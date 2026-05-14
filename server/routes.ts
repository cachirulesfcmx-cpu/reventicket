import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { insertUserSchema, insertEventSchema, insertZoneSchema, insertTicketSchema, insertOrderSchema } from "@shared/schema";
import { whatsappService } from "./whatsapp";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { authLimiter, otpLimiter, checkoutLimiter } from "./middleware/security";
import { pool } from "./db";
import { cache, CacheKeys, CacheTTL, invalidateEventCache, invalidateTicketCache } from "./lib/cache";
import { generateEventSlug, generateEventJsonLd, generateSitemapXml, generateEventMetadata } from "./lib/seo";
import { calculateFees, DEFAULT_FEE_CONFIG } from "./lib/fees";
import { checkPurchaseLimit, recordPurchase, calculateRiskScore, generateFingerprint, hashIP, checkHoneypot, DEFAULT_LIMITS } from "./lib/anti-scalping";
import { getHomeRecommendations, getSimilarEvents, trackEventView, trackAddToCart, trackPurchase as trackRecommendationPurchase } from "./lib/recommendations";
import { csrfTokenEndpoint, validateCSRF, csrfMiddleware } from "./lib/csrf";
import { checkIdempotencyKey, createIdempotencyRecord, completeIdempotencyRecord, failIdempotencyRecord, generateRequestHash } from "./lib/idempotency";
import { assertTransitionAllowed, canUserCancel, canConfirmPayment, type OrderStatus } from "./lib/order-state-machine";
import { emitOrderEvent, getOrderEvents, rebuildOrderState } from "./lib/audit";
import { acquireJobLock, releaseJobLock, getInstanceId } from "./lib/job-locks";
import { getFeeRate } from "./lib/fees";
import enterpriseRoutes from "./routes/enterprise";
import { createPassesForOrder } from "./lib/wallet";
import { trackEvent } from "./lib/analytics";
import { isFeatureEnabled } from "./lib/feature-flags";

import { paymentsRouter } from "./routes/payments";
import { settingsRouter } from "./routes/settings";


declare module "express-session" {
  interface SessionData {
    userId: string;
    csrfToken?: string;
  }
}

const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === "true";
const JOBS_ENABLED = process.env.JOBS_ENABLED === "true";

const isProduction = process.env.NODE_ENV === "production";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const PgSession = connectPgSimple(session);
  
  if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required in production");
  }

  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "dev-only-secret-change-in-production",
      resave: false,
      saveUninitialized: false,
      name: "reventicket.sid",
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
      },
    })
  );

  // CSRF middleware - apply after session
  // CSRF disabled - using CORS + session for security
  // CSRF validation disabled for cross-origin compatibility
  
  // Enterprise routes (analytics, risk, wallet, resale)
  app.use("/api/enterprise", enterpriseRoutes);

  // CSRF token endpoint
  app.get("/api/csrf", csrfTokenEndpoint);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "No autorizado" });
    }
    next();
  };

  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "No autorizado" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Acceso denegado" });
    }
    next();
  };

  // ===== Map Viewer Routes =====
  const fs = await import('fs');
  const path = await import('path');
  
  app.get("/api/maps", async (_req, res) => {
    try {
      const mapsDir = path.join(process.cwd(), 'client', 'public', 'maps');
      let files: string[] = [];
      try {
        files = fs.readdirSync(mapsDir).filter((f: string) => f.endsWith('.svg'));
      } catch {
        files = ['arena-map.svg', 'f1-map.svg', 'estadio-azteca.svg'];
      }
      const maps = files.map((file: string) => {
        const id = file.replace('.svg', '');
        const name = id.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        return { id, name, svgUrl: `/maps/${file}` };
      });
      res.json({ maps });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load maps' });
    }
  });

  app.get("/api/inventory", async (req, res) => {
    try {
      const mapId = req.query.map as string;
      if (!mapId) return res.status(400).json({ error: 'Map ID required' });
      
      const inventoryPath = path.join(process.cwd(), 'data', 'inventory', `${mapId}.json`);
      try {
        const data = fs.readFileSync(inventoryPath, 'utf-8');
        return res.json(JSON.parse(data));
      } catch {
        const defaultZones = [
          { id: 'zone_vip', label: 'VIP Floor', price: 8500, status: 'available' },
          { id: 'zone_platea', label: 'Platea', price: 5500, status: 'available' },
          { id: 'zone_general', label: 'General', price: 2500, status: 'available' }
        ];
        return res.json({ zones: defaultZones, mapId });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to load inventory' });
    }
  });

  app.post("/api/checkout-map", checkoutLimiter, async (req, res) => {
    try {
      const { items, total, mapId } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
      }
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      res.json({ success: true, orderId, items, total, mapId, message: 'Checkout completed' });
    } catch (error) {
      res.status(500).json({ error: 'Checkout failed' });
    }
  });

  // ===== Auth Routes =====
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ error: "El correo ya está registrado" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      // Set session
      req.session.userId = user.id;
      
      res.json({ 
        id: user.id, 
        email: user.email, 
        firstName: user.firstName, 
        lastName: user.lastName,
        role: user.role 
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Error al registrar usuario" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      req.session.userId = user.id;
      
      res.json({ 
        id: user.id, 
        email: user.email, 
        firstName: user.firstName, 
        lastName: user.lastName,
        role: user.role 
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Error al iniciar sesión" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Error al cerrar sesión" });
      }
      res.json({ message: "Sesión cerrada" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      res.json({ 
        id: user.id, 
        email: user.email, 
        firstName: user.firstName, 
        lastName: user.lastName,
        role: user.role 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener usuario" });
    }
  });

  // ===== Venues Routes =====
  app.get("/api/venues", async (req, res) => {
    try {
      const venues = await storage.getAllVenues();
      res.json(venues);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener recintos" });
    }
  });

  app.get("/api/venues/:id", async (req, res) => {
    try {
      const venue = await storage.getVenue(req.params.id);
      if (!venue) {
        return res.status(404).json({ error: "Recinto no encontrado" });
      }
      res.json(venue);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener recinto" });
    }
  });

  app.post("/api/venues", requireAdmin, async (req, res) => {
    try {
      const venue = await storage.createVenue(req.body);
      res.json(venue);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Error al crear recinto" });
    }
  });

  // ===== Events Routes =====
  app.get("/api/events", async (req, res) => {
    try {
      const { category } = req.query;
      let events;
      
      if (category && typeof category === 'string') {
        events = await storage.getEventsByCategory(category);
      } else {
        events = await storage.getAllEvents();
      }
      
      res.json(events);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener eventos" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Evento no encontrado" });
      }
      res.json(event);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener evento" });
    }
  });

  app.post("/api/events", requireAdmin, async (req, res) => {
    try {
      const eventData = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(eventData);
      res.json(event);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Error al crear evento" });
    }
  });

  app.patch("/api/events/:id", requireAdmin, async (req, res) => {
    try {
      const event = await storage.updateEvent(req.params.id, req.body);
      if (!event) {
        return res.status(404).json({ error: "Evento no encontrado" });
      }
      res.json(event);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Error al actualizar evento" });
    }
  });

  app.delete("/api/events/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteEvent(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Evento no encontrado" });
      }
      res.json({ message: "Evento eliminado" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al eliminar evento" });
    }
  });

  // ===== Zones Routes =====
  app.get("/api/events/:eventId/zones", async (req, res) => {
    try {
      const zones = await storage.getZonesByEvent(req.params.eventId);
      res.json(zones);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener zonas" });
    }
  });

  app.post("/api/zones", requireAdmin, async (req, res) => {
    try {
      const zoneData = insertZoneSchema.parse(req.body);
      const zone = await storage.createZone(zoneData);
      res.json(zone);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Error al crear zona" });
    }
  });

  // ===== Tickets Routes =====
  app.get("/api/events/:eventId/tickets", async (req, res) => {
    try {
      const { available } = req.query;
      let tickets;
      
      if (available === 'true') {
        tickets = await storage.getAvailableTicketsByEvent(req.params.eventId);
      } else {
        tickets = await storage.getTicketsByEvent(req.params.eventId);
      }
      
      res.json(tickets);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener boletos" });
    }
  });

  // Get single ticket by ID
  app.get("/api/tickets/:ticketId", async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Boleto no encontrado" });
      }
      // Get zone info to include section name
      const zone = await storage.getZone(ticket.zoneId);
      res.json({ ...ticket, section: zone?.name || "General" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener boleto" });
    }
  });

  app.post("/api/tickets", requireAdmin, async (req, res) => {
    try {
      const ticketData = insertTicketSchema.parse(req.body);
      const ticket = await storage.createTicket(ticketData);
      res.json(ticket);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Error al crear boleto" });
    }
  });

  // ===== Orders Routes =====
  app.get("/api/orders", requireAuth, async (req, res) => {
    try {
      const orders = await storage.getOrdersByUser(req.session.userId!);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener órdenes" });
    }
  });

  app.post("/api/orders", requireAuth, checkoutLimiter, async (req, res) => {
    try {
      const { ticketId, zoneId, eventId, paymentMethod, phone } = req.body;
      const userId = req.session.userId!;
      
      const idempotencyKey = req.headers['idempotency-key'] as string;
      const scope = 'POST:/api/orders';
      
      const intentionData = { ticketId, zoneId, eventId };
      const requestHash = generateRequestHash(intentionData);
      
      if (idempotencyKey) {
        try {
          const idempResult = await checkIdempotencyKey(userId, scope, idempotencyKey, requestHash);
          
          if (!idempResult.isNew && idempResult.existingResponse) {
            return res.status(idempResult.existingResponse.code).json(idempResult.existingResponse.body);
          }
          
          if (idempResult.isNew) {
            await createIdempotencyRecord(userId, scope, idempotencyKey, requestHash);
          }
        } catch (error: any) {
          if (error.message === 'IDEMPOTENCY_KEY_CONFLICT') {
            return res.status(409).json({ 
              error: "Idempotency key ya usada con datos diferentes",
              code: "IDEMPOTENCY_KEY_CONFLICT"
            });
          }
          throw error;
        }
      }
      
      let result;
      
      if (ticketId) {
        result = await storage.atomicPurchaseTicket(
          ticketId,
          userId,
          {
            paymentMethod: paymentMethod || 'card',
            phone,
          }
        );
      } else if (zoneId && eventId) {
        result = await storage.atomicPurchaseByZone(
          eventId,
          zoneId,
          userId,
          {
            paymentMethod: paymentMethod || 'card',
            phone,
          }
        );
      } else {
        if (idempotencyKey) {
          await failIdempotencyRecord(userId, scope, idempotencyKey);
        }
        return res.status(400).json({ error: "Se requiere ticketId o zoneId con eventId" });
      }

      if (!result.success) {
        if (idempotencyKey) {
          await failIdempotencyRecord(userId, scope, idempotencyKey);
        }
        return res.status(result.code || 409).json({ 
          error: result.error,
          code: result.code === 409 ? "TICKET_NOT_AVAILABLE" : "PURCHASE_ERROR"
        });
      }

      const responseBody = {
        ...result.order,
        breakdown: result.breakdown
      };
      
      if (idempotencyKey) {
        await completeIdempotencyRecord(userId, scope, idempotencyKey, 200, responseBody);
      }

      // Track order creation in analytics
      await trackEvent('order_created', {
        userId,
        orderId: result.order.id,
        eventId: eventId || (ticketId ? (await storage.getTicket(ticketId))?.eventId : undefined),
        zoneId,
        sessionHash: req.sessionID,
      });

      res.json(responseBody);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Error al crear orden" });
    }
  });

  // User can only cancel their own orders (NOT set to paid - that's admin only)
  app.patch("/api/orders/:id/status", requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      const userId = req.session.userId!;
      
      if (status !== 'cancelled') {
        return res.status(403).json({ 
          error: "No autorizado. Solo puedes cancelar tu orden.",
          code: "FORBIDDEN_STATUS_CHANGE"
        });
      }

      const existingOrder = await storage.getOrder(req.params.id);
      if (!existingOrder) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }
      
      if (existingOrder.userId !== userId) {
        return res.status(403).json({ error: "No puedes modificar esta orden" });
      }

      if (!canUserCancel(existingOrder.status as OrderStatus)) {
        return res.status(400).json({ 
          error: "No puedes cancelar una orden en este estado",
          code: "INVALID_STATE_TRANSITION"
        });
      }

      const transitionCheck = assertTransitionAllowed(
        existingOrder.status as OrderStatus,
        'cancelled',
        'user'
      );
      
      if (!transitionCheck.allowed) {
        return res.status(409).json({ 
          error: transitionCheck.error,
          code: "INVALID_STATE_TRANSITION"
        });
      }

      const order = await storage.updateOrderStatus(req.params.id, 'cancelled');
      
      if (!order) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }

      await storage.updateTicketStatus(order.ticketId, "available");

      await emitOrderEvent({
        orderId: order.id,
        actorType: 'user',
        actorId: userId,
        eventType: 'cancelled',
        fromStatus: existingOrder.status,
        toStatus: 'cancelled',
        metadata: { reason: 'user_cancelled' }
      });

      // Track cancellation in analytics
      await trackEvent('order_cancelled', {
        userId,
        orderId: order.id,
        sessionHash: req.sessionID,
      });

      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al actualizar orden" });
    }
  });

  // ===== Config Routes (Admin only) =====
  app.get("/api/config/:key", requireAdmin, async (req, res) => {
    try {
      const config = await storage.getConfig(req.params.key);
      res.json(config || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener configuración" });
    }
  });

  app.post("/api/config", requireAdmin, async (req, res) => {
    try {
      const config = await storage.setConfig(req.body);
      res.json(config);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Error al guardar configuración" });
    }
  });

  // ===== WhatsApp Routes (Admin only for security) =====
  app.get("/api/whatsapp/status", requireAdmin, async (req, res) => {
    try {
      if (!WHATSAPP_ENABLED) {
        return res.status(503).json({ 
          error: "WhatsApp está deshabilitado",
          enabled: false 
        });
      }
      const status = whatsappService.getStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener estado de WhatsApp" });
    }
  });

  app.get("/api/whatsapp/qr", requireAdmin, async (req, res) => {
    try {
      if (!WHATSAPP_ENABLED) {
        return res.status(503).json({ 
          error: "WhatsApp está deshabilitado",
          enabled: false 
        });
      }
      const qr = whatsappService.getQRCode();
      res.json({ qr });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener QR" });
    }
  });

  // ===== OTP Routes =====
  app.post("/api/otp/send", otpLimiter, async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ error: "Número de teléfono requerido" });
      }

      const code = whatsappService.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await storage.createOtpCode({ phone, code, expiresAt });

      const sent = await whatsappService.sendOTP(phone, code);
      
      if (!sent) {
        return res.status(500).json({ error: "No se pudo enviar el código. Verifica que WhatsApp esté conectado." });
      }

      res.json({ success: true, message: "Código enviado por WhatsApp" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al enviar OTP" });
    }
  });

  app.post("/api/otp/verify", otpLimiter, async (req, res) => {
    try {
      const { phone, code } = req.body;
      if (!phone || !code) {
        return res.status(400).json({ error: "Teléfono y código requeridos" });
      }

      const otpRecord = await storage.getValidOtpCode(phone, code);
      
      if (!otpRecord) {
        return res.status(400).json({ error: "Código inválido o expirado" });
      }

      await storage.markOtpVerified(otpRecord.id);
      res.json({ success: true, verified: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al verificar OTP" });
    }
  });

  // ===== Cart Routes =====
  app.post("/api/cart", async (req, res) => {
    try {
      const { sessionId, ticketId, eventId, phone } = req.body;
      
      const existingCart = await storage.getCart(sessionId);
      if (existingCart) {
        const updated = await storage.updateCart(existingCart.id, { ticketId, eventId, phone });
        return res.json(updated);
      }

      const cart = await storage.createCart({ sessionId, ticketId, eventId, phone, status: "active" });
      res.json(cart);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Error al crear carrito" });
    }
  });

  app.patch("/api/cart/:id", async (req, res) => {
    try {
      const cart = await storage.updateCart(req.params.id, req.body);
      res.json(cart);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Error al actualizar carrito" });
    }
  });

  // ===== Extended Orders with WhatsApp =====
  app.post("/api/orders/complete", requireAuth, checkoutLimiter, async (req, res) => {
    try {
      const { ticketId, totalAmount, fees, paymentMethod, phone, eventId } = req.body;
      
      if (!ticketId) {
        return res.status(400).json({ error: "ID de boleto requerido" });
      }

      const result = await storage.atomicPurchaseTicket(
        ticketId,
        req.session.userId!,
        {
          totalAmount,
          fees,
          status: paymentMethod === 'card' ? 'paid' : 'pending',
          paymentMethod,
          phone,
        }
      );

      if (!result.success) {
        return res.status(result.code || 400).json({ error: result.error });
      }

      const order = result.order!;
      const ticket = result.ticket!;
      
      if (paymentMethod === 'card') {
        await storage.updateTicketStatus(ticketId, 'sold');
      }

      // Get event and venue details for WhatsApp message
      const event = await storage.getEvent(eventId || ticket.eventId);
      const venue = event ? await storage.getVenue(event.venueId) : null;
      const zone = await storage.getZone(ticket.zoneId);

      if (phone && event && venue) {
        const eventDate = format(new Date(event.date), "EEEE dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
        
        // Send order confirmation
        await whatsappService.sendOrderConfirmation(phone, {
          orderId: order.id,
          eventTitle: event.title,
          eventDate,
          venue: venue.name,
          zone: zone?.name || 'General',
          row: ticket.row,
          seat: ticket.seat,
          total: totalAmount,
          paymentMethod: paymentMethod === 'card' ? 'Tarjeta' : paymentMethod === 'oxxo' ? 'OXXO' : 'Transferencia SPEI'
        });

        // For card payments, send payment confirmed
        if (paymentMethod === 'card') {
          await whatsappService.sendPaymentConfirmed(phone, {
            orderId: order.id,
            eventTitle: event.title,
            total: totalAmount
          });
        } else {
          // For OXXO/SPEI, send payment instructions and schedule reminders
          await whatsappService.sendPaymentInstructions(phone, {
            orderId: order.id,
            eventTitle: event.title,
            total: totalAmount,
            paymentMethod: paymentMethod as 'oxxo' | 'spei',
            reference: order.id.slice(0, 10).toUpperCase()
          });

          // Create payment reminders for 1, 6, and 12 hours
          await storage.createPaymentReminder({ orderId: order.id, hoursAfter: 1 });
          await storage.createPaymentReminder({ orderId: order.id, hoursAfter: 6 });
          await storage.createPaymentReminder({ orderId: order.id, hoursAfter: 12 });
        }
      }

      res.json(order);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Error al completar orden" });
    }
  });

  // Admin: Get all orders
  app.get("/api/admin/orders", requireAdmin, async (req, res) => {
    try {
      const allOrders = await storage.getAllOrders();
      res.json(allOrders);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener órdenes" });
    }
  });

  // Admin: Get order metrics
  app.get("/api/admin/metrics", requireAdmin, async (req, res) => {
    try {
      const metrics = await storage.getOrderMetrics();
      const availableTickets = await storage.getAvailableTicketsByEvent('');
      const allEvents = await storage.getAllEvents();
      
      res.json({
        ...metrics,
        totalEvents: allEvents.length
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener métricas" });
    }
  });

  // Admin: Cancel order
  app.post("/api/admin/orders/:id/cancel", requireAdmin, async (req, res) => {
    try {
      const adminId = req.session.userId!;
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }

      const prevStatus = order.status;
      await storage.updateOrderStatus(order.id, 'cancelled');
      await storage.updateTicketStatus(order.ticketId, 'available');

      await emitOrderEvent({
        orderId: order.id,
        actorType: 'admin',
        actorId: adminId,
        eventType: 'cancelled',
        fromStatus: prevStatus,
        toStatus: 'cancelled',
        metadata: { reason: 'admin_cancelled' }
      });

      // Track cancellation in analytics
      await trackEvent('order_cancelled', {
        userId: order.userId,
        orderId: order.id,
      });

      res.json({ success: true, message: "Orden cancelada" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al cancelar orden" });
    }
  });

  // Admin: View order audit events
  app.get("/api/admin/orders/:id/events", requireAdmin, async (req, res) => {
    try {
      const orderId = req.params.id;
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }

      const events = await getOrderEvents(orderId);
      
      res.json({
        orderId,
        currentStatus: order.status,
        events
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener eventos" });
    }
  });

  // Admin: View order audit with consistency check
  app.get("/api/admin/orders/:id/audit", requireAdmin, async (req, res) => {
    try {
      const orderId = req.params.id;
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }

      const auditResult = await rebuildOrderState(orderId);
      const ticket = await storage.getTicket(order.ticketId);
      
      const inconsistencies = [...auditResult.inconsistencies];
      
      if (order.status === 'paid' && ticket && ticket.status !== 'sold') {
        inconsistencies.push(`Order is paid but ticket status is "${ticket.status}" (expected "sold")`);
      }
      
      if (order.status === 'cancelled' && ticket && ticket.status !== 'available') {
        inconsistencies.push(`Order is cancelled but ticket status is "${ticket.status}" (expected "available")`);
      }
      
      if (auditResult.currentStatus && auditResult.currentStatus !== order.status) {
        inconsistencies.push(`Reconstructed status "${auditResult.currentStatus}" differs from actual "${order.status}"`);
      }

      res.json({
        orderId,
        currentStatus: order.status,
        ticketStatus: ticket?.status,
        reconstructedStatus: auditResult.currentStatus,
        timeline: auditResult.timeline,
        inconsistencies,
        isConsistent: inconsistencies.length === 0
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al obtener auditoría" });
    }
  });

  // Confirm payment (for OXXO/SPEI) - IDEMPOTENT
  app.post("/api/orders/:id/confirm-payment", requireAdmin, async (req, res) => {
    try {
      const adminId = req.session.userId!;
      const orderId = req.params.id;
      
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Orden no encontrada" });
      }

      if (order.status === 'paid') {
        await emitOrderEvent({
          orderId,
          actorType: 'admin',
          actorId: adminId,
          eventType: 'payment_confirmed_idempotent',
          fromStatus: 'paid',
          toStatus: 'paid',
          metadata: { message: 'Already paid, no-op' }
        });
        
        return res.json({ 
          success: true, 
          status: 'already_paid',
          order 
        });
      }

      if (!canConfirmPayment(order.status as OrderStatus)) {
        return res.status(409).json({ 
          error: `No se puede confirmar pago de orden en estado "${order.status}"`,
          code: "INVALID_STATE"
        });
      }

      const transitionCheck = assertTransitionAllowed(
        order.status as OrderStatus,
        'paid',
        'admin'
      );
      
      if (!transitionCheck.allowed) {
        return res.status(409).json({ 
          error: transitionCheck.error,
          code: "INVALID_STATE_TRANSITION"
        });
      }

      const result = await storage.atomicConfirmPayment(orderId, adminId);
      
      if (!result.success) {
        return res.status(result.code || 500).json({ 
          error: result.error,
          code: result.errorCode
        });
      }

      // Create wallet passes automatically
      const passesCreated = await createPassesForOrder(orderId, order.userId);
      if (passesCreated > 0) {
        await emitOrderEvent({
          orderId,
          actorType: 'system',
          actorId: 'wallet',
          eventType: 'wallet_issued',
          fromStatus: 'paid',
          toStatus: 'paid',
          metadata: { passesCreated }
        });
      }

      // Track analytics event
      await trackEvent('payment_confirmed', {
        userId: order.userId,
        orderId,
        eventId: order.ticketId ? (await storage.getTicket(order.ticketId))?.eventId : undefined,
      });

      if (order.phone) {
        const ticket = await storage.getTicket(order.ticketId);
        const event = ticket ? await storage.getEvent(ticket.eventId) : null;
        
        if (event) {
          await whatsappService.sendPaymentConfirmed(order.phone, {
            orderId: order.id,
            eventTitle: event.title,
            total: order.totalAmount
          });
        }
      }

      res.json({ 
        success: true,
        status: 'payment_confirmed',
        order: result.order,
        walletPasses: passesCreated
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Error al confirmar pago" });
    }
  });

  // ===== SEO Routes =====
  
  // Sitemap.xml
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const events = await storage.getAllEvents();
      const venues = await storage.getAllVenues();
      const venueMap = new Map(venues.map((v: { id: string; name: string }) => [v.id, v]));
      
      const eventData = events.map((e: { id: string; title: string; venueId: string; date: Date; category: string; updatedAt?: Date }) => {
        const venue = venueMap.get(e.venueId) as { id: string; name: string } | undefined;
        return {
          id: e.id,
          slug: generateEventSlug(e.title, venue?.name || '', new Date(e.date)),
          category: e.category,
          updatedAt: e.updatedAt || new Date(),
          priority: 0.8
        };
      });
      
      const sitemap = generateSitemapXml(eventData);
      res.header('Content-Type', 'application/xml');
      res.header('Cache-Control', 'public, max-age=3600');
      res.send(sitemap);
    } catch (error) {
      res.status(500).send('Error generating sitemap');
    }
  });

  // Event metadata and JSON-LD
  app.get("/api/events/:id/seo", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) return res.status(404).json({ error: "Evento no encontrado" });
      
      const venue = await storage.getVenue(event.venueId);
      const zones = await storage.getZonesByEvent(event.id);
      const prices = zones.map((z: any) => parseFloat(z.basePrice) || 0).filter((p: number) => p > 0);
      const minPrice = prices.length > 0 ? Math.min(...prices) : undefined;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : undefined;
      
      const slug = generateEventSlug(event.title, venue?.name || '', new Date(event.date));
      
      const metadata = generateEventMetadata({
        id: event.id,
        title: event.title,
        description: event.description || undefined,
        category: event.category,
        date: new Date(event.date),
        venueName: venue?.name || '',
        city: venue?.city || '',
        image: event.image || undefined,
        slug,
        minPrice
      });
      
      const jsonLd = generateEventJsonLd({
        id: event.id,
        title: event.title,
        description: event.description || undefined,
        date: new Date(event.date),
        venueName: venue?.name || '',
        city: venue?.city || '',
        image: event.image || undefined,
        slug,
        category: event.category,
        minPrice,
        maxPrice
      });
      
      res.json({ metadata, jsonLd, slug });
    } catch (error) {
      res.status(500).json({ error: "Error al generar SEO" });
    }
  });

  // ===== Fee Calculation Routes =====
  
  app.post("/api/fees/calculate", (req, res) => {
    try {
      const { ticketPrice, quantity, includeInsurance, category } = req.body;
      
      if (!ticketPrice || !quantity) {
        return res.status(400).json({ error: "Precio y cantidad requeridos" });
      }
      
      const fees = calculateFees(ticketPrice, quantity, {
        includeInsurance: includeInsurance || false,
        category
      });
      
      res.json(fees);
    } catch (error) {
      res.status(500).json({ error: "Error al calcular tarifas" });
    }
  });

  app.get("/api/fees/config", requireAdmin, (_req, res) => {
    res.json(DEFAULT_FEE_CONFIG);
  });

  // ===== Recommendations Routes =====
  
  app.get("/api/reco/home", async (req, res) => {
    try {
      const city = req.query.city as string | undefined;
      const events = await storage.getAllEvents();
      const venues = await storage.getAllVenues();
      const venueMap = new Map(venues.map((v: any) => [v.id, v]));
      
      const eventData = events.map((e: any) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        city: (venueMap.get(e.venueId) as any)?.city || '',
        venueId: e.venueId,
        date: new Date(e.date),
        tags: e.tags || []
      }));
      
      const recommendations = getHomeRecommendations(eventData, undefined, city);
      
      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener recomendaciones" });
    }
  });

  app.get("/api/reco/similar/:eventId", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.eventId);
      if (!event) return res.status(404).json({ error: "Evento no encontrado" });
      
      const allEvents = await storage.getAllEvents();
      const venues = await storage.getAllVenues();
      const venueMap = new Map(venues.map((v: any) => [v.id, v]));
      
      const sourceEvent = {
        id: event.id,
        title: event.title,
        category: event.category,
        city: (venueMap.get(event.venueId) as any)?.city || '',
        venueId: event.venueId,
        date: new Date(event.date),
        tags: event.tags || []
      };
      
      const eventData = allEvents.map((e: any) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        city: (venueMap.get(e.venueId) as any)?.city || '',
        venueId: e.venueId,
        date: new Date(e.date),
        tags: e.tags || []
      }));
      
      const similar = getSimilarEvents(sourceEvent, eventData, 6);
      
      res.json(similar);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener similares" });
    }
  });

  // Track event view for recommendations
  app.post("/api/track/view", async (req, res) => {
    try {
      const { eventId } = req.body;
      const event = await storage.getEvent(eventId);
      if (event) {
        const venue = await storage.getVenue(event.venueId);
        trackEventView(eventId, event.category, venue?.city || '');
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al registrar vista" });
    }
  });

  // ===== Performance Metrics (Admin) =====
  
  const apiTimings: { route: string; duration: number; timestamp: number }[] = [];
  const MAX_TIMINGS = 1000;

  // Middleware to track API timings
  app.use("/api", (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      apiTimings.push({ route: `${req.method} ${req.path}`, duration, timestamp: Date.now() });
      if (apiTimings.length > MAX_TIMINGS) {
        apiTimings.shift();
      }
      if (duration > 500) {
        console.warn(`[SLOW] ${req.method} ${req.path}: ${duration}ms`);
      }
    });
    next();
  });

  app.get("/api/admin/performance", requireAdmin, async (_req, res) => {
    try {
      const now = Date.now();
      const last5min = apiTimings.filter(t => now - t.timestamp < 5 * 60 * 1000);
      
      // Group by route
      const byRoute = new Map<string, number[]>();
      for (const t of last5min) {
        const times = byRoute.get(t.route) || [];
        times.push(t.duration);
        byRoute.set(t.route, times);
      }
      
      const routeStats = Array.from(byRoute.entries()).map(([route, times]) => ({
        route,
        count: times.length,
        avgMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        maxMs: Math.max(...times),
        minMs: Math.min(...times)
      })).sort((a, b) => b.avgMs - a.avgMs);
      
      const slowQueries = last5min.filter(t => t.duration > 200).length;
      const avgResponseTime = last5min.length > 0 
        ? Math.round(last5min.reduce((a, b) => a + b.duration, 0) / last5min.length)
        : 0;
      
      const cacheStats = cache.getStats();
      
      res.json({
        period: "5min",
        totalRequests: last5min.length,
        avgResponseTimeMs: avgResponseTime,
        slowQueries,
        routeStats: routeStats.slice(0, 20),
        cacheSize: cacheStats.size,
        cacheKeys: cacheStats.keys.slice(0, 50)
      });
    } catch (error) {
      res.status(500).json({ error: "Error al obtener métricas" });
    }
  });

  // ===== Anti-Scalping Check =====
  
  app.post("/api/anti-scalping/check", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const { eventId } = req.body;
      
      const limitCheck = checkPurchaseLimit(`user:${userId}:event:${eventId}`, DEFAULT_LIMITS);
      
      res.json({
        allowed: limitCheck.allowed,
        remaining: limitCheck.remaining,
        resetInSeconds: limitCheck.resetIn,
        maxPerUser: DEFAULT_LIMITS.maxPerUser
      });
    } catch (error) {
      res.status(500).json({ error: "Error al verificar límites" });
    }
  });

  // Initialize WhatsApp bot only if enabled
  if (WHATSAPP_ENABLED) {
    console.log("WhatsApp habilitado, inicializando...");
    whatsappService.initialize().catch(console.error);
  } else {
    console.log("WhatsApp deshabilitado (WHATSAPP_ENABLED !== 'true')");
  }

  // Background jobs only if enabled
  if (JOBS_ENABLED) {
    console.log(`Jobs de fondo habilitados, iniciando intervalos... (instance: ${getInstanceId()})`);
    
    // Background job for abandoned cart reminders (check every 5 minutes)
    setInterval(async () => {
      const lockAcquired = await acquireJobLock('background_jobs', 120);
      
      if (!lockAcquired) {
        console.log('Background job lock not acquired, skipping this run');
        return;
      }
      
      try {
        // Check for abandoned carts (30 minutes old)
        const abandonedCarts = await storage.getAbandonedCarts(30);
        
        for (const cart of abandonedCarts) {
          if (cart.phone && cart.eventId) {
            const event = await storage.getEvent(cart.eventId);
            const venue = event ? await storage.getVenue(event.venueId) : null;
            
            if (event && venue) {
              const eventDate = format(new Date(event.date), "EEEE dd 'de' MMMM 'de' yyyy", { locale: es });
              
              await whatsappService.sendAbandonedCartReminder(cart.phone, {
                eventTitle: event.title,
                eventDate,
                venue: venue.name
              });
              
              await storage.updateCart(cart.id, { reminderSent: true });
            }
          }
        }

        // Check for pending payment reminders
        const pendingOrders = await storage.getPendingOrdersOlderThan(0);
        
        for (const order of pendingOrders) {
          if (!order.phone) continue;
          
          const orderAge = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60); // hours
          const reminders = await storage.getPendingReminders(order.id);
          
          for (const reminder of reminders) {
            if (orderAge >= reminder.hoursAfter) {
              const ticket = await storage.getTicket(order.ticketId);
              const event = ticket ? await storage.getEvent(ticket.eventId) : null;
              
              if (event) {
                const hoursRemaining = 24 - orderAge;
                await whatsappService.sendPaymentReminder(order.phone, {
                  orderId: order.id,
                  eventTitle: event.title,
                  total: order.totalAmount,
                  hoursRemaining: Math.max(0, hoursRemaining)
                });
                
                await storage.markReminderSent(reminder.id);
              }
            }
          }
        }
        
        // Expire old reservations (15 minutes for pending OXXO/SPEI payments)
        const expiredCount = await storage.expireReservedTicketsWithAudit(15);
        if (expiredCount > 0) {
          console.log(`Expired ${expiredCount} reserved tickets`);
        }
      } catch (error) {
        console.error("Error in background job:", error);
      } finally {
        await releaseJobLock('background_jobs');
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  } else {
    console.log("Jobs de fondo deshabilitados (JOBS_ENABLED !== 'true')");
  }

  
  app.use("/api/payments", paymentsRouter);
  app.use("/api/settings", settingsRouter);

  
  // Toggle featured status
  app.patch("/api/events/:id/featured", async (req, res) => {
    try {
      const { id } = req.params;
      const { isFeatured } = req.body;
      await db.update(events).set({ isFeatured: Boolean(isFeatured) }).where(eq(events.id, id));
      res.json({ success: true, isFeatured: Boolean(isFeatured) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}

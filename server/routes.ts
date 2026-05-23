import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { signToken, verifyToken, requireJWT, requireJWTAdmin } from "./lib/jwt-auth";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { insertUserSchema, insertEventSchema, insertZoneSchema, insertTicketSchema, insertOrderSchema } from "@shared/schema";
import { whatsappService } from "./whatsapp";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { authLimiter, otpLimiter, checkoutLimiter } from "./middleware/security";
import { pool } from "./db";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { discountCodes, eventMaps } from "@shared/schema";
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
import {
  ensurePushTable,
  saveSubscription,
  removeSubscription,
  sendPushToAdmins,
  vapidPublicKey,
  pushEnabled,
} from "./lib/push-notifications";


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
        sameSite: isProduction ? "none" : "lax",
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

  // VAPID public key (no auth needed — es pública por diseño)
  app.get("/api/push/vapid-public-key", (_req, res) => {
    res.json({ publicKey: vapidPublicKey, enabled: pushEnabled });
  });

  // Auth middleware
  const requireAuth = async (req: any, res: any, next: any) => {
    // Intento 1: sesion por cookie
    let userId = req.session?.userId;

    // Intento 2: JWT en Authorization header
    if (!userId) {
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        try {
          const jwt = require("jsonwebtoken");
          const payload: any = jwt.verify(token, process.env.JWT_SECRET || process.env.SESSION_SECRET || "");
          userId = payload.userId || payload.id || payload.sub;
          // Adjuntar userId al session para que el resto del codigo lo encuentre
          if (req.session) req.session.userId = userId;
        } catch (e) {
          // token invalido
        }
      }
    }

    if (!userId) {
      return res.status(401).json({ error: "No autorizado" });
    }
    next();
  };

  const requireAdmin = async (req: any, res: any, next: any) => {
    // Intento 1: sesión por cookie
    let userId = req.session?.userId;

    // Intento 2: JWT en Authorization header
    if (!userId) {
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        try {
          const jwt = require("jsonwebtoken");
          const payload: any = jwt.verify(token, process.env.JWT_SECRET || process.env.SESSION_SECRET || "");
          userId = payload.userId || payload.id || payload.sub;
        } catch (e) {
          // token invalido, continuar para devolver 401
        }
      }
    }

    if (!userId) {
      return res.status(401).json({ error: "No autorizado" });
    }
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Acceso denegado" });
    }
    // Adjuntar user al request para uso posterior
    req.user = user;
    next();
  };

  // ── Push Notification Routes (protected) ─────────────────────────────────
  app.post("/api/push/subscribe", requireAdmin, async (req: any, res) => {
    try {
      const { subscription } = req.body;
      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return res.status(400).json({ error: "Suscripción inválida" });
      }
      const userId = req.session?.userId || req.user?.id;
      await saveSubscription(userId, subscription, "admin");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/push/unsubscribe", requireAdmin, async (req: any, res) => {
    try {
      const { endpoint } = req.body;
      if (endpoint) await removeSubscription(endpoint);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

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


  // ── JWT Login (para admin panel - cross-domain compatible) ──────────────────
  app.post("/api/auth/jwt-login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email y contraseña requeridos" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      // Check env bypass first
      const adminPass = process.env.ADMIN_PASSWORD;
      let valid = false;
      if (adminPass && user.role === "admin" && password === adminPass) {
        valid = true;
      } else {
        valid = await bcrypt.compare(password, user.password);
      }

      if (!valid) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      const token = signToken({ userId: user.id, email: user.email, role: user.role });

      res.json({
        token,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // JWT verify endpoint
  app.get("/api/auth/jwt-me", requireJWT, (req, res) => {
    res.json({ user: (req as any).jwtUser });
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      // Admin bypass: check env var first (for admin account only)
      const adminPass = process.env.ADMIN_PASSWORD;
      let validPassword = false;
      
      if (adminPass && user.role === "admin" && password === adminPass) {
        validPassword = true;
      } else {
        validPassword = await bcrypt.compare(password, user.password);
      }
      
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

  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.id;
      if (!userId) return res.status(401).json({ error: "No autorizado" });

      const user = await storage.getUser(userId);
      if (!user) {
        // Si el usuario fue creado por OTP y no está en BD, retornar 401 sin error 500
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
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

      // En modo dev (sin WhatsApp), devolver el código en la respuesta para facilitar pruebas
      if (!sent && !isProduction) {
        console.log(`[DEV] OTP para ${phone}: ${code}`);
        return res.json({
          success: true,
          message: "Código generado (modo dev — WhatsApp no conectado)",
          devCode: code, // Solo visible en desarrollo
        });
      }

      if (!sent) {
        return res.status(500).json({ error: "No se pudo enviar el código. Verifica que WhatsApp esté conectado en el panel admin." });
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

      // Buscar o crear usuario por teléfono (email sintético)
      const phoneEmail = `${phone}@reventicket.mx`;
      let user = await storage.getUserByEmail(phoneEmail);
      if (!user) {
        // Usuario nuevo — crear con datos mínimos
        const randomPw = Math.random().toString(36) + Date.now().toString(36);
        const hashedPw = await bcrypt.hash(randomPw, 10);
        user = await storage.createUser({
          email: phoneEmail,
          password: hashedPw,
          firstName: "Usuario",
          lastName: phone.slice(-4), // últimos 4 dígitos como apellido temporal
          role: "buyer",
        });
      }

      // Crear sesión
      req.session.userId = user.id;
      await new Promise<void>((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve()))
      );

      // También devolver JWT para clientes que lo prefieran
      const token = signToken({ userId: user.id, role: user.role });

      res.json({
        success: true,
        verified: true,
        user: { id: user.id, role: user.role, firstName: user.firstName },
        token,
      });
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
      const { ticketId, zoneId, quantity, totalAmount, fees, paymentMethod, phone, eventId } = req.body;
      const userId = req.session.userId!;

      // ── Compra multi-boleto (por zona + cantidad) ──────────────────────────
      if (!ticketId && zoneId && quantity && quantity > 1) {
        const qty = Math.min(parseInt(quantity, 10), 4);
        const orders = [];
        const purchasedTickets = [];

        for (let i = 0; i < qty; i++) {
          const result = await storage.atomicPurchaseByZone(eventId, zoneId, userId, {
            status: paymentMethod === 'card' ? 'paid' : 'pending',
            paymentMethod,
            phone,
          });
          if (!result.success) {
            // Si falla alguno, los anteriores ya están reservados — continúa con los que se pudieron
            break;
          }
          orders.push(result.order!);
          purchasedTickets.push(result.ticket!);
          if (paymentMethod === 'card') {
            await storage.updateTicketStatus(result.ticket!.id, 'sold');
          }
        }

        if (orders.length === 0) {
          return res.status(409).json({ error: "No hay boletos disponibles en esta zona" });
        }

        // Notificaciones para multi-boleto
        const event = await storage.getEvent(eventId);
        const venue = event ? await storage.getVenue(event.venueId) : null;
        const zone = await storage.getZone(zoneId);
        const firstOrder = orders[0];
        const firstTicket = purchasedTickets[0];

        if (phone && event && venue) {
          const eventDate = format(new Date(event.date), "EEEE dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
          await whatsappService.sendOrderConfirmation(phone, {
            orderId: firstOrder.id,
            eventTitle: event.title,
            eventDate,
            venue: venue.name,
            zone: zone?.name || 'General',
            row: `${firstTicket.row}–${purchasedTickets[purchasedTickets.length-1].row}`,
            seat: `${orders.length} boletos`,
            total: totalAmount,
            paymentMethod: paymentMethod === 'card' ? 'Tarjeta' : paymentMethod === 'oxxo' ? 'OXXO' : 'SPEI'
          });
        }

        // Notificación admin
        const adminPhone = process.env.ADMIN_WHATSAPP_PHONE;
        if (adminPhone && whatsappService.isEnabled()) {
          const msg = `🎉 *NUEVA VENTA (${orders.length} boletos) — RevenTicket*\n\n` +
            `🎪 ${event?.title || "—"}\n💰 Total: $${totalAmount} MXN\n📱 ${phone || "—"}`;
          await whatsappService.sendMessage(adminPhone, msg).catch(() => {});
        }
        sendPushToAdmins({ title: `💰 ${orders.length} boletos — $${totalAmount} MXN`, body: event?.title || "", url: "/portal-admin/dashboard", tag: `order-multi-${firstOrder.id}` }).catch(() => {});

        return res.json({ id: firstOrder.id, orders: orders.map(o => o.id), count: orders.length });
      }

      // ── Compra de boleto único ─────────────────────────────────────────────
      if (!ticketId) {
        return res.status(400).json({ error: "ID de boleto requerido" });
      }

      const result = await storage.atomicPurchaseTicket(
        ticketId,
        userId,
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
        // Crear wallet pass automáticamente en pago con tarjeta
        createPassesForOrder(order.id, userId).catch(e =>
          console.error("[Wallet] Error creando passes:", e)
        );
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

      // ── Notificaciones al admin (WhatsApp + Push) ─────────────────────────
      const adminPhoneCard = process.env.ADMIN_WHATSAPP_PHONE;
      const eventTitle = event?.title || "—";
      const payLabel = paymentMethod === 'card' ? 'Tarjeta ✅' : paymentMethod === 'oxxo' ? 'OXXO (pendiente)' : 'SPEI (pendiente)';

      // WhatsApp al admin
      if (adminPhoneCard && whatsappService.isEnabled()) {
        try {
          const adminMsgCard =
            `🎉 *NUEVA VENTA — RevenTicket*\n\n` +
            `📋 Orden: #${order.id.slice(0, 8)}\n` +
            `🎪 Evento: ${eventTitle}\n` +
            `💰 Total: $${totalAmount} MXN\n` +
            `💳 Pago: ${payLabel}\n` +
            `📱 Cliente: ${phone || "—"}\n` +
            `🕐 ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`;
          await whatsappService.sendMessage(adminPhoneCard, adminMsgCard);
        } catch (notifErr) {
          console.error("[Admin WA] Error notificando al admin:", notifErr);
        }
      }

      // Push al admin
      sendPushToAdmins({
        title: `💰 Nueva venta — $${totalAmount} MXN`,
        body: `${eventTitle} · ${payLabel} · Orden #${order.id.slice(0, 8)}`,
        url: "/portal-admin/dashboard",
        tag: `order-${order.id}`,
      }).catch((e) => console.error("[PushNotif] Error enviando push:", e));

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
          // WhatsApp al comprador
          await whatsappService.sendPaymentConfirmed(order.phone, {
            orderId: order.id,
            eventTitle: event.title,
            total: order.totalAmount
          });
        }
      }

      // ── Notificaciones al admin (WhatsApp + Push) ───────────────────────
      const adminPhone = process.env.ADMIN_WHATSAPP_PHONE;
      const confTicket = order.ticketId ? await storage.getTicket(order.ticketId) : null;
      const confEvent  = confTicket ? await storage.getEvent(confTicket.eventId) : null;
      const confTitle  = confEvent?.title || "—";

      if (adminPhone && whatsappService.isEnabled()) {
        try {
          const adminMsg =
            `✅ *PAGO CONFIRMADO — RevenTicket*\n\n` +
            `📋 Orden: #${order.id.slice(0, 8)}\n` +
            `🎪 Evento: ${confTitle}\n` +
            `💰 Total: $${order.totalAmount} MXN\n` +
            `💳 Método: ${order.paymentMethod || "—"}\n` +
            `📱 Cliente: ${order.phone || "—"}\n` +
            `🕐 ${new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}`;
          await whatsappService.sendMessage(adminPhone, adminMsg);
        } catch (notifErr) {
          console.error("[Admin WA] Error enviando notificación al admin:", notifErr);
        }
      }

      // Push al admin
      sendPushToAdmins({
        title: `✅ Pago confirmado — $${order.totalAmount} MXN`,
        body: `${confTitle} · Orden #${order.id.slice(0, 8)}`,
        url: "/portal-admin/dashboard",
        tag: `confirm-${order.id}`,
      }).catch((e) => console.error("[PushNotif] Error enviando push:", e));

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

  // Initialize push notifications table
  ensurePushTable().catch((e) => console.error("[PushNotif] Error creando tabla:", e));

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

        // ── Job: enviar boleto 24h antes del evento ───────────────────────
        if (WHATSAPP_ENABLED && whatsappService.isEnabled()) {
          try {
            const frontendUrl = process.env.FRONTEND_URL || "https://reventicket.up.railway.app";
            const now = new Date();
            const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

            // Aseguramos la columna existe (idempotente)
            await pool.query(`
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS ticket_notified_at TIMESTAMP;
            `);

            const result = await pool.query<{
              order_id: string; phone: string; total_amount: string;
              ticket_id: string; row: string; seat: string; price: string;
              event_title: string; event_date: Date;
              venue_name: string; venue_city: string; zone_name: string;
            }>(
              `SELECT o.id as order_id, o.phone, o.total_amount,
                      t.id as ticket_id, t.row, t.seat, t.price,
                      e.title as event_title, e.date as event_date,
                      v.name as venue_name, v.city as venue_city,
                      z.name as zone_name
               FROM orders o
               JOIN tickets t ON t.id = o.ticket_id
               JOIN events e ON e.id = t.event_id
               JOIN venues v ON v.id = e.venue_id
               JOIN zones  z ON z.id = t.zone_id
               WHERE o.status = 'paid'
                 AND e.date BETWEEN $1 AND $2
                 AND o.ticket_notified_at IS NULL
                 AND o.phone IS NOT NULL`,
              [in24h, in25h]
            );

            for (const row of result.rows) {
              const eventDate = format(new Date(row.event_date), "EEEE dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
              const sent = await whatsappService.sendTicket24hBefore(row.phone, {
                orderId: row.order_id,
                eventTitle: row.event_title,
                eventDate,
                venue: row.venue_name,
                city: row.venue_city,
                zone: row.zone_name,
                row: row.row,
                seat: row.seat,
                price: row.price,
                walletUrl: `${frontendUrl}/wallet`,
              });
              if (sent) {
                await pool.query(
                  `UPDATE orders SET ticket_notified_at = NOW() WHERE id = $1`,
                  [row.order_id]
                );
                console.log(`[24h Job] Boleto enviado a ${row.phone} para orden ${row.order_id}`);
              }
            }
          } catch (jobErr) {
            console.error("[24h Job] Error enviando boletos:", jobErr);
          }
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

  

  // ─── DISCOUNT CODES ───────────────────────────────────────────────────────────

  app.get("/api/discounts", requireAdmin, async (req, res) => {
    try {
      const codes = await db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt));
      res.json(codes);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/discounts", requireAdmin, async (req, res) => {
    try {
      const { code, description, type, value, minOrderAmount, maxUses, isActive, expiresAt } = req.body;
      if (!code || !value || !type) return res.status(400).json({ error: "code, type y value son requeridos" });
      const [created] = await db.insert(discountCodes).values({
        code: code.toUpperCase().trim(), description: description || null, type,
        value: String(value), minOrderAmount: minOrderAmount ? String(minOrderAmount) : null,
        maxUses: maxUses ? parseInt(maxUses) : null, isActive: isActive !== false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }).returning();
      res.status(201).json(created);
    } catch (err: any) {
      if (err.code === "23505") return res.status(409).json({ error: "Ese código ya existe" });
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/discounts/:id", requireAdmin, async (req, res) => {
    try {
      const updates: any = {};
      if (req.body.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.maxUses !== undefined) updates.maxUses = req.body.maxUses ? parseInt(req.body.maxUses) : null;
      if (req.body.expiresAt !== undefined) updates.expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
      const [updated] = await db.update(discountCodes).set(updates).where(eq(discountCodes.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ error: "Cupón no encontrado" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/discounts/:id", requireAdmin, async (req, res) => {
    try {
      await db.delete(discountCodes).where(eq(discountCodes.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/discounts/validate", async (req, res) => {
    try {
      const { code, orderAmount } = req.body;
      if (!code) return res.status(400).json({ error: "Código requerido" });
      const [discount] = await db.select().from(discountCodes).where(eq(discountCodes.code, code.toUpperCase().trim())).limit(1);
      if (!discount) return res.status(404).json({ error: "Código no válido" });
      if (!discount.isActive) return res.status(400).json({ error: "Este código no está activo" });
      if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) return res.status(400).json({ error: "Este código ha expirado" });
      if (discount.maxUses && discount.usedCount >= discount.maxUses) return res.status(400).json({ error: "Este código ya alcanzó su límite de usos" });
      if (discount.minOrderAmount && orderAmount < parseFloat(discount.minOrderAmount)) return res.status(400).json({ error: `Monto mínimo de $${parseFloat(discount.minOrderAmount).toLocaleString()} MXN requerido` });
      const discountAmount = discount.type === "percent" ? (orderAmount * parseFloat(discount.value)) / 100 : Math.min(parseFloat(discount.value), orderAmount);
      res.json({ valid: true, discount, discountAmount: Math.round(discountAmount) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── EVENT MAPS ───────────────────────────────────────────────────────────────

  app.get("/api/event-maps", requireAdmin, async (req, res) => {
    try {
      const maps = await db.select().from(eventMaps).orderBy(desc(eventMaps.createdAt));
      res.json(maps);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/event-maps/event/:eventId", async (req, res) => {
    try {
      const maps = await db.select().from(eventMaps).where(eq(eventMaps.eventId, req.params.eventId));
      res.json(maps);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/event-maps", requireAdmin, async (req, res) => {
    try {
      const { eventId, name, imageUrl, svgData, sections } = req.body;
      if (!eventId || !name) return res.status(400).json({ error: "eventId y name son requeridos" });
      const [created] = await db.insert(eventMaps).values({
        eventId, name, imageUrl: imageUrl || null, svgData: svgData || null, sections: sections || [],
      }).returning();
      res.status(201).json(created);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/event-maps/:id", requireAdmin, async (req, res) => {
    try {
      const updates: any = { updatedAt: new Date() };
      const { name, imageUrl, svgData, sections } = req.body;
      if (name !== undefined) updates.name = name;
      if (imageUrl !== undefined) updates.imageUrl = imageUrl;
      if (svgData !== undefined) updates.svgData = svgData;
      if (sections !== undefined) updates.sections = sections;
      const [updated] = await db.update(eventMaps).set(updates).where(eq(eventMaps.id, req.params.id)).returning();
      if (!updated) return res.status(404).json({ error: "Mapa no encontrado" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/event-maps/:id", requireAdmin, async (req, res) => {
    try {
      await db.delete(eventMaps).where(eq(eventMaps.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });


  // ─── VENUE MAPS (reutilizables, sin evento) ──────────────────────────────────

  // Helper: normalise a venue_maps row to camelCase for the client
  const normaliseMap = (r: any) => ({
    id: r.id,
    name: r.name,
    imageUrl: r.image_url ?? r.imageUrl ?? null,
    sections: (() => {
      const s = r.sections;
      if (!s) return [];
      if (typeof s === "string") { try { return JSON.parse(s); } catch { return []; } }
      return Array.isArray(s) ? s : [];
    })(),
    createdAt: r.created_at ?? r.createdAt,
  });

  app.get("/api/venue-maps", requireAdmin, async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM venue_maps ORDER BY created_at DESC");
      res.json(result.rows.map(normaliseMap));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/venue-maps", requireAdmin, async (req, res) => {
    try {
      const { name, imageUrl, sections } = req.body;
      if (!name) return res.status(400).json({ error: "name es requerido" });
      const result = await pool.query(
        "INSERT INTO venue_maps (name, image_url, sections) VALUES ($1, $2, $3) RETURNING *",
        [name, imageUrl || null, JSON.stringify(sections || [])]
      );
      res.status(201).json(normaliseMap(result.rows[0]));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/venue-maps/:id", requireAdmin, async (req, res) => {
    try {
      const { name, imageUrl, sections } = req.body;
      const result = await pool.query(
        "UPDATE venue_maps SET name=COALESCE($1,name), image_url=COALESCE($2,image_url), sections=COALESCE($3,sections), updated_at=NOW() WHERE id=$4 RETURNING *",
        [name||null, imageUrl||null, sections ? JSON.stringify(sections) : null, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: "Mapa no encontrado" });
      res.json(normaliseMap(result.rows[0]));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/venue-maps/:id", requireAdmin, async (req, res) => {
    try {
      await pool.query("DELETE FROM venue_maps WHERE id=$1", [req.params.id]);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

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

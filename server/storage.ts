import {
  type User,
  type InsertUser,
  type Venue,
  type InsertVenue,
  type Event,
  type InsertEvent,
  type Zone,
  type InsertZone,
  type Ticket,
  type InsertTicket,
  type Order,
  type InsertOrder,
  type Config,
  type InsertConfig,
  type OtpCode,
  type InsertOtpCode,
  type Cart,
  type InsertCart,
  type PaymentReminder,
  type InsertPaymentReminder,
  type OrderEvent,
  users,
  venues,
  events,
  zones,
  tickets,
  orders,
  config,
  otpCodes,
  carts,
  paymentReminders,
  orderEvents,
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, desc, gte, lt, isNull, sql } from "drizzle-orm";
import { getFeeRate, calculateServerFees } from "./lib/fees";

export interface AtomicPurchaseResult {
  success: boolean;
  order?: Order;
  ticket?: Ticket;
  error?: string;
  code?: number;
  breakdown?: {
    ticketPrice: number;
    fees: number;
    totalAmount: number;
    feeRateUsed: number;
  };
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Venues
  getAllVenues(): Promise<Venue[]>;
  getVenue(id: string): Promise<Venue | undefined>;
  createVenue(venue: InsertVenue): Promise<Venue>;
  updateVenue(id: string, venue: Partial<InsertVenue>): Promise<Venue | undefined>;
  
  // Events
  getAllEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  getEventsByCategory(category: string): Promise<Event[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<boolean>;
  
  // Zones
  getZonesByEvent(eventId: string): Promise<Zone[]>;
  getZone(id: string): Promise<Zone | undefined>;
  createZone(zone: InsertZone): Promise<Zone>;
  
  // Tickets
  getTicketsByEvent(eventId: string): Promise<Ticket[]>;
  getTicketsByZone(zoneId: string): Promise<Ticket[]>;
  getAvailableTicketsByEvent(eventId: string): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicketStatus(id: string, status: string): Promise<Ticket | undefined>;
  
  // Orders
  getOrdersByUser(userId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  
  // Config
  getConfig(key: string): Promise<Config | undefined>;
  setConfig(configData: InsertConfig): Promise<Config>;
  
  // OTP
  createOtpCode(otp: InsertOtpCode): Promise<OtpCode>;
  getValidOtpCode(phone: string, code: string): Promise<OtpCode | undefined>;
  markOtpVerified(id: string): Promise<OtpCode | undefined>;
  
  // Carts
  createCart(cart: InsertCart): Promise<Cart>;
  getCart(sessionId: string): Promise<Cart | undefined>;
  updateCart(id: string, updates: Partial<Cart>): Promise<Cart | undefined>;
  getAbandonedCarts(olderThanMinutes: number): Promise<Cart[]>;
  
  // Payment Reminders
  createPaymentReminder(reminder: InsertPaymentReminder): Promise<PaymentReminder>;
  getPendingReminders(orderId: string): Promise<PaymentReminder[]>;
  markReminderSent(id: string): Promise<PaymentReminder | undefined>;
  getDueReminders(): Promise<PaymentReminder[]>;
  
  // Orders extended
  getOrder(id: string): Promise<Order | undefined>;
  getPendingOrdersOlderThan(hours: number): Promise<Order[]>;
  updateOrderPhone(id: string, phone: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  
  // Atomic purchase (prevents double selling)
  atomicPurchaseTicket(ticketId: string, userId: string, orderData: Partial<InsertOrder>): Promise<AtomicPurchaseResult>;
  
  // Get available ticket by zone
  getAvailableTicketByZone(eventId: string, zoneId: string): Promise<Ticket | undefined>;
  
  // Atomic purchase by zone (selects and reserves in one transaction)
  atomicPurchaseByZone(eventId: string, zoneId: string, userId: string, orderData: Partial<InsertOrder>): Promise<AtomicPurchaseResult>;
  
  // Expiration management
  expireReservedTickets(minutesOld: number): Promise<number>;
  getOrderMetrics(): Promise<{ pending: number; paid: number; cancelled: number; totalRevenue: string }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Venues
  async getAllVenues(): Promise<Venue[]> {
    return await db.select().from(venues);
  }

  async getVenue(id: string): Promise<Venue | undefined> {
    const result = await db.select().from(venues).where(eq(venues.id, id)).limit(1);
    return result[0];
  }

  async createVenue(venue: InsertVenue): Promise<Venue> {
    const result = await db.insert(venues).values(venue).returning();
    return result[0];
  }

  async updateVenue(id: string, venue: Partial<InsertVenue>): Promise<Venue | undefined> {
    const result = await db.update(venues).set(venue).where(eq(venues.id, id)).returning();
    return result[0];
  }

  // Events
  async getAllEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(desc(events.date));
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const result = await db.select().from(events).where(eq(events.id, id)).limit(1);
    return result[0];
  }

  async getEventsByCategory(category: string): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.category, category)).orderBy(desc(events.date));
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const result = await db.insert(events).values(event).returning();
    return result[0];
  }

  async updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event | undefined> {
    const result = await db.update(events).set(event).where(eq(events.id, id)).returning();
    return result[0];
  }

  async deleteEvent(id: string): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id)).returning();
    return result.length > 0;
  }

  // Zones
  async getZonesByEvent(eventId: string): Promise<Zone[]> {
    return await db.select().from(zones).where(eq(zones.eventId, eventId));
  }

  async getZone(id: string): Promise<Zone | undefined> {
    const result = await db.select().from(zones).where(eq(zones.id, id)).limit(1);
    return result[0];
  }

  async createZone(zone: InsertZone): Promise<Zone> {
    const result = await db.insert(zones).values(zone).returning();
    return result[0];
  }

  // Tickets
  async getTicketsByEvent(eventId: string): Promise<Ticket[]> {
    return await db.select().from(tickets).where(eq(tickets.eventId, eventId));
  }

  async getTicketsByZone(zoneId: string): Promise<Ticket[]> {
    return await db.select().from(tickets).where(eq(tickets.zoneId, zoneId));
  }

  async getAvailableTicketsByEvent(eventId: string): Promise<Ticket[]> {
    return await db.select().from(tickets)
      .where(and(eq(tickets.eventId, eventId), eq(tickets.status, "available")));
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    const result = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    return result[0];
  }

  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    const result = await db.insert(tickets).values(ticket).returning();
    return result[0];
  }

  async updateTicketStatus(id: string, status: string): Promise<Ticket | undefined> {
    const result = await db.update(tickets).set({ status }).where(eq(tickets.id, id)).returning();
    return result[0];
  }

  // Orders
  async getOrdersByUser(userId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values(order).returning();
    return result[0];
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const result = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    return result[0];
  }

  // Config
  async getConfig(key: string): Promise<Config | undefined> {
    const result = await db.select().from(config).where(eq(config.key, key)).limit(1);
    return result[0];
  }

  async setConfig(configData: InsertConfig): Promise<Config> {
    const existing = await this.getConfig(configData.key);
    if (existing) {
      const result = await db.update(config)
        .set({ value: configData.value, updatedAt: new Date() })
        .where(eq(config.key, configData.key))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(config).values(configData).returning();
      return result[0];
    }
  }

  // OTP
  async createOtpCode(otp: InsertOtpCode): Promise<OtpCode> {
    const result = await db.insert(otpCodes).values(otp).returning();
    return result[0];
  }

  async getValidOtpCode(phone: string, code: string): Promise<OtpCode | undefined> {
    const result = await db.select().from(otpCodes)
      .where(and(
        eq(otpCodes.phone, phone),
        eq(otpCodes.code, code),
        eq(otpCodes.verified, false),
        gte(otpCodes.expiresAt, new Date())
      ))
      .limit(1);
    return result[0];
  }

  async markOtpVerified(id: string): Promise<OtpCode | undefined> {
    const result = await db.update(otpCodes)
      .set({ verified: true })
      .where(eq(otpCodes.id, id))
      .returning();
    return result[0];
  }

  // Carts
  async createCart(cart: InsertCart): Promise<Cart> {
    const result = await db.insert(carts).values(cart).returning();
    return result[0];
  }

  async getCart(sessionId: string): Promise<Cart | undefined> {
    const result = await db.select().from(carts)
      .where(and(eq(carts.sessionId, sessionId), eq(carts.status, "active")))
      .limit(1);
    return result[0];
  }

  async updateCart(id: string, updates: Partial<Cart>): Promise<Cart | undefined> {
    const result = await db.update(carts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(carts.id, id))
      .returning();
    return result[0];
  }

  async getAbandonedCarts(olderThanMinutes: number): Promise<Cart[]> {
    const cutoffTime = new Date(Date.now() - olderThanMinutes * 60 * 1000);
    return await db.select().from(carts)
      .where(and(
        eq(carts.status, "active"),
        eq(carts.reminderSent, false),
        lt(carts.updatedAt, cutoffTime)
      ));
  }

  // Payment Reminders
  async createPaymentReminder(reminder: InsertPaymentReminder): Promise<PaymentReminder> {
    const result = await db.insert(paymentReminders).values(reminder).returning();
    return result[0];
  }

  async getPendingReminders(orderId: string): Promise<PaymentReminder[]> {
    return await db.select().from(paymentReminders)
      .where(and(eq(paymentReminders.orderId, orderId), isNull(paymentReminders.sentAt)));
  }

  async markReminderSent(id: string): Promise<PaymentReminder | undefined> {
    const result = await db.update(paymentReminders)
      .set({ sentAt: new Date() })
      .where(eq(paymentReminders.id, id))
      .returning();
    return result[0];
  }

  async getDueReminders(): Promise<PaymentReminder[]> {
    return await db.select().from(paymentReminders)
      .where(isNull(paymentReminders.sentAt));
  }

  // Orders extended
  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return result[0];
  }

  async getPendingOrdersOlderThan(hours: number): Promise<Order[]> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return await db.select().from(orders)
      .where(and(
        eq(orders.status, "pending"),
        lt(orders.createdAt, cutoffTime)
      ));
  }

  async updateOrderPhone(id: string, phone: string): Promise<Order | undefined> {
    const result = await db.update(orders)
      .set({ phone })
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }

  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getAvailableTicketByZone(eventId: string, zoneId: string): Promise<Ticket | undefined> {
    const result = await db.select().from(tickets)
      .where(and(
        eq(tickets.eventId, eventId),
        eq(tickets.zoneId, zoneId),
        eq(tickets.status, "available")
      ))
      .limit(1);
    return result[0];
  }

  async atomicPurchaseTicket(
    ticketId: string, 
    userId: string, 
    orderData: Partial<InsertOrder>
  ): Promise<AtomicPurchaseResult> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const ticketResult = await client.query(
        `UPDATE tickets 
         SET status = 'reserved' 
         WHERE id = $1 AND status = 'available' 
         RETURNING *`,
        [ticketId]
      );
      
      if (ticketResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: "El boleto ya no está disponible",
          code: 409
        };
      }
      
      const ticket = ticketResult.rows[0];
      
      const ticketPrice = parseFloat(ticket.price);
      const feeBreakdown = calculateServerFees(ticketPrice);
      
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      
      const orderResult = await client.query(
        `INSERT INTO orders (user_id, ticket_id, total_amount, fees, ticket_price, fee_rate_used, status, payment_method, phone, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          userId,
          ticketId,
          feeBreakdown.totalAmount,
          feeBreakdown.fees,
          feeBreakdown.ticketPrice,
          feeBreakdown.feeRateUsed,
          'reserved',
          orderData.paymentMethod || 'card',
          orderData.phone || null,
          expiresAt
        ]
      );
      
      await client.query(
        `INSERT INTO order_events (order_id, actor_type, actor_id, event_type, from_status, to_status, metadata)
         VALUES ($1, 'system', $2, 'created_reserved', NULL, 'reserved', $3)`,
        [orderResult.rows[0].id, userId, JSON.stringify({ ticketId, ticketPrice: feeBreakdown.ticketPrice })]
      );
      
      await client.query('COMMIT');
      
      const order = orderResult.rows[0];
      
      return {
        success: true,
        order: {
          id: order.id,
          userId: order.user_id,
          ticketId: order.ticket_id,
          totalAmount: order.total_amount,
          fees: order.fees,
          ticketPrice: order.ticket_price,
          feeRateUsed: order.fee_rate_used,
          status: order.status,
          paymentMethod: order.payment_method,
          phone: order.phone,
          paymentReference: order.payment_reference,
          expiresAt: order.expires_at,
          createdAt: order.created_at
        },
        ticket: {
          id: ticket.id,
          eventId: ticket.event_id,
          zoneId: ticket.zone_id,
          row: ticket.row,
          seat: ticket.seat,
          price: ticket.price,
          sellerId: ticket.seller_id,
          status: 'reserved',
          createdAt: ticket.created_at
        },
        breakdown: feeBreakdown
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Atomic purchase error:', error);
      return {
        success: false,
        error: "Error al procesar la compra",
        code: 500
      };
    } finally {
      client.release();
    }
  }

  async atomicPurchaseByZone(
    eventId: string,
    zoneId: string,
    userId: string,
    orderData: Partial<InsertOrder>
  ): Promise<AtomicPurchaseResult> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const ticketResult = await client.query(
        `UPDATE tickets 
         SET status = 'reserved' 
         WHERE id = (
           SELECT id FROM tickets 
           WHERE event_id = $1 AND zone_id = $2 AND status = 'available' 
           LIMIT 1 FOR UPDATE SKIP LOCKED
         )
         RETURNING *`,
        [eventId, zoneId]
      );
      
      if (ticketResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: "No hay boletos disponibles en esta zona",
          code: 409
        };
      }
      
      const ticket = ticketResult.rows[0];
      
      const ticketPrice = parseFloat(ticket.price);
      const feeBreakdown = calculateServerFees(ticketPrice);
      
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      
      const orderResult = await client.query(
        `INSERT INTO orders (user_id, ticket_id, total_amount, fees, ticket_price, fee_rate_used, status, payment_method, phone, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          userId,
          ticket.id,
          feeBreakdown.totalAmount,
          feeBreakdown.fees,
          feeBreakdown.ticketPrice,
          feeBreakdown.feeRateUsed,
          'reserved',
          orderData.paymentMethod || 'card',
          orderData.phone || null,
          expiresAt
        ]
      );
      
      await client.query(
        `INSERT INTO order_events (order_id, actor_type, actor_id, event_type, from_status, to_status, metadata)
         VALUES ($1, 'system', $2, 'created_reserved', NULL, 'reserved', $3)`,
        [orderResult.rows[0].id, userId, JSON.stringify({ ticketId: ticket.id, zoneId, eventId, ticketPrice: feeBreakdown.ticketPrice })]
      );
      
      await client.query('COMMIT');
      
      const order = orderResult.rows[0];
      
      return {
        success: true,
        order: {
          id: order.id,
          userId: order.user_id,
          ticketId: order.ticket_id,
          totalAmount: order.total_amount,
          fees: order.fees,
          ticketPrice: order.ticket_price,
          feeRateUsed: order.fee_rate_used,
          status: order.status,
          paymentMethod: order.payment_method,
          phone: order.phone,
          paymentReference: order.payment_reference,
          expiresAt: order.expires_at,
          createdAt: order.created_at
        },
        ticket: {
          id: ticket.id,
          eventId: ticket.event_id,
          zoneId: ticket.zone_id,
          row: ticket.row,
          seat: ticket.seat,
          price: ticket.price,
          sellerId: ticket.seller_id,
          status: 'reserved',
          createdAt: ticket.created_at
        },
        breakdown: feeBreakdown
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Atomic purchase by zone error:', error);
      return {
        success: false,
        error: "Error al procesar la compra",
        code: 500
      };
    } finally {
      client.release();
    }
  }

  async expireReservedTickets(minutesOld: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - minutesOld * 60 * 1000);
    
    const expiredOrders = await db.select()
      .from(orders)
      .where(and(
        eq(orders.status, 'pending'),
        lt(orders.createdAt, cutoffTime)
      ));
    
    let expiredCount = 0;
    
    for (const order of expiredOrders) {
      await db.update(orders)
        .set({ status: 'expired' })
        .where(eq(orders.id, order.id));
      
      await db.update(tickets)
        .set({ status: 'available' })
        .where(eq(tickets.id, order.ticketId));
      
      expiredCount++;
    }
    
    return expiredCount;
  }

  async expireReservedTicketsWithAudit(minutesOld: number): Promise<number> {
    const client = await pool.connect();
    
    try {
      const now = new Date();
      
      const expiredOrders = await client.query(
        `SELECT * FROM orders 
         WHERE status IN ('reserved', 'pending', 'awaiting_payment')
         AND (expires_at IS NOT NULL AND expires_at < $1)
         OR (expires_at IS NULL AND created_at < $2)`,
        [now, new Date(Date.now() - minutesOld * 60 * 1000)]
      );
      
      let expiredCount = 0;
      
      for (const order of expiredOrders.rows) {
        await client.query('BEGIN');
        
        try {
          const prevStatus = order.status;
          
          await client.query(
            `UPDATE orders SET status = 'expired' WHERE id = $1`,
            [order.id]
          );
          
          await client.query(
            `UPDATE tickets SET status = 'available' WHERE id = $1 AND status = 'reserved'`,
            [order.ticket_id]
          );
          
          await client.query(
            `INSERT INTO order_events (order_id, actor_type, event_type, from_status, to_status, metadata)
             VALUES ($1, 'system', 'expired', $2, 'expired', $3)`,
            [order.id, prevStatus, JSON.stringify({ reason: 'reservation_timeout' })]
          );
          
          await client.query('COMMIT');
          expiredCount++;
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`Error expiring order ${order.id}:`, error);
        }
      }
      
      return expiredCount;
    } finally {
      client.release();
    }
  }

  async atomicConfirmPayment(
    orderId: string,
    adminId: string
  ): Promise<{ success: boolean; order?: Order; error?: string; code?: number; errorCode?: string }> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const orderResult = await client.query(
        `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId]
      );
      
      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: "Orden no encontrada", code: 404 };
      }
      
      const order = orderResult.rows[0];
      
      if (order.status === 'paid') {
        await client.query('ROLLBACK');
        return { 
          success: true, 
          order: {
            id: order.id,
            userId: order.user_id,
            ticketId: order.ticket_id,
            totalAmount: order.total_amount,
            fees: order.fees,
            ticketPrice: order.ticket_price,
            feeRateUsed: order.fee_rate_used,
            status: order.status,
            paymentMethod: order.payment_method,
            phone: order.phone,
            paymentReference: order.payment_reference,
            expiresAt: order.expires_at,
            createdAt: order.created_at
          }
        };
      }
      
      if (!['reserved', 'awaiting_payment', 'pending'].includes(order.status)) {
        await client.query('ROLLBACK');
        return { 
          success: false, 
          error: `No se puede confirmar pago de orden en estado "${order.status}"`,
          code: 409,
          errorCode: 'INVALID_STATE'
        };
      }
      
      const ticketCheck = await client.query(
        `SELECT * FROM tickets WHERE id = $1 AND status = 'reserved' FOR UPDATE`,
        [order.ticket_id]
      );
      
      if (ticketCheck.rows.length === 0) {
        const currentTicket = await client.query(
          `SELECT status FROM tickets WHERE id = $1`,
          [order.ticket_id]
        );
        
        if (currentTicket.rows.length > 0 && currentTicket.rows[0].status === 'sold') {
          await client.query('ROLLBACK');
          return { 
            success: false, 
            error: "El boleto ya fue vendido en otra transacción",
            code: 409,
            errorCode: 'TICKET_ALREADY_SOLD'
          };
        }
      }
      
      const prevStatus = order.status;
      
      await client.query(
        `UPDATE orders SET status = 'paid' WHERE id = $1`,
        [orderId]
      );
      
      const ticketUpdateResult = await client.query(
        `UPDATE tickets SET status = 'sold' WHERE id = $1 AND status = 'reserved' RETURNING *`,
        [order.ticket_id]
      );
      
      await client.query(
        `INSERT INTO order_events (order_id, actor_type, actor_id, event_type, from_status, to_status, metadata)
         VALUES ($1, 'admin', $2, 'payment_confirmed', $3, 'paid', $4)`,
        [orderId, adminId, prevStatus, JSON.stringify({ ticketsUpdated: ticketUpdateResult.rowCount })]
      );
      
      await client.query('COMMIT');
      
      const updatedOrder = await client.query(
        `SELECT * FROM orders WHERE id = $1`,
        [orderId]
      );
      
      const finalOrder = updatedOrder.rows[0];
      
      return {
        success: true,
        order: {
          id: finalOrder.id,
          userId: finalOrder.user_id,
          ticketId: finalOrder.ticket_id,
          totalAmount: finalOrder.total_amount,
          fees: finalOrder.fees,
          ticketPrice: finalOrder.ticket_price,
          feeRateUsed: finalOrder.fee_rate_used,
          status: finalOrder.status,
          paymentMethod: finalOrder.payment_method,
          phone: finalOrder.phone,
          paymentReference: finalOrder.payment_reference,
          expiresAt: finalOrder.expires_at,
          createdAt: finalOrder.created_at
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Atomic confirm payment error:', error);
      return {
        success: false,
        error: "Error al confirmar pago",
        code: 500
      };
    } finally {
      client.release();
    }
  }

  async getOrderMetrics(): Promise<{ pending: number; paid: number; cancelled: number; totalRevenue: string }> {
    const allOrders = await db.select().from(orders);
    
    let pending = 0, paid = 0, cancelled = 0;
    let totalRevenue = 0;
    
    for (const order of allOrders) {
      if (order.status === 'pending') pending++;
      else if (order.status === 'paid') {
        paid++;
        totalRevenue += parseFloat(String(order.totalAmount));
      }
      else if (order.status === 'cancelled' || order.status === 'expired') cancelled++;
    }
    
    return { pending, paid, cancelled, totalRevenue: totalRevenue.toFixed(2) };
  }
}

export const storage = new DatabaseStorage();

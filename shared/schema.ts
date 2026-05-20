import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().default("buyer"), // buyer | admin
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Venues table
export const venues = pgTable("venues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  city: text("city").notNull(),
  address: text("address"),
  capacity: integer("capacity"),
  mapData: json("map_data"), // SVG/zone configuration
  image: text("image"),
});

export const insertVenueSchema = createInsertSchema(venues).omit({
  id: true,
});

export type InsertVenue = z.infer<typeof insertVenueSchema>;
export type Venue = typeof venues.$inferSelect;

// Events table
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  category: text("category").notNull(), // Concert | Sports | Theater | Family | F1
  date: timestamp("date").notNull(),
  venueId: varchar("venue_id").notNull().references(() => venues.id),
  image: text("image"),
  minPrice: decimal("min_price", { precision: 10, scale: 2 }),
  tags: json("tags").$type<string[]>().default([]),
  isFeatured: boolean("is_featured").notNull().default(false),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
}).extend({
  tags: z.array(z.string()).optional(),
});

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Zones table (linked to venues for pricing structure)
export const zones = pgTable("zones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  color: text("color"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
});

export const insertZoneSchema = createInsertSchema(zones).omit({
  id: true,
});

export type InsertZone = z.infer<typeof insertZoneSchema>;
export type Zone = typeof zones.$inferSelect;

// Tickets table
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  zoneId: varchar("zone_id").notNull().references(() => zones.id, { onDelete: 'cascade' }),
  row: text("row").notNull(),
  seat: text("seat").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  sellerId: varchar("seller_id").references(() => users.id), // null = admin inventory
  status: text("status").notNull().default("available"), // available | reserved | sold
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

// Orders table
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  fees: decimal("fees", { precision: 10, scale: 2 }).notNull(),
  ticketPrice: decimal("ticket_price", { precision: 10, scale: 2 }), // original ticket price for audit
  feeRateUsed: decimal("fee_rate_used", { precision: 5, scale: 4 }), // fee rate used (audit)
  status: text("status").notNull().default("pending"), // pending | reserved | paid | cancelled | expired
  paymentMethod: text("payment_method"), // card | oxxo | spei
  phone: text("phone"),
  paymentReference: text("payment_reference"),
  expiresAt: timestamp("expires_at"), // for reservation expiry
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Config table for platform settings
export const config = pgTable("config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: json("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConfigSchema = createInsertSchema(config).omit({
  id: true,
  updatedAt: true,
});

export type InsertConfig = z.infer<typeof insertConfigSchema>;
export type Config = typeof config.$inferSelect;

// OTP codes for WhatsApp verification
export const otpCodes = pgTable("otp_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOtpCodeSchema = createInsertSchema(otpCodes).omit({
  id: true,
  verified: true,
  createdAt: true,
});

export type InsertOtpCode = z.infer<typeof insertOtpCodeSchema>;
export type OtpCode = typeof otpCodes.$inferSelect;

// Carts for abandoned cart tracking
export const carts = pgTable("carts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  phone: text("phone"),
  ticketId: varchar("ticket_id").references(() => tickets.id),
  eventId: varchar("event_id").references(() => events.id),
  status: text("status").notNull().default("active"), // active | completed | abandoned
  reminderSent: boolean("reminder_sent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCartSchema = createInsertSchema(carts).omit({
  id: true,
  reminderSent: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCart = z.infer<typeof insertCartSchema>;
export type Cart = typeof carts.$inferSelect;

// Payment reminders tracking
export const paymentReminders = pgTable("payment_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  hoursAfter: integer("hours_after").notNull(), // 1, 6, or 12
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentReminderSchema = createInsertSchema(paymentReminders).omit({
  id: true,
  sentAt: true,
  createdAt: true,
});

export type InsertPaymentReminder = z.infer<typeof insertPaymentReminderSchema>;
export type PaymentReminder = typeof paymentReminders.$inferSelect;

// Order events for auditing (event sourcing light)
export const orderEvents = pgTable("order_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: 'cascade' }),
  actorType: text("actor_type").notNull(), // user | admin | system
  actorId: varchar("actor_id"),
  eventType: text("event_type").notNull(), // created, reserved, payment_confirmed, cancelled, expired, etc.
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOrderEventSchema = createInsertSchema(orderEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertOrderEvent = z.infer<typeof insertOrderEventSchema>;
export type OrderEvent = typeof orderEvents.$inferSelect;

// Idempotency keys to prevent duplicate orders
// Note: user_id is required for /api/orders (authenticated endpoint)
export const idempotencyKeys = pgTable("idempotency_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Required - orders require auth
  scope: text("scope").notNull(), // e.g., "POST:/api/orders"
  key: text("key").notNull(),
  requestHash: text("request_hash").notNull(),
  responseCode: integer("response_code"),
  responseBody: json("response_body"),
  status: text("status").notNull().default("pending"), // pending | completed | failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => ({
  uniqueUserScopeKey: sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_user_scope_key ON idempotency_keys(user_id, scope, key)`,
}));

export const insertIdempotencyKeySchema = createInsertSchema(idempotencyKeys).omit({
  id: true,
  createdAt: true,
});

export type InsertIdempotencyKey = z.infer<typeof insertIdempotencyKeySchema>;
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;

// Job locks for distributed job coordination
export const jobLocks = pgTable("job_locks", {
  jobName: text("job_name").primaryKey(),
  lockedBy: text("locked_by").notNull(),
  lockedAt: timestamp("locked_at").notNull().defaultNow(),
  lockUntil: timestamp("lock_until").notNull(),
});

// ============================================
// ENTERPRISE TABLES - Antifraude + Analytics + Wallet + Resale
// ============================================

// Risk events (append-only telemetry)
export const riskEvents = pgTable("risk_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sessionHash: text("session_hash"),
  eventType: text("event_type").notNull(), // otp_attempt, order_attempt, reserve_expired, etc.
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  timezone: text("timezone"),
  locale: text("locale"),
  riskScore: integer("risk_score"),
  reasonCodes: json("reason_codes").$type<string[]>().default([]),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRiskEventSchema = createInsertSchema(riskEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertRiskEvent = z.infer<typeof insertRiskEventSchema>;
export type RiskEvent = typeof riskEvents.$inferSelect;

// Risk profiles (aggregated by user/session)
export const riskProfiles = pgTable("risk_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sessionHash: text("session_hash"),
  phone: text("phone"),
  ipHashes: json("ip_hashes").$type<string[]>().default([]),
  totalOtpAttempts: integer("total_otp_attempts").notNull().default(0),
  failedOtpAttempts: integer("failed_otp_attempts").notNull().default(0),
  totalOrders: integer("total_orders").notNull().default(0),
  expiredReservations: integer("expired_reservations").notNull().default(0),
  currentRiskScore: integer("current_risk_score").notNull().default(0),
  riskLevel: text("risk_level").notNull().default("low"), // low | medium | high
  lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRiskProfileSchema = createInsertSchema(riskProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRiskProfile = z.infer<typeof insertRiskProfileSchema>;
export type RiskProfile = typeof riskProfiles.$inferSelect;

// Bans (temporary/permanent)
export const bans = pgTable("bans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  phone: text("phone"),
  ipHash: text("ip_hash"),
  sessionHash: text("session_hash"),
  reason: text("reason").notNull(),
  reasonCodes: json("reason_codes").$type<string[]>().default([]),
  bannedBy: varchar("banned_by").references(() => users.id), // admin who issued
  expiresAt: timestamp("expires_at"), // null = permanent
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBanSchema = createInsertSchema(bans).omit({
  id: true,
  createdAt: true,
});
export type InsertBan = z.infer<typeof insertBanSchema>;
export type Ban = typeof bans.$inferSelect;

// Analytics events (append-only tracking)
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventName: text("event_name").notNull(), // view_home, view_event, checkout_start, etc.
  userId: varchar("user_id").references(() => users.id),
  sessionHash: text("session_hash"),
  eventId: varchar("event_id").references(() => events.id),
  venueId: varchar("venue_id").references(() => venues.id),
  zoneId: varchar("zone_id").references(() => zones.id),
  ticketId: varchar("ticket_id").references(() => tickets.id),
  orderId: varchar("order_id").references(() => orders.id),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

// Ticket passes (wallet QR)
export const ticketPasses = pgTable("ticket_passes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("active"), // active | used | revoked | expired
  qrSecret: text("qr_secret").notNull(), // rotating seed for QR generation
  rotationCounter: integer("rotation_counter").notNull().default(0),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  usedAt: timestamp("used_at"),
  revokedAt: timestamp("revoked_at"),
});

export const insertTicketPassSchema = createInsertSchema(ticketPasses).omit({
  id: true,
  issuedAt: true,
});
export type InsertTicketPass = z.infer<typeof insertTicketPassSchema>;
export type TicketPass = typeof ticketPasses.$inferSelect;

// Ticket pass uses (scan history)
export const ticketPassUses = pgTable("ticket_pass_uses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  passId: varchar("pass_id").notNull().references(() => ticketPasses.id),
  scannedBy: varchar("scanned_by").notNull().references(() => users.id), // admin/staff
  scanResult: text("scan_result").notNull(), // valid | invalid | already_used | expired
  scanLocation: text("scan_location"),
  metadata: json("metadata").$type<Record<string, any>>(),
  scannedAt: timestamp("scanned_at").notNull().defaultNow(),
});

export const insertTicketPassUseSchema = createInsertSchema(ticketPassUses).omit({
  id: true,
  scannedAt: true,
});
export type InsertTicketPassUse = z.infer<typeof insertTicketPassUseSchema>;
export type TicketPassUse = typeof ticketPassUses.$inferSelect;

// Resale listings (marketplace futuro - desactivado por default)
export const resaleListings = pgTable("resale_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id),
  ownerUserId: varchar("owner_user_id").notNull().references(() => users.id),
  eventId: varchar("event_id").notNull().references(() => events.id),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }).notNull(),
  listingPrice: decimal("listing_price", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("active"), // active | sold | cancelled | expired
  buyerUserId: varchar("buyer_user_id").references(() => users.id),
  soldAt: timestamp("sold_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertResaleListingSchema = createInsertSchema(resaleListings).omit({
  id: true,
  createdAt: true,
});
export type InsertResaleListing = z.infer<typeof insertResaleListingSchema>;
export type ResaleListing = typeof resaleListings.$inferSelect;

// ─── DISCOUNT CODES ───────────────────────────────────────────────────────────
export const discountCodes = pgTable("discount_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  description: text("description"),
  type: text("type").notNull().default("percent"),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDiscountCodeSchema = createInsertSchema(discountCodes).omit({ id: true, usedCount: true, createdAt: true });
export type InsertDiscountCode = z.infer<typeof insertDiscountCodeSchema>;
export type DiscountCode = typeof discountCodes.$inferSelect;

// ─── EVENT MAPS ───────────────────────────────────────────────────────────────
export const eventMaps = pgTable("event_maps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  svgData: text("svg_data"),
  imageUrl: text("image_url"),
  sections: json("sections").$type<Array<{ id: string; name: string; color: string; price: number; capacity: number }>>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEventMapSchema = createInsertSchema(eventMaps).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEventMap = z.infer<typeof insertEventMapSchema>;
export type EventMap = typeof eventMaps.$inferSelect;

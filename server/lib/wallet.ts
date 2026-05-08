import { db } from "../db";
import { ticketPasses, ticketPassUses, tickets, orders, events, zones, venues } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { isFeatureEnabled } from "./feature-flags";
import crypto from "crypto";

const QR_ROTATION_SECONDS = 30;
const QR_SECRET = process.env.SESSION_SECRET || 'wallet-secret-key';

export interface QRPayload {
  passId: string;
  ts: number;
  nonce: string;
  sig: string;
}

export function generateQRSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateQRPayload(passId: string, qrSecret: string): QRPayload {
  const ts = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(8).toString('hex');
  const data = `${passId}:${ts}:${nonce}:${qrSecret}`;
  const sig = crypto.createHmac('sha256', QR_SECRET).update(data).digest('hex').substring(0, 16);
  
  return { passId, ts, nonce, sig };
}

export function verifyQRPayload(payload: QRPayload, qrSecret: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  if (now - payload.ts > QR_ROTATION_SECONDS * 2) {
    return false;
  }
  
  const data = `${payload.passId}:${payload.ts}:${payload.nonce}:${qrSecret}`;
  const expectedSig = crypto.createHmac('sha256', QR_SECRET).update(data).digest('hex').substring(0, 16);
  
  return crypto.timingSafeEqual(
    Buffer.from(payload.sig),
    Buffer.from(expectedSig)
  );
}

export async function createTicketPass(
  orderId: string,
  ticketId: string,
  userId: string
): Promise<typeof ticketPasses.$inferSelect | null> {
  if (!isFeatureEnabled('WALLET_ENABLED')) return null;

  try {
    const [pass] = await db
      .insert(ticketPasses)
      .values({
        orderId,
        ticketId,
        userId,
        status: 'active',
        qrSecret: generateQRSecret(),
        rotationCounter: 0,
      })
      .returning();

    return pass;
  } catch (error) {
    console.error('[WALLET] Error creating pass:', error);
    return null;
  }
}

export async function getPassWithDetails(passId: string) {
  const result = await db
    .select({
      pass: ticketPasses,
      ticket: tickets,
      order: orders,
      event: events,
      zone: zones,
      venue: venues,
    })
    .from(ticketPasses)
    .innerJoin(tickets, eq(ticketPasses.ticketId, tickets.id))
    .innerJoin(orders, eq(ticketPasses.orderId, orders.id))
    .innerJoin(events, eq(tickets.eventId, events.id))
    .innerJoin(zones, eq(tickets.zoneId, zones.id))
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(eq(ticketPasses.id, passId))
    .limit(1);

  return result[0] || null;
}

export async function getUserPasses(userId: string) {
  return db
    .select({
      pass: ticketPasses,
      ticket: tickets,
      event: events,
      zone: zones,
      venue: venues,
    })
    .from(ticketPasses)
    .innerJoin(tickets, eq(ticketPasses.ticketId, tickets.id))
    .innerJoin(events, eq(tickets.eventId, events.id))
    .innerJoin(zones, eq(tickets.zoneId, zones.id))
    .innerJoin(venues, eq(events.venueId, venues.id))
    .where(eq(ticketPasses.userId, userId));
}

export interface ValidateResult {
  valid: boolean;
  result: 'valid' | 'invalid' | 'already_used' | 'expired' | 'revoked' | 'not_found';
  pass?: typeof ticketPasses.$inferSelect;
  details?: any;
}

export async function validatePass(payload: QRPayload): Promise<ValidateResult> {
  const passData = await getPassWithDetails(payload.passId);
  
  if (!passData) {
    return { valid: false, result: 'not_found' };
  }

  const { pass } = passData;

  if (pass.status === 'used') {
    return { valid: false, result: 'already_used', pass, details: passData };
  }
  if (pass.status === 'revoked') {
    return { valid: false, result: 'revoked', pass, details: passData };
  }
  if (pass.status === 'expired') {
    return { valid: false, result: 'expired', pass, details: passData };
  }

  if (!verifyQRPayload(payload, pass.qrSecret)) {
    return { valid: false, result: 'invalid', pass, details: passData };
  }

  return { valid: true, result: 'valid', pass, details: passData };
}

export async function markPassUsed(
  passId: string,
  scannedBy: string,
  scanLocation?: string
): Promise<boolean> {
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(ticketPasses)
        .set({
          status: 'used',
          usedAt: new Date(),
        })
        .where(and(eq(ticketPasses.id, passId), eq(ticketPasses.status, 'active')));

      await tx.insert(ticketPassUses).values({
        passId,
        scannedBy,
        scanResult: 'valid',
        scanLocation,
      });
    });

    return true;
  } catch (error) {
    console.error('[WALLET] Error marking pass used:', error);
    return false;
  }
}

export async function logScanAttempt(
  passId: string,
  scannedBy: string,
  result: string,
  scanLocation?: string
): Promise<void> {
  try {
    await db.insert(ticketPassUses).values({
      passId,
      scannedBy,
      scanResult: result,
      scanLocation,
    });
  } catch (error) {
    console.error('[WALLET] Error logging scan:', error);
  }
}

export async function createPassesForOrder(
  orderId: string,
  userId: string
): Promise<number> {
  if (!isFeatureEnabled('WALLET_ENABLED')) return 0;

  try {
    // Get the order to find its ticketId
    const orderData = await db
      .select({ ticketId: orders.ticketId })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) return 0;

    const ticketId = orderData[0].ticketId;

    // Check if pass already exists (idempotent)
    const existing = await db
      .select({ id: ticketPasses.id })
      .from(ticketPasses)
      .where(eq(ticketPasses.ticketId, ticketId))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[WALLET] Pass already exists for ticket ${ticketId}`);
      return 0;
    }

    await createTicketPass(orderId, ticketId, userId);
    console.log(`[WALLET] Created pass for order ${orderId}`);
    return 1;
  } catch (error) {
    console.error('[WALLET] Error creating passes for order:', error);
    return 0;
  }
}

export async function revokePass(passId: string): Promise<boolean> {
  try {
    await db
      .update(ticketPasses)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
      })
      .where(eq(ticketPasses.id, passId));
    return true;
  } catch (error) {
    console.error('[WALLET] Error revoking pass:', error);
    return false;
  }
}

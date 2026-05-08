import { db } from "../db";
import { riskEvents, riskProfiles, bans } from "@shared/schema";
import { eq, and, or, gt, sql } from "drizzle-orm";
import { isFeatureEnabled, getFraudStrictMode } from "./feature-flags";
import crypto from "crypto";

export interface RiskContext {
  userId?: string;
  sessionHash?: string;
  phone?: string;
  ipHash?: string;
  userAgent?: string;
  timezone?: string;
  locale?: string;
}

export interface RiskResult {
  score: number;
  level: 'low' | 'medium' | 'high';
  reasonCodes: string[];
  action: 'allow' | 'cooldown' | 'block' | 'step_up';
  cooldownSeconds?: number;
}

const THRESHOLDS = {
  low: { medium: 30, high: 60 },
  medium: { medium: 20, high: 40 },
  high: { medium: 10, high: 25 },
};

export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export async function computeRiskScore(ctx: RiskContext, eventType: string): Promise<RiskResult> {
  if (!isFeatureEnabled('RISK_ENGINE_ENABLED')) {
    return { score: 0, level: 'low', reasonCodes: [], action: 'allow' };
  }

  const reasonCodes: string[] = [];
  let score = 0;
  const strictMode = getFraudStrictMode();
  const thresholds = THRESHOLDS[strictMode];

  try {
    const activeBan = await checkActiveBan(ctx);
    if (activeBan) {
      return {
        score: 100,
        level: 'high',
        reasonCodes: ['active_ban'],
        action: 'block',
      };
    }

    let profile = await getOrCreateProfile(ctx);

    if (profile.failedOtpAttempts > 5) {
      score += 20;
      reasonCodes.push('too_many_failed_otps');
    }
    if (profile.totalOtpAttempts > 10) {
      score += 10;
      reasonCodes.push('too_many_otps');
    }
    if (profile.expiredReservations > 3) {
      score += 15;
      reasonCodes.push('excessive_reserve_expiry');
    }
    if (profile.totalOrders > 10) {
      score += 5;
      reasonCodes.push('high_order_volume');
    }

    const ipHashes = profile.ipHashes as string[] || [];
    if (ipHashes.length > 5) {
      score += 15;
      reasonCodes.push('ip_rotation_suspicious');
    }

    const recentEvents = await getRecentEvents(ctx, 60);
    if (recentEvents > 20) {
      score += 25;
      reasonCodes.push('high_velocity_actions');
    }

    await logRiskEvent(ctx, eventType, score, reasonCodes);

    let level: 'low' | 'medium' | 'high' = 'low';
    let action: 'allow' | 'cooldown' | 'block' | 'step_up' = 'allow';
    let cooldownSeconds: number | undefined;

    if (score >= thresholds.high) {
      level = 'high';
      action = strictMode === 'high' ? 'step_up' : 'block';
    } else if (score >= thresholds.medium) {
      level = 'medium';
      action = 'cooldown';
      cooldownSeconds = Math.min(60 * (score / 10), 1800);
    }

    await updateProfileRisk(ctx, score, level);

    return { score, level, reasonCodes, action, cooldownSeconds };
  } catch (error) {
    console.error('[RISK-ENGINE] Error computing risk:', error);
    return { score: 0, level: 'low', reasonCodes: [], action: 'allow' };
  }
}

async function checkActiveBan(ctx: RiskContext): Promise<boolean> {
  const conditions = [];
  if (ctx.userId) conditions.push(eq(bans.userId, ctx.userId));
  if (ctx.phone) conditions.push(eq(bans.phone, ctx.phone));
  if (ctx.ipHash) conditions.push(eq(bans.ipHash, ctx.ipHash));
  if (ctx.sessionHash) conditions.push(eq(bans.sessionHash, ctx.sessionHash));

  if (conditions.length === 0) return false;

  const activeBans = await db
    .select()
    .from(bans)
    .where(
      and(
        eq(bans.isActive, true),
        or(...conditions),
        or(
          sql`${bans.expiresAt} IS NULL`,
          gt(bans.expiresAt, new Date())
        )
      )
    )
    .limit(1);

  return activeBans.length > 0;
}

async function getOrCreateProfile(ctx: RiskContext): Promise<typeof riskProfiles.$inferSelect> {
  const conditions = [];
  if (ctx.userId) conditions.push(eq(riskProfiles.userId, ctx.userId));
  else if (ctx.sessionHash) conditions.push(eq(riskProfiles.sessionHash, ctx.sessionHash));
  else if (ctx.phone) conditions.push(eq(riskProfiles.phone, ctx.phone));

  if (conditions.length === 0) {
    return {
      id: '',
      userId: null,
      sessionHash: null,
      phone: null,
      ipHashes: [],
      totalOtpAttempts: 0,
      failedOtpAttempts: 0,
      totalOrders: 0,
      expiredReservations: 0,
      currentRiskScore: 0,
      riskLevel: 'low',
      lastActivityAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const existing = await db
    .select()
    .from(riskProfiles)
    .where(or(...conditions))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [newProfile] = await db
    .insert(riskProfiles)
    .values({
      userId: ctx.userId || null,
      sessionHash: ctx.sessionHash || null,
      phone: ctx.phone || null,
      ipHashes: ctx.ipHash ? [ctx.ipHash] : [],
    })
    .returning();

  return newProfile;
}

async function getRecentEvents(ctx: RiskContext, minutes: number): Promise<number> {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  const conditions = [];
  
  if (ctx.userId) conditions.push(eq(riskEvents.userId, ctx.userId));
  else if (ctx.sessionHash) conditions.push(eq(riskEvents.sessionHash, ctx.sessionHash));

  if (conditions.length === 0) return 0;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(riskEvents)
    .where(
      and(
        or(...conditions),
        gt(riskEvents.createdAt, since)
      )
    );

  return result[0]?.count || 0;
}

async function logRiskEvent(
  ctx: RiskContext,
  eventType: string,
  score: number,
  reasonCodes: string[]
): Promise<void> {
  await db.insert(riskEvents).values({
    userId: ctx.userId || null,
    sessionHash: ctx.sessionHash || null,
    eventType,
    ipHash: ctx.ipHash || null,
    userAgent: ctx.userAgent || null,
    timezone: ctx.timezone || null,
    locale: ctx.locale || null,
    riskScore: score,
    reasonCodes,
  });
}

async function updateProfileRisk(
  ctx: RiskContext,
  score: number,
  level: 'low' | 'medium' | 'high'
): Promise<void> {
  const conditions = [];
  if (ctx.userId) conditions.push(eq(riskProfiles.userId, ctx.userId));
  else if (ctx.sessionHash) conditions.push(eq(riskProfiles.sessionHash, ctx.sessionHash));

  if (conditions.length === 0) return;

  await db
    .update(riskProfiles)
    .set({
      currentRiskScore: score,
      riskLevel: level,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(or(...conditions));
}

export async function incrementProfileCounter(
  ctx: RiskContext,
  counter: 'totalOtpAttempts' | 'failedOtpAttempts' | 'totalOrders' | 'expiredReservations'
): Promise<void> {
  if (!isFeatureEnabled('RISK_ENGINE_ENABLED')) return;

  await getOrCreateProfile(ctx);

  const conditions = [];
  if (ctx.userId) conditions.push(eq(riskProfiles.userId, ctx.userId));
  else if (ctx.sessionHash) conditions.push(eq(riskProfiles.sessionHash, ctx.sessionHash));
  else if (ctx.phone) conditions.push(eq(riskProfiles.phone, ctx.phone));

  if (conditions.length === 0) return;

  await db
    .update(riskProfiles)
    .set({
      [counter]: sql`${riskProfiles[counter]} + 1`,
      updatedAt: new Date(),
    })
    .where(or(...conditions));
}

export async function createBan(
  ctx: RiskContext,
  reason: string,
  reasonCodes: string[],
  bannedBy: string,
  durationMinutes?: number
): Promise<void> {
  await db.insert(bans).values({
    userId: ctx.userId || null,
    phone: ctx.phone || null,
    ipHash: ctx.ipHash || null,
    sessionHash: ctx.sessionHash || null,
    reason,
    reasonCodes,
    bannedBy,
    expiresAt: durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : null,
    isActive: true,
  });
}

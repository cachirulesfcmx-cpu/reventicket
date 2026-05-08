import { Router, Request, Response } from "express";
import { db } from "../db";
import { analyticsEvents, riskEvents, riskProfiles, bans, ticketPasses, resaleListings, orders, tickets, events, venues } from "@shared/schema";
import { eq, and, gte, lte, sql, desc, count } from "drizzle-orm";
import { isFeatureEnabled, getFeatureFlags } from "../lib/feature-flags";
import { trackEvent } from "../lib/analytics";
import { getUserPasses, generateQRPayload, validatePass, markPassUsed, logScanAttempt } from "../lib/wallet";
import { createBan } from "../lib/risk-engine";

const router = Router();

function requireAdmin(req: Request, res: Response, next: Function) {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireAuth(req: Request, res: Response, next: Function) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

router.get('/feature-flags', (req, res) => {
  res.json(getFeatureFlags());
});

router.post('/analytics/track', async (req, res) => {
  if (!isFeatureEnabled('ANALYTICS_ENABLED')) {
    return res.status(200).json({ tracked: false, reason: 'disabled' });
  }

  const { eventName, ...ctx } = req.body;
  const user = (req as any).user;
  
  await trackEvent(eventName, {
    ...ctx,
    userId: user?.id,
    sessionHash: req.sessionID,
  });

  res.json({ tracked: true });
});

router.get('/admin/analytics/overview', requireAdmin, async (req, res) => {
  if (!isFeatureEnabled('ANALYTICS_ENABLED')) {
    return res.status(403).json({ error: 'Analytics disabled' });
  }

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    const [dauResult] = await db
      .select({ count: sql<number>`COUNT(DISTINCT session_hash)` })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, dayAgo));

    const [wauResult] = await db
      .select({ count: sql<number>`COUNT(DISTINCT session_hash)` })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, weekAgo));

    const [totalOrders] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(orders)
      .where(gte(orders.createdAt, weekAgo));

    const [paidOrders] = await db
      .select({ 
        count: sql<number>`COUNT(*)`,
        revenue: sql<number>`COALESCE(SUM(total_amount::numeric), 0)`
      })
      .from(orders)
      .where(and(eq(orders.status, 'paid'), gte(orders.createdAt, weekAgo)));

    res.json({
      dau: dauResult?.count || 0,
      wau: wauResult?.count || 0,
      totalOrdersWeek: totalOrders?.count || 0,
      paidOrdersWeek: paidOrders?.count || 0,
      revenueWeek: paidOrders?.revenue || 0,
    });
  } catch (error) {
    console.error('[ANALYTICS] Overview error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/admin/analytics/funnel', requireAdmin, async (req, res) => {
  if (!isFeatureEnabled('ANALYTICS_ENABLED')) {
    return res.status(403).json({ error: 'Analytics disabled' });
  }

  const range = parseInt(req.query.range as string) || 7;
  const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

  try {
    const funnelSteps = ['view_home', 'view_event', 'add_to_cart', 'checkout_start', 'order_created', 'payment_confirmed'];
    
    const funnel = await Promise.all(
      funnelSteps.map(async (step) => {
        const [result] = await db
          .select({ count: sql<number>`COUNT(DISTINCT session_hash)` })
          .from(analyticsEvents)
          .where(and(eq(analyticsEvents.eventName, step), gte(analyticsEvents.createdAt, since)));
        return { step, count: result?.count || 0 };
      })
    );

    res.json({ range, funnel });
  } catch (error) {
    console.error('[ANALYTICS] Funnel error:', error);
    res.status(500).json({ error: 'Failed to fetch funnel' });
  }
});

router.get('/admin/analytics/events', requireAdmin, async (req, res) => {
  if (!isFeatureEnabled('ANALYTICS_ENABLED')) {
    return res.status(403).json({ error: 'Analytics disabled' });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const eventName = req.query.eventName as string;

  try {
    const eventsData = eventName
      ? await db.select().from(analyticsEvents).where(eq(analyticsEvents.eventName, eventName)).orderBy(desc(analyticsEvents.createdAt)).limit(limit)
      : await db.select().from(analyticsEvents).orderBy(desc(analyticsEvents.createdAt)).limit(limit);
    res.json(eventsData);
  } catch (error) {
    console.error('[ANALYTICS] Events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.get('/admin/analytics/top-events', requireAdmin, async (req, res) => {
  if (!isFeatureEnabled('ANALYTICS_ENABLED')) {
    return res.status(403).json({ error: 'Analytics disabled' });
  }

  const range = parseInt(req.query.range as string) || 7;
  const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);

  try {
    const topEvents = await db
      .select({
        eventId: analyticsEvents.eventId,
        views: sql<number>`COUNT(*)`,
      })
      .from(analyticsEvents)
      .where(and(
        eq(analyticsEvents.eventName, 'view_event'),
        gte(analyticsEvents.createdAt, since),
        sql`${analyticsEvents.eventId} IS NOT NULL`
      ))
      .groupBy(analyticsEvents.eventId)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    const eventIds = topEvents.map(e => e.eventId).filter(Boolean);
    const eventsData = eventIds.length > 0 
      ? await db.select().from(events).where(sql`${events.id} IN (${sql.join(eventIds.map(id => sql`${id}`), sql`,`)})`)
      : [];

    const result = topEvents.map(te => ({
      ...te,
      event: eventsData.find(e => e.id === te.eventId),
    }));

    res.json(result);
  } catch (error) {
    console.error('[ANALYTICS] Top events error:', error);
    res.status(500).json({ error: 'Failed to fetch top events' });
  }
});

router.get('/admin/risk/profiles', requireAdmin, async (req, res) => {
  if (!isFeatureEnabled('RISK_ENGINE_ENABLED')) {
    return res.status(403).json({ error: 'Risk engine disabled' });
  }

  const level = req.query.level as string;
  
  try {
    const profiles = (level === 'high' || level === 'medium')
      ? await db.select().from(riskProfiles).where(eq(riskProfiles.riskLevel, level)).orderBy(desc(riskProfiles.currentRiskScore)).limit(100)
      : await db.select().from(riskProfiles).orderBy(desc(riskProfiles.currentRiskScore)).limit(100);
    res.json(profiles);
  } catch (error) {
    console.error('[RISK] Profiles error:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

router.get('/admin/risk/events', requireAdmin, async (req, res) => {
  if (!isFeatureEnabled('RISK_ENGINE_ENABLED')) {
    return res.status(403).json({ error: 'Risk engine disabled' });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

  try {
    const eventsData = await db
      .select()
      .from(riskEvents)
      .orderBy(desc(riskEvents.createdAt))
      .limit(limit);

    res.json(eventsData);
  } catch (error) {
    console.error('[RISK] Events error:', error);
    res.status(500).json({ error: 'Failed to fetch risk events' });
  }
});

router.get('/admin/risk/bans', requireAdmin, async (req, res) => {
  if (!isFeatureEnabled('RISK_ENGINE_ENABLED')) {
    return res.status(403).json({ error: 'Risk engine disabled' });
  }

  try {
    const bansData = await db
      .select()
      .from(bans)
      .where(eq(bans.isActive, true))
      .orderBy(desc(bans.createdAt))
      .limit(100);

    res.json(bansData);
  } catch (error) {
    console.error('[RISK] Bans error:', error);
    res.status(500).json({ error: 'Failed to fetch bans' });
  }
});

router.post('/admin/risk/ban', requireAdmin, async (req, res) => {
  if (!isFeatureEnabled('RISK_ENGINE_ENABLED')) {
    return res.status(403).json({ error: 'Risk engine disabled' });
  }

  const { userId, phone, ipHash, sessionHash, reason, durationMinutes } = req.body;
  const admin = (req as any).user;

  try {
    await createBan(
      { userId, phone, ipHash, sessionHash },
      reason || 'Manual ban by admin',
      ['admin_ban'],
      admin.id,
      durationMinutes
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[RISK] Ban error:', error);
    res.status(500).json({ error: 'Failed to create ban' });
  }
});

router.post('/admin/risk/unban/:id', requireAdmin, async (req, res) => {
  if (!isFeatureEnabled('RISK_ENGINE_ENABLED')) {
    return res.status(403).json({ error: 'Risk engine disabled' });
  }

  try {
    await db
      .update(bans)
      .set({ isActive: false })
      .where(eq(bans.id, req.params.id));

    res.json({ success: true });
  } catch (error) {
    console.error('[RISK] Unban error:', error);
    res.status(500).json({ error: 'Failed to unban' });
  }
});

router.get('/wallet/passes', requireAuth, async (req, res) => {
  if (!isFeatureEnabled('WALLET_ENABLED')) {
    return res.status(403).json({ error: 'Wallet disabled' });
  }

  const user = (req as any).user;

  try {
    const passes = await getUserPasses(user.id);
    res.json(passes);
  } catch (error) {
    console.error('[WALLET] Get passes error:', error);
    res.status(500).json({ error: 'Failed to fetch passes' });
  }
});

router.get('/wallet/pass/:id/qr', requireAuth, async (req, res) => {
  if (!isFeatureEnabled('WALLET_ENABLED')) {
    return res.status(403).json({ error: 'Wallet disabled' });
  }

  const user = (req as any).user;
  const passId = req.params.id;

  try {
    const [pass] = await db
      .select()
      .from(ticketPasses)
      .where(and(eq(ticketPasses.id, passId), eq(ticketPasses.userId, user.id)))
      .limit(1);

    if (!pass) {
      return res.status(404).json({ error: 'Pass not found' });
    }

    if (pass.status !== 'active') {
      return res.status(400).json({ error: 'Pass is not active', status: pass.status });
    }

    const payload = generateQRPayload(pass.id, pass.qrSecret);
    res.json(payload);
  } catch (error) {
    console.error('[WALLET] QR error:', error);
    res.status(500).json({ error: 'Failed to generate QR' });
  }
});

router.post('/wallet/validate', requireAdmin, async (req, res) => {
  if (!isFeatureEnabled('WALLET_ENABLED')) {
    return res.status(403).json({ error: 'Wallet disabled' });
  }

  const { passId, ts, nonce, sig, markUsed, scanLocation } = req.body;
  const admin = (req as any).user;

  try {
    const result = await validatePass({ passId, ts, nonce, sig });

    if (result.valid && markUsed) {
      await markPassUsed(passId, admin.id, scanLocation);
    } else if (!result.valid) {
      await logScanAttempt(passId, admin.id, result.result, scanLocation);
    }

    res.json({
      valid: result.valid,
      result: result.result,
      details: result.details ? {
        event: result.details.event,
        venue: result.details.venue,
        zone: result.details.zone,
        ticket: result.details.ticket,
      } : null,
    });
  } catch (error) {
    console.error('[WALLET] Validate error:', error);
    res.status(500).json({ error: 'Failed to validate' });
  }
});

router.get('/resale/listings', async (req, res) => {
  if (!isFeatureEnabled('RESALE_ENABLED')) {
    return res.status(403).json({ error: 'Resale not available', message: 'Próximamente' });
  }

  const eventId = req.query.eventId as string;

  try {
    let query = db.select().from(resaleListings).where(eq(resaleListings.status, 'active')).limit(50);
    
    if (eventId) {
      query = db.select().from(resaleListings).where(and(eq(resaleListings.status, 'active'), eq(resaleListings.eventId, eventId))).limit(50);
    }

    const listings = await query;
    res.json(listings);
  } catch (error) {
    console.error('[RESALE] Listings error:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

router.post('/resale/list', requireAuth, async (req, res) => {
  if (!isFeatureEnabled('RESALE_ENABLED')) {
    return res.status(403).json({ error: 'Resale not available', message: 'Próximamente' });
  }

  res.status(501).json({ error: 'Not implemented', message: 'Próximamente' });
});

router.post('/resale/buy/:id', requireAuth, async (req, res) => {
  if (!isFeatureEnabled('RESALE_ENABLED')) {
    return res.status(403).json({ error: 'Resale not available', message: 'Próximamente' });
  }

  res.status(501).json({ error: 'Not implemented', message: 'Próximamente' });
});

export default router;

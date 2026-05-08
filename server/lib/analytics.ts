import { db } from "../db";
import { analyticsEvents } from "@shared/schema";
import { isFeatureEnabled } from "./feature-flags";

export interface AnalyticsContext {
  userId?: string;
  sessionHash?: string;
  eventId?: string;
  venueId?: string;
  zoneId?: string;
  ticketId?: string;
  orderId?: string;
  metadata?: Record<string, any>;
}

export type AnalyticsEventName =
  | 'view_home'
  | 'view_event'
  | 'search'
  | 'map_hover_zone'
  | 'add_to_cart'
  | 'checkout_start'
  | 'order_created'
  | 'payment_confirmed'
  | 'purchase_completed'
  | 'wallet_added'
  | 'resale_listed'
  | 'resale_sold';

export async function trackEvent(
  eventName: AnalyticsEventName,
  ctx: AnalyticsContext
): Promise<void> {
  if (!isFeatureEnabled('ANALYTICS_ENABLED')) return;

  try {
    await db.insert(analyticsEvents).values({
      eventName,
      userId: ctx.userId || null,
      sessionHash: ctx.sessionHash || null,
      eventId: ctx.eventId || null,
      venueId: ctx.venueId || null,
      zoneId: ctx.zoneId || null,
      ticketId: ctx.ticketId || null,
      orderId: ctx.orderId || null,
      metadata: ctx.metadata || null,
    });
  } catch (error) {
    console.error('[ANALYTICS] Error tracking event:', error);
  }
}

export async function trackEventBatch(
  events: Array<{ eventName: AnalyticsEventName; ctx: AnalyticsContext }>
): Promise<void> {
  if (!isFeatureEnabled('ANALYTICS_ENABLED')) return;

  try {
    await db.insert(analyticsEvents).values(
      events.map(e => ({
        eventName: e.eventName,
        userId: e.ctx.userId || null,
        sessionHash: e.ctx.sessionHash || null,
        eventId: e.ctx.eventId || null,
        venueId: e.ctx.venueId || null,
        zoneId: e.ctx.zoneId || null,
        ticketId: e.ctx.ticketId || null,
        orderId: e.ctx.orderId || null,
        metadata: e.ctx.metadata || null,
      }))
    );
  } catch (error) {
    console.error('[ANALYTICS] Error tracking batch:', error);
  }
}

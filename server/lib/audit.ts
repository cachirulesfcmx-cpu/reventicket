import { pool } from '../db';
import type { ActorType } from './order-state-machine';

export interface AuditEventData {
  orderId: string;
  actorType: ActorType;
  actorId?: string | null;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  metadata?: Record<string, any>;
}

export async function emitOrderEvent(data: AuditEventData): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query(
      `INSERT INTO order_events (order_id, actor_type, actor_id, event_type, from_status, to_status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        data.orderId,
        data.actorType,
        data.actorId || null,
        data.eventType,
        data.fromStatus || null,
        data.toStatus || null,
        data.metadata ? JSON.stringify(data.metadata) : null
      ]
    );
  } catch (error) {
    console.error('Error emitting order event:', error);
  } finally {
    client.release();
  }
}

export async function getOrderEvents(orderId: string): Promise<any[]> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `SELECT * FROM order_events 
       WHERE order_id = $1 
       ORDER BY created_at ASC`,
      [orderId]
    );
    
    return result.rows.map(row => ({
      id: row.id,
      orderId: row.order_id,
      actorType: row.actor_type,
      actorId: row.actor_id,
      eventType: row.event_type,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      metadata: row.metadata,
      createdAt: row.created_at
    }));
  } finally {
    client.release();
  }
}

export async function rebuildOrderState(orderId: string): Promise<{
  currentStatus: string | null;
  timeline: any[];
  inconsistencies: string[];
}> {
  const events = await getOrderEvents(orderId);
  
  let currentStatus: string | null = null;
  const timeline: any[] = [];
  const inconsistencies: string[] = [];
  
  for (const event of events) {
    timeline.push({
      eventType: event.eventType,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorType: event.actorType,
      timestamp: event.createdAt
    });
    
    if (event.toStatus) {
      if (currentStatus && event.fromStatus && currentStatus !== event.fromStatus) {
        inconsistencies.push(
          `Event ${event.eventType}: expected from "${currentStatus}" but got "${event.fromStatus}"`
        );
      }
      currentStatus = event.toStatus;
    }
  }
  
  return { currentStatus, timeline, inconsistencies };
}

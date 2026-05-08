import { createHash } from 'crypto';
import { pool } from '../db';

export interface IdempotencyResult {
  isNew: boolean;
  existingResponse?: {
    code: number;
    body: any;
  };
  key?: string;
}

export function generateRequestHash(body: any): string {
  const normalized = JSON.stringify(body, Object.keys(body).sort());
  return createHash('sha256').update(normalized).digest('hex');
}

export async function checkIdempotencyKey(
  userId: string,
  scope: string,
  idempotencyKey: string,
  requestHash: string
): Promise<IdempotencyResult> {
  const client = await pool.connect();
  
  try {
    // user_id is required (orders require auth)
    const result = await client.query(
      `SELECT * FROM idempotency_keys 
       WHERE user_id = $1 AND scope = $2 AND key = $3 AND expires_at > NOW()
       LIMIT 1`,
      [userId, scope, idempotencyKey]
    );
    
    if (result.rows.length === 0) {
      return { isNew: true, key: idempotencyKey };
    }
    
    const existing = result.rows[0];
    
    if (existing.request_hash !== requestHash) {
      throw new Error('IDEMPOTENCY_KEY_CONFLICT');
    }
    
    if (existing.status === 'completed' && existing.response_code) {
      return {
        isNew: false,
        existingResponse: {
          code: existing.response_code,
          body: existing.response_body
        },
        key: idempotencyKey
      };
    }
    
    if (existing.status === 'pending') {
      return { isNew: false, key: idempotencyKey };
    }
    
    return { isNew: true, key: idempotencyKey };
  } finally {
    client.release();
  }
}

export async function createIdempotencyRecord(
  userId: string,
  scope: string,
  idempotencyKey: string,
  requestHash: string,
  ttlHours: number = 24
): Promise<{ created: boolean }> {
  const client = await pool.connect();
  
  try {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    
    // Use unique constraint on (user_id, scope, key) - orders require auth
    const result = await client.query(
      `INSERT INTO idempotency_keys (user_id, scope, key, request_hash, status, expires_at)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       ON CONFLICT (user_id, scope, key) DO NOTHING
       RETURNING id`,
      [userId, scope, idempotencyKey, requestHash, expiresAt]
    );
    
    return { created: (result.rowCount || 0) > 0 };
  } finally {
    client.release();
  }
}

export async function completeIdempotencyRecord(
  userId: string,
  scope: string,
  idempotencyKey: string,
  responseCode: number,
  responseBody: any
): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query(
      `UPDATE idempotency_keys 
       SET status = 'completed', response_code = $4, response_body = $5
       WHERE user_id = $1 AND scope = $2 AND key = $3`,
      [userId, scope, idempotencyKey, responseCode, JSON.stringify(responseBody)]
    );
  } finally {
    client.release();
  }
}

export async function failIdempotencyRecord(
  userId: string,
  scope: string,
  idempotencyKey: string
): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query(
      `UPDATE idempotency_keys 
       SET status = 'failed'
       WHERE user_id = $1 AND scope = $2 AND key = $3`,
      [userId, scope, idempotencyKey]
    );
  } finally {
    client.release();
  }
}

export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      `DELETE FROM idempotency_keys WHERE expires_at < NOW() RETURNING id`
    );
    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

import { pool } from '../db';
import { randomBytes } from 'crypto';
import { hostname } from 'os';

let instanceId: string | null = null;

export function getInstanceId(): string {
  if (!instanceId) {
    instanceId = `${hostname()}-${process.pid}-${randomBytes(4).toString('hex')}`;
  }
  return instanceId;
}

export async function acquireJobLock(
  jobName: string,
  ttlSeconds: number
): Promise<boolean> {
  const client = await pool.connect();
  const lockedBy = getInstanceId();
  const lockUntil = new Date(Date.now() + ttlSeconds * 1000);
  
  try {
    const result = await client.query(
      `INSERT INTO job_locks (job_name, locked_by, locked_at, lock_until)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (job_name) DO UPDATE 
       SET locked_by = EXCLUDED.locked_by,
           locked_at = NOW(),
           lock_until = EXCLUDED.lock_until
       WHERE job_locks.lock_until < NOW()
       RETURNING *`,
      [jobName, lockedBy, lockUntil]
    );
    
    const acquired = result.rowCount !== null && result.rowCount > 0;
    if (acquired) {
      console.log(`[JOB-LOCK] Lock acquired for "${jobName}" by ${lockedBy}`);
    } else {
      console.log(`[JOB-LOCK] Lock denied for "${jobName}" - already held by another instance`);
    }
    return acquired;
  } catch (error) {
    console.error('[JOB-LOCK] Error acquiring job lock:', error);
    return false;
  } finally {
    client.release();
  }
}

export async function releaseJobLock(jobName: string): Promise<void> {
  const client = await pool.connect();
  const lockedBy = getInstanceId();
  
  try {
    await client.query(
      `UPDATE job_locks 
       SET lock_until = NOW()
       WHERE job_name = $1 AND locked_by = $2`,
      [jobName, lockedBy]
    );
    console.log(`[JOB-LOCK] Lock released for "${jobName}" by ${lockedBy}`);
  } catch (error) {
    console.error('[JOB-LOCK] Error releasing job lock:', error);
  } finally {
    client.release();
  }
}

export async function extendJobLock(
  jobName: string,
  additionalSeconds: number
): Promise<boolean> {
  const client = await pool.connect();
  const lockedBy = getInstanceId();
  
  try {
    const result = await client.query(
      `UPDATE job_locks 
       SET lock_until = NOW() + interval '${additionalSeconds} seconds'
       WHERE job_name = $1 AND locked_by = $2 AND lock_until > NOW()
       RETURNING *`,
      [jobName, lockedBy]
    );
    
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error('Error extending job lock:', error);
    return false;
  } finally {
    client.release();
  }
}

export async function withJobLock<T>(
  jobName: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const acquired = await acquireJobLock(jobName, ttlSeconds);
  
  if (!acquired) {
    console.log(`Job "${jobName}" is locked by another instance, skipping`);
    return null;
  }
  
  try {
    const result = await fn();
    return result;
  } finally {
    await releaseJobLock(jobName);
  }
}

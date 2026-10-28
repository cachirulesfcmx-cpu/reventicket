import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { handler, json } from '@/lib/http';
import { getProvider } from '@/lib/providers';

export const dynamic = 'force-dynamic';

function authorized(req: Request): boolean {
  const header = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${env.cronSecret}`;
  if (!env.cronSecret || header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

// Scheduled ingestion entry point. The demo provider never writes to canonical tables; a licensed
// provider adapter must be configured (and its coverage verified) before this route writes data.
export const POST = handler(async (req: Request) => {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  const provider = getProvider();
  if (provider.isDemo || provider.id === 'supabase') {
    return json({ status: 'skipped', reason: 'no_licensed_provider_configured' }, 409);
  }
  return json({ status: 'skipped', reason: 'unsupported_provider' }, 409);
}, { limit: 10 });

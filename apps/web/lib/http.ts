import { NextResponse } from 'next/server';
import { clientKey, rateLimit } from './rateLimit';

const BASE_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...BASE_HEADERS, ...headers } });
}

/** Wraps a route: rate limit, and generic errors without stack traces or internal messages. */
export function handler<C>(fn: (req: Request, ctx: C) => Promise<Response>, opts: { limit?: number } = {}) {
  return async (req: Request, ctx: C): Promise<Response> => {
    const rl = rateLimit(`${new URL(req.url).pathname}:${clientKey(req)}`, opts.limit ?? 60);
    if (!rl.ok) {
      return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) });
    }
    try {
      return await fn(req, ctx);
    } catch (e) {
      console.error(JSON.stringify({ event: 'api_error', path: new URL(req.url).pathname, name: (e as Error)?.name ?? 'Error' }));
      return json({ error: 'internal_error' }, 500);
    }
  };
}

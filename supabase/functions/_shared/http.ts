// Runtime-agnostic HTTP helpers shared by every Edge Function (no Deno APIs here,
// so the same code is unit-tested with Jest).

export function parseAllowedOrigins(csv: string | undefined): string[] {
  return (csv ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter((o) => /^https?:\/\/[^\s/]+$/.test(o));
}

/**
 * CORS is an allowlist: the request Origin is echoed back only when it is listed.
 * Requests without an Origin (native apps, server-to-server) are allowed because CORS
 * does not apply to them; authentication is enforced separately.
 */
export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) base['Access-Control-Allow-Origin'] = origin;
  return base;
}

export function isOriginAllowed(origin: string | null, allowed: string[]): boolean {
  return origin === null || allowed.includes(origin);
}

export function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

/** Constant-time string comparison for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Maps STUDIA_* database errors to stable HTTP responses without leaking internals. */
export function mapDbError(message: string | undefined): { status: number; code: string } {
  const m = message ?? '';
  if (m.includes('STUDIA_QUOTA_EXCEEDED')) return { status: 429, code: 'quota_exceeded' };
  if (m.includes('STUDIA_GLOBAL_BUDGET_EXHAUSTED')) return { status: 503, code: 'budget_exhausted' };
  if (m.includes('STUDIA_PROFILE_MISSING')) return { status: 403, code: 'profile_missing' };
  if (m.includes('STUDIA_NOT_FOUND')) return { status: 404, code: 'not_found' };
  return { status: 500, code: 'internal_error' };
}

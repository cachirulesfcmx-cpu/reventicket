import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '@/lib/rateLimit';

const req = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, init);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  resetRateLimits();
  vi.resetModules();
  vi.stubEnv('PREDICTIONS_ENABLED', 'false');
  vi.stubEnv('SPORTS_DATA_PROVIDER', 'demo');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-value-that-must-never-leak');
  vi.stubEnv('CRON_SECRET', 'test-cron-secret');
});
afterEach(() => vi.unstubAllEnvs());

describe('/api/health', () => {
  it('is public and never leaks configuration values', async () => {
    const { GET } = await import('@/app/api/health/route');
    const res = await GET(req('/api/health'), undefined);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(JSON.parse(text)).toMatchObject({ ok: true, dataMode: 'demo', predictionsFlag: false });
    expect(text).not.toContain('test-service-role');
    expect(text).not.toContain('test-cron-secret');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('/api/games', () => {
  it('returns labelled demo data filtered by sport', async () => {
    const { GET } = await import('@/app/api/games/route');
    const body = await (await GET(req('/api/games?sport=NBA&limit=5'), undefined)).json();
    expect(body.isDemo).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((g: { sport: string; isDemo: boolean }) => g.sport === 'NBA' && g.isDemo)).toBe(true);
  });

  it('covers all six competitions in demo mode', async () => {
    const { GET } = await import('@/app/api/games/route');
    const body = await (await GET(req('/api/games?limit=100'), undefined)).json();
    expect(new Set(body.data.map((g: { sport: string }) => g.sport))).toEqual(new Set(['LIGA_MX', 'UCL', 'LALIGA', 'NFL', 'MLB', 'NBA']));
  });

  it.each(['sport=CRICKET', 'limit=0', 'limit=1000', 'from=yesterday', 'from=2026-12-01T00:00:00Z&to=2026-11-01T00:00:00Z'])(
    'rejects invalid query %s with 400', async (q) => {
      const { GET } = await import('@/app/api/games/route');
      const res = await GET(req(`/api/games?${q}`), undefined);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('invalid_query');
    });

  it('rate limits abusive clients', async () => {
    const { GET } = await import('@/app/api/games/route');
    const headers = { 'x-forwarded-for': '203.0.113.9' };
    let last = 200;
    for (let i = 0; i < 61; i++) last = (await GET(req('/api/games', { headers }), undefined)).status;
    expect(last).toBe(429);
    expect((await GET(req('/api/games', { headers: { 'x-forwarded-for': '198.51.100.1' } }), undefined)).status).toBe(200);
  });

  it('hides internal errors', async () => {
    vi.doMock('@/lib/providers', () => ({ getProvider: () => ({ id: 'x', isDemo: false, listGames: () => { throw new Error('db password=hunter2'); } }) }));
    const { GET } = await import('@/app/api/games/route');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await GET(req('/api/games'), undefined);
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).toBe('{"error":"internal_error"}');
    expect(JSON.stringify(spy.mock.calls)).not.toContain('hunter2');
    vi.doUnmock('@/lib/providers');
  });
});

describe('/api/games/[id]', () => {
  it('returns a demo game and no prediction', async () => {
    const { GET } = await import('@/app/api/games/[id]/route');
    const body = await (await GET(req('/api/games/demo-nba-11'), ctx('demo-nba-11'))).json();
    expect(body.data.id).toBe('demo-nba-11');
    expect(body.prediction).toBeNull();
  });

  it('404s unknown ids and 400s malformed ids', async () => {
    const { GET } = await import('@/app/api/games/[id]/route');
    expect((await GET(req('/api/games/nope'), ctx('nope'))).status).toBe(404);
    expect((await GET(req('/api/games/x'), ctx('../../etc/passwd'))).status).toBe(400);
  });
});

describe('/api/picks', () => {
  it('never returns real picks while PREDICTIONS_ENABLED=false', async () => {
    const { GET } = await import('@/app/api/picks/route');
    const body = await (await GET(req('/api/picks'), undefined)).json();
    expect(body.publicationEnabled).toBe(false);
    expect(body.isDemo).toBe(true);
    expect(body.data.every((p: { isDemo: boolean; probability: number | null }) => p.isDemo && p.probability === null)).toBe(true);
  });

  it('stays in demo mode if the flag is on but the database is not configured', async () => {
    vi.stubEnv('PREDICTIONS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const { GET } = await import('@/app/api/picks/route');
    expect((await (await GET(req('/api/picks'), undefined)).json()).publicationEnabled).toBe(false);
  });
});

describe('/api/performance', () => {
  it('reports research results with publication disabled and no approved model', async () => {
    const { GET } = await import('@/app/api/performance/route');
    const body = await (await GET(req('/api/performance'), undefined)).json();
    expect(body.publicationEnabled).toBe(false);
    expect(body.reports.length).toBeGreaterThan(0);
    for (const r of body.reports) for (const g of r.gates) expect(g.status).toBe('experimental_not_publishable');
  });
});

describe('/api/cron/ingest', () => {
  it('requires the cron secret', async () => {
    const { POST } = await import('@/app/api/cron/ingest/route');
    expect((await POST(req('/api/cron/ingest', { method: 'POST' }), undefined)).status).toBe(401);
    expect((await POST(req('/api/cron/ingest', { method: 'POST', headers: { authorization: 'Bearer wrong' } }), undefined)).status).toBe(401);
  });

  it('refuses to write demo data into canonical tables', async () => {
    const { POST } = await import('@/app/api/cron/ingest/route');
    const res = await POST(req('/api/cron/ingest', { method: 'POST', headers: { authorization: 'Bearer test-cron-secret' } }), undefined);
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe('no_licensed_provider_configured');
  });

  it('fails closed when no secret is configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const { POST } = await import('@/app/api/cron/ingest/route');
    expect((await POST(req('/api/cron/ingest', { method: 'POST', headers: { authorization: 'Bearer ' } }), undefined)).status).toBe(401);
  });
});

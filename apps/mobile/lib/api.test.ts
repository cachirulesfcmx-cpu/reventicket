import { demoGames } from '@vanta-edge/shared';
import { ApiError, errorMessage, fetchGame, fetchGames, fetchPicks } from './api';

const cfg = (apiBase: string) => ({ apiBase, apiConfigured: !!apiBase, supabaseUrl: '', supabaseAnonKey: '', supabaseConfigured: false });
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
const as = (f: jest.Mock) => f as unknown as typeof fetch;

describe('mobile API client', () => {
  it('falls back to labelled demo data without an API', async () => {
    const feed = await fetchGames('NFL', { config: cfg('') });
    expect(feed.isDemo).toBe(true);
    expect(feed.data.length).toBeGreaterThan(0);
    expect(feed.data.every((g) => g.sport === 'NFL' && g.isDemo)).toBe(true);
    expect((await fetchPicks({ config: cfg('') })).publicationEnabled).toBe(false);
  });

  it('reads the web API when configured', async () => {
    const f = jest.fn(() => ok({ data: demoGames().slice(0, 1), isDemo: false, note: 'n' }));
    const feed = await fetchGames('LIGA_MX', { fetchImpl: as(f), config: cfg('https://example.test') });
    expect(f).toHaveBeenCalledWith('https://example.test/api/games?limit=100&sport=LIGA_MX', expect.anything());
    expect(feed.data).toHaveLength(1);
  });

  it('maps failures to friendly errors', async () => {
    const c = cfg('https://example.test');
    const down = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    await expect(fetchGames(undefined, { fetchImpl: as(down), config: c })).rejects.toMatchObject({ code: 'network' });
    expect(errorMessage(new ApiError('network'))).toMatch(/Sin conexión/);
    const bad = jest.fn(() => ok({ data: 'nope' }));
    await expect(fetchGames(undefined, { fetchImpl: as(bad), config: c })).rejects.toMatchObject({ code: 'invalid' });
    const missing = jest.fn(() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response));
    expect(await fetchGame('x', { fetchImpl: as(missing), config: c })).toBeNull();
  });
});

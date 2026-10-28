import { describe, expect, it } from 'vitest';
import { groupByDay, localDayKey } from '@/lib/format';
import { DemoProvider, demoGames } from '@/lib/providers/demo';
import { toGame } from '@/lib/providers/supabase';
import { rateLimit } from '@/lib/rateLimit';

describe('time zones', () => {
  it('groups by Mexico City calendar day, not UTC', () => {
    // 2026-11-01 03:00 UTC is still Oct 31 in CDMX (UTC-6).
    expect(localDayKey('2026-11-01T03:00:00Z')).toBe('2026-10-31');
    const g = groupByDay([{ startsAt: '2026-11-01T03:00:00Z' }, { startsAt: '2026-11-01T07:00:00Z' }]);
    expect(g.map((d) => d.day)).toEqual(['2026-10-31', '2026-11-01']);
  });
});

describe('demo provider', () => {
  const now = new Date('2026-10-28T18:20:00Z');
  it('marks every record as demo with future kickoffs and no scores', () => {
    for (const g of demoGames(now)) {
      expect(g.isDemo).toBe(true);
      expect(new Date(g.startsAt).getTime()).toBeGreaterThan(now.getTime());
      expect(g.homeScore).toBeNull();
    }
  });
  it('filters and limits', async () => {
    const p = new DemoProvider(() => now);
    expect((await p.listGames({ sport: 'LIGA_MX', limit: 1 })).length).toBe(1);
    expect(await p.getGame('missing')).toBeNull();
  });
});

describe('database mapping', () => {
  it('maps rows and tolerates missing team joins', () => {
    const g = toGame({ id: 'x', sport: 'NFL', competition: 'NFL', starts_at: '2026-11-01T00:00:00Z', status: 'scheduled', home_score: null,
      away_score: null, data_quality: 'confirmed', source_updated_at: null, home: null, away: { id: 'b', name: 'B', short_name: 'B', logo_url: null } });
    expect(g.isDemo).toBe(false);
    expect(g.home.name).toBe('Por confirmar');
  });
});

describe('rate limiter', () => {
  it('resets after the window', () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) rateLimit('k', 3, 1000, t);
    expect(rateLimit('k', 3, 1000, t).ok).toBe(false);
    expect(rateLimit('k', 3, 1000, t + 1001).ok).toBe(true);
  });
});

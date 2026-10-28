import { describe, expect, it } from 'vitest';
import {
  americanToDecimal, buildExplanation, edge, expectedValue, formatPercent, GamesQuerySchema, isSport, isStale,
  noVigPower, noVigProportional, overround, ProviderGameSchema,
} from './index';

const now = new Date('2026-10-28T18:00:00Z');

describe('probability math', () => {
  it('removes the margin', () => {
    for (const f of [noVigProportional, noVigPower]) {
      const p = f([1.5, 4.2, 6.5]);
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
      expect(p[0]!).toBeGreaterThan(p[1]!);
    }
    expect(overround([1.91, 1.91])).toBeCloseTo(0.0471, 3);
    expect(noVigPower([1.25, 5, 12])[0]!).toBeGreaterThan(noVigProportional([1.25, 5, 12])[0]!);
  });

  it('computes edge and expected value', () => {
    expect(edge(0.6, 0.55)).toBeCloseTo(0.05, 12);
    expect(expectedValue(0.5, 2.2)).toBeCloseTo(0.1, 12);
  });

  it('rejects out-of-range inputs', () => {
    expect(() => noVigPower([1, 2])).toThrow(RangeError);
    expect(() => noVigPower([2])).toThrow(RangeError);
    expect(() => noVigPower([Number.NaN, 2])).toThrow(RangeError);
    expect(() => edge(1.2, 0.5)).toThrow(RangeError);
    expect(() => edge(0.5, -0.1)).toThrow(RangeError);
    expect(() => expectedValue(0.5, 1)).toThrow(RangeError);
    expect(() => americanToDecimal(0)).toThrow(RangeError);
    expect(() => americanToDecimal(50)).toThrow(RangeError);
  });

  it('converts american odds', () => {
    expect(americanToDecimal(150)).toBe(2.5);
    expect(americanToDecimal(-200)).toBeCloseTo(1.5, 12);
  });

  it('formats missing values safely', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(Number.NaN)).toBe('—');
    expect(formatPercent(0.4567)).toBe('45.7 %');
  });
});

describe('validation', () => {
  it('validates game queries', () => {
    expect(GamesQuerySchema.parse({ sport: 'NBA', limit: '10' })).toMatchObject({ sport: 'NBA', limit: 10 });
    expect(GamesQuerySchema.safeParse({ sport: 'CRICKET' }).success).toBe(false);
    expect(GamesQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
    expect(GamesQuerySchema.safeParse({ from: '2026-11-01T00:00:00Z', to: '2026-10-01T00:00:00Z' }).success).toBe(false);
  });

  it('sanitises provider games', () => {
    const base = {
      providerEventId: ' 123 ', sport: 'LIGA_MX', competition: 'Liga MX', startsAt: '2026-11-01T02:00:00Z', status: 'scheduled',
      home: { providerTeamId: 'a', name: ' Tigres ', shortName: 'TIG' }, away: { providerTeamId: 'b', name: 'Pumas', shortName: 'PUM' },
      sourceUpdatedAt: '2026-10-28T17:00:00Z',
    };
    const g = ProviderGameSchema.parse(base);
    expect(g.providerEventId).toBe('123');
    expect(g.home.name).toBe('Tigres');
    expect(ProviderGameSchema.safeParse({ ...base, away: base.home }).success).toBe(false);
    expect(ProviderGameSchema.safeParse({ ...base, status: 'final' }).success).toBe(false);
    expect(ProviderGameSchema.safeParse({ ...base, homeScore: -1 }).success).toBe(false);
    expect(ProviderGameSchema.safeParse({ ...base, sport: 'F1' }).success).toBe(false);
  });

  it('detects stale data', () => {
    expect(isStale({ sourceUpdatedAt: null, status: 'scheduled' }, now)).toBe(true);
    expect(isStale({ sourceUpdatedAt: '2026-10-28T17:00:00Z', status: 'scheduled' }, now)).toBe(false);
    expect(isStale({ sourceUpdatedAt: '2026-10-28T17:50:00Z', status: 'live' }, now)).toBe(true);
    expect(isStale({ sourceUpdatedAt: 'garbage', status: 'scheduled' }, now)).toBe(true);
    expect(isSport('NBA')).toBe(true);
    expect(isSport('nba')).toBe(false);
  });
});

describe('explanations', () => {
  it('never produces a probability when none exists', () => {
    expect(buildExplanation({ probability: null, facts: [], validated: false })).toMatch(/Sin probabilidad/);
  });

  it('labels experimental output and cites sources', () => {
    const t = buildExplanation({
      probability: 0.42, marketProbability: 0.45, validated: false, modelName: 'online_poisson',
      facts: [{ label: 'Goles esperados local', value: 1.4, source: 'provider-x', observedAt: '2026-10-28T12:00:00Z' }],
    });
    expect(t).toMatch(/experimental/);
    expect(t).toMatch(/provider-x/);
    expect(t).toMatch(/no garantizan/);
  });
});

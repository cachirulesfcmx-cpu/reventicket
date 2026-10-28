// Odds arithmetic shared by web, mobile and tests. Mirrors services/predictor/vanta_predictor/odds.py.

function assertOdds(odds: readonly number[]): void {
  if (odds.length < 2 || odds.some((o) => !Number.isFinite(o) || o <= 1)) {
    throw new RangeError('decimal odds must contain at least two finite values > 1');
  }
}

export function impliedProbabilities(odds: readonly number[]): number[] {
  assertOdds(odds);
  return odds.map((o) => 1 / o);
}

export function overround(odds: readonly number[]): number {
  return impliedProbabilities(odds).reduce((a, b) => a + b, 0) - 1;
}

export function noVigProportional(odds: readonly number[]): number[] {
  const p = impliedProbabilities(odds);
  const s = p.reduce((a, b) => a + b, 0);
  return p.map((x) => x / s);
}

/** Power method: find k with Σ p_i^k = 1 (bisection). */
export function noVigPower(odds: readonly number[]): number[] {
  const p = impliedProbabilities(odds);
  let lo = 0.5;
  let hi = 5;
  let k = 1;
  for (let i = 0; i < 200; i++) {
    k = (lo + hi) / 2;
    const s = p.reduce((a, x) => a + x ** k, 0);
    if (Math.abs(s - 1) < 1e-12) break;
    if (s > 1) lo = k;
    else hi = k;
  }
  const q = p.map((x) => x ** k);
  const s = q.reduce((a, b) => a + b, 0);
  return q.map((x) => x / s);
}

export function assertProbability(p: number): void {
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError('probability must be within [0, 1]');
}

export function edge(modelProbability: number, marketProbability: number): number {
  assertProbability(modelProbability);
  assertProbability(marketProbability);
  return modelProbability - marketProbability;
}

/** Expected profit per unit staked, before costs and limits. */
export function expectedValue(modelProbability: number, decimalOdds: number): number {
  assertProbability(modelProbability);
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) throw new RangeError('decimal odds must be > 1');
  return modelProbability * decimalOdds - 1;
}

export function americanToDecimal(american: number): number {
  if (!Number.isFinite(american) || american === 0 || Math.abs(american) < 100) {
    throw new RangeError('american odds must be <= -100 or >= +100');
  }
  return american > 0 ? 1 + american / 100 : 1 + 100 / -american;
}

export function formatPercent(p: number | null | undefined, digits = 1): string {
  return p == null || !Number.isFinite(p) ? '—' : `${(p * 100).toFixed(digits)} %`;
}

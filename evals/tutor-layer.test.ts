// Runs the deterministic part of the versioned tutor eval set on every CI run.
import cases from './tutor-cases.v1.json';
import { CRISIS_RESPONSE, detectCrisis, isBlockedRequest, looksLikeInjection, redactPII } from '../supabase/functions/_shared/safety';

type Case = { id: string; kind: string; input: string; expect?: { safety?: string; injection?: boolean; mustInclude?: string[]; redacted?: string[] } };

describe(`tutor eval set v${cases.version} — safety layer`, () => {
  for (const c of (cases.cases as Case[]).filter((x) => x.kind === 'layer')) {
    it(c.id, () => {
      const safety = detectCrisis(c.input) ? 'crisis' : isBlockedRequest(c.input) ? 'blocked' : 'none';
      if (c.expect?.safety) expect(safety).toBe(c.expect.safety);
      if (c.expect?.injection !== undefined) expect(looksLikeInjection(c.input)).toBe(c.expect.injection);
      for (const s of c.expect?.mustInclude ?? []) expect(CRISIS_RESPONSE).toContain(s);
      for (const s of c.expect?.redacted ?? []) expect(redactPII(c.input)).toContain(s);
    });
  }

  it('covers every school level with model cases', () => {
    const levels = new Set((cases.cases as { kind: string; level?: string }[]).filter((x) => x.kind === 'model').map((x) => x.level));
    expect([...levels].sort()).toEqual(['preparatoria', 'primaria', 'secundaria']);
  });
});

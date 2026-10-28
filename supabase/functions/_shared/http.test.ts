import { corsHeaders, isOriginAllowed, mapDbError, parseAllowedOrigins, safeEqual } from './http';

describe('CORS allowlist', () => {
  const allowed = parseAllowedOrigins('https://app.studia.mx, https://staging.studia.mx/ , javascript:alert(1), *');

  it('parses only well-formed origins (no wildcard)', () => {
    expect(allowed).toEqual(['https://app.studia.mx', 'https://staging.studia.mx']);
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });

  it('echoes only allowed origins', () => {
    expect(corsHeaders('https://app.studia.mx', allowed)['Access-Control-Allow-Origin']).toBe('https://app.studia.mx');
    expect(corsHeaders('https://evil.example', allowed)['Access-Control-Allow-Origin']).toBeUndefined();
    expect(Object.values(corsHeaders(null, allowed))).not.toContain('*');
  });

  it('blocks disallowed browser origins but not native clients', () => {
    expect(isOriginAllowed('https://evil.example', allowed)).toBe(false);
    expect(isOriginAllowed(null, allowed)).toBe(true);
  });
});

describe('helpers', () => {
  it('compares secrets safely', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('maps DB errors without leaking internals', () => {
    expect(mapDbError('ERROR: STUDIA_QUOTA_EXCEEDED')).toEqual({ status: 429, code: 'quota_exceeded' });
    expect(mapDbError('STUDIA_GLOBAL_BUDGET_EXHAUSTED')).toEqual({ status: 503, code: 'budget_exhausted' });
    expect(mapDbError('syntax error at or near')).toEqual({ status: 500, code: 'internal_error' });
  });
});

import { isValidEmail, parseTopics, passwordIssues, validatePlan } from './validation';
import { friendlyError } from './errors';
import { colors, contrastRatio } from './theme';

const NOW = new Date(2026, 9, 28);

describe('validation', () => {
  it('validates emails', () => {
    expect(isValidEmail('ana@example.com')).toBe(true);
    expect(isValidEmail('ana@example')).toBe(false);
    expect(isValidEmail('a na@example.com')).toBe(false);
  });

  it('matches the server password policy', () => {
    expect(passwordIssues('Abcdefghi1')).toEqual([]);
    expect(passwordIssues('short')).toHaveLength(3);
  });

  it('normalizes and caps topics', () => {
    expect(parseTopics('Fracciones, fracciones ,\nPorcentajes,,  ')).toEqual(['Fracciones', 'Porcentajes']);
    expect(parseTopics(Array.from({ length: 40 }, (_, i) => `t${i}`).join(','))).toHaveLength(30);
  });

  it('validates plans', () => {
    const ok = { title: 'Parcial', subject: 'matematicas', topics: 'Fracciones', examDate: '2026-11-01' };
    expect(validatePlan(ok, NOW)).toBeNull();
    expect(validatePlan({ ...ok, title: ' ' }, NOW)).toMatch(/nombre/);
    expect(validatePlan({ ...ok, topics: ' , ' }, NOW)).toMatch(/tema/);
    expect(validatePlan({ ...ok, examDate: '2026-10-01' }, NOW)).toMatch(/pasó/);
    expect(validatePlan({ ...ok, examDate: '01/11/2026' }, NOW)).toMatch(/formato/);
    expect(validatePlan({ ...ok, examDate: '' }, NOW)).toBeNull();
  });
});

describe('friendly errors', () => {
  it('maps server codes and hides raw SQL', () => {
    expect(friendlyError(new Error('P0001: STUDIA_GUARDIAN_CONSENT_REQUIRED'))).toMatch(/autorización/);
    expect(friendlyError({ message: 'quota_exceeded' })).toMatch(/límite diario/);
    expect(friendlyError(new Error('TypeError: Failed to fetch'))).toMatch(/Sin conexión/);
    expect(friendlyError(new Error('relation "x" does not exist'))).toBe('Algo salió mal. Intenta de nuevo.');
  });
});

describe('theme accessibility', () => {
  it('meets WCAG AA contrast for body text on the canvas', () => {
    expect(contrastRatio(colors.text, colors.bg)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(colors.muted, colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.lilac, colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.mint, colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.danger, colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#FFFFFF', colors.violetDeep)).toBeGreaterThanOrEqual(4.5);
  });
});

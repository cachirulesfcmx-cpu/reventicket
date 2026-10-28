import { addDays, daysBetween, examDateOptions, formatLong, parseISODate, relativeExamLabel, toISODate, upcomingDays } from './dates';

const NOW = new Date(2026, 9, 27, 23, 30); // martes 27 oct 2026, late evening local time

describe('dates', () => {
  it('computes exam options from "now" instead of hard-coded days', () => {
    const opts = examDateOptions(NOW);
    expect(opts.map((o) => o.iso)).toEqual(['2026-10-28', '2026-10-29', '2026-10-30', '2026-11-03']);
    expect(opts[0]).toMatchObject({ title: 'Mañana', subtitle: 'miércoles, 28 de octubre', day: 28, month: 'OCT' });
  });

  it('rolls over months and years', () => {
    expect(toISODate(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
    expect(examDateOptions(new Date(2026, 1, 27))[1].iso).toBe('2026-03-01');
  });

  it('rejects impossible or malformed dates', () => {
    expect(parseISODate('2026-02-30')).toBeNull();
    expect(parseISODate('28/10/2026')).toBeNull();
    expect(parseISODate('2026-10-28')?.getDate()).toBe(28);
  });

  it('counts calendar days, not 24h blocks', () => {
    expect(daysBetween(NOW, new Date(2026, 9, 28, 0, 5))).toBe(1);
  });

  it('labels relative exam dates', () => {
    expect(relativeExamLabel('2026-10-28', NOW)).toBe('Mañana');
    expect(relativeExamLabel('2026-10-27', NOW)).toBe('Hoy');
    expect(relativeExamLabel('2026-11-06', NOW)).toBe('En 10 días · viernes, 6 de noviembre');
    expect(relativeExamLabel(null, NOW)).toBe('Sin fecha');
    expect(relativeExamLabel('2026-10-01', NOW)).toMatch(/^Fue el/);
  });

  it('offers a future-only calendar', () => {
    const days = upcomingDays(NOW, 60);
    expect(days).toHaveLength(60);
    expect(days[0].iso).toBe('2026-10-28');
    expect(formatLong(new Date(2026, 9, 31))).toBe('sábado, 31 de octubre');
  });
});

// Local-calendar date helpers (no UTC drift) with Spanish (México) labels.
// Hand-rolled names keep output identical on Hermes, web and Jest.

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const r = startOfDay(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Parses YYYY-MM-DD as a local date; returns null for invalid or impossible dates. */
export function parseISODate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

export function formatLong(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function monthShort(d: Date): string {
  return MONTHS[d.getMonth()].slice(0, 3).toUpperCase();
}

export type DateOption = { key: string; title: string; subtitle: string; iso: string; day: number; month: string };

/** Quick exam-date choices computed from "now" (never hard-coded). */
export function examDateOptions(now: Date): DateOption[] {
  return [
    { key: 'd1', title: 'Mañana', offset: 1 },
    { key: 'd2', title: 'En 2 días', offset: 2 },
    { key: 'd3', title: 'En 3 días', offset: 3 },
    { key: 'd7', title: 'En una semana', offset: 7 },
  ].map(({ key, title, offset }) => {
    const d = addDays(now, offset);
    return { key, title, subtitle: formatLong(d), iso: toISODate(d), day: d.getDate(), month: monthShort(d) };
  });
}

/** Calendar of selectable days (tomorrow … +N) for "otra fecha". */
export function upcomingDays(now: Date, count = 60): DateOption[] {
  return Array.from({ length: count }, (_, i) => {
    const d = addDays(now, i + 1);
    return { key: toISODate(d), title: formatLong(d), subtitle: '', iso: toISODate(d), day: d.getDate(), month: monthShort(d) };
  });
}

export function relativeExamLabel(iso: string | null, now: Date): string {
  if (!iso) return 'Sin fecha';
  const d = parseISODate(iso);
  if (!d) return 'Sin fecha';
  const n = daysBetween(now, d);
  if (n < 0) return `Fue el ${formatLong(d)}`;
  if (n === 0) return 'Hoy';
  if (n === 1) return 'Mañana';
  return `En ${n} días · ${formatLong(d)}`;
}

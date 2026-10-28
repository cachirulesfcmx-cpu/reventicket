export const TIME_ZONE = 'America/Mexico_City';

const dateTime = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });
const dayKey = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIME_ZONE });
const dayLabel = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIME_ZONE });

export const formatKickoff = (iso: string) => `${dateTime.format(new Date(iso))} (CDMX)`;
export const localDayKey = (iso: string) => dayKey.format(new Date(iso));
export const formatDay = (iso: string) => dayLabel.format(new Date(iso));

export function groupByDay<T extends { startsAt: string }>(items: T[]): { day: string; label: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = localDayKey(it.startsAt);
    map.set(k, [...(map.get(k) ?? []), it]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, list]) => ({ day, label: formatDay(list[0]!.startsAt), items: list }));
}

export const fmt = (n: number | null | undefined, digits = 3) => (n == null || !Number.isFinite(n) ? '—' : n.toFixed(digits));
export const signed = (n: number, digits = 3) => `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;

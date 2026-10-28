const TZ = 'America/Mexico_City';
const dt = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ });
export const formatKickoff = (iso: string) => `${dt.format(new Date(iso))} (CDMX)`;

import { demoGames, type Game, type Pick, type Sport } from '@vanta-edge/shared';
import { getConfig } from './config';

export type Feed<T> = { data: T; isDemo: boolean; note: string };
export type Deps = { fetchImpl?: typeof fetch; config?: ReturnType<typeof getConfig> };

export class ApiError extends Error {
  constructor(public code: 'network' | 'timeout' | 'http' | 'invalid', message?: string) {
    super(message ?? code);
  }
}

async function getJson<T>(path: string, deps: Deps, timeoutMs = 10_000): Promise<T> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const cfg = deps.config ?? getConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${cfg.apiBase}${path}`, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new ApiError('http', String(res.status));
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(controller.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
}

/** Without a configured API the app shows the shared, clearly labelled demo fixtures. */
export async function fetchGames(sport?: Sport, deps: Deps = {}): Promise<Feed<Game[]>> {
  if (!(deps.config ?? getConfig()).apiConfigured) {
    const data = demoGames().filter((g) => !sport || g.sport === sport);
    return { data, isDemo: true, note: 'Datos de demostración: partidos ficticios.' };
  }
  const body = await getJson<{ data: Game[]; isDemo: boolean; note: string }>(`/api/games?limit=100${sport ? `&sport=${sport}` : ''}`, deps);
  if (!Array.isArray(body.data)) throw new ApiError('invalid');
  return { data: body.data, isDemo: !!body.isDemo, note: body.note };
}

export async function fetchGame(id: string, deps: Deps = {}): Promise<Game | null> {
  if (!(deps.config ?? getConfig()).apiConfigured) return demoGames().find((g) => g.id === id) ?? null;
  try {
    return (await getJson<{ data: Game }>(`/api/games/${encodeURIComponent(id)}`, deps)).data;
  } catch (e) {
    if (e instanceof ApiError && e.code === 'http' && e.message === '404') return null;
    throw e;
  }
}

export async function fetchPicks(deps: Deps = {}): Promise<Feed<Pick[]> & { publicationEnabled: boolean }> {
  if (!(deps.config ?? getConfig()).apiConfigured) {
    return { data: [], isDemo: true, publicationEnabled: false, note: 'Picks reales desactivados: ningún modelo ha superado la validación.' };
  }
  const b = await getJson<{ data: Pick[]; isDemo: boolean; note: string; publicationEnabled: boolean }>('/api/picks', deps);
  return { data: b.data, isDemo: b.isDemo, note: b.note, publicationEnabled: !!b.publicationEnabled };
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError && e.code === 'timeout') return 'El servidor tardó demasiado. Intenta de nuevo.';
  if (e instanceof ApiError && e.code === 'network') return 'Sin conexión. Revisa tu internet.';
  return 'No pudimos cargar los datos. Intenta de nuevo.';
}

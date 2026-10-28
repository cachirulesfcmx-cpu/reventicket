export const SPORTS = ['LIGA_MX', 'UCL', 'LALIGA', 'NFL', 'MLB', 'NBA'] as const;
export type Sport = (typeof SPORTS)[number];
export type EventStatus = 'scheduled' | 'live' | 'final' | 'postponed' | 'cancelled';
export type DataQuality = 'confirmed' | 'provisional' | 'stale' | 'missing';

export interface Team { id: string; name: string; shortName: string; logoUrl?: string | null }

export interface Game {
  id: string;
  sport: Sport;
  competition: string;
  home: Team;
  away: Team;
  startsAt: string;
  status: EventStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  dataQuality: DataQuality;
  sourceUpdatedAt?: string | null;
  isDemo: boolean;
}

export type ConfidenceLabel = 'experimental' | 'validated' | 'not_available';

export interface Pick {
  id: string;
  gameId: string;
  sport: Sport;
  market: string;
  selection: string;
  probability: number | null;
  odds?: number | null;
  marketProbability?: number | null;
  edge?: number | null;
  confidenceLabel: ConfidenceLabel;
  explanation: string;
  publishedAt: string;
  isDemo: boolean;
}

export const SPORT_LABELS: Record<Sport, string> = {
  LIGA_MX: 'Liga MX', UCL: 'Champions League', LALIGA: 'LaLiga', NFL: 'NFL', MLB: 'MLB', NBA: 'NBA',
};

export const SPORT_META: Record<Sport, { icon: string; region: string; baseline: string }> = {
  LIGA_MX: { icon: '⚽', region: 'Fútbol mexicano', baseline: 'Ratings Elo/Poisson de goles' },
  UCL: { icon: '✦', region: 'Europa', baseline: 'Ratings Elo/Poisson de goles' },
  LALIGA: { icon: '⚽', region: 'España', baseline: 'Ratings Elo/Poisson de goles' },
  NFL: { icon: '🏈', region: 'Fútbol americano', baseline: 'Elo con margen de victoria' },
  MLB: { icon: '⚾', region: 'Béisbol', baseline: 'Carreras, abridor y bullpen (pendiente de datos)' },
  NBA: { icon: '🏀', region: 'Baloncesto', baseline: 'Posesiones y eficiencia (pendiente de datos)' },
};

export function isSport(value: string): value is Sport {
  return (SPORTS as readonly string[]).includes(value);
}

/** A game is stale when the provider has not refreshed it within `maxAgeMinutes`. */
export function isStale(game: Pick2<Game, 'sourceUpdatedAt' | 'status'>, now: Date, maxAgeMinutes = 360): boolean {
  if (!game.sourceUpdatedAt) return true;
  const age = (now.getTime() - new Date(game.sourceUpdatedAt).getTime()) / 60_000;
  const limit = game.status === 'live' ? 5 : maxAgeMinutes;
  return !Number.isFinite(age) || age > limit;
}
type Pick2<T, K extends keyof T> = { [P in K]: T[P] };

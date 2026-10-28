export const SPORTS = ["LIGA_MX", "UCL", "LALIGA", "NFL", "MLB", "NBA"] as const;
export type Sport = typeof SPORTS[number];
export type EventStatus = "scheduled" | "live" | "final" | "postponed" | "cancelled";
export type DataQuality = "confirmed" | "provisional" | "stale" | "missing";
export interface Team { id: string; name: string; shortName: string; logoUrl?: string | null }
export interface Game { id: string; sport: Sport; competition: string; home: Team; away: Team; startsAt: string; status: EventStatus; homeScore?: number | null; awayScore?: number | null; dataQuality: DataQuality; sourceUpdatedAt?: string | null }
export interface Pick { id: string; gameId: string; sport: Sport; market: string; selection: string; probability: number; odds?: number | null; marketProbability?: number | null; edge?: number | null; confidenceLabel: "experimental" | "validated" | "not_available"; explanation: string; publishedAt: string; isDemo: boolean }
export const SPORT_LABELS: Record<Sport, string> = { LIGA_MX: "Liga MX", UCL: "Champions League", LALIGA: "LaLiga", NFL: "NFL", MLB: "MLB", NBA: "NBA" };

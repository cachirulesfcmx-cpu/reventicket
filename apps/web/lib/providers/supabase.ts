import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Game } from '@vanta-edge/shared';
import { env } from '../env';
import type { GamesQuery, SportsDataProvider } from './types';

type Row = {
  id: string; sport: Game['sport']; competition: string; starts_at: string; status: Game['status'];
  home_score: number | null; away_score: number | null; data_quality: Game['dataQuality']; source_updated_at: string | null;
  home: { id: string; name: string; short_name: string; logo_url: string | null } | null;
  away: { id: string; name: string; short_name: string; logo_url: string | null } | null;
};

const COLUMNS = 'id,sport,competition,starts_at,status,home_score,away_score,data_quality,source_updated_at,' +
  'home:teams!games_home_team_id_fkey(id,name,short_name,logo_url),away:teams!games_away_team_id_fkey(id,name,short_name,logo_url)';

export function toGame(r: Row): Game {
  const team = (t: Row['home']) => ({ id: t?.id ?? 'unknown', name: t?.name ?? 'Por confirmar', shortName: t?.short_name ?? '—', logoUrl: t?.logo_url ?? null });
  return {
    id: r.id, sport: r.sport, competition: r.competition, startsAt: r.starts_at, status: r.status,
    homeScore: r.home_score, awayScore: r.away_score, dataQuality: r.data_quality, sourceUpdatedAt: r.source_updated_at,
    home: team(r.home), away: team(r.away), isDemo: false,
  };
}

/** Reads canonical games with the anon key: RLS and column grants decide what is visible. */
export class SupabaseProvider implements SportsDataProvider {
  readonly id = 'supabase';
  readonly isDemo = false;
  private readonly db: SupabaseClient;

  constructor(db?: SupabaseClient) {
    this.db = db ?? createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false } });
  }

  async listGames(q: GamesQuery): Promise<Game[]> {
    let query = this.db.from('games').select(COLUMNS).order('starts_at').limit(q.limit);
    if (q.sport) query = query.eq('sport', q.sport);
    if (q.from) query = query.gte('starts_at', q.from);
    if (q.to) query = query.lte('starts_at', q.to);
    const { data, error } = await query;
    if (error) throw new Error('games_query_failed');
    return (data as unknown as Row[]).map(toGame);
  }

  async getGame(id: string): Promise<Game | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data, error } = await this.db.from('games').select(COLUMNS).eq('id', id).maybeSingle();
    if (error) throw new Error('game_query_failed');
    return data ? toGame(data as unknown as Row) : null;
  }
}

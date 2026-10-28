import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { buildExplanation, type Pick } from '@vanta-edge/shared';
import { env, supabaseConfigured } from './env';
import { demoGames } from './providers/demo';

export type PicksFeed = { data: Pick[]; source: 'demo' | 'database'; isDemo: boolean; publicationEnabled: boolean; note: string };

type PredictionRow = {
  id: string; game_id: string; sport: Pick['sport']; market_key: string; selection_key: string; probability: number;
  decimal_odds: number | null; market_probability: number | null; edge: number | null; published_at: string;
  explanation: { text?: string } | null;
};

/** Real picks only when publication is enabled AND the database exposes approved-model rows (RLS). */
export async function getPicks(): Promise<PicksFeed> {
  if (!env.predictionsEnabled || !supabaseConfigured()) {
    return {
      data: demoGames().slice(0, 6).map((g, i) => ({
        id: `demo-pick-${i + 1}`, gameId: g.id, sport: g.sport, market: 'Ejemplo de mercado', selection: 'Sin recomendación publicada',
        probability: null, confidenceLabel: 'not_available',
        explanation: buildExplanation({ probability: null, facts: [], validated: false }),
        publishedAt: new Date().toISOString(), isDemo: true,
      })),
      source: 'demo', isDemo: true, publicationEnabled: false,
      note: 'Picks reales desactivados: ningún modelo ha superado la validación fuera de muestra.',
    };
  }
  const db = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false } });
  const { data, error } = await db.from('predictions')
    .select('id,game_id,sport,market_key,selection_key,probability,decimal_odds,market_probability,edge,published_at,explanation')
    .eq('status', 'published').order('published_at', { ascending: false }).limit(50);
  if (error) throw new Error('picks_query_failed');
  return {
    data: (data as PredictionRow[]).map((r) => ({
      id: r.id, gameId: r.game_id, sport: r.sport, market: r.market_key, selection: r.selection_key,
      probability: Number(r.probability), odds: r.decimal_odds, marketProbability: r.market_probability, edge: r.edge,
      confidenceLabel: 'validated', explanation: r.explanation?.text ?? '', publishedAt: r.published_at, isDemo: false,
    })),
    source: 'database', isDemo: false, publicationEnabled: true,
    note: 'Solo predicciones de modelos aprobados. No garantizan resultados.',
  };
}

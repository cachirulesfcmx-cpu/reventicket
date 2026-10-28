import summary from '../data/research-summary.json';
import type { Sport } from '@vanta-edge/shared';

export type Interval = [number, number, number];
export type ResearchModel = {
  logLoss: number; brier: number; ece: number; vsMarket: Interval; vsBaseline: Interval;
  betSim: { n_bets: number; roi: number; roi_ci_low: number; roi_ci_high: number; note: string };
};
export type ResearchReport = {
  sport: Sport; market: string;
  holdout: { start: string; end: string; events: number; withOdds: number };
  source: { provider: string; terms: string };
  baselines: Record<string, { log_loss: number; brier: number }>;
  models: Record<string, ResearchModel>;
  gates: { model: string; status: string; checks: { check: string; passed: boolean; detail: string }[] }[];
};

export const research = summary as unknown as { generatedAt: string; note: string; reports: ResearchReport[] };

export function researchFor(sport: Sport): ResearchReport | undefined {
  return research.reports.find((r) => r.sport === sport);
}

export const approvedModelCount = () => research.reports.flatMap((r) => r.gates).filter((g) => g.status === 'candidate_pending_human_approval').length;
export const evaluatedModelCount = () => research.reports.flatMap((r) => r.gates).length;

// Copies aggregate backtest metrics (no raw third-party data) from the predictor reports into
// the web app, so the "Rendimiento" page shows exactly what the research produced.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'services/predictor/reports';
const reports = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
const summary = {
  generatedAt: new Date().toISOString(),
  note: 'Investigación offline. Ningún modelo está aprobado para publicar picks.',
  reports: reports.map((r) => ({
    sport: r.sport,
    market: r.market,
    holdout: { start: r.holdout_start, end: r.holdout_end, events: r.holdout_events, withOdds: r.holdout_events_with_odds },
    source: { provider: r.source.provider, terms: r.source.terms },
    baselines: r.baselines,
    models: Object.fromEntries(Object.entries(r.models).map(([k, v]) => [k, {
      logLoss: v.log_loss, brier: v.brier, ece: v.ece_home_win,
      vsMarket: v.log_loss_diff_vs_market, vsBaseline: v.log_loss_diff_vs_climatology, betSim: v.bet_sim,
    }])),
    gates: r.gates.map((g) => ({ model: g.model, status: g.status, checks: g.checks })),
  })),
};
writeFileSync('apps/web/data/research-summary.json', JSON.stringify(summary, null, 2) + '\n');
console.log(`wrote apps/web/data/research-summary.json (${summary.reports.length} reports)`);

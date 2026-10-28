import type { Metadata } from 'next';
import { SPORT_LABELS, SPORTS } from '@vanta-edge/shared';
import { Notice } from '@/components/ui';
import { fmt, signed } from '@/lib/format';
import { research, researchFor } from '@/lib/research';

export const metadata: Metadata = { title: 'Rendimiento de modelos' };

export default function Performance() {
  return (
    <>
      <div className="section-head"><div><h1 className="page-title">Rendimiento y validación</h1>
        <p>Backtesting cronológico con holdout bloqueado, comparado con un baseline ingenuo y con el mercado (cuotas de cierre sin margen).</p></div></div>
      <Notice tone="warn">{research.note} Menor log loss es mejor. Un intervalo de “vs mercado” por encima de 0 significa que el modelo es peor que el mercado.</Notice>
      {SPORTS.map((s) => {
        const r = researchFor(s);
        if (!r) {
          return (
            <section key={s} className="glass panel">
              <h2>{SPORT_LABELS[s]}</h2>
              <p className="muted">Sin evaluar: falta un dataset histórico con licencia y cobertura verificadas.</p>
            </section>
          );
        }
        return (
          <section key={s} className="glass panel" aria-labelledby={`perf-${s}`}>
            <h2 id={`perf-${s}`}>{SPORT_LABELS[s]} · {r.market}</h2>
            <p className="muted small">Holdout {r.holdout.start} → {r.holdout.end} · {r.holdout.events} partidos ({r.holdout.withOdds} con cuotas) · fuente: {r.source.provider} (solo investigación)</p>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Métricas de validación {SPORT_LABELS[s]}</caption>
                <thead><tr><th scope="col">Modelo</th><th scope="col">Log loss</th><th scope="col">Brier</th><th scope="col">Calibración (ECE)</th><th scope="col">vs mercado (IC 95 %)</th><th scope="col">ROI simulado (IC 95 %)</th><th scope="col">Gate</th></tr></thead>
                <tbody>
                  {Object.entries(r.baselines).map(([k, b]) => (
                    <tr key={k}><th scope="row">{k === 'market_no_vig' ? 'Mercado sin margen' : 'Baseline ingenuo'}</th><td>{fmt(b.log_loss)}</td><td>{fmt(b.brier)}</td><td>—</td><td>—</td><td>—</td><td>referencia</td></tr>
                  ))}
                  {Object.entries(r.models).map(([k, m]) => {
                    const gate = r.gates.find((g) => g.model === k);
                    return (
                      <tr key={k}>
                        <th scope="row">{k}</th><td>{fmt(m.logLoss)}</td><td>{fmt(m.brier)}</td><td>{fmt(m.ece)}</td>
                        <td>{signed(m.vsMarket[0])} [{signed(m.vsMarket[1])}, {signed(m.vsMarket[2])}]</td>
                        <td>{(m.betSim.roi * 100).toFixed(1)} % [{(m.betSim.roi_ci_low * 100).toFixed(1)}, {(m.betSim.roi_ci_high * 100).toFixed(1)}] · {m.betSim.n_bets} apuestas</td>
                        <td><span className={gate?.status === 'candidate_pending_human_approval' ? 'ok' : 'bad'}>{gate?.status === 'candidate_pending_human_approval' ? 'Candidato' : 'No publicable'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}

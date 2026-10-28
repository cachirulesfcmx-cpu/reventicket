import type { Metadata } from 'next';
import { formatPercent, SPORT_LABELS } from '@vanta-edge/shared';
import { DemoTag, EmptyState, Notice } from '@/components/ui';
import { getPicks } from '@/lib/picks';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Picks' };

export default async function Picks() {
  const feed = await getPicks();
  return (
    <>
      <div className="section-head"><div><h1 className="page-title">Picks</h1><p>Solo se publican predicciones de modelos aprobados, con su historial inmutable.</p></div></div>
      <Notice tone={feed.publicationEnabled ? 'info' : 'warn'}>{feed.note}</Notice>
      {feed.data.length === 0 ? <EmptyState title="Sin picks publicados">Cuando un modelo supere la validación y sea aprobado, sus picks aparecerán aquí.</EmptyState> : (
        <div className="games-grid">
          {feed.data.map((p) => (
            <article className="game-card glass" key={p.id}>
              <div className="game-meta"><span>{SPORT_LABELS[p.sport]}</span>{p.isDemo ? <DemoTag>DEMO</DemoTag> : null}</div>
              <h2 className="pick-title">{p.selection}</h2>
              <p className="muted">{p.market}</p>
              <p className="pick-prob" aria-label={`Probabilidad ${formatPercent(p.probability)}`}>{formatPercent(p.probability)}</p>
              <p className="muted small">{p.explanation}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

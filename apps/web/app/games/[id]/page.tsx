import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GameIdSchema, isStale, SPORT_LABELS, SPORT_META } from '@vanta-edge/shared';
import { DemoTag, Notice } from '@/components/ui';
import { formatKickoff } from '@/lib/format';
import { getProvider } from '@/lib/providers';
import { researchFor } from '@/lib/research';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ficha de partido' };

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = GameIdSchema.safeParse(id);
  if (!parsed.success) notFound();
  const game = await getProvider().getGame(parsed.data);
  if (!game) notFound();
  const stale = !game.isDemo && isStale(game, new Date());
  const research = researchFor(game.sport);
  return (
    <>
      <Link href={`/games?sport=${game.sport}`} className="text-link">← {SPORT_LABELS[game.sport]}</Link>
      <section className="match glass" aria-labelledby="match-title">
        <div className="game-meta"><span>{SPORT_META[game.sport].icon} {game.competition}</span>{game.isDemo ? <DemoTag /> : null}</div>
        <h1 id="match-title" className="match-title">{game.home.name} <span className="versus">vs</span> {game.away.name}</h1>
        <p className="muted"><time dateTime={game.startsAt}>{formatKickoff(game.startsAt)}</time> · Estado: {game.status}</p>
        {game.homeScore != null && game.awayScore != null ? <p className="match-score">{game.homeScore} – {game.awayScore}</p> : null}
      </section>

      <div className="detail-grid">
        <section className="glass panel" aria-labelledby="data-h">
          <h2 id="data-h">Datos</h2>
          <dl className="facts">
            <dt>Calidad</dt><dd>{game.isDemo ? 'Demostración (ficticio)' : game.dataQuality}</dd>
            <dt>Última actualización</dt><dd>{game.sourceUpdatedAt ? formatKickoff(game.sourceUpdatedAt) : 'No disponible'}</dd>
            <dt>Lesiones / alineaciones</dt><dd>Datos no disponibles</dd>
            <dt>Cuotas</dt><dd>Datos no disponibles (requiere licencia del proveedor)</dd>
          </dl>
          {stale ? <Notice tone="warn">Los datos de este partido están desactualizados.</Notice> : null}
        </section>
        <section className="glass panel" aria-labelledby="prob-h">
          <h2 id="prob-h">Probabilidades</h2>
          <p className="big-dash" aria-label="Sin probabilidad publicada">—</p>
          <p className="muted">Sin probabilidad publicada: no hay un modelo validado para {SPORT_LABELS[game.sport]}.</p>
          <p className="muted">Baseline previsto: {SPORT_META[game.sport].baseline}.</p>
          {research ? <Link className="text-link" href="/performance">Ver resultados de validación →</Link> : <p className="muted">Sin dataset histórico validado todavía.</p>}
        </section>
      </div>
    </>
  );
}

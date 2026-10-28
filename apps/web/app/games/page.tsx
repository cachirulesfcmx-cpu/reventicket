import type { Metadata } from 'next';
import { isSport, SPORT_LABELS } from '@vanta-edge/shared';
import { EmptyState, GameCard, SportFilter } from '@/components/ui';
import { groupByDay } from '@/lib/format';
import { getProvider } from '@/lib/providers';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Partidos' };

export default async function Games({ searchParams }: { searchParams: Promise<{ sport?: string }> }) {
  const { sport: raw } = await searchParams;
  const sport = raw && isSport(raw) ? raw : undefined;
  const provider = getProvider();
  const games = await provider.listGames({ sport, limit: 100 });
  const days = groupByDay(games);
  return (
    <>
      <div className="section-head">
        <div>
          <h1 className="page-title">Calendario{sport ? ` · ${SPORT_LABELS[sport]}` : ''}</h1>
          <p>Horarios en hora del centro de México (CDMX).{provider.isDemo ? ' Datos de demostración.' : ''}</p>
        </div>
      </div>
      <SportFilter active={sport} />
      {raw && !sport ? <EmptyState title="Deporte no reconocido">Elige una de las seis competiciones disponibles.</EmptyState> : null}
      {days.length === 0 ? (
        <EmptyState title="Sin partidos">No hay partidos disponibles para este filtro. Si el proveedor no cubre esta competición, se mostrará “datos no disponibles”.</EmptyState>
      ) : days.map((d) => (
        <section key={d.day} aria-labelledby={`day-${d.day}`}>
          <h2 className="day-title" id={`day-${d.day}`}>{d.label}</h2>
          <div className="games-grid">{d.items.map((g) => <GameCard key={g.id} game={g} />)}</div>
        </section>
      ))}
    </>
  );
}

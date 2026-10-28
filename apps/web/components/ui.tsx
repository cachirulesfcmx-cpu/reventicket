import Link from 'next/link';
import type { ReactNode } from 'react';
import { SPORT_LABELS, SPORT_META, SPORTS, type Game, type Sport } from '@vanta-edge/shared';
import { formatKickoff } from '@/lib/format';

export function DemoTag({ children = 'DEMO · ficticio' }: { children?: ReactNode }) {
  return <span className="demo-tag">{children}</span>;
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return <div className={`notice glass ${tone === 'warn' ? 'notice-warn' : ''}`} role="note">{children}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty glass" role="status">
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function SportFilter({ active, base = '/games' }: { active?: Sport; base?: string }) {
  return (
    <nav className="chips" aria-label="Filtrar por deporte">
      <Link href={base} className={`chip ${!active ? 'chip-on' : ''}`} aria-current={!active ? 'page' : undefined}>Todos</Link>
      {SPORTS.map((s) => (
        <Link key={s} href={`${base}?sport=${s}`} className={`chip ${active === s ? 'chip-on' : ''}`} aria-current={active === s ? 'page' : undefined}>
          <span aria-hidden>{SPORT_META[s].icon}</span> {SPORT_LABELS[s]}
        </Link>
      ))}
    </nav>
  );
}

const STATUS_LABEL: Record<Game['status'], string> = {
  scheduled: 'Programado', live: 'En vivo', final: 'Final', postponed: 'Pospuesto', cancelled: 'Cancelado',
};

export function GameCard({ game }: { game: Game }) {
  const score = game.homeScore != null && game.awayScore != null;
  return (
    <article className="game-card glass">
      <div className="game-meta">
        <span>{SPORT_META[game.sport].icon} {game.competition}</span>
        {game.isDemo ? <DemoTag /> : <span className={`status status-${game.status}`}>{STATUS_LABEL[game.status]}</span>}
      </div>
      {[game.home, game.away].map((t, i) => (
        <div className="team-row" key={t.id + i}>
          <div className="team">
            <div className="team-short" aria-hidden>{t.shortName}</div>
            <div className="team-name">{t.name}{i === 0 ? <span className="sr-only"> (local)</span> : <span className="sr-only"> (visitante)</span>}</div>
          </div>
          {score ? <div className="score">{i === 0 ? game.homeScore : game.awayScore}</div> : null}
        </div>
      ))}
      <div className="game-footer">
        <time dateTime={game.startsAt}>{formatKickoff(game.startsAt)}</time>
        <Link className="text-link" href={`/games/${game.id}`} aria-label={`Ver ficha ${game.home.name} contra ${game.away.name}`}>Ver ficha →</Link>
      </div>
    </article>
  );
}

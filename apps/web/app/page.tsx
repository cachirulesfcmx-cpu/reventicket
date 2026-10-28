import Link from 'next/link';
import { SPORT_LABELS, SPORT_META, SPORTS } from '@vanta-edge/shared';
import { GameCard, Notice } from '@/components/ui';
import { getProvider } from '@/lib/providers';
import { approvedModelCount, evaluatedModelCount } from '@/lib/research';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const provider = getProvider();
  const games = await provider.listGames({ limit: 6 });
  return (
    <>
      <section className="hero">
        <div className="hero-main glass">
          <div className="hero-orb" aria-hidden />
          <p className="eyebrow">Inteligencia deportiva, con evidencia</p>
          <h1>Lee el juego.<br /><span>Entiende la probabilidad.</span></h1>
          <p>Calendario, datos y probabilidades explicables para seis competiciones. Sin promesas de ganar: cada modelo se valida contra el mercado antes de publicar nada.</p>
          <div className="pill-row">
            <span className="status-pill">6 competiciones</span>
            <span className="status-pill">Backtesting cronológico</span>
            <span className="status-pill">Historial inmutable</span>
          </div>
        </div>
        <div className="metric-card glass">
          <div>
            <div className="metric-label">ESTADO DEL MOTOR</div>
            <div className="metric-number">{approvedModelCount()} de {evaluatedModelCount()}</div>
            <p className="metric-note">modelos aprobados. Los evaluados (Liga MX y NFL) no superan a las cuotas de cierre del mercado, así que los picks reales siguen desactivados.</p>
          </div>
          <Link className="text-link" href="/performance">Ver validación →</Link>
        </div>
      </section>

      <div className="section-head"><div><h2>Explora los deportes</h2><p>Un producto, seis módulos analíticos.</p></div></div>
      <section className="sports-grid">
        {SPORTS.map((s) => (
          <Link className="sport-card glass" href={`/games?sport=${s}`} key={s}>
            <div className="sport-icon" aria-hidden>{SPORT_META[s].icon}</div>
            <div><div className="sport-title">{SPORT_LABELS[s]}</div><div className="sport-sub">{SPORT_META[s].region}</div></div>
          </Link>
        ))}
      </section>

      <div className="section-head">
        <div><h2>Próximos partidos</h2><p>{provider.isDemo ? 'Partidos ficticios para mostrar la interfaz.' : 'Datos del proveedor.'}</p></div>
        <Link className="text-link" href="/games">Calendario completo →</Link>
      </div>
      <section className="games-grid">{games.map((g) => <GameCard key={g.id} game={g} />)}</section>

      {provider.isDemo ? (
        <Notice tone="warn"><strong>Transparencia:</strong> modo demostración. Los partidos mostrados son ficticios; no hay cuotas en vivo ni picks reales. Se activarán solo con datos licenciados y modelos que superen la validación.</Notice>
      ) : null}
    </>
  );
}

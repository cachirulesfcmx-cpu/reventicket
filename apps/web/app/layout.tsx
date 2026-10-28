import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getProvider } from '@/lib/providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'VANTA EDGE — Sports Intelligence', template: '%s · VANTA EDGE' },
  description: 'Análisis deportivo informativo: calendario, datos y probabilidades validadas. Sin apuestas ni transacciones.',
  applicationName: 'VANTA EDGE',
  manifest: '/manifest.json',
};
export const viewport: Viewport = { themeColor: '#07110e', width: 'device-width', initialScale: 1 };

const NAV = [
  { href: '/', label: 'Inicio' },
  { href: '/games', label: 'Partidos' },
  { href: '/picks', label: 'Picks' },
  { href: '/performance', label: 'Rendimiento' },
  { href: '/follows', label: 'Seguidos' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const demo = getProvider().isDemo;
  return (
    <html lang="es-MX">
      <body>
        <a className="skip" href="#main">Saltar al contenido</a>
        <div className="shell">
          <header className="topbar">
            <Link href="/" className="brand" aria-label="VANTA EDGE inicio">
              <div className="brand-mark" aria-hidden>◆</div>
              <div>
                <div className="brand-name">VANTA EDGE</div>
                <div className="brand-sub">SPORTS INTELLIGENCE</div>
              </div>
            </Link>
            <nav className="topnav" aria-label="Principal">
              {NAV.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
            </nav>
            {demo ? <span className="status-pill" role="status">MODO DEMOSTRACIÓN</span> : null}
          </header>
          <main id="main">{children}</main>
          <footer className="footer">
            <span>© 2026 VANTA EDGE · Análisis deportivo informativo</span>
            <span>
              +18 · No aceptamos ni facilitamos apuestas. Las probabilidades no garantizan resultados.{' '}
              <Link href="/responsible" className="text-link">Juego responsable</Link>
            </span>
          </footer>
        </div>
        <nav className="bottom-nav glass" aria-label="Navegación móvil">
          {NAV.slice(0, 4).map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
        </nav>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'VANTA EDGE — Sports Intelligence', description: 'Análisis deportivo y probabilidades basadas en datos.', applicationName: 'VANTA EDGE', manifest: '/manifest.json' };
export const viewport: Viewport = { themeColor: '#07110e', width: 'device-width', initialScale: 1, maximumScale: 1 };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="es"><body>{children}</body></html>; }

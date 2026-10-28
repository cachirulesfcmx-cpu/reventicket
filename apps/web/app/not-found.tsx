import Link from 'next/link';

export default function NotFound() {
  return <div className="empty glass" role="status"><h1 className="page-title">No encontrado</h1><p>Este partido o página no existe.</p><Link className="text-link" href="/games">Ir al calendario</Link></div>;
}

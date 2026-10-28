import type { Metadata } from 'next';
import FollowsClient from './FollowsClient';

export const metadata: Metadata = { title: 'Seguidos' };

export default function Follows() {
  return (
    <>
      <div className="section-head"><div><h1 className="page-title">Equipos seguidos</h1><p>Tu lista es privada: solo tú puedes verla (RLS por usuario).</p></div></div>
      <FollowsClient />
    </>
  );
}

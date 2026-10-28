'use client';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import { browserClient } from '@/lib/browserClient';

type Team = { id: string; name: string; short_name: string; sport: string };
const TERMS_VERSION = 'borrador-2026-10';

export default function FollowsClient() {
  const db = useMemo(() => browserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = db.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!db || !session) return;
    Promise.all([
      db.from('teams').select('id,name,short_name,sport').order('name').limit(200),
      db.from('followed_teams').select('team_id'),
    ]).then(([t, f]) => {
      if (t.error || f.error) { setMsg('No se pudieron cargar los equipos. Intenta de nuevo.'); return; }
      setTeams(t.data as Team[]);
      setFollowed(new Set((f.data as { team_id: string }[]).map((r) => r.team_id)));
    });
  }, [db, session]);

  if (!db) return <div className="empty glass" role="status"><h3>Cuentas no disponibles</h3><p>Este entorno no tiene Supabase configurado (modo demostración).</p></div>;

  async function auth(mode: 'in' | 'up') {
    if (!db) return;
    setMsg(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || password.length < 10) { setMsg('Usa un correo válido y una contraseña de al menos 10 caracteres.'); return; }
    if (mode === 'up' && !adult) { setMsg('Debes confirmar que eres mayor de 18 años.'); return; }
    setBusy(true);
    const res = mode === 'in'
      ? await db.auth.signInWithPassword({ email, password })
      : await db.auth.signUp({ email, password, options: { data: { app: 'vanta-edge', adult_attested: 'true', terms_version: TERMS_VERSION } } });
    setBusy(false);
    if (res.error) setMsg(mode === 'in' ? 'Correo o contraseña incorrectos.' : 'No se pudo crear la cuenta.');
    else if (mode === 'up' && !res.data.session) setMsg('Revisa tu correo para confirmar la cuenta.');
  }

  async function toggle(teamId: string) {
    if (!db || !session) return;
    const on = followed.has(teamId);
    const { error } = on
      ? await db.from('followed_teams').delete().eq('team_id', teamId)
      : await db.from('followed_teams').insert({ user_id: session.user.id, team_id: teamId });
    if (error) { setMsg('No se pudo actualizar.'); return; }
    const next = new Set(followed);
    if (on) next.delete(teamId); else next.add(teamId);
    setFollowed(next);
  }

  if (!session) {
    return (
      <form className="glass panel form" onSubmit={(e) => { e.preventDefault(); auth('in'); }} aria-describedby="auth-help">
        <p id="auth-help" className="muted">Inicia sesión para guardar equipos. Solo mayores de 18 años.</p>
        <label>Correo<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Contraseña<input type="password" autoComplete="current-password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <label className="check"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} /> Confirmo que tengo 18 años o más (requerido para crear cuenta).</label>
        {msg ? <p role="alert" className="error">{msg}</p> : null}
        <div className="row">
          <button type="submit" className="btn" disabled={busy}>Entrar</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => auth('up')}>Crear cuenta</button>
        </div>
      </form>
    );
  }

  return (
    <div className="glass panel">
      <div className="row between"><span className="muted">{session.user.email}</span><button className="btn btn-ghost" onClick={() => db.auth.signOut()}>Cerrar sesión</button></div>
      {msg ? <p role="alert" className="error">{msg}</p> : null}
      {teams.length === 0 ? <p className="muted">Aún no hay equipos cargados desde un proveedor de datos.</p> : (
        <ul className="team-list">
          {teams.map((t) => (
            <li key={t.id}>
              <span>{t.name} <span className="muted small">{t.sport}</span></span>
              <button className={`btn ${followed.has(t.id) ? '' : 'btn-ghost'}`} aria-pressed={followed.has(t.id)} onClick={() => toggle(t.id)}>
                {followed.has(t.id) ? 'Siguiendo' : 'Seguir'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

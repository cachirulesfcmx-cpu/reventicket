import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button, Empty, Glass, s } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { colors, TOUCH } from '../../lib/theme';

export default function Account() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) {
    return <Screen title="Cuenta"><Empty title="Cuentas no disponibles" body="Este entorno no tiene Supabase configurado (modo demostración)." /></Screen>;
  }

  async function auth(mode: 'in' | 'up') {
    if (!supabase) return;
    setMsg(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || password.length < 10) { setMsg('Usa un correo válido y una contraseña de 10+ caracteres.'); return; }
    if (mode === 'up' && !adult) { setMsg('Debes confirmar que tienes 18 años o más.'); return; }
    setBusy(true);
    const res = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { app: 'vanta-edge', adult_attested: 'true', terms_version: 'borrador-2026-10' } } });
    setBusy(false);
    if (res.error) setMsg(mode === 'in' ? 'Correo o contraseña incorrectos.' : 'No se pudo crear la cuenta.');
    else if (mode === 'up' && !res.data.session) setMsg('Revisa tu correo para confirmar la cuenta.');
  }

  return (
    <Screen title="Cuenta" subtitle="Solo mayores de 18 años. Tus equipos seguidos son privados.">
      {session ? (
        <Glass>
          <Text style={s.title}>{session.user.email}</Text>
          <Button label="Cerrar sesión" ghost onPress={() => supabase?.auth.signOut()} />
        </Glass>
      ) : (
        <Glass>
          <Text style={st.label} nativeID="email">Correo</Text>
          <TextInput style={st.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" accessibilityLabelledBy="email" />
          <Text style={st.label} nativeID="pw">Contraseña</Text>
          <TextInput style={st.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" accessibilityLabelledBy="pw" />
          <Pressable onPress={() => setAdult(!adult)} style={st.check} accessibilityRole="checkbox" aria-checked={adult} accessibilityLabel="Confirmo que tengo 18 años o más">
            <View style={[st.box, adult && st.boxOn]}>{adult ? <Text style={{ color: '#04130C', fontWeight: '800' }}>✓</Text> : null}</View>
            <Text style={s.muted}>Confirmo que tengo 18 años o más (requerido para crear cuenta).</Text>
          </Pressable>
          {msg ? <Text style={{ color: colors.danger }} accessibilityRole="alert">{msg}</Text> : null}
          <Button label="Entrar" onPress={() => auth('in')} disabled={busy} />
          <Button label="Crear cuenta" ghost onPress={() => auth('up')} disabled={busy} />
        </Glass>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  label: { color: colors.muted, fontSize: 13, marginTop: 8, marginBottom: 6 },
  input: { minHeight: TOUCH, borderRadius: 12, borderWidth: 1, borderColor: colors.line, color: colors.text, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.05)' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TOUCH, marginTop: 10 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.green, borderColor: colors.green },
});

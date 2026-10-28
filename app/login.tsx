import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Glass } from '../components/Glass';
import { Screen } from '../components/Screen';
import { Notice } from '../components/States';
import { useAuth } from '../lib/auth';
import { friendlyError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { isValidEmail } from '../lib/validation';

export default function Login() {
  const { configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!isValidEmail(email) || !password) { setError('Escribe un correo válido y tu contraseña.'); return; }
    if (!supabase) return;
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (e) setError(friendlyError(e, 'No se pudo iniciar sesión.'));
    else router.replace('/(tabs)');
  }

  return (
    <Screen back title="Inicia sesión" subtitle="Cuenta de adulto (padre, madre, tutor, docente o estudiante mayor de edad).">
      {!configured ? <Notice tone="warning">Este entorno no tiene Supabase configurado. Define EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY.</Notice> : null}
      <Glass style={{ marginTop: 16 }}>
        <Field label="Correo electrónico" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress" placeholder="tu@correo.com" />
        <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"
          textContentType="password" placeholder="Tu contraseña" onSubmitEditing={submit} />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button label="Entrar" onPress={submit} loading={busy} disabled={!configured} testID="login-submit" />
        <Link href="/forgot-password" style={{ color: colors.lilac, marginTop: 16, textAlign: 'center', fontSize: 15 }}>¿Olvidaste tu contraseña?</Link>
      </Glass>
      <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20, fontSize: 15 }}>
        ¿Aún no tienes cuenta? <Link href="/onboarding" style={{ color: colors.lilac }}>Empieza aquí</Link>
      </Text>
    </Screen>
  );
}

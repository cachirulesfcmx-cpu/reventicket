import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Glass } from '../components/Glass';
import { Screen } from '../components/Screen';
import { Notice } from '../components/States';
import { supabase } from '../lib/supabase';
import { isValidEmail } from '../lib/validation';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!isValidEmail(email)) { setError('Escribe un correo válido.'); return; }
    if (!supabase) return;
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: Linking.createURL('/auth/callback', { queryParams: { next: 'reset' } }) });
    setBusy(false);
    // Same message whether or not the account exists (no account enumeration).
    setDone(true);
  }

  return (
    <Screen back title="Recupera tu contraseña" subtitle="Te enviaremos un enlace para crear una nueva.">
      <Glass style={{ marginTop: 12 }}>
        {done ? (
          <Notice tone="success">Si existe una cuenta con ese correo, recibirás un enlace en unos minutos.</Notice>
        ) : (
          <>
            <Field label="Correo electrónico" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button label="Enviar enlace" onPress={submit} loading={busy} disabled={!supabase} />
          </>
        )}
      </Glass>
    </Screen>
  );
}

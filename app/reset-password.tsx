import { router } from 'expo-router';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Glass } from '../components/Glass';
import { Screen } from '../components/Screen';
import { Notice } from '../components/States';
import { useAuth } from '../lib/auth';
import { friendlyError } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { passwordIssues } from '../lib/validation';

export default function ResetPassword() {
  const { session } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const issues = passwordIssues(password);

  async function submit() {
    setError(null);
    if (issues.length) { setError(`Tu contraseña necesita: ${issues.join(', ').toLowerCase()}.`); return; }
    if (!supabase) return;
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) setError(friendlyError(e, 'No se pudo actualizar la contraseña.'));
    else router.replace('/(tabs)');
  }

  if (!session) {
    return (
      <Screen back title="Enlace no válido">
        <Notice tone="warning">El enlace expiró o ya se usó. Solicita uno nuevo.</Notice>
        <Button label="Solicitar enlace" variant="secondary" onPress={() => router.replace('/forgot-password')} />
      </Screen>
    );
  }
  return (
    <Screen title="Nueva contraseña">
      <Glass style={{ marginTop: 12 }}>
        <Field label="Nueva contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password"
          help={issues.length ? `Falta: ${issues.join(', ').toLowerCase()}` : 'Contraseña segura ✓'} />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button label="Guardar contraseña" onPress={submit} loading={busy} />
      </Glass>
    </Screen>
  );
}

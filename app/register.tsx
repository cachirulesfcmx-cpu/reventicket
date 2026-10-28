import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Glass } from '../components/Glass';
import { Screen } from '../components/Screen';
import { Notice } from '../components/States';
import { useAuth } from '../lib/auth';
import { config } from '../lib/config';
import { loadDraft } from '../lib/draft';
import { friendlyError } from '../lib/errors';
import { accountTypeFor, isMinor, type Answers } from '../lib/onboarding';
import { supabase } from '../lib/supabase';
import { colors, TOUCH } from '../lib/theme';
import { isValidEmail, passwordIssues } from '../lib/validation';

function Check({ checked, onPress, label, testID }: { checked: boolean; onPress: () => void; label: string; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.row} accessibilityRole="checkbox" aria-checked={checked} accessibilityLabel={label}>
      <View style={[styles.box, checked && styles.boxOn]}>{checked ? <Text style={{ color: '#fff' }}>✓</Text> : null}</View>
      <Text style={styles.rowText}>{label}</Text>
    </Pressable>
  );
}

export default function Register() {
  const { configured } = useAuth();
  const [draft, setDraft] = useState<Answers | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => { loadDraft().then(setDraft); }, []);
  const minorFlow = draft ? isMinor(draft) : false;
  const issues = passwordIssues(password);

  async function submit() {
    setError(null);
    if (!isValidEmail(email)) { setError('Escribe un correo válido.'); return; }
    if (issues.length) { setError(`Tu contraseña necesita: ${issues.join(', ').toLowerCase()}.`); return; }
    if (!adult || !privacy) { setError('Confirma que eres mayor de edad y que aceptas el aviso de privacidad.'); return; }
    if (!supabase) return;
    setBusy(true);
    const { error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: Linking.createURL('/auth/callback'),
        data: {
          display_name: name.trim().slice(0, 80),
          account_type: draft ? accountTypeFor(draft) : 'guardian',
          adult_attested: adult ? 'true' : 'false',
          privacy_notice_version: config.privacyNoticeVersion,
        },
      },
    });
    setBusy(false);
    if (e) setError(friendlyError(e, 'No se pudo crear la cuenta.'));
    else setSent(true);
  }

  if (sent) {
    return (
      <Screen back title="Revisa tu correo">
        <Notice tone="success">Te enviamos un enlace de confirmación. Ábrelo desde este dispositivo para activar tu cuenta.</Notice>
        {minorFlow ? <Notice>Después de confirmar, crea el perfil del estudiante en “Familia” para completar su plan.</Notice> : null}
        <Link href="/login" style={{ color: colors.lilac, fontSize: 16, marginTop: 12 }}>Ir a iniciar sesión</Link>
      </Screen>
    );
  }

  return (
    <Screen back title="Crea tu cuenta"
      subtitle={minorFlow
        ? 'Esta cuenta la crea el padre, la madre o el tutor. Después podrás crear y autorizar el perfil del estudiante.'
        : 'Las cuentas de StudIA son para personas adultas. Los estudiantes menores usan un perfil administrado por su tutor.'}>
      {!configured ? <Notice tone="warning">Este entorno no tiene Supabase configurado.</Notice> : null}
      <Glass style={{ marginTop: 12 }}>
        <Field label="Nombre o alias" value={name} onChangeText={setName} autoComplete="name" placeholder="Opcional" maxLength={80} />
        <Field label="Correo electrónico" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress" placeholder="adulto@correo.com" />
        <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password"
          textContentType="newPassword" placeholder="Crea una contraseña segura"
          help={password ? (issues.length ? `Falta: ${issues.join(', ').toLowerCase()}` : 'Contraseña segura ✓') : '10+ caracteres con mayúscula, minúscula y número'} />
        <Check testID="register-adult" checked={adult} onPress={() => setAdult(!adult)} label="Confirmo que tengo 18 años o más." />
        <Check testID="register-privacy" checked={privacy} onPress={() => setPrivacy(!privacy)}
          label={`He leído y acepto el aviso de privacidad (versión ${config.privacyNoticeVersion}).`} />
        <Link href="/privacy" style={{ color: colors.lilac, marginBottom: 12, fontSize: 15 }}>Leer aviso de privacidad</Link>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button label="Crear cuenta" onPress={submit} loading={busy} disabled={!configured} testID="register-submit" />
      </Glass>
      <Text style={styles.foot}>
        ¿Ya tienes cuenta? <Link href="/login" style={{ color: colors.lilac }}>Inicia sesión</Link>
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: TOUCH, marginBottom: 6 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.violet, borderColor: colors.lilac },
  rowText: { color: colors.text, fontSize: 15, lineHeight: 21, flex: 1 },
  foot: { color: colors.muted, textAlign: 'center', marginTop: 20, fontSize: 15 },
});

import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, StyleSheet, Text } from 'react-native';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Glass } from '../../components/Glass';
import { Screen } from '../../components/Screen';
import { Notice } from '../../components/States';
import { deleteMyAccount, exportMyData } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { friendlyError } from '../../lib/errors';
import { colors } from '../../lib/theme';

const ACCOUNT_LABEL = { guardian: 'Padre, madre o tutor', adult_student: 'Estudiante adulto', teacher: 'Docente', other: 'Otro' } as const;

export default function Profile() {
  const { session, profile, signOut } = useAuth();
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirm, setConfirm] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  async function doExport() {
    setBusy('export'); setMsg(null);
    try {
      const json = JSON.stringify(await exportMyData(), null, 2);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url; a.download = `studia-mis-datos-${new Date().toISOString().slice(0, 10)}.json`; a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ title: 'Mis datos de StudIA', message: json });
      }
      setMsg({ tone: 'success', text: 'Exportación lista.' });
    } catch (e) { setMsg({ tone: 'error', text: friendlyError(e) }); } finally { setBusy(null); }
  }

  async function doDelete() {
    if (confirm.trim() !== 'ELIMINAR') { setMsg({ tone: 'error', text: 'Escribe ELIMINAR para confirmar.' }); return; }
    setBusy('delete'); setMsg(null);
    try { await deleteMyAccount(); router.replace('/onboarding'); } catch (e) { setMsg({ tone: 'error', text: friendlyError(e) }); setBusy(null); }
  }

  return (
    <Screen title="Mi perfil">
      <Glass style={{ marginTop: 12 }}>
        <Text style={styles.label}>Cuenta</Text>
        <Text style={styles.value}>{session?.user.email}</Text>
        <Text style={styles.muted}>{profile ? `${ACCOUNT_LABEL[profile.account_type]} · Plan ${profile.plan}` : ''}</Text>
      </Glass>
      <Button label="Familia y perfiles de estudiantes" variant="secondary" onPress={() => router.push('/family')} style={{ marginTop: 12 }} />
      <Button label="Aviso de privacidad" variant="secondary" onPress={() => router.push('/privacy')} style={{ marginTop: 10 }} />
      {profile?.is_admin ? <Button label="Administración" variant="secondary" onPress={() => router.push('/admin')} style={{ marginTop: 10 }} /> : null}

      <Text style={styles.section} accessibilityRole="header">Tus datos</Text>
      <Button label="Descargar mis datos (JSON)" variant="secondary" onPress={doExport} loading={busy === 'export'} />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      {showDelete ? (
        <Glass style={{ marginTop: 12 }}>
          <Text style={styles.value}>Eliminar cuenta</Text>
          <Text style={styles.muted}>Se borrarán tu cuenta, perfiles de estudiantes, planes, resultados y materiales. No se puede deshacer.</Text>
          <Field label="Escribe ELIMINAR para confirmar" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" />
          <Button label="Eliminar definitivamente" variant="danger" onPress={doDelete} loading={busy === 'delete'} />
        </Glass>
      ) : (
        <Button label="Eliminar mi cuenta" variant="ghost" onPress={() => setShowDelete(true)} style={{ marginTop: 6 }} />
      )}
      <Button label="Cerrar sesión" variant="danger" onPress={async () => { await signOut(); router.replace('/login'); }} style={{ marginTop: 24 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  value: { color: colors.text, fontSize: 17, fontWeight: '600', marginTop: 4 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  section: { color: colors.text, fontSize: 20, fontWeight: '600', marginTop: 28, marginBottom: 12 },
});

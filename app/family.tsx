import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { Glass } from '../components/Glass';
import { Screen } from '../components/Screen';
import { Empty, ErrorState, Loading, Notice } from '../components/States';
import { createStudent, deleteStudent, familyReport, saveOnboarding, type FamilyRow } from '../lib/api';
import { SCHOOL_LEVELS } from '../lib/catalog';
import { config } from '../lib/config';
import { clearDraft, loadDraft } from '../lib/draft';
import { friendlyError } from '../lib/errors';
import { useFocusData } from '../lib/useAsync';
import { colors, radii, TOUCH } from '../lib/theme';

export default function Family() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const report = useFocusData(familyReport);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<string>('primaria');
  const [grade, setGrade] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function save() {
    setMsg(null);
    if (!name.trim() || !grade.trim()) { setMsg({ tone: 'error', text: 'Escribe un alias y el grado o semestre.' }); return; }
    if (!consent) { setMsg({ tone: 'error', text: 'Se necesita tu autorización como padre, madre o tutor.' }); return; }
    setBusy(true);
    try {
      const id = await createStudent({ name, level, grade, consent, noticeVersion: config.privacyNoticeVersion });
      const draft = await loadDraft();
      if (draft) {
        // Attach the minor's first-run answers to the consented profile (server re-checks ownership).
        try { await saveOnboarding(draft, id); await clearDraft(); } catch { /* answers stay local; non-blocking */ }
      }
      setName(''); setGrade(''); setConsent(false);
      setMsg({ tone: 'success', text: 'Perfil creado y autorización registrada.' });
      report.reload();
    } catch (e) { setMsg({ tone: 'error', text: friendlyError(e) }); } finally { setBusy(false); }
  }

  async function remove(row: FamilyRow) {
    if (pendingDelete !== row.studentId) { setPendingDelete(row.studentId); return; }
    try { await deleteStudent(row.studentId); setPendingDelete(null); report.reload(); } catch (e) { setMsg({ tone: 'error', text: friendlyError(e) }); }
  }

  return (
    <Screen back title="Familia" subtitle="Perfiles de estudiantes administrados por ti y su reporte de avance.">
      {from === 'onboarding' ? <Notice>Crea el perfil del estudiante para guardar sus respuestas del cuestionario inicial.</Notice> : null}
      <Text style={styles.section} accessibilityRole="header">Reporte</Text>
      {report.loading && !report.data ? <Loading /> : report.error ? <ErrorState message={report.error} onRetry={report.reload} /> : !report.data?.length ? (
        <Empty title="Sin perfiles" body="Agrega a tus hijos o estudiantes para crear planes para cada uno." />
      ) : (
        <View style={{ gap: 10 }}>
          {report.data.map((r) => (
            <Glass key={r.studentId}>
              <Text style={styles.name}>{r.displayName}</Text>
              <Text style={styles.muted}>{SCHOOL_LEVELS.find((l) => l.value === r.schoolLevel)?.label} · {r.grade}</Text>
              <Text style={styles.stats}>
                {r.activePlans} planes activos · {r.completedSessions} sesiones completadas · {r.attempts} simulacros
                {r.avgScore != null ? ` · promedio ${Math.round(r.avgScore)}%` : ''}
              </Text>
              <Button label={pendingDelete === r.studentId ? 'Confirmar: eliminar perfil y sus datos' : 'Eliminar perfil'}
                variant={pendingDelete === r.studentId ? 'danger' : 'ghost'} onPress={() => remove(r)} style={{ marginTop: 8 }} />
            </Glass>
          ))}
        </View>
      )}

      <Text style={styles.section} accessibilityRole="header">Agregar estudiante</Text>
      <Glass>
        <Field label="Nombre de pila o alias" value={name} onChangeText={setName} placeholder="Ej. Leo" maxLength={40}
          help="No uses el nombre completo ni datos que identifiquen a la persona." />
        <Text style={styles.label}>Nivel educativo</Text>
        <View style={styles.wrap}>
          {SCHOOL_LEVELS.map((l) => (
            <Pressable key={l.value} onPress={() => setLevel(l.value)} style={[styles.chip, level === l.value && styles.chipOn]}
              accessibilityRole="radio" aria-checked={level === l.value}>
              <Text style={styles.chipText}>{level === l.value ? `✓ ${l.label}` : l.label}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Grado o semestre" value={grade} onChangeText={setGrade} placeholder="Ej. 5.º o 2.º semestre" maxLength={30} />
        <Pressable onPress={() => setConsent(!consent)} style={styles.row} accessibilityRole="checkbox" aria-checked={consent}
          accessibilityLabel="Soy su padre, madre o tutor legal y autorizo el uso de StudIA conforme al aviso de privacidad">
          <View style={[styles.box, consent && styles.boxOn]}>{consent ? <Text style={{ color: '#fff' }}>✓</Text> : null}</View>
          <Text style={styles.rowText}>Soy su padre, madre o tutor legal y autorizo el uso de StudIA conforme al aviso de privacidad ({config.privacyNoticeVersion}).</Text>
        </Pressable>
        <Notice tone="warning">Esta autorización es una declaración dentro de la app; no es verificación de identidad. Pendiente de revisión legal antes de uso público.</Notice>
        {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
        <Button label="Crear perfil" onPress={save} loading={busy} />
      </Glass>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.text, fontSize: 20, fontWeight: '600', marginTop: 20, marginBottom: 10 },
  name: { color: colors.text, fontSize: 18, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 14, marginTop: 4 },
  stats: { color: colors.text, fontSize: 14, marginTop: 8, lineHeight: 20 },
  label: { color: colors.muted, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { minHeight: TOUCH - 4, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.lilac, backgroundColor: 'rgba(111,91,255,0.25)', borderWidth: 2 },
  chipText: { color: colors.text, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: TOUCH, marginBottom: 6 },
  box: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.violet, borderColor: colors.lilac },
  rowText: { color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 },
});

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Glass } from '../../components/Glass';
import { Screen } from '../../components/Screen';
import { Notice } from '../../components/States';
import { createPlan, listStudents, type Student } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { OTHER_SUBJECT, SUBJECTS } from '../../lib/catalog';
import { examDateOptions } from '../../lib/dates';
import { friendlyError } from '../../lib/errors';
import { colors, radii, TOUCH } from '../../lib/theme';
import { validatePlan } from '../../lib/validation';

export default function NewPlan() {
  const { session } = useAuth();
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('matematicas');
  const [topics, setTopics] = useState('');
  const [examDate, setExamDate] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listStudents().then(setStudents).catch(() => setStudents([])); }, []);

  async function save() {
    const problem = validatePlan({ title, subject, topics, examDate });
    if (problem) { setError(problem); return; }
    if (!session) return;
    setBusy(true); setError(null);
    try {
      const id = await createPlan({ title, subject, topics, examDate, studentId }, session.user.id);
      router.replace(`/plan/${id}`);
    } catch (e) { setError(friendlyError(e)); setBusy(false); }
  }

  const chip = (selected: boolean) => [styles.chip, selected && styles.chipOn];
  return (
    <Screen back title="Nuevo plan" subtitle="Generamos sesiones de diagnóstico, aprendizaje, práctica y un simulacro final antes de tu examen."
      footer={<Button label="Crear plan" onPress={save} loading={busy} testID="plan-save" />}>
      <Glass style={{ marginTop: 12 }}>
        <Field label="Nombre del examen" value={title} onChangeText={setTitle} placeholder="Ej. Parcial de fracciones" maxLength={120} />
        <Text style={styles.label}>Materia</Text>
        <View style={styles.wrap}>
          {[...SUBJECTS, OTHER_SUBJECT].map((s) => (
            <Pressable key={s.slug} onPress={() => setSubject(s.slug)} style={chip(subject === s.slug)} accessibilityRole="radio" aria-checked={subject === s.slug}>
              <Text style={styles.chipText}>{subject === s.slug ? `✓ ${s.name}` : s.name}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Temas (separados por coma o renglón)" value={topics} onChangeText={setTopics} multiline
          style={{ minHeight: 90, textAlignVertical: 'top' }} placeholder="Fracciones, porcentajes, problemas" />
        <Text style={styles.label}>Fecha del examen</Text>
        <View style={styles.wrap}>
          {examDateOptions(new Date()).map((d) => (
            <Pressable key={d.key} onPress={() => setExamDate(d.iso)} style={chip(examDate === d.iso)} accessibilityRole="radio" aria-checked={examDate === d.iso}>
              <Text style={styles.chipText}>{d.title}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="O escribe la fecha (AAAA-MM-DD)" value={examDate} onChangeText={setExamDate} placeholder="2026-11-20" autoCapitalize="none" />
        {students.length ? (
          <>
            <Text style={styles.label}>¿Para quién es el plan?</Text>
            <View style={styles.wrap}>
              <Pressable onPress={() => setStudentId(null)} style={chip(studentId === null)} accessibilityRole="radio"><Text style={styles.chipText}>Para mí</Text></Pressable>
              {students.map((s) => (
                <Pressable key={s.id} onPress={() => setStudentId(s.id)} style={chip(studentId === s.id)} accessibilityRole="radio" aria-checked={studentId === s.id}>
                  <Text style={styles.chipText}>{s.display_name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </Glass>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { minHeight: TOUCH - 4, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.lilac, backgroundColor: 'rgba(111,91,255,0.25)', borderWidth: 2 },
  chipText: { color: colors.text, fontSize: 14 },
});

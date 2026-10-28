import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { ErrorState, Loading, Notice } from '../../components/States';
import { deletePlan, getPlan, setPlanStatus, setSessionStatus, type Session } from '../../lib/api';
import { subjectName } from '../../lib/catalog';
import { parseISODate, formatLong, relativeExamLabel } from '../../lib/dates';
import { friendlyError } from '../../lib/errors';
import { useFocusData } from '../../lib/useAsync';
import { colors, radii, TOUCH } from '../../lib/theme';

const KIND_LABEL: Record<string, string> = {
  diagnostic: 'Diagnóstico', learn: 'Aprender', practice: 'Practicar', review: 'Repasar', mock_exam: 'Simulacro',
};

export default function PlanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => getPlan(id), [id]);
  const { data, error, loading, reload, setData } = useFocusData(load);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function toggle(s: Session) {
    const status = s.status === 'completed' ? 'pending' : 'completed';
    try {
      await setSessionStatus(s.id, status);
      setData((d) => d && { ...d, sessions: d.sessions.map((x) => (x.id === s.id ? { ...x, status } : x)) });
    } catch (e) { setMsg(friendlyError(e)); }
  }

  function open(s: Session) {
    if (!data) return;
    if (s.kind === 'diagnostic' || s.kind === 'mock_exam' || s.kind === 'practice') {
      router.push(`/exam?subject=${data.plan.subject_slug}&plan=${data.plan.id}${data.plan.student_id ? `&student=${data.plan.student_id}` : ''}`);
    } else {
      router.push(`/tutor?topic=${encodeURIComponent(s.topic)}${data.plan.student_id ? `&student=${data.plan.student_id}` : ''}`);
    }
  }

  if (loading && !data) return <Screen back><Loading /></Screen>;
  if (error || !data) return <Screen back><ErrorState message={error ?? 'No encontrado'} onRetry={reload} /></Screen>;
  const { plan, sessions } = data;
  const done = sessions.filter((s) => s.status === 'completed').length;
  const pct = sessions.length ? Math.round((done / sessions.length) * 100) : 0;

  return (
    <Screen back title={plan.title} subtitle={`${subjectName(plan.subject_slug)} · ${relativeExamLabel(plan.exam_date, new Date())}`}>
      <View style={styles.progress} accessibilityRole="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} accessibilityLabel="Sesiones completadas">
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.muted}>{done} de {sessions.length} sesiones completadas</Text>
      {msg ? <Notice tone="error">{msg}</Notice> : null}
      <View style={{ gap: 10, marginTop: 16 }}>
        {sessions.map((s) => {
          const d = s.scheduled_for ? parseISODate(s.scheduled_for) : null;
          return (
            <View key={s.id} style={[styles.session, s.status === 'completed' && styles.sessionDone]}>
              <Pressable onPress={() => toggle(s)} style={styles.check} accessibilityRole="checkbox" aria-checked={s.status === 'completed'}
                accessibilityLabel={`Marcar ${s.topic} como ${s.status === 'completed' ? 'pendiente' : 'completada'}`}>
                <Text style={{ color: s.status === 'completed' ? colors.mint : colors.muted, fontSize: 20 }}>{s.status === 'completed' ? '✓' : '○'}</Text>
              </Pressable>
              <Pressable style={{ flex: 1 }} onPress={() => open(s)} accessibilityRole="button" accessibilityLabel={`${KIND_LABEL[s.kind]}: ${s.topic}`}>
                <Text style={styles.kind}>{KIND_LABEL[s.kind] ?? s.kind}{d ? ` · ${formatLong(d)}` : ''}</Text>
                <Text style={styles.topic}>{s.topic}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <Button label={plan.status === 'completed' ? 'Reabrir plan' : 'Marcar plan como completado'} variant="secondary" style={{ marginTop: 20 }}
        onPress={async () => { await setPlanStatus(plan.id, plan.status === 'completed' ? 'active' : 'completed'); reload(); }} />
      {confirmDelete ? (
        <Button label="Confirmar: eliminar plan" variant="danger" style={{ marginTop: 10 }}
          onPress={async () => { try { await deletePlan(plan.id); router.back(); } catch (e) { setMsg(friendlyError(e)); } }} />
      ) : (
        <Button label="Eliminar plan" variant="ghost" style={{ marginTop: 6 }} onPress={() => setConfirmDelete(true)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: 12 },
  fill: { height: '100%', backgroundColor: colors.mint },
  muted: { color: colors.muted, fontSize: 14, marginTop: 8 },
  session: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  sessionDone: { opacity: 0.7 },
  check: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  kind: { color: colors.lilac, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  topic: { color: colors.text, fontSize: 16, marginTop: 2 },
});

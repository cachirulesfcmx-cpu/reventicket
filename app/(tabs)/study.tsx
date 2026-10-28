import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Empty, ErrorState, Loading } from '../../components/States';
import { listPlans } from '../../lib/api';
import { subjectName } from '../../lib/catalog';
import { relativeExamLabel } from '../../lib/dates';
import { useFocusData } from '../../lib/useAsync';
import { colors, radii } from '../../lib/theme';

export default function Study() {
  const { data, error, loading, reload } = useFocusData(listPlans);
  return (
    <Screen title="Mis planes" subtitle="Un paso a la vez." footer={<Button label="Nuevo plan" onPress={() => router.push('/plan/new')} />}>
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? (
        <Empty title="Sin planes todavía" body="Crea un plan con la materia, los temas y la fecha de tu examen." />
      ) : (
        <View style={{ gap: 10, marginTop: 12 }}>
          {data.map((p) => (
            <Pressable key={p.id} onPress={() => router.push(`/plan/${p.id}`)} style={styles.card} accessibilityRole="button"
              accessibilityLabel={`${p.title}, ${subjectName(p.subject_slug)}, ${p.status === 'completed' ? 'completado' : 'activo'}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{p.title}</Text>
                <Text style={styles.muted}>{subjectName(p.subject_slug)} · {relativeExamLabel(p.exam_date, new Date())}</Text>
              </View>
              <Text style={[styles.badge, p.status === 'completed' && { color: colors.mint }]}>{p.status === 'completed' ? 'Completado' : 'Activo'}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 14, marginTop: 4 },
  badge: { color: colors.lilac, fontSize: 13 },
});

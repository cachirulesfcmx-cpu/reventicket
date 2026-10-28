import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Glass } from '../../components/Glass';
import { Screen } from '../../components/Screen';
import { Empty, ErrorState, Loading, Notice } from '../../components/States';
import { myProgress } from '../../lib/api';
import { subjectName } from '../../lib/catalog';
import { useFocusData } from '../../lib/useAsync';
import { colors } from '../../lib/theme';

// Every number here comes from graded attempts in the database; nothing is estimated or invented.
export default function Progress() {
  const { data, error, loading, reload } = useFocusData(myProgress);
  const overall = data?.length ? Math.round(data.reduce((s, r) => s + Number(r.avg_score) * r.attempts, 0) / data.reduce((s, r) => s + r.attempts, 0)) : null;
  return (
    <Screen title="Mi progreso" subtitle="Calculado con tus simulacros calificados.">
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : !data?.length ? (
        <Empty title="Aún no hay resultados" body="Haz un simulacro para conocer tu punto de partida." action={{ label: 'Hacer un simulacro', onPress: () => router.push('/exam') }} />
      ) : (
        <>
          <Glass style={{ marginTop: 12, alignItems: 'center' }}>
            <Text style={styles.kicker}>PROMEDIO EN SIMULACROS</Text>
            <Text style={styles.big} accessibilityLabel={`${overall} por ciento`}>{overall}%</Text>
          </Glass>
          {data.some((r) => r.includes_demo) ? <Notice tone="warning">Incluye preguntas de demostración: no es una evaluación oficial.</Notice> : null}
          <View style={{ gap: 10, marginTop: 8 }}>
            {data.map((r) => (
              <View key={`${r.subject_slug}-${r.student_id ?? 'me'}`} style={styles.row} accessible accessibilityLabel={`${subjectName(r.subject_slug)}: ${Math.round(Number(r.avg_score))} por ciento en ${r.attempts} intentos`}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{subjectName(r.subject_slug)}</Text>
                  <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(Number(r.avg_score))}%` }]} /></View>
                </View>
                <Text style={styles.score}>{Math.round(Number(r.avg_score))}%</Text>
                <Text style={styles.muted}>{r.attempts} int.</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.mint, fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  big: { color: colors.mint, fontSize: 56, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 8 },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.mint },
  score: { color: colors.text, fontSize: 16, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 13 },
});

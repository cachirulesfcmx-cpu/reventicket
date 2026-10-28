import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SPORT_LABELS, SPORT_META, SPORTS } from '@vanta-edge/shared';
import { Screen } from '../../components/Screen';
import { ErrorView, GameCard, Glass, Loading, Notice } from '../../components/ui';
import { fetchGames } from '../../lib/api';
import { research } from '../../lib/research';
import { colors, TOUCH } from '../../lib/theme';
import { useLoad } from '../../lib/useLoad';

export default function Home() {
  const load = useCallback(() => fetchGames(), []);
  const { data, error, loading, reload } = useLoad(load);
  const gates = research.reports.flatMap((r) => r.gates);
  const approved = gates.filter((g) => g.status === 'candidate_pending_human_approval').length;
  return (
    <Screen title="Lee el juego." subtitle="Calendario, datos y probabilidades explicables. Sin promesas de ganar." onRefresh={reload} refreshing={loading && !!data}>
      <Glass>
        <Text style={st.kicker}>ESTADO DEL MOTOR</Text>
        <Text style={st.big}>{approved} de {gates.length} modelos aprobados</Text>
        <Text style={st.muted}>Los modelos evaluados no superan al mercado; los picks reales siguen desactivados.</Text>
      </Glass>
      <Text style={st.section} accessibilityRole="header">Deportes</Text>
      <View style={st.grid}>
        {SPORTS.map((s) => (
          <Pressable key={s} style={st.sport} onPress={() => router.push({ pathname: '/games', params: { sport: s } })}
            accessibilityRole="button" accessibilityLabel={`Ver partidos de ${SPORT_LABELS[s]}`}>
            <Text style={{ fontSize: 22 }} importantForAccessibility="no">{SPORT_META[s].icon}</Text>
            <Text style={st.sportTitle}>{SPORT_LABELS[s]}</Text>
            <Text style={st.muted}>{SPORT_META[s].region}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={st.section} accessibilityRole="header">Próximos partidos</Text>
      {data?.isDemo ? <Notice>{data.note}</Notice> : null}
      {loading && !data ? <Loading /> : error ? <ErrorView message={error} onRetry={reload} /> : data?.data.slice(0, 4).map((g) => <GameCard key={g.id} game={g} />)}
    </Screen>
  );
}

const st = StyleSheet.create({
  kicker: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  big: { color: colors.text, fontSize: 22, fontWeight: '800', marginVertical: 6 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  section: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 14, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sport: { flexBasis: '30%', flexGrow: 1, minHeight: TOUCH * 2, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSolid },
  sportTitle: { color: colors.text, fontWeight: '700', fontSize: 13, marginTop: 8 },
});

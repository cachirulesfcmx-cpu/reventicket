import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { isSport, SPORT_LABELS, SPORTS, type Sport } from '@vanta-edge/shared';
import { Screen } from '../../components/Screen';
import { Empty, ErrorView, GameCard, Loading, Notice } from '../../components/ui';
import { fetchGames } from '../../lib/api';
import { colors, TOUCH } from '../../lib/theme';
import { useLoad } from '../../lib/useLoad';

export default function Games() {
  const params = useLocalSearchParams<{ sport?: string }>();
  const [sport, setSport] = useState<Sport | undefined>(params.sport && isSport(params.sport) ? params.sport : undefined);
  const load = useCallback(() => fetchGames(sport), [sport]);
  const { data, error, loading, reload } = useLoad(load);
  return (
    <Screen title="Calendario" subtitle="Horarios en hora del centro de México." onRefresh={reload} refreshing={loading && !!data}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips} accessibilityRole="radiogroup">
        {[undefined, ...SPORTS].map((s) => (
          <Pressable key={s ?? 'all'} onPress={() => setSport(s)} style={[st.chip, sport === s && st.chipOn]}
            accessibilityRole="radio" aria-checked={sport === s} accessibilityLabel={s ? SPORT_LABELS[s] : 'Todos'}>
            <Text style={[st.chipText, sport === s && { color: colors.green }]}>{s ? SPORT_LABELS[s] : 'Todos'}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {data?.isDemo ? <Notice>{data.note}</Notice> : null}
      {loading && !data ? <Loading /> : error ? <ErrorView message={error} onRetry={reload} />
        : !data?.data.length ? <Empty title="Sin partidos" body="Datos no disponibles para esta competición." />
          : data.data.map((g) => <GameCard key={g.id} game={g} />)}
    </Screen>
  );
}

const st = StyleSheet.create({
  chips: { gap: 8, paddingBottom: 12 },
  chip: { minHeight: TOUCH - 8, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSolid },
  chipOn: { borderColor: colors.green, borderWidth: 2 },
  chipText: { color: colors.text, fontSize: 13 },
});

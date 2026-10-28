import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Text } from 'react-native';
import { SPORT_LABELS, SPORT_META } from '@vanta-edge/shared';
import { Screen } from '../../components/Screen';
import { DemoTag, Empty, ErrorView, Glass, Loading, Notice, s } from '../../components/ui';
import { fetchGame } from '../../lib/api';
import { formatKickoff } from '../../lib/format';
import { useLoad } from '../../lib/useLoad';

export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => fetchGame(String(id)), [id]);
  const { data: game, error, loading, reload } = useLoad(load);
  if (loading && !game) return <Screen title="Ficha"><Loading /></Screen>;
  if (error) return <Screen title="Ficha"><ErrorView message={error} onRetry={reload} /></Screen>;
  if (!game) return <Screen title="Ficha"><Empty title="Partido no encontrado" /></Screen>;
  return (
    <Screen title={`${game.home.shortName} vs ${game.away.shortName}`} subtitle={`${SPORT_META[game.sport].icon} ${game.competition} · ${formatKickoff(game.startsAt)}`}>
      {game.isDemo ? <Notice>Partido ficticio de demostración: no es un calendario confirmado.</Notice> : null}
      <Glass>
        {game.isDemo ? <DemoTag /> : null}
        <Text style={[s.title, { marginTop: 8 }]}>{game.home.name}</Text>
        <Text style={s.muted}>vs</Text>
        <Text style={s.title}>{game.away.name}</Text>
      </Glass>
      <Glass>
        <Text style={s.title}>Datos</Text>
        <Text style={s.muted}>Calidad: {game.isDemo ? 'demostración' : game.dataQuality}</Text>
        <Text style={s.muted}>Lesiones y alineaciones: datos no disponibles</Text>
        <Text style={s.muted}>Cuotas: datos no disponibles</Text>
      </Glass>
      <Glass>
        <Text style={s.title}>Probabilidades</Text>
        <Text style={[s.title, { fontSize: 34 }]} accessibilityLabel="Sin probabilidad publicada">—</Text>
        <Text style={s.muted}>Sin probabilidad publicada: no hay un modelo validado para {SPORT_LABELS[game.sport]}.</Text>
      </Glass>
    </Screen>
  );
}

import { useCallback } from 'react';
import { Text } from 'react-native';
import { formatPercent, SPORT_LABELS } from '@vanta-edge/shared';
import { Screen } from '../../components/Screen';
import { Empty, ErrorView, Glass, Loading, Notice, s } from '../../components/ui';
import { fetchPicks } from '../../lib/api';
import { useLoad } from '../../lib/useLoad';

export default function Picks() {
  const load = useCallback(() => fetchPicks(), []);
  const { data, error, loading, reload } = useLoad(load);
  return (
    <Screen title="Picks" subtitle="Solo modelos aprobados, con historial inmutable." onRefresh={reload} refreshing={loading && !!data}>
      {loading && !data ? <Loading /> : error ? <ErrorView message={error} onRetry={reload} /> : (
        <>
          <Notice>{data!.note}</Notice>
          {data!.publicationEnabled && data!.data.length ? data!.data.map((p) => (
            <Glass key={p.id}>
              <Text style={s.muted}>{SPORT_LABELS[p.sport]} · {p.market}</Text>
              <Text style={s.title}>{p.selection}</Text>
              <Text style={[s.title, { fontSize: 26 }]}>{formatPercent(p.probability)}</Text>
              <Text style={s.muted}>{p.explanation}</Text>
            </Glass>
          )) : <Empty title="Sin picks publicados" body="Aparecerán cuando un modelo supere la validación y sea aprobado." />}
        </>
      )}
    </Screen>
  );
}

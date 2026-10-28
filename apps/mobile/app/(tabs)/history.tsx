import { Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Empty, Glass, Notice, s } from '../../components/ui';
import { research } from '../../lib/research';
import { colors } from '../../lib/theme';

const pct = (n: number) => `${(n * 100).toFixed(1)} %`;

export default function History() {
  return (
    <Screen title="Historial y rendimiento" subtitle="Predicciones publicadas y validación de modelos.">
      <Text style={[s.title, { marginTop: 4 }]} accessibilityRole="header">Predicciones publicadas</Text>
      <Empty title="Sin historial" body="No se ha publicado ninguna predicción: ningún modelo está aprobado." />
      <Text style={[s.title, { marginTop: 8 }]} accessibilityRole="header">Validación (investigación)</Text>
      <Notice>{research.note}</Notice>
      {research.reports.map((r) => (
        <Glass key={r.sport}>
          <Text style={s.title}>{r.sport} · {r.market}</Text>
          <Text style={s.muted}>Holdout {r.holdout.start} → {r.holdout.end} · {r.holdout.events} partidos</Text>
          {Object.entries(r.models).map(([name, m]) => {
            const gate = r.gates.find((g) => g.model === name);
            return (
              <View key={name} style={{ marginTop: 10 }} accessible accessibilityLabel={`${name}: ROI simulado ${pct(m.betSim.roi)}, ${gate?.status === 'experimental_not_publishable' ? 'no publicable' : 'candidato'}`}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{name}</Text>
                <Text style={s.muted}>Log loss {m.logLoss.toFixed(3)} vs mercado {r.baselines.market_no_vig?.log_loss.toFixed(3)}</Text>
                <Text style={s.muted}>ROI simulado {pct(m.betSim.roi)} [IC {pct(m.betSim.roi_ci_low)}, {pct(m.betSim.roi_ci_high)}]</Text>
                <Text style={{ color: gate?.status === 'experimental_not_publishable' ? colors.danger : colors.green, fontSize: 13 }}>
                  {gate?.status === 'experimental_not_publishable' ? 'No publicable' : 'Candidato (requiere aprobación)'}
                </Text>
              </View>
            );
          })}
        </Glass>
      ))}
      <Empty title="Champions League, LaLiga, MLB, NBA" body="Sin evaluar: falta un dataset histórico con licencia verificada." />
    </Screen>
  );
}

import { StyleSheet, Text } from 'react-native';
import { Glass } from '../components/Glass';
import { Screen } from '../components/Screen';
import { ErrorState, Loading } from '../components/States';
import { requireSupabase } from '../lib/supabase';
import { useFocusData } from '../lib/useAsync';
import { colors } from '../lib/theme';

type Overview = { accounts: number; students: number; materialsFailed: number; jobsQueued: number;
  aiToday: { requests: number; est_cost_usd: number; alert_sent_at: string | null } | null };

// Aggregates only (no personal data or content). The server rejects non-admins.
export default function Admin() {
  const { data, error, loading, reload } = useFocusData(async () => {
    const { data: d, error: e } = await requireSupabase().rpc('admin_overview');
    if (e) throw new Error(e.message);
    return d as Overview;
  });
  return (
    <Screen back title="Administración">
      {loading && !data ? <Loading /> : error ? <ErrorState message={error} onRetry={reload} /> : data ? (
        <Glass style={{ marginTop: 12, gap: 6 }}>
          <Text style={styles.row}>Cuentas: {data.accounts}</Text>
          <Text style={styles.row}>Perfiles de estudiantes: {data.students}</Text>
          <Text style={styles.row}>Materiales con error: {data.materialsFailed}</Text>
          <Text style={styles.row}>Trabajos de lectura en cola: {data.jobsQueued}</Text>
          <Text style={styles.row}>IA hoy: {data.aiToday?.requests ?? 0} solicitudes · USD {Number(data.aiToday?.est_cost_usd ?? 0).toFixed(2)}</Text>
          <Text style={styles.row}>Alerta de gasto: {data.aiToday?.alert_sent_at ? 'enviada' : 'no'}</Text>
        </Glass>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { color: colors.text, fontSize: 16, lineHeight: 26 } });

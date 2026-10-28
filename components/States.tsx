import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import { Button } from './Button';
import { useOnline } from '../lib/network';

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.lilac} size="large" />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.muted}>{body}</Text> : null}
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" style={{ marginTop: 16 }} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={[styles.box, styles.errorBox]} accessibilityRole="alert">
      <Text style={styles.title}>No pudimos cargar esto</Text>
      <Text style={styles.muted}>{message}</Text>
      {onRetry ? <Button label="Reintentar" onPress={onRetry} variant="secondary" style={{ marginTop: 16 }} /> : null}
    </View>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'success' | 'error' | 'warning'; children: string }) {
  const color = { info: colors.lilac, success: colors.mint, error: colors.danger, warning: colors.warning }[tone];
  return (
    <View style={[styles.notice, { borderColor: color }]} accessibilityRole={tone === 'error' ? 'alert' : 'text'} accessibilityLiveRegion="polite">
      <Text style={[styles.noticeText]}>{children}</Text>
    </View>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  if (online !== false) return null;
  return (
    <View style={styles.offline} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Text style={styles.offlineText}>Sin conexión. Algunas funciones no están disponibles.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  box: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 20, marginVertical: 12, backgroundColor: 'rgba(255,255,255,0.04)' },
  errorBox: { borderColor: 'rgba(255,122,133,0.5)' },
  title: { color: colors.text, fontSize: 17, fontWeight: '600', marginBottom: 6 },
  muted: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 12, marginVertical: 10, backgroundColor: 'rgba(255,255,255,0.04)' },
  noticeText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  offline: { backgroundColor: '#3A2A10', paddingVertical: 8, paddingHorizontal: 16 },
  offlineText: { color: colors.warning, fontSize: 13, textAlign: 'center' },
});

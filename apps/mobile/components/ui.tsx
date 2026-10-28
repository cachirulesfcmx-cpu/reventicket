import { BlurView } from 'expo-blur';
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SPORT_META, type Game } from '@vanta-edge/shared';
import { formatKickoff } from '../lib/format';
import { colors, TOUCH } from '../lib/theme';

/** Liquid-glass card: real blur on iOS, solid translucent fallback on Android/web (contrast never depends on blur). */
export function Glass({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.glass, Platform.OS !== 'ios' && { backgroundColor: colors.panelSolid }, style]}>
      {Platform.OS === 'ios' ? <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} /> : null}
      <View style={s.glassInner}>{children}</View>
    </View>
  );
}

export function DemoTag({ label = 'DEMO · ficticio' }: { label?: string }) {
  return <Text style={s.demo} accessibilityLabel="Dato de demostración, partido ficticio">{label}</Text>;
}

export function Notice({ children, tone = 'warn' }: { children: string; tone?: 'warn' | 'info' }) {
  return (
    <View style={[s.notice, tone === 'info' && { borderColor: colors.line, backgroundColor: colors.panelSolid }]} accessibilityRole="text">
      <Text style={s.noticeText}>{children}</Text>
    </View>
  );
}

export function Loading() {
  return <View style={s.center} accessibilityRole="progressbar" accessibilityLabel="Cargando"><ActivityIndicator color={colors.green} size="large" /></View>;
}

export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Glass style={{ borderColor: 'rgba(255,180,162,0.4)' }}>
      <Text style={s.title} accessibilityRole="alert">No pudimos cargar esto</Text>
      <Text style={s.muted}>{message}</Text>
      <Button label="Reintentar" onPress={onRetry} />
    </Glass>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return <Glass><Text style={s.title}>{title}</Text>{body ? <Text style={s.muted}>{body}</Text> : null}</Glass>;
}

export function Button({ label, onPress, ghost, disabled }: { label: string; onPress: () => void; ghost?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} aria-disabled={!!disabled}
      style={({ pressed }) => [s.btn, ghost && s.btnGhost, (pressed || disabled) && { opacity: 0.6 }]}>
      <Text style={[s.btnText, ghost && { color: colors.green }]}>{label}</Text>
    </Pressable>
  );
}

const STATUS: Record<Game['status'], string> = { scheduled: 'Programado', live: 'En vivo', final: 'Final', postponed: 'Pospuesto', cancelled: 'Cancelado' };

export function GameCard({ game }: { game: Game }) {
  return (
    <Link href={`/game/${game.id}`} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={`${game.home.name} contra ${game.away.name}, ${formatKickoff(game.startsAt)}${game.isDemo ? ', partido ficticio de demostración' : ''}`}>
        <Glass>
          <View style={s.row}>
            <Text style={s.muted}>{SPORT_META[game.sport].icon} {game.competition}</Text>
            {game.isDemo ? <DemoTag /> : <Text style={s.muted}>{STATUS[game.status]}</Text>}
          </View>
          {[game.home, game.away].map((t, i) => (
            <View key={t.id + i} style={s.team}>
              <Text style={s.abbr}>{t.shortName}</Text>
              <Text style={s.teamName}>{t.name}</Text>
              {game.homeScore != null && game.awayScore != null ? <Text style={s.score}>{i === 0 ? game.homeScore : game.awayScore}</Text> : null}
            </View>
          ))}
          <Text style={[s.muted, { marginTop: 6 }]}>{formatKickoff(game.startsAt)}</Text>
        </Glass>
      </Pressable>
    </Link>
  );
}

export const s = StyleSheet.create({
  glass: { borderRadius: 20, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', backgroundColor: colors.panel, marginBottom: 12 },
  glassInner: { padding: 16 },
  center: { padding: 32, alignItems: 'center' },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  demo: { color: colors.warn, fontSize: 11, backgroundColor: colors.warnBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  notice: { borderWidth: 1, borderColor: '#5A4C2C', backgroundColor: colors.warnBg, borderRadius: 16, padding: 14, marginBottom: 12 },
  noticeText: { color: '#E9DDBF', fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  team: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 5 },
  abbr: { width: 40, textAlign: 'center', color: colors.lime, fontWeight: '800', fontSize: 12, backgroundColor: '#20392D', borderRadius: 10, paddingVertical: 8, overflow: 'hidden' },
  teamName: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  score: { color: colors.text, fontSize: 18, fontWeight: '800' },
  btn: { minHeight: TOUCH, borderRadius: 99, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 12 },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.green },
  btnText: { color: '#04130C', fontWeight: '800', fontSize: 15 },
});

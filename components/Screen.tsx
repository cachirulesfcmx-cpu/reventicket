import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, gradients, TOUCH } from '../lib/theme';
import { OfflineBanner } from './States';

type Props = {
  title?: string;
  subtitle?: string;
  back?: boolean | (() => void);
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  headerRight?: ReactNode;
};

export function Canvas() {
  return (
    <>
      <LinearGradient colors={gradients.canvas} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[styles.star, { top: '12%', left: '14%' }]} />
      <View pointerEvents="none" style={[styles.star, { top: '46%', right: '9%' }]} />
      <View pointerEvents="none" style={[styles.star, { top: '74%', left: '26%', opacity: 0.5 }]} />
    </>
  );
}

export function BackButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      accessibilityRole="button"
      accessibilityLabel="Regresar"
      hitSlop={8}
      style={styles.back}
    >
      <Text style={styles.backGlyph}>‹</Text>
    </Pressable>
  );
}

/** Page shell: safe areas, night canvas, optional back header, scrollable body and sticky footer. */
export function Screen({ title, subtitle, back, children, footer, scroll = true, headerRight }: Props) {
  const body = (
    <View style={styles.inner}>
      {title ? <Text style={styles.title} accessibilityRole="header">{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <Canvas />
      <OfflineBanner />
      {back || headerRight ? (
        <View style={styles.header}>
          {back ? <BackButton onPress={typeof back === 'function' ? back : undefined} /> : <View />}
          {headerRight}
        </View>
      ) : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{body}</ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{body}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 },
  back: {
    width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  backGlyph: { color: colors.text, fontSize: 28, marginTop: -3 },
  scroll: { flexGrow: 1, paddingBottom: 28 },
  inner: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12 },
  title: { color: colors.text, fontSize: 30, lineHeight: 37, fontWeight: '600', letterSpacing: -0.6, marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, marginBottom: 8 },
  footer: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  star: { position: 'absolute', width: 2, height: 2, borderRadius: 1, backgroundColor: '#B5B8FF' },
});

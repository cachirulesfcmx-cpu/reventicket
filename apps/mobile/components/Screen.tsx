import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';

export function Screen({ title, subtitle, children, onRefresh, refreshing = false }: {
  title: string; subtitle?: string; children: ReactNode; onRefresh?: () => void; refreshing?: boolean;
}) {
  return (
    <SafeAreaView style={st.safe} edges={['top', 'left', 'right']}>
      <LinearGradient colors={['#163D2E', '#0B1712', colors.bg]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={st.page}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} /> : undefined}>
        <View style={st.inner}>
          <Text style={st.brand}>VANTA EDGE</Text>
          <Text style={st.title} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={st.subtitle}>{subtitle}</Text> : null}
          {children}
          <Text style={st.footer}>+18 · Informativo. Sin apuestas ni transacciones. Las probabilidades no garantizan resultados.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { paddingBottom: 32 },
  inner: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12 },
  brand: { color: colors.green, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 6 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 14 },
  footer: { color: '#7F9789', fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 16 },
});

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Glass } from '../../components/Glass';
import { Screen } from '../../components/Screen';
import { ErrorState, Loading, Notice } from '../../components/States';
import { listPlans, saveOnboarding, type Plan } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { subjectName } from '../../lib/catalog';
import { relativeExamLabel } from '../../lib/dates';
import { clearDraft, loadDraft } from '../../lib/draft';
import { friendlyError } from '../../lib/errors';
import { isMinor, STEPS, canContinue, type Answers } from '../../lib/onboarding';
import { useFocusData } from '../../lib/useAsync';
import { colors, radii } from '../../lib/theme';

const TILES = [
  { href: '/tutor', icon: '✦', title: 'Tutor IA', body: 'Pregunta y aprende paso a paso' },
  { href: '/exam', icon: '◉', title: 'Simulacro', body: 'Practica y califícate al instante' },
  { href: '/materials', icon: '▤', title: 'Materiales', body: 'Sube PDF, fotos o texto' },
  { href: '/family', icon: '⌂', title: 'Familia', body: 'Perfiles y reportes' },
] as const;

export default function Home() {
  const { profile } = useAuth();
  const plans = useFocusData(listPlans);
  const [draft, setDraft] = useState<Answers | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Persist the first-run answers once an adult account exists.
  useEffect(() => {
    loadDraft().then(async (d) => {
      if (!d || STEPS.some((s) => !canContinue(s, d))) return;
      if (isMinor(d)) { setDraft(d); return; }
      try { await saveOnboarding(d); await clearDraft(); } catch (e) { setSyncMsg(friendlyError(e)); }
    });
  }, []);

  const active = (plans.data ?? []).filter((p) => p.status === 'active');
  const next: Plan | undefined = active.filter((p) => p.exam_date).sort((a, b) => a.exam_date!.localeCompare(b.exam_date!))[0] ?? active[0];

  return (
    <Screen title={`¡Hola${profile?.display_name ? `, ${profile.display_name}` : ''}!`} subtitle="¿Qué vamos a aprender hoy?">
      {syncMsg ? <Notice tone="warning">{syncMsg}</Notice> : null}
      {draft ? (
        <Notice tone="info">Para terminar la configuración del estudiante, crea su perfil en Familia. Sus respuestas se guardarán ahí.</Notice>
      ) : null}
      {draft ? <Button label="Crear perfil del estudiante" variant="secondary" onPress={() => router.push('/family?from=onboarding')} /> : null}

      <Glass style={styles.hero}>
        <Text style={styles.kicker}>TU PRÓXIMO OBJETIVO</Text>
        {plans.loading ? <Loading /> : plans.error ? <ErrorState message={plans.error} onRetry={plans.reload} /> : next ? (
          <Pressable onPress={() => router.push(`/plan/${next.id}`)} accessibilityRole="button" accessibilityLabel={`Abrir plan ${next.title}`}>
            <Text style={styles.heroTitle}>{next.title}</Text>
            <Text style={styles.muted}>{subjectName(next.subject_slug)} · {relativeExamLabel(next.exam_date, new Date())}</Text>
          </Pressable>
        ) : (
          <Text style={styles.muted}>Aún no tienes planes. Crea uno con los temas de tu examen.</Text>
        )}
        <Button label={next ? 'Nuevo plan' : 'Preparar un examen →'} onPress={() => router.push('/plan/new')} style={{ marginTop: 16 }} />
      </Glass>

      <Text style={styles.section} accessibilityRole="header">Herramientas</Text>
      <View style={styles.grid}>
        {TILES.map((t) => (
          <Pressable key={t.href} onPress={() => router.push(t.href)} style={styles.tile} accessibilityRole="button" accessibilityLabel={`${t.title}. ${t.body}`}>
            <Text style={styles.tileIcon}>{t.icon}</Text>
            <Text style={styles.tileTitle}>{t.title}</Text>
            <Text style={styles.muted}>{t.body}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 16 },
  kicker: { color: colors.mint, fontSize: 12, fontWeight: '700', letterSpacing: 1.4, marginBottom: 10 },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  section: { color: colors.text, fontSize: 20, fontWeight: '600', marginTop: 24, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '46%', flexGrow: 1, minHeight: 130, padding: 16, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tileIcon: { fontSize: 24, color: colors.lilac, marginBottom: 10 },
  tileTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
});

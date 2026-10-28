import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Choice } from '../components/Choice';
import { Glass } from '../components/Glass';
import { BackButton, Canvas } from '../components/Screen';
import { Notice } from '../components/States';
import { OTHER_SUBJECT, searchSubjects } from '../lib/catalog';
import { examDateOptions, upcomingDays } from '../lib/dates';
import { loadDraft, saveDraft } from '../lib/draft';
import {
  EMPTY_ANSWERS, GOAL_TARGET, MAX_AGE, MIN_AGE, STEPS, canContinue, firstIncompleteStep, isMinor,
  type Answers, type Concern, type Goal, type Need, type Role,
} from '../lib/onboarding';
import { colors, gradients, radii, TOUCH } from '../lib/theme';
import { VOICES, speak, stopSpeaking } from '../lib/voice';

const TITLES: Record<(typeof STEPS)[number], string> = {
  role: '¿Cuál de estas opciones te describe mejor?',
  voice: '¿Cómo quieres que suene tu tutor?',
  age: '¿Cuántos años tienes?',
  need: '¿Qué necesitas más ahora mismo?',
  prepMode: '¿Crear o unirte a una preparación de examen?',
  examDate: '¿Cuándo es tu examen?',
  subject: '¿De qué materia es el examen?',
  goal: '¿Cuál es tu meta?',
  concern: '¿Qué es lo que más te preocupa?',
  materials: '¿Tienes apuntes para este examen?',
};

const ROLES: { id: Role; title: string; subtitle: string; icon: string }[] = [
  { id: 'student', title: 'Estudiante', subtitle: 'Prepárate para tus exámenes', icon: '🎓' },
  { id: 'guardian', title: 'Padre, madre o tutor', subtitle: 'Acompaña el aprendizaje de tus hijos', icon: '👨‍👩‍👧' },
  { id: 'teacher', title: 'Docente', subtitle: 'Prepara clases y actividades', icon: '🧑‍🏫' },
  { id: 'other', title: 'Otro', subtitle: 'Explora StudIA', icon: '🔭' },
];

const NEEDS: { id: Need; title: string; subtitle: string; icon: string }[] = [
  { id: 'upcoming_exam', title: 'Tengo un examen pronto', subtitle: 'Un plan de estudio rápido y sin estrés.', icon: '📝' },
  { id: 'better_grades', title: 'Quiero mejores calificaciones', subtitle: 'Estudia con método y constancia.', icon: '📈' },
  { id: 'official_exam', title: 'Presentaré un examen de admisión', subtitle: 'Organiza tu preparación por temas.', icon: '📋' },
];

const GOALS: { id: Goal; title: string; subtitle: string }[] = [
  { id: 'pass', title: 'Aprobar', subtitle: 'Enfócate en los temas clave' },
  { id: 'good', title: 'Sacar buena calificación', subtitle: 'Repasa todos los temas con práctica' },
  { id: 'excellent', title: 'Sacar 10', subtitle: 'Domina también las preguntas difíciles' },
];

const CONCERNS: { id: Concern; title: string; icon: string }[] = [
  { id: 'where_to_start', title: 'No sé por dónde empezar', icon: '🧭' },
  { id: 'too_much_material', title: 'Hay demasiado material', icon: '📚' },
  { id: 'dont_understand', title: 'No entiendo las explicaciones', icon: '❔' },
  { id: 'no_time', title: 'No tengo suficiente tiempo', icon: '⏱️' },
  { id: 'fear_failing', title: 'Me preocupa reprobar', icon: '😟' },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>(EMPTY_ANSWERS);
  const [search, setSearch] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [langNote, setLangNote] = useState(false);
  const now = useMemo(() => new Date(), []);
  const id = STEPS[step];

  useEffect(() => {
    loadDraft().then((d) => {
      if (d) { setA(d); setStep(Math.min(firstIncompleteStep(d), STEPS.length - 1)); }
    });
    return stopSpeaking;
  }, []);

  const update = (patch: Partial<Answers>) => {
    setA((prev) => {
      const next = { ...prev, ...patch };
      saveDraft(next);
      return next;
    });
  };

  const valid = canContinue(id, a, now);
  const last = step === STEPS.length - 1;
  const goBack = () => (step > 0 ? setStep(step - 1) : router.canGoBack() ? router.back() : router.replace('/login'));
  const goNext = () => {
    if (!valid) return;
    if (last) router.push('/register');
    else setStep(step + 1);
  };

  const dateOptions = examDateOptions(now);
  const subjects = searchSubjects(search);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom', 'left', 'right']}>
      <Canvas />
      <View style={s.top}>
        <BackButton onPress={goBack} />
        <View
          style={s.track}
          accessibilityRole="progressbar"
          accessibilityLabel="Progreso del cuestionario"
          aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-valuetext={`Paso ${step + 1} de ${STEPS.length}`}
        >
          <LinearGradient colors={gradients.progress} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[s.fill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
        </View>
        <Pressable onPress={() => setLangNote((v) => !v)} style={s.lang} accessibilityRole="button"
          accessibilityLabel="Idioma: español de México" accessibilityHint="Muestra los idiomas disponibles">
          <Text style={{ fontSize: 16 }}>🇲🇽</Text>
          <Text style={s.langText}>ES</Text>
        </Pressable>
      </View>
      {langNote ? <View style={s.pad}><Notice>Por ahora StudIA está disponible solo en español (México).</Notice></View> : null}

      <ScrollView key={step} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.heading} accessibilityRole="header" testID="onboarding-title">{TITLES[id]}</Text>

        {id === 'role' && (
          <View style={s.list}>
            {ROLES.map((r) => (
              <Choice key={r.id} testID={`role-${r.id}`} title={r.title} subtitle={r.subtitle} selected={a.role === r.id}
                onPress={() => update({ role: r.id })} right={<Text style={s.emoji}>{r.icon}</Text>} />
            ))}
          </View>
        )}

        {id === 'voice' && (
          <View style={s.voiceArea}>
            <View style={s.orbOuter} importantForAccessibility="no-hide-descendants">
              <LinearGradient colors={gradients.orb} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[s.orb, a.voice === 'text_only' && { opacity: 0.35 }]} />
            </View>
            <Text style={s.eyebrow}>ELIGE LA VOZ</Text>
            <View style={s.row} accessibilityRole="radiogroup">
              {VOICES.map((v) => (
                <Pressable key={v.id} testID={`voice-${v.id}`} onPress={() => { update({ voice: v.id }); speak(`Hola, soy ${v.name}. Vamos a estudiar juntos.`, v.id); }}
                  accessibilityRole="radio" accessibilityLabel={`Voz ${v.name}`} accessibilityHint="Reproduce una muestra de la voz"
                  aria-selected={a.voice === v.id} aria-checked={a.voice === v.id}
                  style={[s.pill, a.voice === v.id && s.pillOn]}>
                  <Text style={s.pillText}>{a.voice === v.id ? `✓ ${v.name}` : v.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.caption}>Toca una voz para escuchar una muestra (usa la voz de tu dispositivo).</Text>
            <Glass style={{ marginTop: 24, alignSelf: 'stretch' }}>
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>No usar voz</Text>
                  <Text style={s.caption}>Chatea con tu tutor solo por texto</Text>
                </View>
                <Switch testID="voice-text-only" value={a.voice === 'text_only'} accessibilityLabel="No usar voz, solo texto"
                  onValueChange={(on) => { stopSpeaking(); update({ voice: on ? 'text_only' : 'luna' }); }}
                  trackColor={{ false: '#34343D', true: colors.violet }} thumbColor="#FFFFFF" />
              </View>
            </Glass>
          </View>
        )}

        {id === 'age' && (
          <View style={{ marginTop: 28 }}>
            <View
              style={s.agePicker}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Edad"
              aria-valuemin={MIN_AGE} aria-valuemax={MAX_AGE} aria-valuenow={a.age ?? 12} aria-valuetext={a.age ? `${a.age} años` : 'Sin elegir'}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(e) => {
                const cur = a.age ?? 12;
                update({ age: e.nativeEvent.actionName === 'increment' ? Math.min(MAX_AGE, cur + 1) : Math.max(MIN_AGE, cur - 1), guardianAck: false });
              }}
            >
              <Pressable testID="age-minus" onPress={() => update({ age: Math.max(MIN_AGE, (a.age ?? 13) - 1), guardianAck: false })}
                style={s.ageBtn} accessibilityRole="button" accessibilityLabel="Restar un año"><Text style={s.ageBtnText}>−</Text></Pressable>
              <Text style={s.ageValue} testID="age-value">{a.age ?? '—'}<Text style={s.ageUnit}> años</Text></Text>
              <Pressable testID="age-plus" onPress={() => update({ age: Math.min(MAX_AGE, (a.age ?? 11) + 1), guardianAck: false })}
                style={s.ageBtn} accessibilityRole="button" accessibilityLabel="Sumar un año"><Text style={s.ageBtnText}>+</Text></Pressable>
            </View>
            <View style={[s.row, { flexWrap: 'wrap', marginTop: 18 }]}>
              {[8, 10, 12, 14, 16, 18, 25].map((n) => (
                <Pressable key={n} onPress={() => update({ age: n, guardianAck: false })} style={[s.chip, a.age === n && s.pillOn]}
                  accessibilityRole="button" accessibilityLabel={`${n} años`}>
                  <Text style={s.pillText}>{n === 25 ? '18+' : n}</Text>
                </Pressable>
              ))}
            </View>
            {a.age !== null && a.age < 18 ? (
              <Glass style={{ marginTop: 24 }}>
                <Text style={s.cardTitle}>Necesitas a un adulto</Text>
                <Text style={s.caption}>
                  Las cuentas de StudIA las crea una persona adulta (padre, madre o tutor). Después, desde su cuenta, podrá crear tu perfil de estudiante y autorizarlo.
                </Text>
                <Pressable testID="guardian-ack" onPress={() => update({ guardianAck: !a.guardianAck })} style={s.checkRow}
                  accessibilityRole="checkbox" aria-checked={a.guardianAck}
                  accessibilityLabel="Un adulto responsable me está ayudando y creará la cuenta">
                  <View style={[s.checkbox, a.guardianAck && s.checkboxOn]}>{a.guardianAck ? <Text style={s.checkMark}>✓</Text> : null}</View>
                  <Text style={[s.caption, { flex: 1 }]}>Un adulto responsable me está ayudando y creará la cuenta.</Text>
                </Pressable>
              </Glass>
            ) : null}
          </View>
        )}

        {id === 'need' && (
          <View style={s.list}>
            {NEEDS.map((n) => (
              <Choice key={n.id} testID={`need-${n.id}`} title={n.title} subtitle={n.subtitle} selected={a.need === n.id}
                onPress={() => update({ need: n.id })} right={<Text style={s.emoji}>{n.icon}</Text>} />
            ))}
          </View>
        )}

        {id === 'prepMode' && (
          <View style={s.list}>
            <Choice testID="prep-create" title="CREAR · Preparación de examen"
              subtitle="Sube tus apuntes o escribe los temas y arma un plan personalizado."
              selected={a.prepMode === 'create'} onPress={() => update({ prepMode: 'create' })} />
            <View style={s.or}><View style={s.line} /><Text style={s.caption}>O</Text><View style={s.line} /></View>
            <Choice testID="prep-join" title="UNIRTE · Preparación de tu escuela"
              subtitle="Próximamente: códigos de escuela para estudiar con materiales de tu docente."
              selected={false} disabled onPress={() => {}} />
          </View>
        )}

        {id === 'examDate' && (
          <View style={s.list}>
            {dateOptions.map((d) => (
              <Choice key={d.key} testID={`date-${d.key}`} title={d.title} subtitle={d.subtitle} selected={a.examDate === d.iso}
                onPress={() => { setShowCalendar(false); update({ examDate: d.iso }); }}
                right={<View style={s.dateBadge}><Text style={s.dateNum}>{d.day}</Text><Text style={s.dateMonth}>{d.month}</Text></View>} />
            ))}
            <Button testID="date-other" label={showCalendar ? 'Ocultar calendario' : 'Elegir otra fecha'} variant="secondary"
              onPress={() => setShowCalendar((v) => !v)} />
            {showCalendar ? (
              <View style={s.calendar}>
                {upcomingDays(now).map((d) => (
                  <Pressable key={d.key} onPress={() => update({ examDate: d.iso })} accessibilityRole="button"
                    accessibilityLabel={d.title} aria-selected={a.examDate === d.iso}
                    style={[s.calDay, a.examDate === d.iso && s.pillOn]}>
                    <Text style={s.calNum}>{d.day}</Text>
                    <Text style={s.dateMonth}>{d.month}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        )}

        {id === 'subject' && (
          <View style={{ marginTop: 20 }}>
            <TextInput testID="subject-search" value={search} onChangeText={setSearch} placeholder="Buscar materia"
              placeholderTextColor={colors.faint} style={s.search} accessibilityLabel="Buscar materia" autoCorrect={false} />
            <View style={s.grid}>
              {subjects.map((sub) => (
                <Pressable key={sub.slug} testID={`subject-${sub.slug}`} onPress={() => update({ subject: sub.slug })}
                  accessibilityRole="radio" accessibilityLabel={sub.name}
                  aria-selected={a.subject === sub.slug} aria-checked={a.subject === sub.slug}
                  style={[s.subject, a.subject === sub.slug && s.subjectOn]}>
                  <Text style={s.subjectText}>{a.subject === sub.slug ? `✓ ${sub.name}` : sub.name}</Text>
                  <Text style={s.subjectGlyph} importantForAccessibility="no">{sub.glyph}</Text>
                </Pressable>
              ))}
            </View>
            {subjects.length === 0 ? <Text style={[s.caption, { textAlign: 'center' }]}>No encontramos “{search}”.</Text> : null}
            <Pressable testID="subject-other" onPress={() => { setSearch(''); update({ subject: OTHER_SUBJECT.slug }); }}
              accessibilityRole="radio" aria-selected={a.subject === OTHER_SUBJECT.slug} aria-checked={a.subject === OTHER_SUBJECT.slug}
              style={[s.addPill, a.subject === OTHER_SUBJECT.slug && s.pillOn]}>
              <Text style={s.pillText}>{a.subject === OTHER_SUBJECT.slug ? '✓ Otra materia' : '＋ Agrega tu materia'}</Text>
            </Pressable>
          </View>
        )}

        {id === 'goal' && (
          <View style={s.list}>
            {GOALS.map((g) => (
              <Choice key={g.id} testID={`goal-${g.id}`} title={g.title} subtitle={g.subtitle} selected={a.goal === g.id}
                onPress={() => update({ goal: g.id })}
                right={<View style={s.ring} accessibilityLabel={`Meta ${GOAL_TARGET[g.id]} por ciento`}><Text style={s.ringText}>{GOAL_TARGET[g.id]}%</Text></View>} />
            ))}
          </View>
        )}

        {id === 'concern' && (
          <View style={s.list}>
            {CONCERNS.map((c) => (
              <Choice key={c.id} testID={`concern-${c.id}`} title={c.title} selected={a.concern === c.id}
                onPress={() => update({ concern: c.id })} right={<Text style={s.emoji}>{c.icon}</Text>} />
            ))}
          </View>
        )}

        {id === 'materials' && (
          <View style={s.list}>
            <Text style={[s.caption, { textAlign: 'center', fontSize: 16 }]}>
              Con apuntes, tu preparación es más precisa. Sin ellos, la armamos con los temas que nos cuentes.
            </Text>
            <Choice testID="materials-have" title="Tengo apuntes" subtitle="Sube PDF, fotos o texto después de crear la cuenta."
              selected={a.materials === 'have_notes'} onPress={() => update({ materials: 'have_notes' })} />
            <Choice testID="materials-none" title="No tengo apuntes" subtitle="Escribe los temas del examen y el tutor te ayuda."
              selected={a.materials === 'no_notes'} onPress={() => update({ materials: 'no_notes' })} />
            <Text style={s.disclaimer}>
              Tus respuestas se guardan solo en este dispositivo hasta que un adulto cree la cuenta; después se usan para personalizar tu plan. No guardamos tu edad exacta.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        <Button testID="onboarding-next" onPress={goNext} disabled={!valid}
          label={last ? (isMinor(a) ? 'Continuar con un adulto' : 'Crear mi cuenta') : 'Continuar'}
          hint={valid ? undefined : 'Elige una opción para continuar'} />
        <Text style={s.stepLabel} testID="onboarding-step">STUDIA · {step + 1} DE {STEPS.length}</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: 20 },
  top: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%', maxWidth: 680, alignSelf: 'center' },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  lang: { flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: TOUCH - 4, paddingHorizontal: 12, borderRadius: radii.pill,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  langText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, width: '100%', maxWidth: 640, alignSelf: 'center' },
  heading: { color: colors.text, fontSize: 32, lineHeight: 40, fontWeight: '600', letterSpacing: -0.9, textAlign: 'center', marginTop: 12 },
  list: { gap: 12, marginTop: 24 },
  emoji: { fontSize: 34 },
  voiceArea: { alignItems: 'center', paddingTop: 24 },
  orbOuter: { width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(166,117,255,0.12)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(205,190,255,0.16)' },
  orb: { width: 150, height: 150, borderRadius: 75, borderWidth: 3, borderColor: 'rgba(255,255,255,0.18)' },
  eyebrow: { color: colors.muted, fontSize: 12, letterSpacing: 2.2, marginTop: 22 },
  row: { flexDirection: 'row', gap: 10, marginTop: 16, justifyContent: 'center' },
  pill: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 22, borderRadius: radii.pill, backgroundColor: colors.surfaceStrong,
    borderWidth: 1, borderColor: colors.border },
  pillOn: { backgroundColor: 'rgba(111,91,255,0.28)', borderColor: colors.lilac, borderWidth: 2 },
  pillText: { color: colors.text, fontSize: 16 },
  chip: { minWidth: TOUCH, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: radii.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  caption: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  agePicker: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surfaceStrong, borderRadius: 40, padding: 8 },
  ageBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceStrong },
  ageBtnText: { color: colors.text, fontSize: 30 },
  ageValue: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 46, fontWeight: '600' },
  ageUnit: { fontSize: 18, color: colors.muted },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, minHeight: TOUCH },
  checkbox: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.violet, borderColor: colors.lilac },
  checkMark: { color: '#fff', fontWeight: '700' },
  or: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  line: { height: 1, backgroundColor: colors.border, flex: 1 },
  dateBadge: { width: 64, height: 64, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center' },
  dateNum: { color: colors.text, fontSize: 26, fontWeight: '600' },
  dateMonth: { color: colors.muted, fontSize: 11, letterSpacing: 1.2, marginTop: 2 },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  calDay: { width: 58, height: 62, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border },
  calNum: { color: colors.text, fontSize: 20, fontWeight: '600' },
  search: { minHeight: 52, borderRadius: radii.pill, backgroundColor: colors.surfaceStrong, paddingHorizontal: 20, color: colors.text,
    fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  subject: { flexBasis: '47%', flexGrow: 1, minHeight: 70, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.045)', padding: 14, justifyContent: 'center', overflow: 'hidden' },
  subjectOn: { borderColor: colors.selectedBorder, backgroundColor: colors.selected, borderWidth: 2 },
  subjectText: { color: colors.text, fontSize: 15, paddingRight: 28 },
  subjectGlyph: { position: 'absolute', right: 10, bottom: 6, fontSize: 22, color: colors.faint },
  addPill: { alignSelf: 'center', minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 20, borderRadius: radii.pill,
    backgroundColor: colors.surfaceStrong, marginTop: 18, borderWidth: 1, borderColor: colors.border },
  ring: { width: 56, height: 56, borderRadius: 28, borderWidth: 4, borderColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  ringText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  disclaimer: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 10 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10, width: '100%', maxWidth: 640, alignSelf: 'center' },
  stepLabel: { color: colors.muted, fontSize: 11, letterSpacing: 2, textAlign: 'center', marginTop: 12 },
});

import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Glass } from '../components/Glass';
import { Screen } from '../components/Screen';
import { Loading, Notice } from '../components/States';
import { startQuiz, submitQuiz, type Quiz, type QuizResult } from '../lib/api';
import { SUBJECTS, subjectName } from '../lib/catalog';
import { friendlyError } from '../lib/errors';
import { colors, radii, TOUCH } from '../lib/theme';

export default function Exam() {
  const params = useLocalSearchParams<{ subject?: string; plan?: string; student?: string }>();
  const [subject, setSubject] = useState(params.subject ?? 'matematicas');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setBusy(true); setError(null); setResult(null); setAnswers({}); setIdx(0);
    try { setQuiz(await startQuiz(subject, 5, params.student, params.plan)); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }

  async function finish() {
    if (!quiz) return;
    setBusy(true); setError(null);
    try { setResult(await submitQuiz(quiz.attemptId, answers)); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }

  if (result) {
    return (
      <Screen back title="Resultados" subtitle={subjectName(subject)} footer={<Button label="Hacer otro simulacro" onPress={() => { setQuiz(null); setResult(null); }} />}>
        <Glass style={{ alignItems: 'center', marginTop: 12 }}>
          <Text style={styles.big}>{Math.round(result.score)}%</Text>
          <Text style={styles.muted}>{result.correct} de {result.total} correctas · calificado en el servidor</Text>
        </Glass>
        {result.includesDemo ? <Notice tone="warning">Preguntas de demostración: no es una evaluación oficial ni un diagnóstico curricular.</Notice> : null}
        {result.review.map((r, i) => (
          <View key={r.questionId} style={[styles.review, { borderColor: r.isCorrect ? colors.mint : colors.warning }]}>
            <Text style={styles.q}>{i + 1}. {r.prompt}</Text>
            <Text style={{ color: r.isCorrect ? colors.mint : colors.warning, fontWeight: '600', marginTop: 6 }}>
              {r.isCorrect ? '✓ Correcto' : `✗ Respuesta correcta: ${r.options[r.correctIndex]}`}
            </Text>
            <Text style={styles.muted}>{r.explanation}</Text>
          </View>
        ))}
      </Screen>
    );
  }

  if (!quiz) {
    return (
      <Screen back title="Simulacro" subtitle="Preguntas de opción múltiple calificadas de forma determinista en el servidor."
        footer={<Button label="Empezar" onPress={begin} loading={busy} testID="exam-start" />}>
        <Text style={styles.label}>Materia</Text>
        <View style={styles.wrap}>
          {SUBJECTS.map((s) => (
            <Pressable key={s.slug} onPress={() => setSubject(s.slug)} style={[styles.chip, subject === s.slug && styles.chipOn]}
              accessibilityRole="radio" aria-checked={subject === s.slug}>
              <Text style={styles.chipText}>{subject === s.slug ? `✓ ${s.name}` : s.name}</Text>
            </Pressable>
          ))}
        </View>
        <Notice tone="warning">El banco actual contiene solo preguntas de demostración. El contenido validado por docentes se marcará como tal.</Notice>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </Screen>
    );
  }

  const q = quiz.questions[idx];
  const lastQ = idx === quiz.questions.length - 1;
  return (
    <Screen back title={`Pregunta ${idx + 1} de ${quiz.questions.length}`} subtitle={q.contentStatus === 'demo' ? 'Contenido de demostración' : 'Contenido validado'}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {idx > 0 ? <Button label="Anterior" variant="secondary" onPress={() => setIdx(idx - 1)} style={{ flex: 1 }} /> : null}
          <Button label={lastQ ? 'Calificar' : 'Siguiente'} onPress={lastQ ? finish : () => setIdx(idx + 1)} loading={busy}
            disabled={answers[q.id] === undefined} style={{ flex: 2 }} />
        </View>
      }>
      {busy && !quiz ? <Loading /> : null}
      <Glass style={{ marginTop: 12 }}>
        <Text style={styles.q} accessibilityRole="header">{q.prompt}</Text>
        <View style={{ gap: 10, marginTop: 16 }} accessibilityRole="radiogroup">
          {q.options.map((o, i) => {
            const selected = answers[q.id] === i;
            return (
              <Pressable key={i} onPress={() => setAnswers({ ...answers, [q.id]: i })} style={[styles.option, selected && styles.optionOn]}
                accessibilityRole="radio" aria-checked={selected} accessibilityLabel={`Opción ${String.fromCharCode(65 + i)}: ${o}`}>
                <Text style={styles.optionText}>{selected ? '● ' : '○ '}{String.fromCharCode(65 + i)}. {o}</Text>
              </Pressable>
            );
          })}
        </View>
      </Glass>
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  big: { color: colors.mint, fontSize: 56, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  label: { color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: TOUCH - 4, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.lilac, backgroundColor: 'rgba(111,91,255,0.25)', borderWidth: 2 },
  chipText: { color: colors.text, fontSize: 14 },
  q: { color: colors.text, fontSize: 20, lineHeight: 28, fontWeight: '600' },
  option: { minHeight: TOUCH + 4, justifyContent: 'center', padding: 14, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.04)' },
  optionOn: { borderColor: colors.selectedBorder, backgroundColor: colors.selected, borderWidth: 2 },
  optionText: { color: colors.text, fontSize: 16 },
  review: { borderWidth: 1, borderRadius: radii.md, padding: 14, marginTop: 10, backgroundColor: colors.surface },
});

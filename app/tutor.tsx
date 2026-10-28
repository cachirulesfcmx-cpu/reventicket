import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Notice } from '../components/States';
import { askTutor, listMaterials, type ChatMessage, type Material } from '../lib/api';
import { friendlyError } from '../lib/errors';
import { useOnline } from '../lib/network';
import { colors, radii, TOUCH } from '../lib/theme';
import { speak, stopSpeaking } from '../lib/voice';

const GREETING: ChatMessage = {
  role: 'assistant',
  content: '¡Hola! Soy tu tutor de StudIA. ¿Qué tema quieres entender hoy? Te lo explico paso a paso y luego practicamos.',
};

export default function Tutor() {
  const params = useLocalSearchParams<{ topic?: string; student?: string }>();
  const online = useOnline();
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState(params.topic ? `Explícame: ${params.topic}` : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    listMaterials().then((m) => setMaterials(m.filter((x) => x.status === 'ready'))).catch(() => {});
    return stopSpeaking;
  }, []);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    if (online === false) { setError('Sin conexión. El tutor necesita internet.'); return; }
    setError(null);
    setInput('');
    const history = [...messages.filter((m) => m !== GREETING), { role: 'user' as const, content: q }];
    setMessages([...messages, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const res = await askTutor(history, { studentId: params.student, materialId });
      setMessages((m) => [...m, { role: 'assistant', content: res.answer }]);
    } catch (e) {
      setError(friendlyError(e, 'El tutor no está disponible por ahora.'));
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 50);
    }
  }

  return (
    <Screen back scroll={false} title="Tutor IA" subtitle="Te explica paso a paso. Puede equivocarse: verifica con tu docente."
      footer={
        <View style={styles.composer}>
          <TextInput value={input} onChangeText={setInput} placeholder="Escribe tu pregunta…" placeholderTextColor={colors.faint}
            style={styles.input} multiline maxLength={4000} accessibilityLabel="Tu pregunta" testID="tutor-input" />
          <Pressable onPress={send} disabled={busy || !input.trim()} style={[styles.send, (busy || !input.trim()) && { opacity: 0.5 }]}
            accessibilityRole="button" accessibilityLabel="Enviar pregunta" testID="tutor-send">
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      }>
      {materials.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 8 }} contentContainerStyle={{ gap: 8 }}>
          <Pressable onPress={() => setMaterialId(null)} style={[styles.chip, !materialId && styles.chipOn]} accessibilityRole="radio" aria-checked={!materialId}>
            <Text style={styles.chipText}>Sin material</Text>
          </Pressable>
          {materials.map((m) => (
            <Pressable key={m.id} onPress={() => setMaterialId(m.id)} style={[styles.chip, materialId === m.id && styles.chipOn]} accessibilityRole="radio" aria-checked={materialId === m.id}>
              <Text style={styles.chipText} numberOfLines={1}>📄 {m.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} accessibilityLiveRegion="polite">
        {messages.map((m, i) => (
          <View key={i} style={[styles.msg, m.role === 'user' ? styles.user : styles.ai]}>
            <Text style={styles.role}>{m.role === 'user' ? 'Tú' : 'StudIA'}</Text>
            <Text style={styles.text} selectable>{m.content}</Text>
            {m.role === 'assistant' ? (
              <Pressable onPress={() => speak(m.content, 'luna')} accessibilityRole="button" accessibilityLabel="Escuchar respuesta" style={styles.listen}>
                <Text style={styles.listenText}>🔊 Escuchar</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {busy ? <ActivityIndicator color={colors.lilac} accessibilityLabel="El tutor está escribiendo" /> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: TOUCH, maxHeight: 140, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.06)', color: colors.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  send: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  msg: { padding: 14, borderRadius: 18, marginBottom: 10, maxWidth: '92%' },
  user: { alignSelf: 'flex-end', backgroundColor: 'rgba(91,93,245,0.28)' },
  ai: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  role: { color: colors.lilac, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  text: { color: colors.text, fontSize: 16, lineHeight: 23 },
  listen: { marginTop: 8, minHeight: 32, justifyContent: 'center' },
  listenText: { color: colors.muted, fontSize: 13 },
  chip: { minHeight: 40, maxWidth: 220, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.lilac, borderWidth: 2 },
  chipText: { color: colors.text, fontSize: 13 },
});

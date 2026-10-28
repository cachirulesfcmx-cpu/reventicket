// Real voice previews using the device text-to-speech engine (no audio leaves the device).
import * as Speech from 'expo-speech';
import type { Voice } from './onboarding';

export const VOICES: { id: Exclude<Voice, 'text_only'>; name: string; pitch: number; rate: number }[] = [
  { id: 'luna', name: 'Luna', pitch: 1.15, rate: 0.95 },
  { id: 'sol', name: 'Sol', pitch: 0.85, rate: 0.95 },
  { id: 'nova', name: 'Nova', pitch: 1.0, rate: 1.05 },
];

export function speak(text: string, voice: Voice | null) {
  const v = VOICES.find((x) => x.id === voice);
  if (!v) return;
  Speech.stop();
  Speech.speak(text, { language: 'es-MX', pitch: v.pitch, rate: v.rate });
}

export function stopSpeaking() {
  Speech.stop();
}

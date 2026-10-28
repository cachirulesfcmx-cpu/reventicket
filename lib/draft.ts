// Local onboarding draft. Kept on-device until an authenticated adult account exists,
// then sent through save_onboarding() and cleared.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMPTY_ANSWERS, type Answers } from './onboarding';

const KEY = 'studia.onboarding.v1';

export async function loadDraft(): Promise<Answers | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...EMPTY_ANSWERS, ...(JSON.parse(raw) as Partial<Answers>) } : null;
  } catch {
    return null;
  }
}

export async function saveDraft(a: Answers): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(a)); } catch { /* storage unavailable: draft is best-effort */ }
}

export async function clearDraft(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* ignore */ }
}

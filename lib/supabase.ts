import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { config } from './config';

// Static web export renders once without `window`; skip persistence there.
const canPersist = Platform.OS !== 'web' || typeof window !== 'undefined';

export const supabase = config.isSupabaseConfigured
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        storage: canPersist ? AsyncStorage : undefined,
        persistSession: canPersist,
        autoRefreshToken: canPersist,
        // Links are exchanged explicitly in app/auth/callback.tsx (PKCE).
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  return supabase;
}

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { getConfig } from './config';

const config = getConfig();

const canPersist = Platform.OS !== 'web' || typeof window !== 'undefined';

// Anon key only; data access is enforced by RLS. Sessions refresh automatically.
export const supabase = config.supabaseConfigured
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { storage: canPersist ? AsyncStorage : undefined, persistSession: canPersist, autoRefreshToken: canPersist, detectSessionInUrl: false },
    })
  : null;

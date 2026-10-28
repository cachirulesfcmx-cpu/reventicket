import 'server-only';
import { env, supabaseConfigured } from '../env';
import { DemoProvider } from './demo';
import { SupabaseProvider } from './supabase';
import type { SportsDataProvider } from './types';

/** Demo unless the database provider is explicitly selected and configured. */
export function getProvider(): SportsDataProvider {
  if (env.provider === 'supabase' && supabaseConfigured()) return new SupabaseProvider();
  return new DemoProvider();
}

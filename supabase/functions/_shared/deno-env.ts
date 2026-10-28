// Deno-only glue: env access and Supabase clients. Kept apart from pure modules.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseAllowedOrigins } from './http.ts';

export const env = (name: string): string | undefined => Deno.env.get(name) ?? undefined;
export const allowedOrigins = () => parseAllowedOrigins(env('APP_ALLOWED_ORIGINS'));

/** Client that acts as the calling user (RLS applies). */
export function userClient(authHeader: string): SupabaseClient {
  return createClient(env('SUPABASE_URL')!, env('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

/** Privileged client. Server-side only; never returned to or derived from client input. */
export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
}

/** Structured log line without user content. */
export function log(event: string, fields: Record<string, string | number | boolean | null> = {}) {
  console.log(JSON.stringify({ event, ...fields, at: new Date().toISOString() }));
}

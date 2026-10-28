// Public (client-safe) configuration only. Secrets never use the EXPO_PUBLIC_ prefix.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const config = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  isSupabaseConfigured: /^(https:\/\/[a-z0-9-]+\.supabase\.co|http:\/\/(localhost|127\.0\.0\.1):\d+)$/.test(url) && anonKey.length > 20,
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  privacyNoticeVersion: process.env.EXPO_PUBLIC_PRIVACY_NOTICE_VERSION ?? 'borrador-2026-10',
  privacyNoticeUrl: process.env.EXPO_PUBLIC_PRIVACY_NOTICE_URL ?? '',
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '',
};

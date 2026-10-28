// Public configuration only (EXPO_PUBLIC_* is inlined into the bundle). Never put secrets here.
// Read lazily so tests can vary the environment without reloading modules.
export function getConfig() {
  const apiBase = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return {
    apiBase,
    apiConfigured: /^https?:\/\/[^\s]+$/.test(apiBase),
    supabaseUrl,
    supabaseAnonKey,
    supabaseConfigured: /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl) && supabaseAnonKey.length > 20,
  };
}

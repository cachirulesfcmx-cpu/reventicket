import 'server-only';

// Server-side configuration. SUPABASE_SERVICE_ROLE_KEY and CRON_SECRET are read only here and
// never passed to client components (the `server-only` import makes that a build error).
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  cronSecret: process.env.CRON_SECRET ?? '',
  provider: (process.env.SPORTS_DATA_PROVIDER ?? 'demo').toLowerCase(),
  // Publication additionally requires approved model rows in the database (enforced by RLS).
  predictionsEnabled: process.env.PREDICTIONS_ENABLED === 'true',
};

export const supabaseConfigured = () =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(env.supabaseUrl) && env.supabaseAnonKey.length > 20;

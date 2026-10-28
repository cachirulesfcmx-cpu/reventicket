// Liveness + configuration check. Reports only whether settings exist, never their values.
import { json } from '../_shared/http.ts';
import { env, serviceClient } from '../_shared/deno-env.ts';

Deno.serve(async () => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const names = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL',
    'APP_ALLOWED_ORIGINS', 'WORKER_SECRET', 'AI_DAILY_BUDGET_USD', 'AI_PRICE_INPUT_PER_MTOK', 'AI_PRICE_OUTPUT_PER_MTOK'];
  const config = Object.fromEntries(names.map((n) => [n, Boolean(env(n))]));
  const t0 = Date.now();
  const { error } = await serviceClient().from('subjects').select('slug', { head: true, count: 'exact' });
  const db = { ok: !error, ms: Date.now() - t0 };
  const ok = db.ok && config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY;
  return json({ ok, db, config, version: env('APP_VERSION') ?? 'dev' }, ok ? 200 : 503, headers);
});

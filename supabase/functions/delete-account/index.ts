// Account and data deletion (ARCO: cancelación). Removes stored files, then the auth user;
// every personal row cascades from auth.users.
import { corsHeaders, isOriginAllowed, json } from '../_shared/http.ts';
import { allowedOrigins, log, serviceClient, userClient } from '../_shared/deno-env.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const allowed = allowedOrigins();
  const headers = corsHeaders(origin, allowed);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (!isOriginAllowed(origin, allowed)) return json({ error: 'origin_not_allowed' }, 403, headers);
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'auth_required' }, 401, headers);
  const { data: { user } } = await userClient(authHeader).auth.getUser();
  if (!user) return json({ error: 'invalid_session' }, 401, headers);

  let body: { confirm?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'invalid_json' }, 400, headers); }
  if (body.confirm !== 'ELIMINAR') return json({ error: 'confirmation_required' }, 400, headers);

  const admin = serviceClient();
  const bucket = admin.storage.from('study-materials');
  for (;;) {
    const { data: files, error } = await bucket.list(user.id, { limit: 100 });
    if (error) return json({ error: 'storage_cleanup_failed' }, 500, headers);
    if (!files?.length) break;
    const { error: rmError } = await bucket.remove(files.map((f) => `${user.id}/${f.name}`));
    if (rmError) return json({ error: 'storage_cleanup_failed' }, 500, headers);
  }
  await admin.from('audit_events').insert({ actor_id: null, event_type: 'account_deleted', target_type: 'user', target_id: null });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: 'delete_failed' }, 500, headers);
  log('account_deleted');
  return json({ deleted: true }, 200, headers);
});

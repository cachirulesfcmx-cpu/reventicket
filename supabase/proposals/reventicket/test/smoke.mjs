// Black-box smoke test of the REAL RevenTicket backend (branch main) against a local test database.
// Usage: BASE=http://127.0.0.1:PORT SMOKE_DB_URL=postgres://... ADMIN_EMAIL=... ADMIN_PASS=... RT_DIR=... node smoke.mjs
// Prints one JSON object {step: "status [detail]"}. Fictitious data only; never point it at production.
import { createRequire } from 'node:module';
const require = createRequire(`${process.env.RT_DIR}/package.json`);
const pg = require('pg');

const BASE = process.env.BASE;
const db = new pg.Client({ connectionString: process.env.SMOKE_DB_URL });
await db.connect();
const out = {};
const ids = {};

async function call(step, method, path, { body, token, cookie } = {}) {
  const headers = { 'content-type': 'application/json', 'x-forwarded-proto': 'https' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (cookie) headers.cookie = cookie;
  let res, json = null;
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    try { json = await res.json(); } catch { json = null; }
  } catch (e) {
    out[step] = `ERR ${e.message}`;
    return { status: 0, json: null, res: null };
  }
  const err = json && (json.error || json.message);
  out[step] = `${res.status}${res.status >= 400 && err ? ` ${String(err).slice(0, 80)}` : ''}`;
  return { status: res.status, json, res };
}
const sid = (r) => (r.res?.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).find((c) => c.startsWith('reventicket.sid='));

await call('health', 'GET', '/api/health');
// Registration and session login
const reg = await call('register', 'POST', '/api/auth/register',
  { body: { email: 'buyer.smoke@example.test', password: 'Smoke-Test-Only-1!', firstName: 'Smoke', lastName: 'Buyer' } });
ids.buyer = reg.json?.id;
// Mass-assignment probe: can a public registration choose its own role?
const esc = await call('register_with_role_admin', 'POST', '/api/auth/register',
  { body: { email: 'escalation.smoke@example.test', password: 'Smoke-Test-Only-2!', firstName: 'X', lastName: 'Y', role: 'admin' } });
out.register_with_role_admin += ` role=${esc.json?.role ?? 'n/a'}`;
const login = await call('login_session', 'POST', '/api/auth/login', { body: { email: 'buyer.smoke@example.test', password: 'Smoke-Test-Only-1!' } });
const cookie = sid(login);
await call('me_session', 'GET', '/api/auth/me', { cookie });
const bjwt = await call('login_jwt_buyer', 'POST', '/api/auth/jwt-login', { body: { email: 'buyer.smoke@example.test', password: 'Smoke-Test-Only-1!' } });
const buyerToken = bjwt.json?.token;
await call('login_wrong_password', 'POST', '/api/auth/jwt-login', { body: { email: 'buyer.smoke@example.test', password: 'wrong' } });
// Admin login (bcrypt hash seeded by the harness; ADMIN_PASSWORD bypass not set)
const ajwt = await call('login_jwt_admin', 'POST', '/api/auth/jwt-login', { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASS } });
const adminToken = ajwt.json?.token;
// OTP (WhatsApp disabled: send reports failure in production mode but must persist the code)
await call('otp_send', 'POST', '/api/otp/send', { body: { phone: '5500000001' } });
const otp = await db.query("select code from public.otp_codes where phone = '5500000001' order by created_at desc limit 1");
out.otp_persisted = otp.rowCount === 1 ? 'yes' : 'no';
await call('otp_verify', 'POST', '/api/otp/verify', { body: { phone: '5500000001', code: otp.rows[0]?.code ?? '000000' } });
await call('otp_reuse_rejected', 'POST', '/api/otp/verify', { body: { phone: '5500000001', code: otp.rows[0]?.code ?? '000000' } });
// Authorization boundaries in the app
await call('buyer_cannot_create_venue', 'POST', '/api/venues', { token: buyerToken, body: { name: 'X', city: 'Y' } });
await call('anon_cannot_read_config', 'GET', '/api/config/fees');
// Admin catalogue
const v = await call('admin_create_venue', 'POST', '/api/venues', { token: adminToken, body: { name: 'Foro Smoke', city: 'CDMX' } });
ids.venue = v.json?.id;
await call('admin_create_event', 'POST', '/api/events', { token: adminToken,
  body: { title: 'Evento Smoke', category: 'concierto', date: new Date(Date.now() + 864e5 * 7).toISOString(), venueId: ids.venue || 'v1' } });
const z = await call('admin_create_zone', 'POST', '/api/zones', { token: adminToken, body: { eventId: 'e1', name: 'General', color: '#fff', basePrice: '500.00' } });
ids.zone = z.json?.id;
const t = await call('admin_create_ticket', 'POST', '/api/tickets', { token: adminToken,
  body: { eventId: 'e1', zoneId: ids.zone, row: 'A', seat: '1', price: '500.00' } });
ids.ticket = t.json?.id;
await call('admin_set_config', 'POST', '/api/config', { token: adminToken, body: { key: 'smoke', value: { on: true } } });
await call('admin_get_config', 'GET', '/api/config/smoke', { token: adminToken });
// Public catalogue
await call('list_events', 'GET', '/api/events');
await call('event_zones', 'GET', '/api/events/e1/zones');
await call('event_tickets', 'GET', '/api/events/e1/tickets');
// Purchase and issuance
const o = await call('buyer_create_order', 'POST', '/api/orders', { token: buyerToken, body: { ticketId: ids.ticket, paymentMethod: 'card' } });
ids.order = o.json?.id;
await call('buyer_list_orders', 'GET', '/api/orders', { token: buyerToken });
await call('admin_confirm_payment', 'POST', `/api/orders/${ids.order ?? 'none'}/confirm-payment`, { token: adminToken });
const st = await db.query('select o.status as order_status, t.status as ticket_status from public.orders o join public.tickets t on t.id = o.ticket_id where o.id = $1', [ids.order ?? '']);
out.order_final_state = st.rowCount ? `${st.rows[0].order_status}/${st.rows[0].ticket_status}` : 'none';
await call('admin_list_orders', 'GET', '/api/admin/orders', { token: adminToken });
await call('admin_delete_event', 'DELETE', '/api/events/e3', { token: adminToken });

await db.end();
console.log(JSON.stringify(out));

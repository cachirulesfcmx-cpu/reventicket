// Probes for validate.sh. Prints one JSON object {check: observed, _expect: {check: value required AFTER the fixes}}.
// Every request carries a distinct X-Forwarded-For so per-IP limiters do not mask per-account behaviour
// (locally there is no proxy, so the server's `trust proxy 1` takes it as the client address).
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(`${process.env.RT_DIR}/package.json`);
const pg = require('pg');
const { BASE, LABEL, PEPPER } = process.env;
const db = new pg.Client({ connectionString: process.env.DB });
await db.connect();
let ip = 0;
const req = async (method, path, { body, token } = {}) => {
  ip += 1;
  const headers = { 'content-type': 'application/json', 'x-forwarded-proto': 'https', 'x-forwarded-for': `10.9.${ip >> 8}.${ip & 255}` };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const out = {}; const expect = {};
const check = (name, observed, after) => { out[name] = observed; if (after !== undefined) expect[name] = after; };
// Plant a code in the format the running build stores (plaintext before, HMAC after).
const stored = (phone, code) => (LABEL === 'after' ? createHmac('sha256', PEPPER).update(`${phone}:${code}`).digest('hex') : code);
const plant = (phone, code, ttl = "10 minutes") =>
  db.query(`insert into otp_codes (phone, code, expires_at) values ($1, $2, now() + interval '${ttl}')`, [phone, stored(phone, code)]);
const otpVerify = (phone, code) => req('POST', '/api/otp/verify', { body: { phone, code } });

// ---------------------------------------------------------------- attacks
const esc = await req('POST', '/api/auth/register', { body: { email: 'attacker@example.test', password: 'Smoke-Only-Attacker-1', firstName: 'A', lastName: 'B', role: 'admin' } });
const escRole = (await db.query("select role from users where email = 'attacker@example.test'")).rows[0]?.role;
check('ATTACK register with role=admin -> stored role', `${esc.status} ${escRole}`, '200 buyer');
const escTok = (await req('POST', '/api/auth/jwt-login', { body: { email: 'attacker@example.test', password: 'Smoke-Only-Attacker-1' } })).json?.token;
check('ATTACK self-registered user creates a venue', (await req('POST', '/api/venues', { token: escTok, body: { name: 'X', city: 'Y' } })).status, 403);

check('ATTACK admin login with ADMIN_PASSWORD (plaintext)', (await req('POST', '/api/auth/jwt-login', { body: { email: 'admin@example.test', password: 'plaintext-bypass-test' } })).status, 401);

await req('POST', '/api/otp/send', { body: { phone: '5500000001' } });
const sent = (await db.query("select code from otp_codes where phone = '5500000001' order by created_at desc limit 1")).rows[0]?.code ?? '';
check('ATTACK OTP readable from otp_codes', /^\d{6}$/.test(sent) ? 'plaintext' : /^[0-9a-f]{64}$/.test(sent) ? 'hmac-sha256' : `other(${sent.length})`, 'hmac-sha256');

await plant('5500000002', '111111');
for (let i = 0; i < 5; i++) await otpVerify('5500000002', String(200000 + i));
check('ATTACK distributed brute force: right code after 5 misses', (await otpVerify('5500000002', '111111')).status, 400);

await plant('5500000003', '222222');
const race = await Promise.all([otpVerify('5500000003', '222222'), otpVerify('5500000003', '222222'), otpVerify('5500000003', '222222')]);
check('ATTACK same OTP sent 3x concurrently -> successes', race.filter((r) => r.status === 200).length, 1);

await plant('5500000004', '333333');
await req('POST', '/api/otp/send', { body: { phone: '5500000004' } });
check('ATTACK old OTP still valid after a new one is sent', (await otpVerify('5500000004', '333333')).status, 400);

// ---------------------------------------------------------------- regression: authentication
check('register buyer', (await req('POST', '/api/auth/register', { body: { email: 'buyer@example.test', password: 'Smoke-Only-Buyer-1', firstName: 'B', lastName: 'Uyer' } })).status, 200);
const buyer = await req('POST', '/api/auth/jwt-login', { body: { email: 'buyer@example.test', password: 'Smoke-Only-Buyer-1' } });
check('buyer jwt-login', buyer.status, 200);
check('buyer session login', (await req('POST', '/api/auth/login', { body: { email: 'buyer@example.test', password: 'Smoke-Only-Buyer-1' } })).status, 200);
check('wrong password', (await req('POST', '/api/auth/jwt-login', { body: { email: 'buyer@example.test', password: 'nope' } })).status, 401);
check('unknown email', (await req('POST', '/api/auth/jwt-login', { body: { email: 'nobody@example.test', password: 'nope' } })).status, 401);
check('duplicate registration rejected', (await req('POST', '/api/auth/register', { body: { email: 'buyer@example.test', password: 'Smoke-Only-Buyer-1', firstName: 'B', lastName: 'U' } })).status, 400);
const admin = await req('POST', '/api/auth/jwt-login', { body: { email: 'admin@example.test', password: process.env.ADMIN_PASS } });
check('admin jwt-login with bcrypt password', admin.status, 200);
check('buyer cannot use admin routes', (await req('POST', '/api/venues', { token: buyer.json?.token, body: { name: 'X', city: 'Y' } })).status, 403);

// ---------------------------------------------------------------- regression: OTP login
await plant('5500000005', '444444');
check('OTP wrong code', (await otpVerify('5500000005', '000000')).status, 400);
const otpOk = await otpVerify('5500000005', '444444');
check('OTP right code -> login', `${otpOk.status} ${otpOk.json?.user?.role ?? ''}`.trim(), '200 buyer');
check('OTP reuse', (await otpVerify('5500000005', '444444')).status, 400);
await plant('5500000006', '555555', '-1 minute');
check('OTP expired code', (await otpVerify('5500000006', '555555')).status, 400);

// ---------------------------------------------------------------- regression: admin + purchase + issuance
const at = admin.json?.token;
const z = await req('POST', '/api/zones', { token: at, body: { eventId: 'e1', name: 'General', color: '#fff', basePrice: '500.00' } });
check('admin creates zone', z.status, 200);
const t = await req('POST', '/api/tickets', { token: at, body: { eventId: 'e1', zoneId: z.json?.id, row: 'A', seat: '1', price: '500.00' } });
check('admin creates ticket', t.status, 200);
const o = await req('POST', '/api/orders', { token: buyer.json?.token, body: { ticketId: t.json?.id, paymentMethod: 'card' } });
check('buyer purchases ticket', o.status, 200);
const again = await req('POST', '/api/orders', { token: buyer.json?.token, body: { ticketId: t.json?.id, paymentMethod: 'card' } });
check('second purchase of the same ticket', again.status >= 400 ? 'rejected' : 'accepted', 'rejected');
check('admin confirms payment', (await req('POST', `/api/orders/${o.json?.id}/confirm-payment`, { token: at })).status, 200);
const st = (await db.query('select o.status os, t.status ts from orders o join tickets t on t.id = o.ticket_id where o.id = $1', [o.json?.id ?? ''])).rows[0];
check('order/ticket final state', st ? `${st.os}/${st.ts}` : 'none', 'paid/sold');
check('buyer lists own orders', (await req('GET', '/api/orders', { token: buyer.json?.token })).status, 200);
check('admin lists orders', (await req('GET', '/api/admin/orders', { token: at })).status, 200);

out._expect = expect;
await db.end();
console.log(JSON.stringify(out));

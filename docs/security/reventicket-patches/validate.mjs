// Probes for validate.sh. Prints one line per check: "<label> <check>: <observed>".
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(`${process.env.RT_DIR}/package.json`);
const pg = require('pg');
const { BASE, LABEL } = process.env;
const db = new pg.Client({ connectionString: process.env.DB });
await db.connect();
const post = async (path, body) => {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-proto': 'https' }, body: JSON.stringify(body) });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, json: j };
};
const show = (k, v) => console.log(`${LABEL.padEnd(6)} ${k.padEnd(44)} ${v}`);

// 1. Mass assignment of role on public registration
const reg = await post('/api/auth/register', { email: 'probe@example.test', password: 'Probe-Only-1!', firstName: 'P', lastName: 'R', role: 'admin' });
const dbRole = (await db.query("select role from users where email = 'probe@example.test'")).rows[0]?.role;
show('register with role=admin -> stored role', `${reg.status} ${dbRole}`);

// 2. Plaintext ADMIN_PASSWORD bypass (env set to "plaintext-bypass-test" in both runs)
show('admin jwt-login with ADMIN_PASSWORD value', (await post('/api/auth/jwt-login', { email: 'admin@example.test', password: 'plaintext-bypass-test' })).status);
show('admin jwt-login with the bcrypt password', (await post('/api/auth/jwt-login', { email: 'admin@example.test', password: process.env.ADMIN_PASS })).status);

// 3. OTP at rest
await post('/api/otp/send', { phone: '5500000009' });
const stored = (await db.query("select code from otp_codes where phone = '5500000009'")).rows[0]?.code ?? '';
show('OTP stored in otp_codes.code', /^\d{6}$/.test(stored) ? 'PLAINTEXT 6 digits' : /^[0-9a-f]{64}$/.test(stored) ? 'HMAC-SHA256 (64 hex)' : `other (${stored.length} chars)`);
// Known code planted in the format each version expects, then verified through the API.
const planted = LABEL === 'after' ? createHmac('sha256', process.env.PEPPER).update('5500000010:424242').digest('hex') : '424242';
await db.query("insert into otp_codes (phone, code, expires_at) values ('5500000010', $1, now() + interval '5 minutes')", [planted]);
show('OTP verify with the right code', (await post('/api/otp/verify', { phone: '5500000010', code: '424242' })).status);
show('OTP reuse of the same code', (await post('/api/otp/verify', { phone: '5500000010', code: '424242' })).status);
show('OTP verify with a wrong code', (await post('/api/otp/verify', { phone: '5500000010', code: '000000' })).status);

// Existing rate limit on jwt-login (global /api limiter; not changed by the patches)
let limited = 'no 429 in 110 attempts';
for (let i = 0; i < 110; i++) {
  const r = await post('/api/auth/jwt-login', { email: 'admin@example.test', password: `wrong-${i}` });
  if (r.status === 429) { limited = `429 after ${i + 1} attempts`; break; }
}
show('jwt-login brute-force rate limit', limited);
await db.end();

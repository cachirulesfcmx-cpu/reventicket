// Sends the "model" cases to a deployed tutor (staging) and writes answers for rubric review.
// Requires: STUDIA_SUPABASE_URL, STUDIA_ANON_KEY and a test account (STUDIA_EVAL_EMAIL / STUDIA_EVAL_PASSWORD).
// Never point this at production with real student accounts.
import { readFile, writeFile } from 'node:fs/promises';

const url = process.env.STUDIA_SUPABASE_URL;
const anon = process.env.STUDIA_ANON_KEY;
const email = process.env.STUDIA_EVAL_EMAIL;
const password = process.env.STUDIA_EVAL_PASSWORD;
if (!url || !anon || !email || !password) {
  console.error('BLOCKED: set STUDIA_SUPABASE_URL, STUDIA_ANON_KEY, STUDIA_EVAL_EMAIL, STUDIA_EVAL_PASSWORD');
  process.exit(2);
}
const set = JSON.parse(await readFile(new URL('./tutor-cases.v1.json', import.meta.url), 'utf8'));
const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: anon, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
}).then((r) => r.json());
if (!auth.access_token) { console.error('login failed'); process.exit(1); }
const out = [];
for (const c of set.cases.filter((x) => x.kind === 'model')) {
  const t0 = Date.now();
  const res = await fetch(`${url}/functions/v1/tutor`, {
    method: 'POST',
    headers: { apikey: anon, authorization: `Bearer ${auth.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: c.material ? `${c.material}\n\n${c.input}` : c.input }] }),
  });
  const body = await res.json().catch(() => ({}));
  out.push({ id: c.id, level: c.level, status: res.status, ms: Date.now() - t0, answer: body.answer ?? null, error: body.error ?? null, rubric: c.rubric, verdict: 'PENDING_REVIEW' });
  console.log(`${c.id}: HTTP ${res.status} in ${Date.now() - t0} ms`);
}
const file = `evals/results-${set.version}-${new Date().toISOString().slice(0, 10)}.json`;
await writeFile(file, JSON.stringify(out, null, 2));
console.log(`wrote ${file} — reviewers must fill each verdict (PASS/FAIL) against its rubric`);

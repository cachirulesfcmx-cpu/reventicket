// Fails if tracked files contain credential-looking values. Prints file:line only, never the match.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  ['anthropic-key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['openai-style-key', /\bsk-[A-Za-z0-9]{32,}\b/],
  ['jwt', /\beyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/],
  ['supabase-secret', /\bsb_secret_[A-Za-z0-9_-]{16,}/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ['private-key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['assigned-secret', /^(?!#)\s*(SUPABASE_SERVICE_ROLE_KEY|CRON_SECRET|SPORTS_DATA_API_KEY|ODDS_API_KEY|VERCEL_TOKEN)\s*=\s*\S{8,}/m],
];
const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter((f) => f && !/(^|\/)package-lock\.json$|\.(png|jpg|ico|woff2?)$/.test(f));
const hits = [];
for (const f of files) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  text.split('\n').forEach((line, i) => {
    for (const [name, re] of PATTERNS) if (re.test(line) && !line.includes('check-secrets:allow')) hits.push(`${f}:${i + 1} (${name})`);
  });
}
if (hits.length) {
  console.error(`Potential secrets found:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`secret scan: ${files.length} tracked files, 0 findings`);

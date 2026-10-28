// Fails when production dependencies have high/critical advisories that are not explicitly
// accepted (with an unexpired entry) in docs/security/audit-allowlist.json.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let raw;
try { raw = execSync('npm audit --omit=dev --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
catch (e) { raw = e.stdout; }
const report = JSON.parse(raw);
const allow = JSON.parse(readFileSync(new URL('../docs/security/audit-allowlist.json', import.meta.url), 'utf8')).accepted;
const today = new Date().toISOString().slice(0, 10);

const blocking = new Set();
for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of v.via) {
    if (typeof via === 'string' || !['high', 'critical'].includes(via.severity)) continue;
    const id = via.url.split('/').pop();
    const entry = allow.find((a) => a.advisory === id);
    if (!entry) blocking.add(`${via.severity} ${id} in ${name}: ${via.title}`);
    else if (entry.expires < today) blocking.add(`EXPIRED acceptance ${id} (expired ${entry.expires})`);
    else console.log(`accepted until ${entry.expires}: ${id} (${name})`);
  }
}
if (blocking.size) {
  console.error([...blocking].join('\n'));
  process.exit(1);
}
console.log('audit gate: no unaccepted high/critical advisories in production dependencies');

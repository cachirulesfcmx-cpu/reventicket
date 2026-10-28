// Verifies server-only secrets never reach client bundles. Run after a build made with the
// canary values below (CI sets them); scans browser JS and mobile exports for the canaries.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const CANARIES = ['canary-service-role-7f3a9c', 'canary-cron-secret-2b8e1d'];
const dirs = ['apps/web/.next/static', 'apps/mobile/dist'].filter(existsSync);
if (!dirs.includes('apps/web/.next/static')) {
  console.error('apps/web/.next/static not found: run the web build first');
  process.exit(2);
}
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
let scanned = 0;
const leaks = [];
for (const d of dirs) {
  for (const f of walk(d)) {
    if (!/\.(js|mjs|json|html|hbc|map)$/.test(f)) continue;
    scanned++;
    const text = readFileSync(f, 'latin1');
    for (const c of CANARIES) if (text.includes(c)) leaks.push(`${f} contains ${c.slice(0, 12)}…`);
    if (/SUPABASE_SERVICE_ROLE_KEY/.test(text)) leaks.push(`${f} references SUPABASE_SERVICE_ROLE_KEY`);
  }
}
if (leaks.length) {
  console.error(leaks.join('\n'));
  process.exit(1);
}
console.log(`bundle check: ${scanned} client files in ${dirs.join(', ')}, no server secrets`);

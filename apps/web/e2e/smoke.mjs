// Browser smoke test. Usage: BASE_URL=https://<preview-url> node apps/web/e2e/smoke.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = (process.env.BASE_URL ?? 'http://127.0.0.1:3123').replace(/\/$/, '');
const OUT = process.env.SMOKE_OUT ?? 'apps/web/e2e/artifacts';
mkdirSync(OUT, { recursive: true });

const PAGES = ['/', '/games', '/games?sport=LIGA_MX', '/games/demo-nfl-7', '/picks', '/performance', '/follows', '/responsible'];
const results = [];
const browser = await chromium.launch();
// Protected Vercel previews: pass a temporary share token via VERCEL_SHARE_TOKEN (never commit it).
async function prime(page) {
  if (process.env.VERCEL_SHARE_TOKEN) await page.goto(`${BASE}/?_vercel_share=${process.env.VERCEL_SHARE_TOKEN}`, { waitUntil: 'networkidle' });
}

for (const [label, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
  const page = await browser.newPage({ viewport });
  await prime(page);
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 160)}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.slice(0, 160)}`));
  for (const path of PAGES) {
    const name = `${label} ${path}`;
    try {
      const res = await page.goto(BASE + path, { waitUntil: 'networkidle' });
      assert.equal(res.status(), 200, `HTTP ${res.status()}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `horizontal overflow ${overflow}px`);
      const h = await page.locator('h1, h2').first().innerText();
      assert.ok(h.length > 0, 'no heading');
      if (path.startsWith('/games')) assert.ok((await page.content()).includes('DEMO') || !(await page.content()).includes('demo-'), 'demo data must be labelled');
      if (path === '/' || path === '/picks') assert.ok(!/garantiza(?!n)|gana seguro|stop losing/i.test(await page.innerText('main')), 'no guaranteed-win claims');
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, error: e.message.split('\n')[0] });
    }
  }
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/home-${label}.png`, fullPage: false });
  await page.goto(BASE + '/performance', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/performance-${label}.png`, fullPage: false });
  results.push({ name: `${label} console/CSP clean`, ok: problems.length === 0, error: problems.slice(0, 3).join(' | ') });
  await page.close();
}

const page = await browser.newPage();
await prime(page);
const nf = await page.goto(BASE + '/games/no-existe');
results.push({ name: 'unknown game returns 404', ok: nf.status() === 404, error: `HTTP ${nf.status()}` });
const api = await (await page.request.get(BASE + '/api/picks')).json();
results.push({ name: 'API picks: publication disabled', ok: api.publicationEnabled === false && api.data.every((p) => p.isDemo && p.probability === null) });
const bad = await page.request.get(BASE + '/api/games?sport=F1');
results.push({ name: 'API rejects invalid sport (400)', ok: bad.status() === 400 });
const health = await page.request.get(BASE + '/api/health');
const htext = await health.text();
results.push({ name: 'health public, no secrets', ok: health.status() === 200 && !/service_role|secret|eyJ/i.test(htext) });
await browser.close();

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.ok ? '' : ` — ${r.error}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} smoke checks passed against ${BASE}`);
process.exit(failed ? 1 : 0);

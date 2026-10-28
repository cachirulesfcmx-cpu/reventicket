// End-to-end test of the web build: serves dist/ (SPA fallback) and drives Chromium through
// the 10-step onboarding at phone and desktop widths, incl. keyboard-only navigation.
// Usage: npm run build:web && npm run test:e2e
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const DIST = resolve(process.argv[2] ?? 'dist');
const ART = resolve('e2e/artifacts');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };

// Apply the production CSP from vercel.json so E2E also proves the app works under it.
const vercel = JSON.parse(await readFile(resolve('vercel.json'), 'utf8'));
const CSP = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;

const server = createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy', CSP);
  const url = new URL(req.url, 'http://x');
  const file = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(await readFile(join(DIST, 'index.html')));
  }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const results = [];
async function check(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, ok: false, error: e.message }); console.log(`FAIL ${name}\n  ${e.message.split('\n').slice(0,6).join(' | ')}`); }
}

const id = (t) => `[data-testid="${t}"]`;
const step = async (page) => (await page.locator(id('onboarding-step')).innerText()).trim();
const next = (page) => page.locator(id('onboarding-next'));
const disabled = async (page) => (await next(page).getAttribute('aria-disabled')) === 'true';

async function walk(page, { minor }) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy/i.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}/onboarding`);
  await page.waitForSelector(id('onboarding-title'));
  assert.equal(await step(page), 'STUDIA · 1 DE 10');
  assert.ok(await disabled(page), 'continue must be disabled before choosing');

  await page.click(id('role-student'));
  assert.equal(await page.locator(id('role-student')).getAttribute('aria-checked'), 'true');
  await next(page).click();
  assert.equal(await step(page), 'STUDIA · 2 DE 10');

  // back / forward keeps answers
  await page.getByRole('button', { name: 'Regresar' }).click();
  assert.equal(await step(page), 'STUDIA · 1 DE 10');
  assert.equal(await page.locator(id('role-student')).getAttribute('aria-checked'), 'true');
  await next(page).click();

  await page.click(id('voice-nova'));
  await next(page).click();

  // age + minor safeguard
  assert.equal(await step(page), 'STUDIA · 3 DE 10');
  if (minor) {
    await page.getByRole('button', { name: '12 años' }).click();
    assert.ok(await disabled(page), 'minor cannot continue without adult acknowledgement');
    await page.click(id('guardian-ack'));
    assert.ok(!(await disabled(page)), 'minor can continue after adult acknowledgement');
  } else {
    await page.getByRole('button', { name: '25 años' }).click();
    assert.equal(await page.locator(id('guardian-ack')).count(), 0, 'adults see no guardian checkbox');
  }
  await next(page).click();

  await page.click(id('need-upcoming_exam'));
  await next(page).click();

  // join is not implemented, so it must be disabled
  assert.equal(await page.locator(id('prep-join')).getAttribute('aria-disabled'), 'true');
  await page.click(id('prep-create'));
  await next(page).click();

  // dynamic dates
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const label = await page.locator(id('date-d1')).getAttribute('aria-label');
  assert.ok(label.includes(String(tomorrow.getDate())), `tomorrow option shows the real date (${label})`);
  await page.click(id('date-d3'));
  await next(page).click();

  // subject search (accent-insensitive)
  await page.fill(id('subject-search'), 'quimi');
  assert.equal(await page.locator('[data-testid^="subject-"][role="radio"]').count(), 2, 'Química + "agrega" pill');
  await page.fill(id('subject-search'), 'zzz');
  await page.getByText('No encontramos').waitFor();
  await page.fill(id('subject-search'), '');
  await page.click(id('subject-fisica'));
  await next(page).click();

  await page.click(id('goal-good'));
  await next(page).click();
  await page.click(id('concern-no_time'));
  await next(page).click();

  assert.equal(await step(page), 'STUDIA · 10 DE 10');
  await page.click(id('materials-have'));
  const cta = await next(page).innerText();
  assert.equal(cta.trim(), minor ? 'Continuar con un adulto' : 'Crear mi cuenta');
  await next(page).click();
  await page.waitForURL('**/register');
  await page.getByText('Crea tu cuenta').waitFor();
  if (minor) await page.getByText('Esta cuenta la crea el padre').waitFor();

  const body = await page.content();
  assert.ok(!/17,243,000|15M\+|YA SE UNIERON/i.test(body), 'no fake user counts');
  assert.deepEqual(errors, [], 'no runtime errors');
}

const browser = await chromium.launch();
await mkdir(ART, { recursive: true });

await check('phone 390x844: full onboarding as a minor, safeguard + handoff', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await walk(page, { minor: true });
  await page.screenshot({ path: join(ART, 'register-phone.png') });
  await page.close();
});

await check('desktop 1280x800: full onboarding as an adult', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await walk(page, { minor: false });
  await page.close();
});

await check('draft persists across reloads and resumes at first incomplete step', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/onboarding`);
  await page.click(id('role-guardian'));
  await next(page).click();
  await page.click(id('voice-luna'));
  await page.reload();
  await page.waitForSelector(id('onboarding-title'));
  assert.equal(await step(page), 'STUDIA · 3 DE 10');
  await ctx.close();
});

await check('keyboard only: Tab + Enter/Space operate choices and continue', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await page.goto(`${base}/onboarding`);
  await page.waitForSelector(id('onboarding-title'));
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    if (focused === 'role-teacher') break;
  }
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), 'role-teacher', 'role card reachable by Tab');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator(id('role-teacher')).getAttribute('aria-checked'), 'true');
  await page.focus(id('onboarding-next'));
  await page.keyboard.press('Enter');
  assert.equal(await step(page), 'STUDIA · 2 DE 10');
  await page.close();
});

await check('accessibility: headings, labelled controls, progressbar, 200% text zoom without horizontal scroll', async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
  await page.goto(`${base}/onboarding`);
  await page.waitForSelector(id('onboarding-title'));
  assert.equal(await page.getByRole('heading').count() >= 1, true);
  const bar = page.getByRole('progressbar', { name: 'Progreso del cuestionario' });
  assert.equal(await bar.getAttribute('aria-valuenow'), '1');
  const unlabeled = await page.$$eval('[role="radio"],[role="button"],[role="checkbox"]', (els) =>
    els.filter((e) => !(e.getAttribute('aria-label') || e.textContent?.trim())).length);
  assert.equal(unlabeled, 0, 'every interactive control has an accessible name');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `no horizontal scroll at 320px (overflow ${overflow}px)`);
  await page.screenshot({ path: join(ART, 'onboarding-320.png') });
  await page.close();
});

await check('auth routes guard: signed-out user hitting /tutor is redirected away', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/tutor`);
  await page.waitForTimeout(800);
  assert.ok(!page.url().endsWith('/tutor') || (await page.getByTestId('tutor-input').count()) === 0, 'protected screen not rendered');
  await page.close();
});

await check('screenshots of key onboarding steps', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(`${base}/onboarding`);
  await page.waitForSelector(id('onboarding-title'));
  await page.click(id('role-student'));
  await page.screenshot({ path: join(ART, 'step1-role.png') });
  await next(page).click();
  await page.click(id('voice-luna'));
  await page.screenshot({ path: join(ART, 'step2-voice.png') });
  await page.close();
});

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} E2E checks passed`);
process.exit(failed.length ? 1 : 0);

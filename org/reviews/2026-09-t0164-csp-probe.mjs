// Built-app feasibility probe, not an application security policy.
// Run from the repo root: node org/reviews/2026-09-t0164-csp-probe.mjs <built-checkout>
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const root = resolve(process.argv[2] ?? '.');
const port = 3804;
const origin = `http://127.0.0.1:${port}`;
const token = randomBytes(32).toString('base64url');
const dataDir = mkdtempSync(join(tmpdir(), 'patterstage-t0164-csp-'));
const env = { ...process.env, PS_AUTH_TOKEN: token, PS_AUTH_MODE: 'token',
  PS_PUBLIC_ORIGIN: origin, PS_DATA_DIR: dataDir, CH_DATA_DIR: dataDir,
  HERMES_HOME: join(dataDir, 'hermes-home'), PS_READ_ONLY: '0' };
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)],
  { cwd: root, env, stdio: 'ignore', windowsHide: true });
let browser;
try {
  for (let i = 0; i < 90; i++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${server.exitCode}`);
    try {
      const response = await fetch(origin, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) break;
    } catch { /* startup */ }
    if (i === 89) throw new Error('Server not ready');
    await sleep(1000);
  }
  browser = await chromium.launch({ headless: true });
  const results = [];
  for (const policy of [null, "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"]) {
    const context = await browser.newContext({ baseURL: origin,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    const page = await context.newPage();
    const violations = [];
    page.on('console', (message) => {
      if (/Content Security Policy|Refused to execute|Refused to load/i.test(message.text())) {
        violations.push(message.text().split(' Either ')[0].slice(0, 160));
      }
    });
    if (policy) await page.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'document') return route.continue();
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy } });
    });
    await page.goto('/work/missions');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.getByRole('button', { name: 'New Mission' }).click();
    const opens = await page.getByRole('dialog', { name: 'New Mission' }).waitFor({ timeout: 3000 }).then(() => true, () => false);
    results.push({ policy: policy ?? 'current frame-ancestors-only response', opensMissionDialog: opens,
      violations: violations.length, examples: violations.slice(0, 2) });
    await context.close();
  }
  const revision = execFileSync('git', ['-c', `safe.directory=${root}`, '-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  console.log(JSON.stringify({ revision, port, results }, null, 2));
} finally {
  await browser?.close();
  server.kill();
}

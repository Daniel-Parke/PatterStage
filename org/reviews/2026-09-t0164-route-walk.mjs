// Supplemental bounded walk of every static page route on an isolated build.
// Run: node org/reviews/2026-09-t0164-route-walk.mjs <built-checkout>
import { chromium, request } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { seedDemo } from '../../tests/e2e/seed-demo.mjs';

const buildRoot = resolve(process.argv[2] ?? '.');
const port = 3805;
const origin = `http://127.0.0.1:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), 'patterstage-t0164-routes-'));
const token = randomBytes(32).toString('base64url');
const env = { ...process.env, PORT: String(port), PS_DATA_DIR: dataDir,
  CH_DATA_DIR: dataDir, HERMES_HOME: join(dataDir, 'hermes-home'),
  PS_AUTH_TOKEN: token, PS_AUTH_MODE: 'token', PS_PUBLIC_ORIGIN: origin,
  PS_READ_ONLY: '0', PS_COMPOSER: '1' };
const files = execFileSync('git', ['-c', `safe.directory=${buildRoot}`, 'ls-files', 'src/app'], { cwd: buildRoot, encoding: 'utf8' })
  .split(/\r?\n/).filter((path) => path.endsWith('/page.tsx'));
const dynamicFiles = files.filter((path) => path.includes('['));
const routes = files.filter((path) => !path.includes('['))
  .map((path) => path.slice('src/app'.length, -'/page.tsx'.length) || '/')
  .sort();
const report = {
  revision: execFileSync('git', ['-c', `safe.directory=${buildRoot}`, '-C', buildRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  buildId: readFileSync(join(buildRoot, '.next', 'BUILD_ID'), 'utf8').trim(),
  port, dataDir: '<isolated temporary directory>',
  fixtures: {}, staticRoutes: routes.length,
  dynamicFilesExcluded: dynamicFiles, states: [], failures: [],
};
const server = spawn(process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)],
  { cwd: buildRoot, env, stdio: 'ignore', windowsHide: true });
let browser;
let api;
try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${server.exitCode}`);
    try {
      const response = await fetch(origin, { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 200) { ready = true; break; }
    } catch { /* server starting */ }
    await sleep(1000);
  }
  if (!ready) throw new Error('Server not ready within 90 seconds');
  api = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  report.fixtures = await seedDemo(api);
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ baseURL: origin, viewport,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
    for (const route of routes) {
      const page = await context.newPage();
      const pageErrors = [];
      const failedRequests = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('response', (response) => {
        if (response.status() >= 400) failedRequests.push({ status: response.status(), path: response.url().replace(origin, '') });
      });
      try {
        const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(500);
        const state = await page.evaluate(() => ({
          h1: [...document.querySelectorAll('h1')].map((element) => element.textContent?.trim() ?? ''),
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }));
        const screenshot = await page.screenshot({ fullPage: false });
        const row = { route, viewport, status: response?.status() ?? null, ...state,
          screenshotSha256: createHash('sha256').update(screenshot).digest('hex'),
          pageErrors, failedRequests };
        report.states.push(row);
        if (row.status !== 200 || row.h1.length === 0 || row.scrollWidth > row.viewportWidth || pageErrors.length) {
          report.failures.push({ route, viewport, status: row.status, h1: row.h1,
            overflow: row.scrollWidth > row.viewportWidth, pageErrors });
        }
      } catch (error) {
        report.failures.push({ route, viewport, navigationError: error.message });
      } finally {
        await page.close();
      }
    }
    await context.close();
  }
} finally {
  await browser?.close();
  await api?.dispose();
  server.kill();
  writeFileSync(resolve('org/reviews/2026-09-t0164-route-results.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ revision: report.revision, staticRoutes: report.staticRoutes,
  states: report.states.length, failures: report.failures.length, port }));
if (report.failures.length) process.exitCode = 1;

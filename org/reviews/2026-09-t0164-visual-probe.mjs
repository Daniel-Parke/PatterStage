// Run from the repository root against an already built, isolated checkout.
// Example: node org/reviews/2026-09-t0164-visual-probe.mjs <build-root>
import { chromium, request } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { seedDemo } from '../../tests/e2e/seed-demo.mjs';

const buildRoot = resolve(process.argv[2] ?? '.');
const output = resolve('org/reviews/2026-09-t0164-images');
const port = 3802;
const origin = `http://127.0.0.1:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), 'patterstage-t0164-visual-'));
const token = randomBytes(32).toString('base64url');
const env = { ...process.env, PORT: String(port), PS_DATA_DIR: dataDir,
  CH_DATA_DIR: dataDir, HERMES_HOME: join(dataDir, 'hermes-home'),
  PS_AUTH_TOKEN: token, PS_AUTH_MODE: 'token', PS_PUBLIC_ORIGIN: origin,
  PS_READ_ONLY: '0', PS_COMPOSER: '1' };
mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)],
  { cwd: buildRoot, env, stdio: 'ignore', windowsHide: true });
const report = { buildRoot, revision: execFileSync('git', ['-c', `safe.directory=${buildRoot}`, '-C', buildRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  buildId: readFileSync(join(buildRoot, '.next', 'BUILD_ID'), 'utf8').trim(),
  port, dataDir, fixtures: {}, captures: [], errors: [] };
let browser;
let api;

async function ready() {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) throw new Error(`Server exited before ready: ${server.exitCode}`);
    try {
      const response = await fetch(origin, { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 200) return;
    } catch { /* process is starting */ }
    await sleep(1000);
  }
  throw new Error('Server did not become ready within 90 seconds');
}

async function capture(page, name, viewport) {
  await page.setViewportSize(viewport);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  await page.waitForTimeout(150);
  const state = await page.evaluate(() => ({
    h1: [...document.querySelectorAll('h1')].map((element) => element.textContent?.trim() ?? ''),
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    stageInspector: [...document.querySelectorAll('h3')].filter((element) => element.textContent?.trim() === 'Stage')
      .map((element) => ({ rect: element.getBoundingClientRect().toJSON(),
        parentDisplay: getComputedStyle(element.parentElement).display,
        parentVisibility: getComputedStyle(element.parentElement).visibility })),
    flowControls: [...document.querySelectorAll('.react-flow__controls-button')]
      .map((element) => ({ background: getComputedStyle(element).backgroundColor,
        color: getComputedStyle(element).color,
        fill: getComputedStyle(element.querySelector('svg') ?? element).fill })),
  }));
  const path = join(output, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  report.captures.push({ name, viewport, ...state,
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
}

try {
  await ready();
  api = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  report.fixtures = await seedDemo(api);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: origin,
    viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push({ kind: 'pageerror', message: error.message }));
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push({ kind: 'console', message: message.text() }); });
  page.on('response', (response) => {
    if (response.status() >= 400) report.errors.push({ kind: 'http', status: response.status(), path: response.url().replace(origin, '') });
  });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const prefix = `${viewport.width}`;
    await page.goto('/work/missions');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await capture(page, `${prefix}-missions`, viewport);
    await page.getByRole('button', { name: 'New Mission' }).click();
    await capture(page, `${prefix}-mission-form`, viewport);
    await page.getByRole('textbox', { name: 'Mission name' }).fill('Needs an instruction');
    await capture(page, `${prefix}-mission-validation`, viewport);
    await page.getByRole('button', { name: /cancel/i }).first().click();

    await page.goto('/work/composer');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await capture(page, `${prefix}-composer`, viewport);
    if (viewport.width === 1440) {
      await page.getByRole('button', { name: 'Run status' }).click();
      await capture(page, '1440-composer-status-dropdown', viewport);
      await page.getByRole('button', { name: 'Run status' }).click();
      await page.getByRole('button', { name: 'Build', exact: true }).click();
      await page.locator('.react-flow__node').first().waitFor({ timeout: 15000 });
      await capture(page, '1440-composer-build', viewport);
      const node = page.locator('.react-flow__node').first();
      await node.click();
      await page.getByRole('heading', { name: 'Stage', exact: true }).waitFor({ timeout: 10000 });
      await capture(page, '1440-composer-inspector', viewport);
    }

    await page.goto('/agent/memory');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await capture(page, `${prefix}-hindsight`, viewport);
    await page.getByRole('button', { name: 'Add Memory' }).click();
    await capture(page, `${prefix}-hindsight-add-memory`, viewport);
    await page.getByRole('button', { name: 'Cancel' }).last().click();
    await page.getByRole('button', { name: 'Directives', exact: true }).click();
    await page.getByRole('button', { name: 'New Directive' }).click();
    await capture(page, `${prefix}-hindsight-directive-dialog`, viewport);
    await page.getByRole('button', { name: 'Cancel' }).last().click();
    await page.getByRole('button', { name: 'Mental Models', exact: true }).click();
    await page.getByRole('button', { name: 'New Model' }).click();
    await capture(page, `${prefix}-hindsight-model-dialog`, viewport);
    await page.getByRole('button', { name: 'Cancel' }).last().click();
  }
  await context.close();
} finally {
  await browser?.close();
  await api?.dispose();
  server.kill();
  report.dataDir = '<isolated temporary directory>';
  report.buildRoot = '<isolated build checkout>';
  writeFileSync(resolve('org/reviews/2026-09-t0164-visual-results.json'), JSON.stringify(report, null, 2) + '\n');
}

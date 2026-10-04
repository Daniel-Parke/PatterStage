import { test as base, expect, type Page, type Route, type TestInfo } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, request, type Server } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { dump, load } from 'js-yaml';

// Independent T-0192 oracle infrastructure. Only owned roots and actual HTTP;
// no production modules, operator environment, live providers or rebuilt output.
type WireResponse = { status: number; body: string; json: <T = Record<string, unknown>>() => T };
export type Runtime = {
  root: string; data: string; hermes: string; origin: string; refusalOrigin: string;
  api: (path: string, method?: string, body?: unknown) => Promise<WireResponse>;
  sql: <T>(action: (db: Database.Database) => T) => T;
  hold: () => { promise: Promise<void>; release: () => void };
  route: (pattern: string, handler: (route: Route) => Promise<void>) => Promise<void>;
};

/** Owned precondition, not an API result: actions under test still use real HTTP. */
export function seedFallbacks(runtime: Runtime, names: string[]) {
  runtime.sql(db => {
    const insert = db.prepare('INSERT INTO model_fallbacks(id,position,enabled,custom_name,custom_provider,custom_model_id,override_base_url) VALUES (?,?,1,?,?,?,?)');
    names.forEach((name, position) => insert.run(`oracle-${position}`, position, name, 'openai', name, `${runtime.refusalOrigin}/v1`));
  });
  const path = join(runtime.hermes, 'config.yaml'), config = load(readFileSync(path, 'utf8')) as Record<string, unknown>;
  config.fallback_providers = names.map(model => ({ model, provider: 'openai', base_url: `${runtime.refusalOrigin}/v1` }));
  writeFileSync(path, dump(config));
  return names.map((_, position) => `oracle-${position}`);
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((done, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', done); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Owned listener did not bind');
  return address.port;
}

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((done, fail) => server.close(error => error ? fail(error) : done()));
}

async function wire(url: string, headers: Record<string, string>, method = 'GET', body?: unknown): Promise<WireResponse> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((done, fail) => {
    const req = request(url, { agent: false, method, headers: { ...headers,
      ...(payload === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)) }) },
      signal: AbortSignal.timeout(10_000) }, response => {
      const parts: Buffer[] = [];
      response.on('data', part => parts.push(Buffer.from(part)));
      response.on('error', error => { req.destroy(); fail(error); });
      response.on('aborted', () => { req.destroy(); fail(new Error('Owned response aborted')); });
      response.on('end', () => {
        const text = Buffer.concat(parts).toString('utf8');
        done({ status: response.statusCode ?? 0, body: text, json: <T>() => JSON.parse(text) as T });
      });
    });
    req.on('error', error => { req.destroy(); fail(error); });
    req.end(payload);
  });
}

async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((done, fail) => {
    const timer = setTimeout(() => fail(new Error('Owned server did not exit; root retained')), 5_000);
    child.once('exit', () => { clearTimeout(timer); done(); });
    child.kill();
  });
}

// Public Next custom-server API, production mode, existing build only. Bind is
// performed by this very child; there is no reserve/release/rebind interval.
const ownedServer = String.raw`
const http = require('node:http');
const next = require('next');
let handler;
const server = http.createServer((req, res) => {
  if (req.url === '/__oracle_owned__') {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(process.env.ORACLE_OWNERSHIP_NONCE);
  } else if (handler) handler(req, res);
  else { res.writeHead(503); res.end('Owned application preparing'); }
});
server.once('error', error => { console.error(error.code); process.exit(1); });
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  process.env.PS_PUBLIC_ORIGIN = 'http://127.0.0.1:' + port;
  try {
    const app = next({dev:false, dir:process.cwd(), hostname:'127.0.0.1', port});
    await app.prepare();
    handler = app.getRequestHandler();
    process.send({kind:'owned-ready', pid:process.pid, port});
  } catch (error) { console.error(error); server.close(); process.exitCode = 1; }
});
`;

async function drainCallbacks(pending: Promise<void>[]) {
  const errors: unknown[] = [];
  let observed = 0;
  while (observed < pending.length) {
    const batch = pending.slice(observed); observed = pending.length;
    for (const result of await Promise.allSettled(batch)) if (result.status === 'rejected') errors.push(result.reason);
  }
  return errors;
}

async function ownedRuntime(page: Page, info: TestInfo, runTest: (runtime: Runtime) => Promise<void>) {
  const checkout = process.cwd();
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    if (existsSync(join(checkout, name))) throw new Error(`Refusing checkout environment file ${name}`);
  }
  if (!existsSync(join(checkout, '.next', 'BUILD_ID'))) throw new Error('Existing build required; oracle never builds');
  const receipts = resolve(checkout, 'tmp/t0192-browser-oracle');
  mkdirSync(receipts, { recursive: true });
  const root = mkdtempSync(join(receipts, 'runtime-'));
  const data = join(root, 'data'), hermes = join(root, 'hermes'), home = join(root, 'home'), temporary = join(root, 'temporary');
  for (const dir of [data, hermes, home, temporary, join(data, 'scripts'), join(hermes, 'profiles')]) mkdirSync(dir, { recursive: true });
  const token = randomBytes(32).toString('base64url'), ownershipNonce = randomBytes(32).toString('hex');
  const refused: { method: string; path: string }[] = [];
  const refusal = createServer((req, res) => {
    refused.push({ method: req.method ?? '', path: new URL(req.url ?? '/', 'http://owned').pathname });
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Owned oracle provider refusal: execution is prohibited' }));
  });
  const releases: (() => void)[] = [], pending: Promise<void>[] = [];
  const track = (handler: (route: Route) => Promise<void>) => (route: Route) => {
    const work = Promise.resolve().then(() => handler(route)); pending.push(work); return work;
  };
  let child: ChildProcess | undefined, serverLog = '';
  const refusalPort = await listen(refusal), refusalOrigin = `http://127.0.0.1:${refusalPort}`;
  try {
    writeFileSync(join(hermes, 'config.yaml'), `agent:\n  max_turns: 40\nmodel:\n  provider: openai\n  default: oracle-keyless\n  base_url: ${refusalOrigin}/v1\nmemory:\n  provider: none\noracle_unrelated: preserve-me\n`);
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
    for (const name of ['SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'LANG', 'LC_ALL']) if (process.env[name]) env[name] = process.env[name];
    Object.assign(env, { PATH: dirname(process.execPath) + (process.platform === 'win32' ? `;${process.env.SystemRoot}\\System32` : ':/usr/bin:/bin'),
      HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home, TMP: temporary, TEMP: temporary, TMPDIR: temporary,
      NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', PS_DATA_DIR: data, CH_DATA_DIR: data, CONTROL_HUB_DATA_DIR: data,
      HERMES_HOME: hermes, AGENT_HOME: hermes, PS_SCRIPTS_DIR: join(data, 'scripts'), PS_HARDWARE_LOG_DIR: join(data, 'logs'),
      PS_AUTH_MODE: 'token', PS_AUTH_TOKEN: token, ORACLE_OWNERSHIP_NONCE: ownershipNonce, PS_READ_ONLY: '0', PS_COMPOSER: '1',
      HERMES_GATEWAY_URL: refusalOrigin, PS_LLM_API: `${refusalOrigin}/v1/chat/completions`, CONTROL_HUB_LLM_API: `${refusalOrigin}/v1/chat/completions`,
      OPENAI_BASE_URL: `${refusalOrigin}/v1`, ANTHROPIC_BASE_URL: refusalOrigin, OLLAMA_HOST: refusalOrigin,
      PS_SEARXNG_URL: refusalOrigin });
    child = spawn(process.execPath, ['-e', ownedServer],
      { cwd: checkout, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    child.stdout?.on('data', data => { serverLog += String(data); });
    child.stderr?.on('data', data => { serverLog += String(data); });
    const ownedChild = child;
    const port = await new Promise<number>((done, fail) => {
      const timer = setTimeout(() => fail(new Error('Owned readiness deadline exceeded')), 10_000);
      ownedChild.once('error', error => { clearTimeout(timer); fail(error); });
      ownedChild.once('exit', code => { clearTimeout(timer); fail(new Error(`Owned server exited during setup: ${code}`)); });
      ownedChild.once('message', message => {
        const ready = message as { kind?: string; pid?: number; port?: number };
        clearTimeout(timer);
        if (ready.kind !== 'owned-ready' || ready.pid !== ownedChild.pid || !Number.isInteger(ready.port) || ready.port! <= 0 || ready.port! > 65535) {
          fail(new Error('Invalid owned listener IPC receipt')); return;
        }
        done(ready.port!);
      });
    });
    const origin = `http://127.0.0.1:${port}`;
    const proof = await wire(`${origin}/__oracle_owned__`, {});
    if (proof.status !== 200 || proof.body !== ownershipNonce || ownedChild.exitCode !== null) throw new Error('Owned listener identity not established');
    await page.context().setExtraHTTPHeaders({});
    const signedIn = await page.request.post(`${origin}/api/auth/sign-in`, { headers: { Origin: origin }, data: { token }, maxRedirects: 0 });
    expect(signedIn.status(), 'real isolated sign-in').toBe(303);
    const session = (await page.context().cookies(origin)).find(cookie => cookie.name === 'ps_session');
    expect(session?.httpOnly).toBe(true);
    expect(session?.value).not.toBe(token);
    if (!session) throw new Error('Real sign-in did not issue a session');
    const api: Runtime['api'] = (path, method, body) => {
      const url = new URL(path, origin);
      if (url.origin !== origin || !url.pathname.startsWith('/api/')) throw new Error('Oracle HTTP must stay on its owned API');
      if (/\/scripts\/run|\/composer\/runs$/.test(url.pathname) && method === 'POST') throw new Error('Oracle refuses provider/script execution');
      return wire(url.href, { Origin: origin, Cookie: `${session.name}=${session.value}` }, method, body);
    };
    const profiles = await api('/api/agent/profiles');
    if (profiles.status !== 200) throw new Error(`Owned database setup failed: ${profiles.status}`);
    const sql: Runtime['sql'] = action => { const db = new Database(join(data, 'patterstage.db'), { fileMustExist: true }); try { return action(db); } finally { db.close(); } };
    // Existing seeded records remain keyless and are explicitly redirected to our listener.
    sql(db => {
      db.prepare('UPDATE models SET base_url = ?').run(`${refusalOrigin}/v1`);
      db.prepare('UPDATE agent_profiles SET gateway_host = ?, gateway_port = ?, api_key_ref = NULL').run('127.0.0.1', refusalPort);
      db.prepare('UPDATE memory_providers SET enabled = 0, is_active = 0, config_json = ?').run(JSON.stringify({ host: '127.0.0.1', port: refusalPort, bank: 'oracle' }));
    });
    await page.route('**/*', track(async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || /\/scripts\/run$|\/composer\/runs$/.test(url.pathname) && route.request().method() === 'POST') {
        await route.fulfill({ status: 503, json: { error: 'Owned oracle forbids execution/external navigation' } });
      } else await route.continue();
    }));
    writeFileSync(join(root, 'isolation.json'), JSON.stringify({ title: info.titlePath, root, data, hermes, home, temporary, origin, refusalOrigin,
      pid: child.pid, execPath: process.execPath, abi: process.versions.modules, build: readFileSync(join(checkout, '.next/BUILD_ID'), 'utf8').trim(),
      inheritedEnvKeys: ['SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'LANG', 'LC_ALL'], providerKeysPresent: false }, null, 2));
    await runTest({ root, data, hermes, origin, refusalOrigin, api, sql,
      hold: () => { let release!: () => void; const promise = new Promise<void>(done => { release = done; }); releases.push(release); return { promise, release }; },
      route: async (pattern, handler) => { await page.route(pattern, track(handler)); },
    });
  } finally {
    const callbackErrors: unknown[] = [];
    const cleanupErrors: unknown[] = [];
    const cleanup = async (action: () => Promise<unknown>) => {
      try { await action(); } catch (error) { cleanupErrors.push(error); }
    };
    try {
      if (!page.isClosed()) {
        await cleanup(() => page.route('**/*', track(async route => { await route.abort('aborted'); })));
      }
      releases.forEach(release => release());
      callbackErrors.push(...await drainCallbacks(pending));
      if (!page.isClosed()) await cleanup(async () => info.attach('owned-final-viewport', { body: await page.screenshot(), contentType: 'image/png' }));
      if (!page.isClosed()) await cleanup(() => page.goto('about:blank'));
      callbackErrors.splice(0, callbackErrors.length, ...await drainCallbacks(pending));
    } finally {
      try { if (!page.isClosed()) await cleanup(() => page.close()); }
      finally {
        try { if (child?.pid) await cleanup(() => stop(child!)); }
        finally {
          await cleanup(() => close(refusal));
          writeFileSync(join(root, 'server.log'), serverLog.replaceAll(token, '[owned-token]'));
          writeFileSync(join(root, 'teardown.json'), JSON.stringify({ exitCode: child?.exitCode, signalCode: child?.signalCode, refused,
            callbackErrors: callbackErrors.map(String), cleanupErrors: cleanupErrors.map(String), rootsRetained: true }, null, 2));
        }
      }
    }
    if (callbackErrors.length || cleanupErrors.length) throw new AggregateError([...callbackErrors, ...cleanupErrors], 'Oracle callback/cleanup failures');
  }
}

export const test = base.extend<{ runtime: Runtime }>({ runtime: async ({ page }, use, info) => ownedRuntime(page, info, use) });
export { expect };

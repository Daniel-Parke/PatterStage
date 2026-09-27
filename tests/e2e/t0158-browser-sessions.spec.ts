import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createHttpServer, type Server, type ServerResponse } from 'node:http';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const token = process.env.PS_E2E_AUTH_TOKEN;

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`T-0158 browser session at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, extraHTTPHeaders: {} });

    test('Given deliberate sign-in, the browser uses an opaque cookie through navigation and loses access after sign-out', async ({ page }) => {
      if (!token) throw new Error('Playwright did not provide PS_E2E_AUTH_TOKEN');
      await page.goto('/agent/settings');
      const origin = new URL(page.url()).origin;
      let signedIn = false;
      for (const data of [{ token }, { operatorToken: token }, { operator_token: token }]) {
        const signIn = await page.request.post(`${origin}/api/auth/sign-in`, {
          headers: { Origin: origin }, data,
        });
        if (signIn.ok()) { signedIn = true; break; }
      }
      expect(signedIn).toBe(true);
      const cookies = await page.context().cookies(origin);
      const session = cookies.find(cookie => cookie.name === 'ps_session');
      expect(session).toBeDefined();
      expect(session!.value).not.toBe(token);
      expect(session!.httpOnly).toBe(true);
      expect(session!.sameSite).toBe('Lax');
      expect(session!.path).toBe('/');
      const protectedPage = await page.goto('/agent/settings');
      expect(protectedPage?.status()).toBe(200);
      expect(await page.evaluate(() => Object.values(localStorage).join(' '))).not.toContain(token);
      expect(await page.evaluate(() => Object.values(sessionStorage).join(' '))).not.toContain(token);
      const signedOut = await page.request.delete(`${origin}/api/auth/session`, { headers: { Origin: origin } });
      expect(signedOut.ok()).toBe(true);
      const denied = await page.request.get(`${origin}/api/agent/profiles`);
      expect([401, 403]).toContain(denied.status());
      const afterSignOut = await page.goto('/agent/settings');
      if (afterSignOut?.status() === 200) expect(new URL(page.url()).pathname).not.toBe('/agent/settings');
    });
  });
}

test.describe('T-0158 built server and real SQLite', () => {
  test.describe.configure({ mode: 'default' });
  const operatorToken = 't0158-production-oracle-6ad4c31b';
  let server: ChildProcess | undefined;
  let upstreamGateway: Server | undefined;
  let dataDir: string;
  let origin: string;

  async function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const socket = createServer();
      socket.once('error', reject);
      socket.listen(0, '127.0.0.1', () => {
        const address = socket.address();
        if (!address || typeof address === 'string') return reject(new Error('No TCP port'));
        socket.close(() => resolve(address.port));
      });
    });
  }

  async function boot(directory = mkdtempSync(join(tmpdir(), 't0158-e2e-')), options: { tokenFile?: boolean; authMode?: string; readOnly?: boolean; gatewayUrl?: string } = {}): Promise<void> {
    dataDir = directory;
    const port = await freePort();
    origin = `http://127.0.0.1:${port}`;
    const environment: NodeJS.ProcessEnv = { ...process.env, PS_DATA_DIR: dataDir, CH_DATA_DIR: dataDir, HERMES_HOME: join(dataDir, 'hermes-home'), PS_AUTH_TOKEN: operatorToken, PS_AUTH_MODE: options.authMode ?? 'token', PS_PUBLIC_ORIGIN: origin, PS_READ_ONLY: options.readOnly === false ? '0' : '1', PS_COMPOSER: '1' };
    if (options.gatewayUrl) environment.HERMES_GATEWAY_URL = options.gatewayUrl;
    if (options.tokenFile) delete environment.PS_AUTH_TOKEN;
    server = spawn(process.execPath, [join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
      cwd: process.cwd(), stdio: 'ignore',
      env: environment,
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(`Built server exited ${server.exitCode}`);
      try { await fetch(origin, { signal: AbortSignal.timeout(500) }); return; } catch { /* wait for listener */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('Built server did not listen within 20 seconds');
  }

  async function stop(): Promise<void> {
    const running = server;
    server = undefined;
    if (!running || running.exitCode !== null) return;
    await new Promise<void>(resolve => {
      running.once('exit', () => resolve());
      running.kill();
      setTimeout(resolve, 5_000).unref();
    });
  }

  async function signIn(): Promise<string> {
    const encodings = [
      { contentType: 'application/json', body: JSON.stringify({ token: operatorToken }) },
      { contentType: 'application/json', body: JSON.stringify({ operatorToken }) },
      { contentType: 'application/json', body: JSON.stringify({ operator_token: operatorToken }) },
      { contentType: 'text/plain', body: operatorToken },
    ];
    const statuses: number[] = [];
    for (const encoding of encodings) {
      const response = await fetch(`${origin}/api/auth/sign-in`, {
        method: 'POST', headers: { Origin: origin, 'Content-Type': encoding.contentType },
        body: encoding.body, redirect: 'manual',
      });
      statuses.push(response.status);
      if (response.status >= 200 && response.status < 400) {
        const setCookie = response.headers.get('set-cookie') ?? '';
        expect(setCookie).toMatch(/ps_session=/);
        expect(setCookie).not.toContain(operatorToken);
        return setCookie.split(';', 1)[0];
      }
      if (response.status >= 500) throw new Error(`Sign-in failed with ${response.status}`);
    }
    throw new Error(`No documented body-token sign-in succeeded: ${statuses.join(', ')}`);
  }

  function authRefusal(response: Response): void {
    expect([401, 403]).toContain(response.status);
  }

  function openDb(): Database.Database {
    return new Database(join(dataDir, 'patterstage.db'));
  }

  function sessionRecord(db: Database.Database, cookie: string): { row: Record<string, unknown>; hashColumn: string } {
    const secret = decodeURIComponent(cookie.split('=', 2)[1]);
    const raw = Buffer.from(secret, /^[0-9a-f]{64}$/i.test(secret) ? 'hex' : 'base64url');
    const digests = [createHash('sha256').update(secret).digest(), createHash('sha256').update(raw).digest()];
    const columns = db.prepare('PRAGMA table_info(auth_sessions)').all() as { name: string }[];
    const hashColumn = columns.find(column => /hash/i.test(column.name))?.name;
    if (!hashColumn) throw new Error('Session table has no hashed-secret column');
    const rows = db.prepare('SELECT * FROM auth_sessions').all() as Record<string, unknown>[];
    const row = rows.find(candidate => digests.some(digest => {
      const value = candidate[hashColumn];
      return (typeof value === 'string' && (
        value.toLowerCase() === digest.toString('hex') || value === digest.toString('base64') || value === digest.toString('base64url')
      )) || (value instanceof Uint8Array && Buffer.from(value).equals(digest));
    }));
    if (!row) throw new Error('Cookie has no corresponding hashed SQLite row');
    return { row, hashColumn };
  }

  function timeValue(sample: unknown, offsetMs: number): string | number {
    const time = Date.now() + offsetMs;
    if (typeof sample === 'number') return Math.abs(sample) < 100_000_000_000 ? Math.floor(time / 1000) : time;
    const iso = new Date(time).toISOString();
    return typeof sample === 'string' && /^\d{4}-\d\d-\d\d /.test(sample)
      ? iso.replace('T', ' ').replace(/\.\d{3}Z$/, '')
      : iso;
  }

  test.beforeEach(async () => { await boot(); });
  test.afterEach(async () => {
    await stop();
    if (upstreamGateway) {
      upstreamGateway.closeAllConnections();
      await new Promise<void>(resolve => upstreamGateway!.close(() => resolve()));
      upstreamGateway = undefined;
    }
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  test('Given a successful sign-in, real SQLite persists a hash rather than the fresh 256-bit browser secret', async () => {
    const first = await signIn();
    const second = await signIn();
    expect(first).not.toBe(second);
    const secret = decodeURIComponent(first.split('=', 2)[1]);
    const raw = Buffer.from(secret, /^[0-9a-f]{64}$/i.test(secret) ? 'hex' : 'base64url');
    expect(raw.byteLength).toBeGreaterThanOrEqual(32);
    const db = openDb();
    try {
      const rows = db.prepare('SELECT * FROM auth_sessions').all() as Record<string, unknown>[];
      expect(rows.length).toBeGreaterThanOrEqual(2);
      const stored = JSON.stringify(rows);
      expect(stored).not.toContain(secret);
      expect(stored).not.toContain(operatorToken);
      const digests = [createHash('sha256').update(secret).digest(), createHash('sha256').update(raw).digest()];
      expect(rows.some(row => Object.values(row).some(value => digests.some(digest =>
        (typeof value === 'string' && (value.toLowerCase() === digest.toString('hex') || value === digest.toString('base64') || value === digest.toString('base64url')))
        || (value instanceof Uint8Array && Buffer.from(value).equals(digest))
      )))).toBe(true);
    } finally { db.close(); }
  });

  test('Given loopback HTTP sign-in, the opaque cookie is scoped, HttpOnly, Lax and at most 12 hours', async () => {
    const response = await fetch(`${origin}/api/auth/sign-in`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: operatorToken }),
    });
    expect(response.status).toBeLessThan(400);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/ps_session=/);
    expect(cookie).not.toContain(operatorToken);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
    expect(cookie).not.toMatch(/;\s*Secure(?:;|$)/i);
    const maxAge = Number(cookie.match(/Max-Age=(\d+)/i)?.[1]);
    expect(maxAge).toBeGreaterThan(0);
    expect(maxAge).toBeLessThanOrEqual(43_200);
  });

  test('Given a legacy root-token cookie, it is refused and explicitly cleared', async () => {
    const response = await fetch(`${origin}/api/agent/profiles`, { headers: { Cookie: `ps_session=${operatorToken}` } });
    authRefusal(response);
    expect(response.headers.get('set-cookie') ?? '').toMatch(/ps_session=.*(?:Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
  });

  test('Given a browser cookie, unsafe requests require the exact configured Origin', async () => {
    const cookie = await signIn();
    for (const supplied of ['https://foreign.example', `${origin}.evil.example`, undefined]) {
      const response = await fetch(`${origin}/api/auth/session`, {
        method: 'DELETE', headers: { Cookie: cookie, ...(supplied ? { Origin: supplied } : {}), 'Sec-Fetch-Site': 'same-origin' },
      });
      authRefusal(response);
    }
  });

  test('Given Bearer and an invalid cookie, the valid Bearer credential takes precedence', async () => {
    const response = await fetch(`${origin}/api/agent/profiles`, {
      headers: { Authorization: `Bearer ${operatorToken}`, Cookie: 'ps_session=invalid' },
    });
    expect(response.status).toBe(200);
  });

  test('Given a committed session, self sign-out revokes its row and clears its cookie', async () => {
    const cookie = await signIn();
    const signedOut = await fetch(`${origin}/api/auth/session`, { method: 'DELETE', headers: { Cookie: cookie, Origin: origin } });
    expect(signedOut.status).toBeGreaterThanOrEqual(200);
    expect(signedOut.status).toBeLessThan(400);
    expect(signedOut.headers.get('set-cookie') ?? '').toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    const reused = await fetch(`${origin}/api/agent/profiles`, { headers: { Cookie: cookie } });
    authRefusal(reused);
  });

  for (const kind of ['idle', 'absolute'] as const) {
    test(`Given the ${kind} clock has expired in real SQLite, the cookie cannot read protected data`, async () => {
      const cookie = await signIn();
      const db = openDb();
      try {
        const { row, hashColumn } = sessionRecord(db, cookie);
        const columns = db.prepare('PRAGMA table_info(auth_sessions)').all() as { name: string }[];
        const expiry = columns.find(column => kind === 'idle'
          ? /idle.*expir|expir.*idle/i.test(column.name)
          : /absolute.*expir|expir.*absolute/i.test(column.name))?.name;
        const other = columns.find(column => kind === 'idle'
          ? /absolute.*expir|expir.*absolute/i.test(column.name)
          : /idle.*expir|expir.*idle/i.test(column.name))?.name;
        if (!expiry || !other) throw new Error('Missing separate idle and absolute expiry roles');
        db.prepare(`UPDATE auth_sessions SET "${expiry}" = ?, "${other}" = ? WHERE "${hashColumn}" = ?`)
          .run(timeValue(row[expiry], -60_000), timeValue(row[other], 60_000), row[hashColumn]);
      } finally { db.close(); }
      const denied = await fetch(`${origin}/api/agent/profiles`, { headers: { Cookie: cookie } });
      authRefusal(denied);
    });
  }

  test('Given read-only mode, prefetch and polling do not renew; interactive navigation does', async () => {
    const cookie = await signIn();
    function activity(): string {
      const db = openDb();
      try {
        const { row } = sessionRecord(db, cookie);
        const key = Object.keys(row).find(name => /last.*activ|activ.*last/i.test(name));
        if (!key) throw new Error('Session row has no last-activity value');
        return String(row[key]);
      } finally { db.close(); }
    }
    const initial = activity();
    await new Promise(resolve => setTimeout(resolve, 1_100));
    await fetch(`${origin}/agent/settings`, { headers: { Cookie: cookie, Purpose: 'prefetch', 'Next-Router-Prefetch': '1', 'Sec-Fetch-Mode': 'cors' } });
    expect(activity()).toBe(initial);
    await fetch(`${origin}/agent/settings`, { headers: { Cookie: cookie, 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Dest': 'empty' } });
    expect(activity()).toBe(initial);
    const navigation = await fetch(`${origin}/agent/settings`, { headers: { Cookie: cookie, 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-User': '?1' } });
    expect(navigation.status).toBe(200);
    expect(activity()).not.toBe(initial);
    const refused = await fetch(`${origin}/api/orchestration/chat`, {
      method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: '{}',
    });
    expect([403, 503]).toContain(refused.status);
  });

  test('Given renewal races self revocation, a later request cannot revive the row', async () => {
    const cookie = await signIn();
    const [signedOut] = await Promise.all([
      fetch(`${origin}/api/auth/session`, { method: 'DELETE', headers: { Cookie: cookie, Origin: origin } }),
      fetch(`${origin}/agent/settings`, { headers: { Cookie: cookie, 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-User': '?1' } }),
    ]);
    expect(signedOut.status).toBeLessThan(400);
    authRefusal(await fetch(`${origin}/api/agent/profiles`, { headers: { Cookie: cookie } }));
  });

  test('Given intentional GET token hand-off, the clean redirect issues an opaque cookie', async () => {
    const handOff = await fetch(`${origin}/?ps_token=${encodeURIComponent(operatorToken)}`, { redirect: 'manual' });
    expect(handOff.status).toBeGreaterThanOrEqual(300);
    expect(handOff.status).toBeLessThan(400);
    expect(handOff.headers.get('location') ?? '').not.toContain('ps_token');
    expect(handOff.headers.get('set-cookie') ?? '').toMatch(/ps_session=/);
    expect(handOff.headers.get('set-cookie') ?? '').not.toContain(operatorToken);
  });

  test('Given public body-token sign-in, foreign Origin and oversized input create no session', async () => {
    await signIn();
    for (const input of [
      { headers: { Origin: 'https://foreign.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ token: operatorToken }) },
      { headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'x'.repeat(1_048_576) }) },
    ]) {
      const denied = await fetch(`${origin}/api/auth/sign-in`, { method: 'POST', ...input });
      expect([400, 401, 403, 413, 429]).toContain(denied.status);
      expect(denied.headers.get('set-cookie') ?? '').not.toMatch(/ps_session=[^;]+/);
    }
  });

  test('Given an invalid operator credential, sign-in issues no session', async () => {
    await signIn();
    const denied = await fetch(`${origin}/api/auth/sign-in`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'incorrect-credential' }),
    });
    expect([401, 403, 429]).toContain(denied.status);
    expect(denied.headers.get('set-cookie') ?? '').not.toMatch(/ps_session=[^;]+/);
  });

  test('Given a browser session alone, management still needs a fresh operator credential', async () => {
    const cookie = await signIn();
    for (const path of ['/api/auth/sessions/list', '/api/auth/sessions/revoke']) {
      const denied = await fetch(`${origin}${path}`, {
        method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: '{}',
      });
      authRefusal(denied);
    }
  });

  test('Given a fresh Bearer credential, list exposes no secrets and revoke invalidates only one session', async () => {
    function ids(value: unknown): Set<string> {
      const found = new Set<string>();
      const walk = (item: unknown): void => {
        if (!item || typeof item !== 'object') return;
        if (Array.isArray(item)) { item.forEach(walk); return; }
        const record = item as Record<string, unknown>;
        for (const key of ['id', 'sessionId', 'session_id']) {
          if (typeof record[key] === 'string') found.add(record[key] as string);
        }
        Object.values(record).forEach(walk);
      };
      walk(value);
      return found;
    }
    async function listed(): Promise<Set<string>> {
      const response = await fetch(`${origin}/api/auth/sessions/list`, {
        method: 'POST', headers: { Authorization: `Bearer ${operatorToken}`, Origin: origin },
      });
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).not.toContain(operatorToken);
      return ids(JSON.parse(body));
    }
    const before = await listed();
    const first = await signIn();
    const second = await signIn();
    const added = [...await listed()].filter(id => !before.has(id));
    expect(added).toHaveLength(2);
    let revoked = false;
    for (const field of ['sessionId', 'id', 'session_id']) {
      const response = await fetch(`${origin}/api/auth/sessions/revoke`, {
        method: 'POST', headers: { Authorization: `Bearer ${operatorToken}`, Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: added[0] }),
      });
      if (response.status >= 200 && response.status < 300) { revoked = true; break; }
    }
    expect(revoked).toBe(true);
    const statuses = await Promise.all([first, second].map(async cookie =>
      (await fetch(`${origin}/api/agent/profiles`, { headers: { Cookie: cookie } })).status
    ));
    expect(statuses.filter(status => status === 200)).toHaveLength(1);
    expect(statuses.filter(status => [401, 403].includes(status))).toHaveLength(1);
  });

  test('Given an invalid cookie, run-events and chat streams send no protected data', async () => {
    const run = await fetch(`${origin}/api/runs/unavailable/events`, { headers: { Cookie: 'ps_session=invalid', Accept: 'text/event-stream' } });
    authRefusal(run);
    expect(await run.text()).not.toMatch(/^data:/m);
    const chat = await fetch(`${origin}/api/orchestration/chat`, {
      method: 'POST', headers: { Cookie: 'ps_session=invalid', Origin: origin, 'Content-Type': 'application/json' }, body: '{}',
    });
    authRefusal(chat);
    expect(await chat.text()).not.toMatch(/^data:/m);
  });

  for (const streamKind of ['run', 'composer', 'research'] as const) test(`Given an open quiet ${streamKind} event stream, self revocation closes it before later protected output`, async () => {
    test.setTimeout(40_000);
    upstreamGateway = createHttpServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      response.write(': t0158-ready\n\n');
    });
    await new Promise<void>(resolve => upstreamGateway!.listen(0, '127.0.0.1', resolve));
    const gatewayAddress = upstreamGateway.address();
    if (!gatewayAddress || typeof gatewayAddress === 'string') throw new Error('Mock gateway has no port');
    await stop();
    await boot(dataDir, { gatewayUrl: `http://127.0.0.1:${gatewayAddress.port}` });
    const runId = `t0158-${streamKind}-${Date.now()}`;
    const db = openDb();
    try {
      if (streamKind === 'run') db.prepare('INSERT INTO runs (id, run_id, status, session_id) VALUES (?, ?, ?, ?)')
        .run(runId, runId, 'started', `t0158-session-${Date.now()}`);
      if (streamKind === 'composer') {
        db.prepare('INSERT INTO composer_workflows (id, name) VALUES (?, ?)').run(`workflow-${runId}`, 'T-0158 stream fixture');
        db.prepare('INSERT INTO composer_runs (id, workflow_id, status) VALUES (?, ?, ?)')
          .run(runId, `workflow-${runId}`, 'running');
      }
      if (streamKind === 'research') db.prepare('INSERT INTO research_runs (id, query, status) VALUES (?, ?, ?)')
        .run(runId, 't0158-stream', 'running');
    } finally { db.close(); }
    const route = streamKind === 'run' ? `/api/runs/${runId}/events`
      : streamKind === 'composer' ? `/api/composer/runs/${runId}/events`
        : `/api/laboratory/research/${runId}/events`;
    const controller = new AbortController();
    try {
      const stream = await fetch(`${origin}${route}`, {
        headers: { Authorization: `Bearer ${operatorToken}`, Accept: 'text/event-stream' },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)]),
      });
      expect(stream.status).toBe(200);
      expect(stream.headers.get('content-type') ?? '').toMatch(/text\/event-stream/i);
      const reader = stream.body?.getReader();
      expect(reader).toBeDefined();
      let closed = false;
      void reader!.closed.then(() => { closed = true; }, () => { closed = true; });
      await new Promise(resolve => setTimeout(resolve, 3_000));
      expect(closed).toBe(false);
    } finally { controller.abort(); }
    const cookie = await signIn();
    const activity = (): string => {
      const database = openDb();
      try {
        const { row } = sessionRecord(database, cookie);
        const key = Object.keys(row).find(name => /last.*activ|activ.*last/i.test(name));
        if (!key) throw new Error('Session row has no last-activity value');
        return String(row[key]);
      } finally { database.close(); }
    };
    const beforeActivity = activity();
    const quietController = new AbortController();
    try {
      const open = await fetch(`${origin}${route}`, {
        headers: { Cookie: cookie, Accept: 'text/event-stream' },
        signal: AbortSignal.any([quietController.signal, AbortSignal.timeout(15_000)]),
      });
      expect(open.status).toBe(200);
      expect(open.headers.get('content-type') ?? '').toMatch(/text\/event-stream/i);
      const reader = open.body?.getReader();
      expect(reader).toBeDefined();
      let closed = false;
      void reader!.closed.then(() => { closed = true; }, () => { closed = true; });
      await new Promise(resolve => setTimeout(resolve, 1_100));
      expect(closed).toBe(false);
      expect(activity()).toBe(beforeActivity);
      const signedOut = await fetch(`${origin}/api/auth/session`, {
        method: 'DELETE', headers: { Cookie: cookie, Origin: origin },
      });
      expect(signedOut.status).toBeGreaterThanOrEqual(200);
      expect(signedOut.status).toBeLessThan(400);
      const marker = `t0158-protected-after-revoke-${Date.now()}`;
      const changed = openDb();
      try {
        if (streamKind === 'run') changed.prepare('UPDATE runs SET status = ?, output = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('completed', marker, runId);
        if (streamKind === 'composer') changed.prepare('UPDATE composer_runs SET status = ?, context_json = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('completed', JSON.stringify({ marker }), runId);
        if (streamKind === 'research') changed.prepare('UPDATE research_runs SET status = ?, report = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('completed', marker, runId);
      } finally { changed.close(); }
      const stopped = await Promise.race([
        reader!.closed.then(() => true, () => false),
        new Promise<false>(resolve => setTimeout(() => resolve(false), 10_000)),
      ]);
      expect(stopped).toBe(true);
      let buffered = '';
      while (true) {
        const part = await reader!.read();
        if (part.done) break;
        buffered += new TextDecoder().decode(part.value);
      }
      expect(buffered).not.toContain(marker);
    } finally { quietController.abort(); }
  });

  test('Given an open quiet chat stream, self revocation aborts its upstream and blocks later output', async () => {
    test.setTimeout(40_000);
    const upstreams: { response: ServerResponse; closed: Promise<void> }[] = [];
    const gateway = createHttpServer((_request, response) => {
      upstreams.push({ response, closed: new Promise(resolve => response.once('close', resolve)) });
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      response.write(': t0158-ready\n\n');
    });
    await new Promise<void>(resolve => gateway.listen(0, '127.0.0.1', resolve));
    try {
      const address = gateway.address();
      if (!address || typeof address === 'string') throw new Error('Mock gateway has no port');
      await stop();
      rmSync(dataDir, { recursive: true, force: true });
      await boot(mkdtempSync(join(tmpdir(), 't0158-chat-')), { readOnly: false, gatewayUrl: `http://127.0.0.1:${address.port}` });
      const cookie = await signIn();
      const controller = new AbortController();
      try {
        const response = await fetch(`${origin}/api/orchestration/chat`, {
          method: 'POST',
          headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'oracle' }], stream: true }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type') ?? '').toMatch(/text\/event-stream/i);
        expect(upstreams.length).toBeGreaterThan(0);
        const upstream = upstreams.at(-1)!;
        const reader = response.body?.getReader();
        expect(reader).toBeDefined();
        let downstreamClosed = false;
        void reader!.closed.then(() => { downstreamClosed = true; }, () => { downstreamClosed = true; });
        await new Promise(resolve => setTimeout(resolve, 1_100));
        expect(downstreamClosed).toBe(false);
        const signedOut = await fetch(`${origin}/api/auth/session`, {
          method: 'DELETE', headers: { Cookie: cookie, Origin: origin },
        });
        expect(signedOut.status).toBeGreaterThanOrEqual(200);
        expect(signedOut.status).toBeLessThan(400);
        const marker = `t0158-chat-after-revoke-${Date.now()}`;
        if (!upstream.response.destroyed) upstream.response.write(`data: ${marker}\n\n`);
        const stopped = await Promise.race([
          Promise.all([upstream.closed, reader!.closed]).then(() => true, () => false),
          new Promise<false>(resolve => setTimeout(() => resolve(false), 10_000)),
        ]);
        expect(stopped).toBe(true);
        let buffered = '';
        while (true) {
          const part = await reader!.read();
          if (part.done) break;
          buffered += new TextDecoder().decode(part.value);
        }
        expect(buffered).not.toContain(marker);
      } finally { controller.abort(); }
    } finally {
      gateway.closeAllConnections();
      await new Promise<void>(resolve => gateway.close(() => resolve()));
    }
  });

  test('Given one production boot, a route-minted session works across proxy and route, then fails after restart', async () => {
    const cookie = await signIn();
    const page = await fetch(`${origin}/api/agent/profiles`, { headers: { Cookie: cookie } });
    expect(page.status).toBe(200);
    await stop();
    await boot(dataDir);
    const restored = await fetch(`${origin}/api/agent/profiles`, { headers: { Cookie: cookie } });
    authRefusal(restored);
  });

  test('Given session storage becomes unavailable, later requests fail closed and contain no protected body', async () => {
    const marker = `t0158-protected-profile-${Date.now()}`;
    const seeded = openDb();
    try { seeded.prepare('INSERT INTO agent_profiles (slug, display_name) VALUES (?, ?)').run(marker, marker); }
    finally { seeded.close(); }
    const bearerProof = await fetch(`${origin}/api/agent/profiles`, { headers: { Authorization: `Bearer ${operatorToken}` } });
    expect(bearerProof.status).toBe(200);
    expect(await bearerProof.text()).toContain(marker);
    const cookie = await signIn();
    const before = await fetch(`${origin}/api/agent/profiles`, { headers: { Cookie: cookie } });
    expect(before.status).toBe(200);
    const protectedBody = await before.text();
    expect(protectedBody).toContain(marker);
    const db = openDb();
    try { db.exec('ALTER TABLE auth_sessions RENAME TO auth_sessions_unavailable'); } finally { db.close(); }
    for (let attempt = 0; attempt < 2; attempt++) {
      const denied = await fetch(`${origin}/api/agent/profiles`, { headers: { Cookie: cookie } });
      expect([401, 503]).toContain(denied.status);
      expect(await denied.text()).not.toContain(marker);
      expect(denied.headers.get('set-cookie') ?? '').not.toMatch(/ps_session=[^;]+/);
    }
  });

  test('Given token-file rotation without restart, an old browser cookie is refused', async () => {
    await stop();
    rmSync(dataDir, { recursive: true, force: true });
    dataDir = mkdtempSync(join(tmpdir(), 't0158-rotation-'));
    writeFileSync(join(dataDir, 'auth-token'), operatorToken, { mode: 0o600 });
    await boot(dataDir, { tokenFile: true });
    const cookie = await signIn();
    writeFileSync(join(dataDir, 'auth-token'), 't0158-rotated-operator-c5eb', { mode: 0o600 });
    const denied = await fetch(`${origin}/api/agent/profiles`, { headers: { Cookie: cookie } });
    authRefusal(denied);
  });

  test('Given PS_AUTH_MODE=none, privileged session management remains unavailable', async () => {
    await stop();
    rmSync(dataDir, { recursive: true, force: true });
    dataDir = mkdtempSync(join(tmpdir(), 't0158-auth-none-'));
    await boot(dataDir, { authMode: 'none' });
    for (const path of ['/api/auth/sessions/list', '/api/auth/sessions/revoke']) {
      const response = await fetch(`${origin}${path}`, {
        method: 'POST', headers: { Authorization: `Bearer ${operatorToken}`, Origin: origin, 'Content-Type': 'application/json' }, body: '{}',
      });
      expect([401, 403, 404, 503]).toContain(response.status);
      expect(response.headers.get('set-cookie') ?? '').not.toMatch(/ps_session=[^;]+/);
    }
  });
});

test.describe('T-0158 managed network startup', () => {
  test.describe.configure({ mode: 'default' });
  const networkEntry = join(process.cwd(), 'scripts', 'tooling', 'start-network.mjs');
  const operatorToken = 't0158-managed-network-584d';

  async function fixture(mode: 'unselected' | 'insecure-lan' | 'private-proxy', check: (origin: string, publicOrigin: string, process: ChildProcess) => Promise<void>): Promise<void> {
    expect(existsSync(networkEntry), 'ADR-0013 requires the managed network entrypoint').toBe(true);
    const directory = mkdtempSync(join(tmpdir(), 't0158-network-'));
    const port = await new Promise<number>((resolve, reject) => {
      const socket = createServer(); socket.once('error', reject);
      socket.listen(0, '127.0.0.1', () => {
        const address = socket.address();
        if (!address || typeof address === 'string') return reject(new Error('No TCP port'));
        socket.close(() => resolve(address.port));
      });
    });
    const origin = `http://127.0.0.1:${port}`;
    const publicOrigin = mode === 'private-proxy' ? 'https://stage.example' : origin;
    const environment: NodeJS.ProcessEnv = {
      ...process.env, PORT: String(port), PS_DATA_DIR: directory, CH_DATA_DIR: directory,
      HERMES_HOME: join(directory, 'hermes-home'), PS_AUTH_TOKEN: operatorToken,
      PS_AUTH_MODE: 'token', PS_PUBLIC_ORIGIN: publicOrigin, PS_READ_ONLY: '1',
    };
    delete environment.PS_INSECURE_LAN_HTTP;
    delete environment.PS_PRIVATE_PROXY_NETWORK;
    if (mode === 'insecure-lan') environment.PS_INSECURE_LAN_HTTP = '1';
    if (mode === 'private-proxy') environment.PS_PRIVATE_PROXY_NETWORK = '1';
    const child = spawn(process.execPath, [networkEntry], { cwd: process.cwd(), env: environment, stdio: 'ignore' });
    try { await check(origin, publicOrigin, child); }
    finally {
      if (child.pid && child.exitCode === null) {
        if (process.platform === 'win32') {
          const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
          await new Promise<void>(resolve => { killer.once('exit', () => resolve()); killer.once('error', () => resolve()); });
        } else child.kill();
        await new Promise<void>(resolve => { child.once('exit', () => resolve()); setTimeout(resolve, 5_000).unref(); });
      }
      rmSync(directory, { recursive: true, force: true });
    }
  }

  async function waitForListener(origin: string, child: ChildProcess): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Managed network launcher exited ${child.exitCode} before listening`);
      try { await fetch(origin, { signal: AbortSignal.timeout(500) }); return; } catch { /* wait for listener */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('Managed network launcher did not listen within 20 seconds');
  }

  test('Given no explicit network mode, managed startup refuses to expose a listener', async () => {
    await fixture('unselected', async (origin, _publicOrigin, child) => {
      const exit = await Promise.race([
        new Promise<number | null>(resolve => child.once('exit', code => resolve(code))),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 5_000)),
      ]);
      expect(exit).not.toBeNull();
      expect(exit).not.toBe(0);
      await expect(fetch(origin, { signal: AbortSignal.timeout(500) })).rejects.toThrow();
    });
  });

  test('Given explicit insecure LAN HTTP mode, managed startup issues a non-Secure loopback HTTP session', async () => {
    await fixture('insecure-lan', async (origin, _publicOrigin, child) => {
      await waitForListener(origin, child);
      const response = await fetch(`${origin}/?ps_token=${encodeURIComponent(operatorToken)}`, { redirect: 'manual' });
      expect(response.status).toBeGreaterThanOrEqual(300);
      expect(response.status).toBeLessThan(400);
      const cookie = response.headers.get('set-cookie') ?? '';
      expect(cookie).toMatch(/ps_session=/);
      expect(cookie).not.toContain(operatorToken);
      expect(cookie).not.toMatch(/;\s*Secure(?:;|$)/i);
    });
  });

  test('Given private-proxy mode, direct HTTP cannot mint a session by claiming HTTPS in forwarded headers', async () => {
    await fixture('private-proxy', async (origin, publicOrigin, child) => {
      await waitForListener(origin, child);
      const response = await fetch(`${origin}/api/auth/sign-in`, {
        method: 'POST', headers: { Origin: publicOrigin, Host: 'stage.example', 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: operatorToken }),
      });
      expect([401, 403]).toContain(response.status);
      expect(response.headers.get('set-cookie') ?? '').not.toMatch(/ps_session=[^;]+/);
    });
  });
});

test.describe('T-0158 exact session clocks in a built process', () => {
  test.describe.configure({ mode: 'default' });
  const operatorToken = 't0158-boundary-operator-824f';
  const epoch = Date.parse('2026-01-01T00:00:00.000Z');

  async function withClock(check: (context: { origin: string; setTime: (milliseconds: number) => void; cookie: () => Promise<string> }) => Promise<void>): Promise<void> {
    const directory = mkdtempSync(join(tmpdir(), 't0158-clock-'));
    const clockFile = join(directory, 'oracle-clock');
    writeFileSync(clockFile, String(epoch));
    const port = await new Promise<number>((resolve, reject) => {
      const socket = createServer(); socket.once('error', reject);
      socket.listen(0, '127.0.0.1', () => {
        const address = socket.address();
        if (!address || typeof address === 'string') return reject(new Error('No TCP port'));
        socket.close(() => resolve(address.port));
      });
    });
    const origin = `http://127.0.0.1:${port}`;
    const preload = "import{readFileSync}from'node:fs';const BaseDate=Date;class FixedDate extends BaseDate{constructor(...args){if(args.length)super(...args);else super(Number(readFileSync(process.env.PS_T0158_CLOCK_FILE,'utf8')))}static now(){return Number(readFileSync(process.env.PS_T0158_CLOCK_FILE,'utf8'))}}globalThis.Date=FixedDate";
    const nodeOptions = `${process.env.NODE_OPTIONS ?? ''} --import=data:text/javascript,${encodeURIComponent(preload)}`.trim();
    const child = spawn(process.execPath, [join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-H', '127.0.0.1', '-p', String(port)], {
      cwd: process.cwd(), stdio: 'ignore',
      env: { ...process.env, NODE_OPTIONS: nodeOptions, PS_T0158_CLOCK_FILE: clockFile, PS_DATA_DIR: directory, CH_DATA_DIR: directory, HERMES_HOME: join(directory, 'hermes-home'), PS_AUTH_TOKEN: operatorToken, PS_AUTH_MODE: 'token', PS_PUBLIC_ORIGIN: origin, PS_READ_ONLY: '1' },
    });
    try {
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (child.exitCode !== null) throw new Error(`Fixed-clock server exited ${child.exitCode}`);
        try { await fetch(origin, { signal: AbortSignal.timeout(500) }); ready = true; break; } catch { /* wait */ }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      if (!ready) throw new Error('Fixed-clock server did not listen within 20 seconds');
      await check({
        origin,
        setTime: milliseconds => writeFileSync(clockFile, String(milliseconds)),
        cookie: async () => {
          const response = await fetch(`${origin}/?ps_token=${encodeURIComponent(operatorToken)}`, { redirect: 'manual' });
          expect(response.status).toBeGreaterThanOrEqual(300);
          expect(response.status).toBeLessThan(400);
          const setCookie = response.headers.get('set-cookie') ?? '';
          expect(setCookie).toMatch(/ps_session=/);
          return setCookie.split(';', 1)[0];
        },
      });
    } finally {
      if (child.exitCode === null) await new Promise<void>(resolve => {
        child.once('exit', () => resolve()); child.kill(); setTimeout(resolve, 5_000).unref();
      });
      rmSync(directory, { recursive: true, force: true });
    }
  }

  test('Given no qualifying activity, idle expiry refuses at exactly 30 minutes and accepts one millisecond before', async () => {
    await withClock(async ({ origin, setTime, cookie }) => {
      const session = await cookie();
      setTime(epoch + 30 * 60_000 - 1);
      const before = await fetch(`${origin}/api/agent/profiles`, { headers: { Cookie: session } });
      expect(before.status).toBe(200);
      setTime(epoch + 30 * 60_000);
      const boundary = await fetch(`${origin}/api/agent/profiles`, { headers: { Cookie: session } });
      expect([401, 403]).toContain(boundary.status);
    });
  });

  test('Given qualifying navigation, absolute expiry refuses at exactly 12 hours and accepts one millisecond before', async () => {
    await withClock(async ({ origin, setTime, cookie }) => {
      const session = await cookie();
      for (let renewal = 1; renewal <= 24; renewal++) {
        setTime(epoch + renewal * 29 * 60_000);
        const page = await fetch(`${origin}/agent/settings`, {
          headers: { Cookie: session, 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-User': '?1' },
        });
        expect(page.status).toBe(200);
      }
      setTime(epoch + 12 * 60 * 60_000 - 1);
      const before = await fetch(`${origin}/api/agent/profiles`, { headers: { Cookie: session } });
      expect(before.status).toBe(200);
      setTime(epoch + 12 * 60 * 60_000);
      const boundary = await fetch(`${origin}/api/agent/profiles`, { headers: { Cookie: session } });
      expect([401, 403]).toContain(boundary.status);
    });
  });
});

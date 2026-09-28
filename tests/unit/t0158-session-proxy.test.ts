/** @jest-environment node */
/** Direct proxy and handler oracle with a disposable real SQLite session store. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

const token = 't0158-proxy-source-oracle-83c0974d';
const origin = 'http://127.0.0.1:3000';
const environmentKeys = ['PS_AUTH_TOKEN', 'PS_READ_ONLY', 'PS_AUTH_MODE', 'PS_DATA_DIR', 'CH_DATA_DIR', 'HERMES_HOME', 'PS_PUBLIC_ORIGIN', 'NEXT_RUNTIME'] as const;
const originalEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]])) as Record<(typeof environmentKeys)[number], string | undefined>;
let dataDirectory: string;

jest.mock('better-sqlite3', () => jest.requireActual('../../node_modules/better-sqlite3/lib/index.js'));
jest.unmock('@/lib/db');

beforeEach(async () => {
  dataDirectory = mkdtempSync(join(tmpdir(), 't0158-session-proxy-'));
  process.env.PS_AUTH_TOKEN = token;
  process.env.PS_DATA_DIR = dataDirectory;
  process.env.CH_DATA_DIR = dataDirectory;
  process.env.HERMES_HOME = join(dataDirectory, 'hermes-home');
  process.env.PS_PUBLIC_ORIGIN = origin;
  process.env.PS_AUTH_MODE = 'token';
  process.env.PS_READ_ONLY = '0';
  process.env.NEXT_RUNTIME = 'nodejs';
  jest.resetModules();
  const { initialiseBootState } = await import('@/lib/auth/boot-state');
  initialiseBootState();
  const { ensureDb } = await import('@/lib/db');
  expect(jest.isMockFunction(ensureDb)).toBe(false);
  ensureDb();
});

afterEach(() => {
  (jest.requireActual('@/lib/db') as typeof import('@/lib/db')).getDb().close();
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDirectory, { recursive: true, force: true });
});

async function invoke(path: string, init: ConstructorParameters<typeof NextRequest>[1] = {}): Promise<Response> {
  const implementation = jest.requireActual('@/proxy') as { proxy?: (request: NextRequest) => Response | Promise<Response>; default?: (request: NextRequest) => Response | Promise<Response> };
  const handler = implementation.proxy ?? implementation.default;
  if (!handler) throw new Error('The Next proxy module has no request handler');
  return handler(new NextRequest(`${origin}${path}`, init));
}

test('Given no browser session, exact POST sign-in reaches its handler without widening other auth paths', async () => {
  const signIn = await invoke('/api/auth/sign-in', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  expect(signIn.status).toBeLessThan(400);
  const { POST: signInHandler } = await import('@/app/api/auth/sign-in/route');
  const signedIn = await signInHandler(new NextRequest(`${origin}/api/auth/sign-in`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
  }));
  expect(signedIn.status).toBe(303);
  expect(signedIn.headers.get('set-cookie') ?? '').toMatch(/ps_session=/);
  expect(signedIn.headers.get('set-cookie') ?? '').not.toContain(token);

  const { POST: listHandler } = await import('@/app/api/auth/sessions/list/route');
  const { POST: revokeHandler } = await import('@/app/api/auth/sessions/revoke/route');
  for (const [path, handler] of [
    ['/api/auth/sessions/list', listHandler],
    ['/api/auth/sessions/revoke', revokeHandler],
  ] as const) {
    const init = { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' };
    const passThrough = await invoke(path, init);
    expect(passThrough.status).toBeLessThan(400);
    const denied = await handler(new NextRequest(`${origin}${path}`, init));
    expect([401, 403]).toContain(denied.status);
  }
  for (const path of ['/api/auth/sign-in/other', '/api/auth/sessions/list/other', '/api/auth/sessions/revoke/other']) {
    const denied = await invoke(path, { method: 'POST', headers: { Origin: origin } });
    expect([401, 403]).toContain(denied.status);
  }
});

test('Given read-only mode, application writes are refused with a defined status', async () => {
  process.env.PS_READ_ONLY = '1';
  const response = await invoke('/api/orchestration/chat', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, Origin: origin },
  });
  expect([403, 503]).toContain(response.status);
});

test('Given intentional GET token hand-off, proxy redirects without putting the root token in the cookie', async () => {
  const response = await invoke(`/?ps_token=${encodeURIComponent(token)}`);
  expect(response.status).toBeGreaterThanOrEqual(300);
  expect(response.status).toBeLessThan(400);
  expect(response.headers.get('location') ?? '').not.toContain('ps_token');
  expect(response.headers.get('set-cookie') ?? '').toMatch(/ps_session=/);
  expect(response.headers.get('set-cookie') ?? '').not.toContain(token);
});

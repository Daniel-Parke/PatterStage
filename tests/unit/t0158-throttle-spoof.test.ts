/** @jest-environment node */

import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

jest.mock('better-sqlite3', () => jest.requireActual('../../node_modules/better-sqlite3/lib/index.js'));
jest.unmock('@/lib/db');

const environmentKeys = ['PS_AUTH_TOKEN', 'PS_AUTH_MODE', 'PS_DATA_DIR', 'CH_DATA_DIR', 'HERMES_HOME', 'PS_PUBLIC_ORIGIN', 'PS_INSECURE_LAN_HTTP', 'NEXT_RUNTIME'] as const;
const originalEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]])) as Record<(typeof environmentKeys)[number], string | undefined>;
let dataDirectory: string;
let operatorToken: string;
let publicOrigin: string;
let listener: Server;
let peerAddresses: string[];

async function signIn(token: string, forwardedFor?: string): Promise<Response> {
  const headers: Record<string, string> = {
    origin: publicOrigin,
    'content-type': 'application/json',
  };
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  return fetch(`${publicOrigin}/api/auth/sign-in`, {
    method: 'POST', headers, body: JSON.stringify({ token }), redirect: 'manual',
  });
}

beforeEach(async () => {
  jest.resetModules();
  dataDirectory = mkdtempSync(join(tmpdir(), 't0158-throttle-spoof-'));
  operatorToken = randomBytes(32).toString('hex');
  peerAddresses = [];
  process.env.PS_AUTH_TOKEN = operatorToken;
  process.env.PS_AUTH_MODE = 'token';
  process.env.PS_DATA_DIR = dataDirectory;
  process.env.CH_DATA_DIR = dataDirectory;
  process.env.HERMES_HOME = join(dataDirectory, 'hermes-home');
  process.env.PS_INSECURE_LAN_HTTP = '1';
  process.env.NEXT_RUNTIME = 'nodejs';

  // The socket peer stays fixed. The client controls only the supplied forwarding header.
  listener = createServer(async (incoming, outgoing) => {
    peerAddresses.push(incoming.socket.remoteAddress ?? '');
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk as Uint8Array));
      const { POST } = await import('@/app/api/auth/sign-in/route');
      const response = await POST(new NextRequest(`${publicOrigin}${incoming.url}`, {
        method: 'POST',
        headers: incoming.headers as Record<string, string>,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      outgoing.end(await response.text());
    } catch {
      outgoing.writeHead(500);
      outgoing.end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => resolve());
  });
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('No HTTP listener port');
  publicOrigin = `http://127.0.0.1:${address.port}`;
  process.env.PS_PUBLIC_ORIGIN = publicOrigin;
  const { initialiseBootState } = await import('@/lib/auth/boot-state');
  initialiseBootState();
  const { ensureDb } = await import('@/lib/db');
  expect(jest.isMockFunction(ensureDb)).toBe(false);
  ensureDb();
});

afterEach(async () => {
  await new Promise<void>(resolve => listener.close(() => resolve()));
  (jest.requireActual('@/lib/db') as typeof import('@/lib/db')).getDb().close();
  rmSync(dataDirectory, { recursive: true, force: true });
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('T-0158 direct-LAN sign-in throttle', () => {
  it('Given an unused direct-LAN listener, the legitimate first sign-in succeeds', async () => {
    const response = await signIn(operatorToken);
    expect(response.status).toBe(303);
    expect(response.headers.get('set-cookie') ?? '').toMatch(/ps_session=[^;,\s]+/);
    expect(peerAddresses).toEqual(['127.0.0.1']);
  });

  it('Given repeated wrong sign-ins from one peer, the penalty is bounded at 15 seconds', async () => {
    const wrongToken = randomBytes(32).toString('hex');
    const first = await signIn(wrongToken);
    expect(first.status).toBe(401);
    let throttled: Response | undefined;
    for (let attempt = 0; attempt < 40 && !throttled; attempt += 1) {
      const response = await signIn(wrongToken);
      if (response.status === 429) throttled = response;
      else expect(response.status).toBe(401);
    }
    expect(throttled?.status).toBe(429);
    const retryAfter = Number(throttled?.headers.get('retry-after'));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(15);
    expect(new Set(peerAddresses)).toEqual(new Set(['127.0.0.1']));
  });

  it('Given direct-LAN wrong sign-ins from one peer, rotating X-Forwarded-For still reaches the shared throttle', async () => {
    const wrongToken = randomBytes(32).toString('hex');
    let throttled: Response | undefined;
    // The accepted small typo allowance is five failures; the next guess must be refused.
    for (let attempt = 0; attempt < 6 && !throttled; attempt += 1) {
      const spoofedAddress = `198.51.100.${attempt + 1}`;
      const response = await signIn(wrongToken, spoofedAddress);
      expect(response.headers.get('set-cookie') ?? '').not.toMatch(/ps_session=[^;,\s]+/);
      if (response.status === 429) throttled = response;
      else expect(response.status).toBe(401);
    }
    expect(new Set(peerAddresses)).toEqual(new Set(['127.0.0.1']));
    expect(throttled?.status).toBe(429);
    const retryAfter = Number(throttled?.headers.get('retry-after'));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(15);
  });
});

/** @jest-environment node */

import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

jest.mock('better-sqlite3', () => jest.requireActual('../../node_modules/better-sqlite3/lib/index.js'));
jest.unmock('@/lib/db');

const origin = 'http://127.0.0.1:3000';
const environmentKeys = ['PS_AUTH_TOKEN', 'PS_AUTH_MODE', 'PS_DATA_DIR', 'CH_DATA_DIR', 'HERMES_HOME', 'PS_PUBLIC_ORIGIN', 'HERMES_GATEWAY_URL', 'NEXT_RUNTIME'] as const;
const originalEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]])) as Record<(typeof environmentKeys)[number], string | undefined>;
const originalFetch = globalThis.fetch;
let dataDirectory: string;
let operatorToken: string;

function sessionCookie(response: Response): string {
  const match = /(?:^|[,;])\s*ps_session=([^;,\s]+)/i.exec(response.headers.get('set-cookie') ?? '');
  if (!match) throw new Error('Sign-in did not issue a browser session');
  return `ps_session=${match[1]}`;
}

async function signIn(): Promise<string> {
  const { POST } = await import('@/app/api/auth/sign-in/route');
  const response = await POST(new NextRequest(`${origin}/api/auth/sign-in`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ token: operatorToken }),
  }));
  expect(response.status).toBe(303);
  return sessionCookie(response);
}

function chatRequest(cookie: string): NextRequest {
  return new NextRequest(`${origin}/api/orchestration/chat`, {
    method: 'POST',
    headers: { origin, cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'held turn' }], stream: false }),
  });
}

async function heldChat(cookie: string, protectedMarker: string): Promise<{
  pending: Promise<Response>;
  called: Promise<void>;
  release: () => void;
}> {
  let gatewayCalled!: () => void;
  let release!: () => void;
  const called = new Promise<void>(resolve => { gatewayCalled = resolve; });
  const heldResponse = new Promise<Response>(resolve => {
    release = () => resolve(new Response(JSON.stringify({ choices: [{ message: { content: protectedMarker } }] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
  });
  globalThis.fetch = jest.fn(async () => {
    gatewayCalled();
    return heldResponse;
  }) as typeof fetch;
  const { POST } = await import('@/app/api/orchestration/chat/route');
  return { pending: POST(chatRequest(cookie)), called, release };
}

beforeEach(async () => {
  jest.resetModules();
  dataDirectory = mkdtempSync(join(tmpdir(), 't0158-chat-revocation-'));
  operatorToken = randomBytes(32).toString('hex');
  process.env.PS_AUTH_TOKEN = operatorToken;
  process.env.PS_AUTH_MODE = 'token';
  process.env.PS_DATA_DIR = dataDirectory;
  process.env.CH_DATA_DIR = dataDirectory;
  process.env.HERMES_HOME = join(dataDirectory, 'hermes-home');
  process.env.PS_PUBLIC_ORIGIN = origin;
  process.env.HERMES_GATEWAY_URL = 'http://127.0.0.1:8652';
  process.env.NEXT_RUNTIME = 'nodejs';
  const { initialiseBootState } = await import('@/lib/auth/boot-state');
  initialiseBootState();
  const { ensureDb } = await import('@/lib/db');
  ensureDb();
  expect(jest.isMockFunction(ensureDb)).toBe(false);
});

afterEach(() => {
  (jest.requireActual('@/lib/db') as typeof import('@/lib/db')).getDb().close();
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value !== undefined) process.env[key] = value;
    else delete process.env[key];
  }
  globalThis.fetch = originalFetch;
  rmSync(dataDirectory, { recursive: true, force: true });
});

describe('T-0158 queued non-stream chat', () => {
  it('Given a live browser session, a held non-stream chat completion reaches the caller', async () => {
    const cookie = await signIn();
    const marker = 't0158-live-chat-completion';
    const chat = await heldChat(cookie, marker);
    try {
      await chat.called;
      chat.release();
      const response = await chat.pending;
      expect(response.status).toBe(200);
      expect(await response.text()).toContain(marker);
    } finally {
      chat.release();
    }
  });

  it('Given a held non-stream chat completion, self-revocation prevents its protected response', async () => {
    const cookie = await signIn();
    const marker = 't0158-revoked-chat-secret-marker';
    const chat = await heldChat(cookie, marker);
    try {
      await chat.called;
      const { DELETE } = await import('@/app/api/auth/session/route');
      const revoked = await DELETE(new NextRequest(`${origin}/api/auth/session`, {
        method: 'DELETE', headers: { origin, cookie },
      }));
      expect(revoked.status).toBe(200);
      const { getDb } = jest.requireActual<typeof import('@/lib/db')>('@/lib/db');
      const row = getDb().prepare('SELECT revoked_at_ms FROM auth_sessions').get() as { revoked_at_ms: number | null };
      expect(row.revoked_at_ms).not.toBeNull();

      chat.release();
      const response = await chat.pending;
      const body = await response.text();
      expect(body).not.toContain(marker);
      expect(response.status).toBeGreaterThanOrEqual(400);
    } finally {
      chat.release();
    }
  });
});

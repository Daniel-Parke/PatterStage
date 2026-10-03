/** @jest-environment node */

import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

const origin = 'http://127.0.0.1:3000';
const environmentKeys = ['PS_AUTH_TOKEN', 'PS_AUTH_MODE', 'PS_DATA_DIR', 'CH_DATA_DIR', 'HERMES_HOME'] as const;
const originalEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]])) as Record<(typeof environmentKeys)[number], string | undefined>;
let dataDirectory: string;
let operatorToken: string;

function bearerRequest(token: string): NextRequest {
  return new NextRequest(`${origin}/api/sessions`, {
    headers: { authorization: `Bearer ${token}`, 'x-forwarded-for': '198.51.100.42' },
  });
}

async function exhaustTypoAllowance(): Promise<{
  proxy: typeof import('@/proxy').proxy;
  maximumSeconds: number;
}> {
  const { proxy } = await import('@/proxy');
  const { FREE_AUTH_ATTEMPTS, MAX_AUTH_PENALTY_SECONDS } = await import('@/lib/api/auth-throttle');
  const wrongToken = randomBytes(32).toString('hex');
  for (let attempt = 0; attempt < FREE_AUTH_ATTEMPTS; attempt += 1) {
    expect(proxy(bearerRequest(wrongToken)).status).toBe(401);
  }
  return { proxy, maximumSeconds: MAX_AUTH_PENALTY_SECONDS };
}

beforeEach(() => {
  jest.resetModules();
  dataDirectory = mkdtempSync(join(tmpdir(), 't0158-throttle-clock-'));
  jest.useFakeTimers({ now: 1_000_000 });
  operatorToken = randomBytes(32).toString('hex');
  process.env.PS_DATA_DIR = dataDirectory;
  process.env.CH_DATA_DIR = dataDirectory;
  process.env.HERMES_HOME = join(dataDirectory, 'hermes-home');
  process.env.PS_AUTH_TOKEN = operatorToken;
  process.env.PS_AUTH_MODE = 'token';
});

afterEach(() => {
  jest.useRealTimers();
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value !== undefined) process.env[key] = value;
    else delete process.env[key];
  }
  rmSync(dataDirectory, { recursive: true, force: true });
});

describe('T-0158 root-credential penalty clock', () => {
  it('Given a root-token typo at an ordinary clock, Retry-After stays within the 15-second ceiling', async () => {
    const { proxy, maximumSeconds } = await exhaustTypoAllowance();

    const blocked = proxy(bearerRequest(operatorToken));
    expect(blocked.status).toBe(429);
    const retryAfter = Number(blocked.headers.get('retry-after'));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(maximumSeconds);
  });

  it('Given a root-token penalty then a ten-minute backward clock jump, Retry-After and lockout stay within the ceiling', async () => {
    const { proxy, maximumSeconds } = await exhaustTypoAllowance();
    jest.setSystemTime(Date.now() - 10 * 60_000);

    const afterJump = proxy(bearerRequest(operatorToken));
    if (afterJump.status === 429) {
      const retryAfter = Number(afterJump.headers.get('retry-after'));
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(maximumSeconds);
    } else {
      expect(afterJump.status).toBeLessThan(400);
    }

    jest.advanceTimersByTime((maximumSeconds + 1) * 1000);
    expect(proxy(bearerRequest(operatorToken)).status).not.toBe(429);
  });
});

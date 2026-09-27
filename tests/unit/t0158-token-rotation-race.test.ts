/** @jest-environment node */
/** ADR-0013: a credential verified before root-token rotation cannot mint a new-token session. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { migrationsDir, openRealDb, type RealDb } from "../helpers/baseline-db";

let testDb: RealDb | null = null;
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));

const OLD_TOKEN = "t0158-old-root-token-for-race-oracle";
const NEW_TOKEN = "t0158-new-root-token-for-race-oracle";
const ORIGIN = "http://127.0.0.1:3000";
const originalEnvironment = {
  PS_AUTH_TOKEN: process.env.PS_AUTH_TOKEN,
  PS_AUTH_MODE: process.env.PS_AUTH_MODE,
  PS_PUBLIC_ORIGIN: process.env.PS_PUBLIC_ORIGIN,
};
let rotations = 0;

function sessionRows(): number {
  return (testDb!.prepare("SELECT COUNT(*) AS total FROM auth_sessions").get() as { total: number }).total;
}

function assertNoNewTokenSession(cookie: string | undefined): void {
  if (cookie) expect(sessionRows()).toBeGreaterThan(0);
  const { validateBrowserSession } = jest.requireActual("@/lib/auth/session-store") as typeof import("@/lib/auth/session-store");
  expect(cookie ? validateBrowserSession(cookie) : null).toBeNull();
}

beforeEach(() => {
  process.env.PS_AUTH_TOKEN = OLD_TOKEN;
  process.env.PS_AUTH_MODE = "token";
  process.env.PS_PUBLIC_ORIGIN = ORIGIN;
  rotations = 0;
  jest.resetModules();
  jest.doMock("@/lib/api/auth-token", () => {
    const actual = jest.requireActual("@/lib/api/auth-token") as typeof import("@/lib/api/auth-token");
    return {
      ...actual,
      tokenMatches: (...args: Parameters<typeof actual.tokenMatches>): boolean => {
        const matched = actual.tokenMatches(...args);
        if (matched && args[0] === OLD_TOKEN && args[1] === OLD_TOKEN && rotations === 0) {
          process.env.PS_AUTH_TOKEN = NEW_TOKEN;
          rotations++;
        }
        return matched;
      },
    };
  });
  (jest.requireActual("@/lib/auth/boot-state") as typeof import("@/lib/auth/boot-state")).initialiseBootState();
  testDb = openRealDb();
  testDb.pragma("foreign_keys = ON");
  testDb.exec(readFileSync(join(migrationsDir, "043_auth_sessions.sql"), "utf8"));
});

afterEach(() => {
  testDb?.close();
  testDb = null;
  jest.dontMock("@/lib/api/auth-token");
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("Given the root token rotates after POST credential comparison, the old credential cannot issue a session valid under the new token", async () => {
  const { POST } = jest.requireActual("@/app/api/auth/sign-in/route") as typeof import("@/app/api/auth/sign-in/route");
  const response = await POST(new NextRequest(`${ORIGIN}/api/auth/sign-in`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ token: OLD_TOKEN }),
  }));

  expect(rotations).toBe(1);
  expect(process.env.PS_AUTH_TOKEN).toBe(NEW_TOKEN);
  assertNoNewTokenSession(response.cookies.get("ps_session")?.value);
});

test("Given the root token rotates after GET hand-off comparison, the old URL credential cannot issue a session valid under the new token", () => {
  const { proxy } = jest.requireActual("@/proxy") as typeof import("@/proxy");
  const response = proxy(new NextRequest(`${ORIGIN}/?ps_token=${encodeURIComponent(OLD_TOKEN)}`));

  expect(rotations).toBe(1);
  expect(process.env.PS_AUTH_TOKEN).toBe(NEW_TOKEN);
  assertNoNewTokenSession(response.cookies.get("ps_session")?.value);
});

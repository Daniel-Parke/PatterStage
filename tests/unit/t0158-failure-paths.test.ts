/** @jest-environment node */

import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

jest.mock("better-sqlite3", () => jest.requireActual("../../node_modules/better-sqlite3/lib/index.js"));
jest.unmock("@/lib/db");

const publicOrigin = "http://127.0.0.1:3000";
const environmentKeys = ["PS_AUTH_TOKEN", "PS_DATA_DIR", "PS_PUBLIC_ORIGIN", "PS_AUTH_MODE", "NEXT_RUNTIME"] as const;
const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof environmentKeys)[number], string | undefined>;

let dataDirectory: string;
let operatorToken: string;

function sessionCookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = /(?:^|[,;])\s*ps_session=([^;,\s]+)/i.exec(setCookie);
  if (match === null) throw new Error("Sign-in did not issue a browser session");
  return `ps_session=${match[1]}`;
}

function expiresSessionCookie(response: Response): boolean {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = /(?:^|[,;])\s*ps_session=([^;,\s]*)/i.exec(setCookie);
  return match !== null && (match[1] === "" || /\bMax-Age=0\b/i.test(setCookie));
}

function issuesSessionCookie(response: Response): boolean {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = /(?:^|[,;])\s*ps_session=([^;,\s]*)/i.exec(setCookie);
  return match !== null && match[1].length > 0 && !/\bMax-Age=0\b/i.test(setCookie);
}

function sessionRowCounts(): { total: number; revoked: number } {
  const { getDb } = jest.requireActual<typeof import("@/lib/db")>("@/lib/db");
  const row = getDb().prepare(
    "SELECT COUNT(*) AS total, COUNT(revoked_at_ms) AS revoked FROM auth_sessions",
  ).get() as { total: number; revoked: number };
  return row;
}

function failSqliteWrite(kind: "INSERT" | "UPDATE OF revoked_at_ms"): () => boolean {
  const { getDb } = jest.requireActual<typeof import("@/lib/db")>("@/lib/db");
  const db = getDb();
  let reachedFailure = false;
  db.function("oracle_failure_reached", () => {
    reachedFailure = true;
    return 0;
  });
  db.exec(`
    CREATE TEMP TRIGGER oracle_session_write_failure
    BEFORE ${kind} ON auth_sessions
    BEGIN
      SELECT oracle_failure_reached();
      SELECT RAISE(ABORT, 'oracle session storage unavailable');
    END;
  `);
  return () => reachedFailure;
}

async function signIn(): Promise<{ response: Response; cookie: string }> {
  const { POST } = await import("@/app/api/auth/sign-in/route");
  const response = await POST(new NextRequest(`${publicOrigin}/api/auth/sign-in`, {
    method: "POST",
    headers: { origin: publicOrigin, "content-type": "application/json" },
    body: JSON.stringify({ token: operatorToken }),
  }));
  expect(response.status).toBe(303);
  return { response, cookie: sessionCookieFrom(response) };
}

function signOutRequest(cookie: string): NextRequest {
  return new NextRequest(`${publicOrigin}/api/auth/session`, {
    method: "DELETE",
    headers: { origin: publicOrigin, cookie },
  });
}

async function signOut(cookie: string): Promise<Response> {
  const { DELETE } = await import("@/app/api/auth/session/route");
  return DELETE(signOutRequest(cookie));
}

function navigationRequest(address: URL): NextRequest {
  return new NextRequest(address, {
    headers: {
      accept: "text/html",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
    },
  });
}

async function handoffResult(token: string): Promise<{
  status: number;
  finalAddressClean: boolean;
  locationsClean: boolean;
  issuedSessionCookie: boolean;
  storageUnavailable: boolean;
  invalidCredentialClaim: boolean;
}> {
  const { proxy } = await import("@/proxy");
  let address = new URL(`${publicOrigin}/?ps_token=${encodeURIComponent(token)}`);
  let locationsClean = true;
  let issuedSessionCookie = false;

  for (let hop = 0; hop < 4; hop += 1) {
    const response = await proxy(navigationRequest(address));
    issuedSessionCookie ||= issuesSessionCookie(response);
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location !== null) {
      address = new URL(location, address);
      locationsClean &&= !address.href.includes(token) && !address.searchParams.has("ps_token");
      continue;
    }
    const body = await response.text();
    return {
      status: response.status,
      finalAddressClean: !address.href.includes(token) && !address.searchParams.has("ps_token"),
      locationsClean,
      issuedSessionCookie,
      storageUnavailable: /storage|unavailable/i.test(body),
      invalidCredentialClaim: /invalid|incorrect credential/i.test(body),
    };
  }

  throw new Error("GET hand-off exceeded the redirect limit");
}

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ["Date"] });
  jest.resetModules();
  dataDirectory = mkdtempSync(join(tmpdir(), "patterstage-t0158-failure-paths-"));
  operatorToken = randomBytes(32).toString("hex");
  process.env.PS_AUTH_TOKEN = operatorToken;
  process.env.PS_DATA_DIR = dataDirectory;
  process.env.PS_PUBLIC_ORIGIN = publicOrigin;
  process.env.PS_AUTH_MODE = "token";
  process.env.NEXT_RUNTIME = "nodejs";
  const { register } = await import("@/instrumentation");
  await register();
  const { ensureDb } = await import("@/lib/db");
  expect(jest.isMockFunction(ensureDb)).toBe(false);
  ensureDb();
});

afterEach(async () => {
  const { getDb } = await import("@/lib/db");
  getDb().close();
  jest.clearAllTimers();
  jest.useRealTimers();
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(dataDirectory, { recursive: true, force: true });
});

describe("T-0158 failure paths", () => {
  it("normal self sign-out revokes its session and expires the browser cookie", async () => {
    const { cookie } = await signIn();

    const response = await signOut(cookie);

    expect(response.status).toBe(200);
    expect(expiresSessionCookie(response)).toBe(true);
    expect(sessionRowCounts()).toEqual({ total: 1, revoked: 1 });
  });

  it("failed self sign-out revocation reports failure, expires the cookie and leaves the row unrevoked", async () => {
    const { cookie } = await signIn();
    const reachedFailure = failSqliteWrite("UPDATE OF revoked_at_ms");

    const response = await signOut(cookie);

    expect(reachedFailure()).toBe(true);
    expect({ failed: response.status >= 500 && response.status < 600, cookieExpired: expiresSessionCookie(response), rows: sessionRowCounts() })
      .toEqual({ failed: true, cookieExpired: true, rows: { total: 1, revoked: 0 } });
  });

  it("missing operator-token source makes proxy deny self sign-out and expire the stale cookie", async () => {
    const { cookie } = await signIn();
    expect(existsSync(join(dataDirectory, "auth-token"))).toBe(false);
    delete process.env.PS_AUTH_TOKEN;
    const { proxy } = await import("@/proxy");

    const response = await proxy(signOutRequest(cookie));

    expect({ denied: response.status >= 400, cookieExpired: expiresSessionCookie(response) })
      .toEqual({ denied: true, cookieExpired: true });
  });

  it("invalid GET hand-off ends at a token-free authentication refusal", async () => {
    const invalidToken = randomBytes(32).toString("hex");

    const result = await handoffResult(invalidToken);

    expect({ status: result.status, finalAddressClean: result.finalAddressClean, locationsClean: result.locationsClean, issuedSessionCookie: result.issuedSessionCookie })
      .toEqual({ status: 401, finalAddressClean: true, locationsClean: true, issuedSessionCookie: false });
  });

  it("GET hand-off storage failure ends at a token-free storage-unavailable response without a session cookie", async () => {
    const reachedFailure = failSqliteWrite("INSERT");

    const result = await handoffResult(operatorToken);

    expect(reachedFailure()).toBe(true);
    expect(result).toEqual({
      status: 503,
      finalAddressClean: true,
      locationsClean: true,
      issuedSessionCookie: false,
      storageUnavailable: true,
      invalidCredentialClaim: false,
    });
    expect(sessionRowCounts()).toEqual({ total: 0, revoked: 0 });
  });
});

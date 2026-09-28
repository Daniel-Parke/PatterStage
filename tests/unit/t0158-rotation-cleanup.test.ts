/** @jest-environment node */

import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type DatabaseType from "better-sqlite3";
import { NextRequest } from "next/server";

jest.mock("better-sqlite3", () => jest.requireActual("../../node_modules/better-sqlite3/lib/index.js"));
jest.unmock("@/lib/db");

const publicOrigin = "http://127.0.0.1:3000";
const environmentKeys = ["PS_AUTH_TOKEN", "PS_DATA_DIR", "PS_PUBLIC_ORIGIN", "PS_AUTH_MODE", "NEXT_RUNTIME"] as const;
const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof environmentKeys)[number], string | undefined>;

let Database: typeof DatabaseType;
let originalPrepare: typeof DatabaseType.prototype.prepare;
let dataDirectory: string;
let currentToken: string;

function hasIssuedSessionCookie(response: Response): boolean {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const sessionCookie = /(?:^|[,;])\s*ps_session=([^;,\s]*)/i.exec(setCookie);
  return sessionCookie !== null && sessionCookie[1].length > 0 && !/\bMax-Age=0\b/i.test(setCookie);
}

function sessionRowCount(): number {
  const { getDb } = jest.requireActual<typeof import("@/lib/db")>("@/lib/db");
  const row = getDb().prepare("SELECT COUNT(*) AS count FROM auth_sessions").get() as { count: number };
  return row.count;
}

function rotateAtSessionInsert(): () => boolean {
  let reachedInsert = false;
  Database.prototype.prepare = function prepareWithRotation(this: InstanceType<typeof DatabaseType>, sql: string) {
    if (!reachedInsert && /\bINSERT\s+INTO\s+["`]?auth_sessions\b/i.test(sql)) {
      reachedInsert = true;
      process.env.PS_AUTH_TOKEN = randomBytes(32).toString("hex");
    }
    return originalPrepare.call(this, sql);
  } as typeof DatabaseType.prototype.prepare;
  return () => reachedInsert;
}

async function postSignIn(token: string): Promise<Response> {
  const { POST } = await import("@/app/api/auth/sign-in/route");
  return POST(new NextRequest(`${publicOrigin}/api/auth/sign-in`, {
    method: "POST",
    headers: { origin: publicOrigin, "content-type": "application/json" },
    body: JSON.stringify({ token }),
  }));
}

function handoffRequest(url: URL): NextRequest {
  return new NextRequest(url, {
    headers: {
      accept: "text/html",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
    },
  });
}

async function followHandoff(token: string): Promise<{ finalStatus: number; finalAddressClean: boolean; locationsClean: boolean; issuedSessionCookie: boolean }> {
  const { proxy } = await import("@/proxy");
  let address = new URL(`${publicOrigin}/?ps_token=${encodeURIComponent(token)}`);
  let locationsClean = true;
  let issuedSessionCookie = false;

  for (let hop = 0; hop < 4; hop += 1) {
    const response = await proxy(handoffRequest(address));
    issuedSessionCookie ||= hasIssuedSessionCookie(response);
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || location === null) {
      return {
        finalStatus: response.status,
        finalAddressClean: !address.href.includes(token) && !address.searchParams.has("ps_token"),
        locationsClean,
        issuedSessionCookie,
      };
    }
    const nextAddress = new URL(location, address);
    locationsClean &&= !nextAddress.href.includes(token) && !nextAddress.searchParams.has("ps_token");
    address = nextAddress;
  }

  throw new Error("GET hand-off exceeded the redirect limit");
}

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ["Date"] });
  jest.resetModules();
  Database = jest.requireActual("../../node_modules/better-sqlite3/lib/index.js") as typeof DatabaseType;
  originalPrepare = Database.prototype.prepare;
  dataDirectory = mkdtempSync(join(tmpdir(), "patterstage-t0158-rotation-cleanup-"));
  currentToken = randomBytes(32).toString("hex");
  process.env.PS_AUTH_TOKEN = currentToken;
  process.env.PS_DATA_DIR = dataDirectory;
  process.env.PS_PUBLIC_ORIGIN = publicOrigin;
  process.env.PS_AUTH_MODE = "token";
  process.env.NEXT_RUNTIME = "nodejs";
  const { register } = await import("@/instrumentation");
  await register();
  const { ensureDb, getDb } = await import("@/lib/db");
  expect(jest.isMockFunction(ensureDb)).toBe(false);
  ensureDb();
  expect(getDb()).toBeInstanceOf(Database);
});

afterEach(async () => {
  Database.prototype.prepare = originalPrepare;
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

describe("T-0158 rotation cleanup", () => {
  it("normal POST sign-in commits one browser session", async () => {
    const response = await postSignIn(currentToken);

    expect({ status: response.status, issuedSessionCookie: hasIssuedSessionCookie(response), rows: sessionRowCount() })
      .toEqual({ status: 303, issuedSessionCookie: true, rows: 1 });
  });

  it("POST rotation during INSERT rolls back the session and issues no cookie", async () => {
    const reachedInsert = rotateAtSessionInsert();

    const response = await postSignIn(currentToken);

    expect(reachedInsert()).toBe(true);
    expect({ status: response.status, issuedSessionCookie: hasIssuedSessionCookie(response), rows: sessionRowCount() })
      .toEqual({ status: 401, issuedSessionCookie: false, rows: 0 });
  });

  it("successful GET hand-off redirects to a token-free URL", async () => {
    const { proxy } = await import("@/proxy");
    const response = await proxy(handoffRequest(new URL(`${publicOrigin}/?ps_token=${encodeURIComponent(currentToken)}`)));
    const location = response.headers.get("location");

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(location).not.toBeNull();
    const redirectAddress = new URL(location!, publicOrigin);
    expect({ cleanLocation: !redirectAddress.href.includes(currentToken) && !redirectAddress.searchParams.has("ps_token"), issuedSessionCookie: hasIssuedSessionCookie(response) })
      .toEqual({ cleanLocation: true, issuedSessionCookie: true });
  });

  it("wrong-token GET hand-off leaves a token-free final browser URL and no session cookie", async () => {
    const wrongToken = randomBytes(32).toString("hex");

    const journey = await followHandoff(wrongToken);

    expect(journey).toEqual({ finalStatus: 401, finalAddressClean: true, locationsClean: true, issuedSessionCookie: false });
  });

  it("GET rotation during INSERT leaves no row, cookie or token-bearing final URL", async () => {
    const reachedInsert = rotateAtSessionInsert();

    const journey = await followHandoff(currentToken);

    expect(reachedInsert()).toBe(true);
    expect({ ...journey, rows: sessionRowCount() })
      .toEqual({ finalStatus: 401, finalAddressClean: true, locationsClean: true, issuedSessionCookie: false, rows: 0 });
  });
});

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
let Database: typeof DatabaseType;
let originalPrepare: typeof DatabaseType.prototype.prepare;
const environmentKeys = ["PS_AUTH_TOKEN", "PS_DATA_DIR", "PS_PUBLIC_ORIGIN", "PS_AUTH_MODE", "NEXT_RUNTIME"] as const;
const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof environmentKeys)[number], string | undefined>;

let dataDirectory: string;
let oldToken: string;
let newToken: string;

function interceptSessionInsert(action: () => void): () => boolean {
  let intercepted = false;
  Database.prototype.prepare = function prepareWithInterleaving(this: InstanceType<typeof DatabaseType>, sql: string) {
    if (!intercepted && /\bINSERT\s+INTO\s+["`]?auth_sessions\b/i.test(sql)) {
      intercepted = true;
      action();
    }
    return originalPrepare.call(this, sql);
  } as typeof Database.prototype.prepare;
  return () => intercepted;
}

function hasSessionCookie(response: Response): boolean {
  const setCookie = response.headers.get("set-cookie") ?? "";
  return /(?:^|[,;\s])ps_session=/i.test(setCookie);
}

async function postSignIn(): Promise<Response> {
  const { register } = await import("@/instrumentation");
  await register();
  const { ensureDb, getDb } = await import("@/lib/db");
  expect(jest.isMockFunction(ensureDb)).toBe(false);
  ensureDb();
  expect(getDb()).toBeInstanceOf(Database);
  const { POST } = await import("@/app/api/auth/sign-in/route");
  return POST(
    new NextRequest(`${publicOrigin}/api/auth/sign-in`, {
      method: "POST",
      headers: {
        origin: publicOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify({ token: oldToken }),
    }),
  );
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ["Date"] });
  jest.resetModules();
  Database = jest.requireActual("../../node_modules/better-sqlite3/lib/index.js") as typeof DatabaseType;
  originalPrepare = Database.prototype.prepare;
  dataDirectory = mkdtempSync(join(tmpdir(), "patterstage-t0158-rotation-status-"));
  oldToken = randomBytes(32).toString("hex");
  newToken = randomBytes(32).toString("hex");
  process.env.PS_AUTH_TOKEN = oldToken;
  process.env.PS_DATA_DIR = dataDirectory;
  process.env.PS_PUBLIC_ORIGIN = publicOrigin;
  process.env.PS_AUTH_MODE = "token";
  process.env.NEXT_RUNTIME = "nodejs";
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

describe("T-0158 rotation response status", () => {
  it("POST sign-in accepts the current credential and commits a session", async () => {
    const response = await postSignIn();

    expect({ status: response.status, sessionCookie: hasSessionCookie(response) }).toEqual({ status: 303, sessionCookie: true });
  });

  it("POST sign-in refuses a credential rotated after comparison with 401 and no session cookie", async () => {
    const sawSessionInsert = interceptSessionInsert(() => {
      process.env.PS_AUTH_TOKEN = newToken;
    });

    const response = await postSignIn();

    expect(sawSessionInsert()).toBe(true);
    expect({ status: response.status, sessionCookie: hasSessionCookie(response) }).toEqual({ status: 401, sessionCookie: false });
  });

  it("GET token hand-off refuses a credential rotated after comparison with 401 and no session cookie", async () => {
    const { register } = await import("@/instrumentation");
    await register();
    const { ensureDb } = await import("@/lib/db");
    expect(jest.isMockFunction(ensureDb)).toBe(false);
    ensureDb();
    const sawSessionInsert = interceptSessionInsert(() => {
      process.env.PS_AUTH_TOKEN = newToken;
    });
    const { proxy } = await import("@/proxy");
    const response = await proxy(
      new NextRequest(`${publicOrigin}/?ps_token=${encodeURIComponent(oldToken)}`, {
        headers: {
          accept: "text/html",
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          "sec-fetch-site": "same-origin",
        },
      }),
    );

    expect(sawSessionInsert()).toBe(true);
    expect({ status: response.status, sessionCookie: hasSessionCookie(response) }).toEqual({ status: 401, sessionCookie: false });
  });

  it("POST sign-in reports a true session-storage failure as 503 with no session cookie", async () => {
    const sawSessionInsert = interceptSessionInsert(() => {
      throw new Error("oracle storage unavailable");
    });

    const response = await postSignIn();

    expect(sawSessionInsert()).toBe(true);
    expect({ status: response.status, sessionCookie: hasSessionCookie(response) }).toEqual({ status: 503, sessionCookie: false });
  });
});

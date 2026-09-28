/** @jest-environment node */
/** ADR-0012: a queued Hindsight GET must not release data after revocation. */
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

jest.mock("better-sqlite3", () => jest.requireActual("../../node_modules/better-sqlite3/lib/index.js"));
jest.unmock("@/lib/db");

const origin = "http://127.0.0.1:3000";
const path = "/api/memory/hindsight?action=list";
const environmentKeys = ["PS_AUTH_TOKEN", "PS_AUTH_MODE", "PS_DATA_DIR", "CH_DATA_DIR", "HERMES_HOME", "PS_PUBLIC_ORIGIN", "NEXT_RUNTIME"] as const;
const originalEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]])) as Record<(typeof environmentKeys)[number], string | undefined>;
const originalFetch = globalThis.fetch;
let dataDirectory: string;
let operatorToken: string;

function sessionCookie(response: Response): string {
  const match = /(?:^|[,;])\s*ps_session=([^;,\s]+)/i.exec(response.headers.get("set-cookie") ?? "");
  if (!match) throw new Error("Sign-in did not issue a browser session");
  return `ps_session=${match[1]}`;
}

async function signIn(): Promise<string> {
  const { POST } = await import("@/app/api/auth/sign-in/route");
  const response = await POST(new NextRequest(`${origin}/api/auth/sign-in`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ token: operatorToken }),
  }));
  expect(response.status).toBe(303);
  return sessionCookie(response);
}

function heldGet(headers: Record<string, string>, marker: string): {
  pending: Promise<Response>;
  called: Promise<void>;
  release: () => void;
} {
  let markCalled!: () => void;
  let release!: () => void;
  const called = new Promise<void>((resolve) => { markCalled = resolve; });
  const upstream = new Promise<Response>((resolve) => {
    release = () => resolve(new Response(JSON.stringify({
      items: [{ id: "held-memory", text: marker, fact_type: "preference", date: "2026-09-28", tags: [] }],
      total: 1,
    }), { status: 200, headers: { "content-type": "application/json" } }));
  });
  globalThis.fetch = jest.fn(async () => {
    markCalled();
    return upstream;
  }) as typeof fetch;
  const pending = import("@/app/api/memory/hindsight/route").then(({ GET }) =>
    GET(new NextRequest(`${origin}${path}`, { headers })));
  return { pending, called, release };
}

beforeEach(async () => {
  jest.resetModules();
  dataDirectory = mkdtempSync(join(tmpdir(), "t0158-held-hindsight-"));
  operatorToken = randomBytes(32).toString("hex");
  process.env.PS_AUTH_TOKEN = operatorToken;
  process.env.PS_AUTH_MODE = "token";
  process.env.PS_DATA_DIR = dataDirectory;
  process.env.CH_DATA_DIR = dataDirectory;
  process.env.HERMES_HOME = join(dataDirectory, "hermes-home");
  process.env.PS_PUBLIC_ORIGIN = origin;
  process.env.NEXT_RUNTIME = "nodejs";
  const { initialiseBootState } = await import("@/lib/auth/boot-state");
  initialiseBootState();
  const { ensureDb } = await import("@/lib/db");
  ensureDb();
  expect(jest.isMockFunction(ensureDb)).toBe(false);
});

afterEach(() => {
  (jest.requireActual("@/lib/db") as typeof import("@/lib/db")).getDb().close();
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = originalFetch;
  rmSync(dataDirectory, { recursive: true, force: true });
});

describe("T-0158 held Hindsight GET", () => {
  it("Given a live browser session, a held protected response reaches the caller", async () => {
    const cookie = await signIn();
    const marker = "t0158-live-hindsight-marker";
    const held = heldGet({ cookie }, marker);
    try {
      await held.called;
      held.release();
      const response = await held.pending;
      expect(response.status).toBe(200);
      expect(await response.text()).toContain(marker);
    } finally {
      held.release();
    }
  });

  it("Given a held protected response, revoking its browser session prevents release", async () => {
    const cookie = await signIn();
    const marker = "t0158-revoked-hindsight-marker";
    const held = heldGet({ cookie }, marker);
    try {
      await held.called;
      const { DELETE } = await import("@/app/api/auth/session/route");
      const revoked = await DELETE(new NextRequest(`${origin}/api/auth/session`, {
        method: "DELETE", headers: { origin, cookie },
      }));
      expect(revoked.status).toBe(200);
      const { getDb } = jest.requireActual<typeof import("@/lib/db")>("@/lib/db");
      const row = getDb().prepare("SELECT revoked_at_ms FROM auth_sessions").get() as { revoked_at_ms: number | null };
      expect(row.revoked_at_ms).not.toBeNull();

      held.release();
      const response = await held.pending;
      const body = await response.text();
      expect({ status: response.status, exposed: body.includes(marker) }).toEqual({ status: 401, exposed: false });
    } finally {
      held.release();
    }
  });

  it("Given a Bearer client, a held protected response reaches the caller", async () => {
    const marker = "t0158-bearer-hindsight-marker";
    const held = heldGet({ authorization: `Bearer ${operatorToken}` }, marker);
    try {
      await held.called;
      held.release();
      const response = await held.pending;
      expect(response.status).toBe(200);
      expect(await response.text()).toContain(marker);
    } finally {
      held.release();
    }
  });
});

it("Given a held shared route handler, revoking its browser session prevents release", async () => {
  const cookie = await signIn();
  const marker = "t0158-revoked-wrapped-route-marker";
  let markCalled!: () => void;
  let release!: () => void;
  const called = new Promise<void>((resolve) => { markCalled = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  const { route } = await import("@/lib/api/api-route");
  const GET = route("GET /api/held-response-oracle", "reading a protected result", "Failed to read protected result", async (_request: NextRequest) => {
    markCalled();
    await held;
    return NextResponse.json({ marker });
  });
  const pending = GET(new NextRequest(`${origin}/api/held-response-oracle`, { headers: { cookie } }));
  try {
    await called;
    const { DELETE } = await import("@/app/api/auth/session/route");
    const revoked = await DELETE(new NextRequest(`${origin}/api/auth/session`, {
      method: "DELETE", headers: { origin, cookie },
    }));
    expect(revoked.status).toBe(200);
    const { getDb } = jest.requireActual<typeof import("@/lib/db")>("@/lib/db");
    const row = getDb().prepare("SELECT revoked_at_ms FROM auth_sessions").get() as { revoked_at_ms: number | null };
    expect(row.revoked_at_ms).not.toBeNull();

    release();
    const response = await pending;
    const body = await response.text();
    expect({ status: response.status, exposed: body.includes(marker) }).toEqual({ status: 401, exposed: false });
  } finally {
    release();
  }
});

/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// Read-only mode still READS (T-0034, finding 6).
//
// The finding as filed: /api/missions/[id]/run carries no requireAuth while its
// siblings do, and the inconsistency invites the belief that a route without
// one is unprotected. Reading the code turns the finding inside out.
//
// `requireAuth()` in src/lib/api-auth.ts does not authenticate. Its own header
// says so: it is `requireNotReadOnly()` under a name it kept to avoid churning
// call sites during the security hotfix. Authentication is enforced once, in
// src/proxy.ts, on every request including this one — that is the lock-book's
// structural contract and `design-lint no-auth-in-route-handler` holds it.
//
// So the guard on these routes is the READ-ONLY guard, and src/proxy.ts already
// applies it by METHOD, the way it has to be applied: unsafe methods are
// refused, safe ones are not. Its own comment records what the per-route
// version cost: "the old per-route guards also fired on ~35 GET handlers, which
// 503'd the read-only UI it was meant to enable".
//
// Two of those thirty-five are in this directory. `GET /api/missions` and
// `GET /api/missions/[id]` answer 503 under PS_READ_ONLY, so an operator who
// set the flag to browse safely cannot see their missions at all. The run
// route, the one the finding called anomalous, is the only one in the family
// that was right.
//
// This is the repro, authored before the fix and kept forever.
// ═══════════════════════════════════════════════════════════════

jest.mock("next/server", () => {
  class NextResponse {
    status: number;
    private _data: unknown;
    constructor(data: unknown = null, init?: ResponseInit) {
      this._data = data;
      this.status = init?.status ?? 200;
    }
    json() {
      return Promise.resolve(this._data);
    }
    static json(data: unknown, init?: ResponseInit) {
      return new NextResponse(data, init);
    }
  }
  return { NextRequest: class NextRequest {}, NextResponse };
});

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(() => ({ status: 500, json: async () => ({ error: "boom" }) })),
}));
jest.mock("@/lib/db", () => ({ ensureDb: jest.fn() }));
jest.mock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn() }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/missions/mission-repository", () => ({
  listMissions: jest.fn(() => [{ id: "m1", name: "Nightly digest" }]),
  getMission: jest.fn((id: string) => (id === "m1" ? { id: "m1", name: "Nightly digest" } : null)),
}));
jest.mock("@/lib/runs-repository", () => ({
  getLatestRunForMission: jest.fn(() => null),
  // A Map, because the handler calls .get() on it per row.
  listLatestRunsForMissions: jest.fn(() => new Map()),
}));
jest.mock("@/lib/orchestration/run-deadline", () => ({ buildMissionRunView: jest.fn(() => null) }));

// NOTE: @/lib/api-auth is deliberately NOT mocked. The whole point is the real
// read-only guard reading the real environment variable.

const READ_ONLY_KEYS = ["PS_READ_ONLY", "CH_READ_ONLY"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  jest.resetModules();
  for (const k of READ_ONLY_KEYS) {
    saved[k] = process.env[k];
    process.env[k] = "true";
  }
});

afterEach(() => {
  for (const k of READ_ONLY_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

type Res = { status: number; json: () => Promise<unknown> };

describe("PS_READ_ONLY=true", () => {
  it("still serves GET /api/missions", async () => {
    const route = require("@/app/api/missions/route") as { GET: (req: Request) => Promise<Res> };
    const res = await route.GET({ url: "http://127.0.0.1/api/missions" } as Request);
    expect(res.status).toBe(200);
  });

  it("still serves GET /api/missions/[id]", async () => {
    const route = require("@/app/api/missions/[id]/route") as {
      GET: (req: unknown, ctx: { params: Promise<{ id: string }> }) => Promise<Res>;
    };
    const res = await route.GET({}, { params: Promise.resolve({ id: "m1" }) });
    expect(res.status).toBe(200);
  });

  it("still serves GET /api/missions/[id]/run, which never carried the guard", async () => {
    const route = require("@/app/api/missions/[id]/run/route") as {
      GET: (req: unknown, ctx: { params: Promise<{ id: string }> }) => Promise<Res>;
    };
    const res = await route.GET({}, { params: Promise.resolve({ id: "m1" }) });
    expect(res.status).toBe(200);
  });

  it("still refuses POST /api/missions, which is a write", async () => {
    const route = require("@/app/api/missions/route") as {
      POST: (req: unknown) => Promise<Res>;
    };
    const res = await route.POST({ json: async () => ({ action: "promote" }) });
    expect(res.status).toBe(503);
  });

  it("still refuses POST /api/missions/[id]/dispatch", async () => {
    const route = require("@/app/api/missions/[id]/dispatch/route") as {
      POST: (req: unknown, ctx: { params: Promise<{ id: string }> }) => Promise<Res>;
    };
    const res = await route.POST({}, { params: Promise.resolve({ id: "m1" }) });
    expect(res.status).toBe(503);
  });

  it("still refuses POST /api/missions/[id]/cancel", async () => {
    const route = require("@/app/api/missions/[id]/cancel/route") as {
      POST: (req: unknown, ctx: { params: Promise<{ id: string }> }) => Promise<Res>;
    };
    const res = await route.POST({}, { params: Promise.resolve({ id: "m1" }) });
    expect(res.status).toBe(503);
  });
});

describe("with writes allowed", () => {
  beforeEach(() => {
    for (const k of READ_ONLY_KEYS) delete process.env[k];
  });

  it("lets POST /api/missions through to its handler", async () => {
    const route = require("@/app/api/missions/route") as { POST: (req: unknown) => Promise<Res> };
    const res = await route.POST({ json: async () => ({ action: "nonsense" }) });
    // Reaching the action switch (400 for an unknown action) is the proof that
    // the read-only guard did not fire; the status itself is not the point.
    expect(res.status).not.toBe(503);
  });
});

describe("no route handler authenticates", () => {
  it("keeps authentication in src/proxy.ts, where design-lint holds it", () => {
    const { readFileSync, readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const dir = join(process.cwd(), "src/app/api/missions");
    const files: string[] = [];
    (function walk(d: string) {
      for (const e of readdirSync(d)) {
        const p = join(d, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".ts")) files.push(p);
      }
    })(dir);
    // A floor, not a presence check. `> 0` passes on ONE file, so a walk that
    // lost its way — a moved directory, a changed extension — would report a
    // clean tree while inspecting almost none of it (T-0066, closed in T-0075).
    // Measured at 5; four leaves room for churn without leaving room for a
    // collapse.
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/readAuthToken|tokenMatches|ps_session/);
      // And the misnomer is gone from this family's CODE: a call that reads as
      // authentication but only checks a flag is the defect the finding found.
      // The name may still appear in prose, because explaining what was removed
      // and why is the whole point of removing it.
      const imports = src.match(/import\s*{[^}]*}\s*from\s*"@\/lib\/api-auth"/g) ?? [];
      for (const line of imports) expect(line).not.toMatch(/\brequireAuth\b/);
      expect(src).not.toMatch(/\brequireAuth\s*\(\s*\w/);
    }
  });
});

/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform, and the cancel route is the file this contract creates, so it is read through a guarded require */

// ═══════════════════════════════════════════════════════════════
// B14 oracle, group research-cancel (D98). Contract section 5.2.
//
// THE DEFECT. `cancelled` is a member of ResearchStatus (types.ts:12), has a
// colour in the page's STATUS_COLOR map (research/page.tsx:32) and is in the
// SSE TERMINAL set (events/route.ts:20) — and NOTHING in the codebase ever
// writes it. There is no cancel route, no repository function and no button.
// A Depth 8 / Breadth 12 run against a slow endpoint can only be waited out or
// left to the 30-minute watchdog, spending the whole time.
//
// THE CONTRACT.
//   - `cancelResearchRun(id)` moves a pending/running row to `cancelled` and
//     refuses a terminal one.
//   - POST /api/laboratory/research/[id]/cancel is the route: 404 unknown,
//     409 already finished, otherwise the cancelled run and a
//     `research.cancelled` event (already a legal ANALYTICS_EVENT_TYPE).
//   - runResearchJob bails out rather than overwriting the row the operator
//     just wrote — no `completed`, no `failed`, no artifact capture.
//
// The database is real; the engine is a double, so the bail-out can be timed
// exactly. The watchdog and the rest of the repository are untouched.
// ═══════════════════════════════════════════════════════════════

import { join } from "path";
import type DatabaseNs from "better-sqlite3";

import { execBaselineSchema } from "../helpers/baseline-db";
import { applyDeepResearchMigration } from "@/lib/db/apply-deep-research-migration";
import { applyResearchOptionsMigration } from "@/lib/db/apply-research-options-migration";
import { applyResearchComposerLinkMigration } from "@/lib/db/apply-research-composer-link-migration";
import { applyResearchUsageMigration } from "@/lib/db/apply-research-usage-migration";
import { applyResearchGatherMigration } from "@/lib/db/apply-research-gather-migration";

type RealDb = DatabaseNs.Database;
let testDb: RealDb | null = null;

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    getDb: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});

const runDeepResearch = jest.fn();
jest.mock("@/lib/laboratory/deep-research/engine", () => ({
  runDeepResearch: (...a: unknown[]) => runDeepResearch(...a),
  defaultLlm: jest.fn(),
  defaultVisit: jest.fn(),
}));
jest.mock("@/lib/laboratory/deep-research/search", () => ({
  resolveSearchProvider: () => jest.fn(),
}));

const captureArtifactOnce = jest.fn();
jest.mock("@/lib/artifacts-repository", () => ({
  captureArtifactOnce: (...a: unknown[]) => captureArtifactOnce(...a),
}));

const recordEvent = jest.fn();
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: (...a: unknown[]) => recordEvent(...a) }));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(() => ({ status: 500, body: { error: "boom" } })),
}));

jest.mock("next/server", () => ({
  NextResponse: class NextResponse {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      this.status = status;
      this.body = body;
    }
    async json() {
      return this.body;
    }
    static json(data: unknown, init?: ResponseInit) {
      return new NextResponse(init?.status ?? 200, data);
    }
  },
}));

import {
  createResearchRun,
  getResearchRun,
  listResearchSteps,
  updateResearchRun,
} from "@/lib/laboratory/deep-research/research-repository";
import { runResearchJob } from "@/lib/laboratory/deep-research/run-job";
import type { ResearchRun } from "@/lib/laboratory/deep-research/types";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

// ── the two things the contract adds, read loosely ──────────────

function cancelResearchRun(): (id: string) => ResearchRun | null {
  const mod = require("@/lib/laboratory/deep-research/research-repository") as {
    cancelResearchRun?: (id: string) => ResearchRun | null;
  };
  if (typeof mod.cancelResearchRun !== "function") {
    throw new Error("research-repository exports no cancelResearchRun (contract 5.2)");
  }
  return mod.cancelResearchRun;
}

interface RouteAnswer {
  status: number;
  body: { data?: { run?: ResearchRun }; error?: string };
}

function cancelRoute(): (req: unknown, ctx: { params: Promise<{ id: string }> }) => Promise<RouteAnswer> {
  const mod = require("@/app/api/laboratory/research/[id]/cancel/route") as {
    POST?: (req: unknown, ctx: { params: Promise<{ id: string }> }) => Promise<RouteAnswer>;
  };
  if (typeof mod.POST !== "function") {
    throw new Error("no POST /api/laboratory/research/[id]/cancel (contract 5.2)");
  }
  return mod.POST;
}

function post(id: string): Promise<RouteAnswer> {
  return cancelRoute()({}, { params: Promise.resolve({ id }) });
}

// ── fixture ─────────────────────────────────────────────────────

const RESULT = {
  report: "## In brief\n- something",
  provider: "duckduckgo",
  searchAttempts: 2,
  searchFailures: 0,
  visitAttempts: 2,
  visitFailures: 0,
  usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
};

const STEP = { kind: "plan" as const, input: "q", output: "a plan", sources: [] };

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => RealDb)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyDeepResearchMigration(testDb, migrationsDir);
  applyResearchOptionsMigration(testDb, migrationsDir);
  applyResearchComposerLinkMigration(testDb, migrationsDir);
  applyResearchUsageMigration(testDb, migrationsDir);
  applyResearchGatherMigration(testDb, migrationsDir);
  jest.clearAllMocks();
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

// ═══════════════════════════════════════════════════════════════
// (A) the repository
// ═══════════════════════════════════════════════════════════════

describe("cancelResearchRun", () => {
  it("moves a running run to cancelled and says who stopped it", () => {
    const run = createResearchRun({ query: "slow one" });
    updateResearchRun(run.id, { status: "running" });

    const cancelled = cancelResearchRun()(run.id);

    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.error).toMatch(/cancel/i);
    expect(getResearchRun(run.id)!.completedAt).not.toBeNull();
  });

  it("cancels a run that has not started yet", () => {
    const run = createResearchRun({ query: "queued one" });
    expect(cancelResearchRun()(run.id)?.status).toBe("cancelled");
  });

  it("refuses a run that already finished, so a report is never relabelled", () => {
    const run = createResearchRun({ query: "done" });
    updateResearchRun(run.id, { status: "completed", report: "the report" });

    expect(cancelResearchRun()(run.id)).toBeNull();
    const after = getResearchRun(run.id)!;
    expect(after.status).toBe("completed");
    expect(after.report).toBe("the report");
  });

  it("returns null for a run that does not exist", () => {
    expect(cancelResearchRun()("nope")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// (B) the route
// ═══════════════════════════════════════════════════════════════

describe("POST /api/laboratory/research/[id]/cancel", () => {
  it("cancels a running run and answers with it", async () => {
    const run = createResearchRun({ query: "slow one" });
    updateResearchRun(run.id, { status: "running" });

    const res = await post(run.id);

    expect(res.status).toBe(200);
    expect(res.body.data?.run?.status).toBe("cancelled");
    expect(recordEvent).toHaveBeenCalledWith(
      "research.cancelled",
      expect.objectContaining({ entityType: "research", entityId: run.id }),
    );
  });

  it("404s an id that is not a run", async () => {
    const res = await post("nope");
    expect(res.status).toBe(404);
  });

  it("409s a run that has already finished", async () => {
    const run = createResearchRun({ query: "done" });
    updateResearchRun(run.id, { status: "completed", report: "r" });

    const res = await post(run.id);
    expect(res.status).toBe(409);
    expect(getResearchRun(run.id)!.status).toBe("completed");
  });
});

// ═══════════════════════════════════════════════════════════════
// (C) the job bails out instead of overwriting the operator's decision
// ═══════════════════════════════════════════════════════════════

describe("runResearchJob after a cancel", () => {
  it("stops at the next step and leaves the row cancelled", async () => {
    const run = createResearchRun({ query: "slow one" });
    let stepsTaken = 0;

    runDeepResearch.mockImplementation(async (_query: string, deps: { onStep: (s: unknown) => void }) => {
      deps.onStep(STEP);
      stepsTaken += 1;
      // The operator presses Stop here.
      cancelResearchRun()(run.id);
      deps.onStep(STEP); // must throw: the job is not allowed to keep going
      stepsTaken += 1;
      return RESULT;
    });

    await runResearchJob(run.id, "slow one", { rounds: 3 });

    const after = getResearchRun(run.id)!;
    expect(after.status).toBe("cancelled");
    expect(after.report).toBeNull();
    expect(stepsTaken).toBe(1);
    // A cancelled run is not a failed one, and its half-written report is not
    // an artifact.
    expect(captureArtifactOnce).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalledWith("research.failed", expect.anything());
    expect(recordEvent).not.toHaveBeenCalledWith("research.completed", expect.anything());
  });

  it("does not resurrect a run cancelled during the final synthesize", async () => {
    const run = createResearchRun({ query: "slow one" });

    runDeepResearch.mockImplementation(async () => {
      // No further step hook fires after the last one, so the terminal write is
      // the only place left to notice.
      cancelResearchRun()(run.id);
      return RESULT;
    });

    await runResearchJob(run.id, "slow one", { rounds: 1 });

    const after = getResearchRun(run.id)!;
    expect(after.status).toBe("cancelled");
    expect(after.report).toBeNull();
    expect(captureArtifactOnce).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// GREEN CONTROL
// ═══════════════════════════════════════════════════════════════

describe("GREEN CONTROL: an uncancelled run still finishes normally", () => {
  it("records the steps, the report, the usage and the artifact", async () => {
    const run = createResearchRun({ query: "a question" });
    runDeepResearch.mockImplementation(async (_q: string, deps: { onStep: (s: unknown) => void }) => {
      deps.onStep(STEP);
      return RESULT;
    });

    await runResearchJob(run.id, "a question", { rounds: 1 });

    const after = getResearchRun(run.id)!;
    expect(after.status).toBe("completed");
    expect(after.report).toContain("In brief");
    expect(after.usage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
    expect(listResearchSteps(run.id)).toHaveLength(1);
    expect(captureArtifactOnce).toHaveBeenCalled();
    expect(recordEvent).toHaveBeenCalledWith("research.completed", expect.anything());
  });
});

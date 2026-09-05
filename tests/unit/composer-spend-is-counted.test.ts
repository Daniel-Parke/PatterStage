/**
 * @jest-environment node
 *
 * T-0058 acceptance oracle — a Composer stage's tokens reach the spend console.
 *
 * T-0030 made Deep Research countable and left a comment in spend-summary.ts
 * saying of the other two sources: "composer — a `runs` row with a
 * `composer_node_run_id` and no mission. Tokens in `usage_json`, no model
 * dimension, so it is priced at model-cost's conservative DEFAULT_RATE."
 *
 * The second sentence is false and has always been false. Composer stage runs
 * never carry `usage_json`, so `readRunUsageSince` — which selects
 * `WHERE r.usage_json IS NOT NULL` — excludes every one of them. The Composer
 * row on the spend console reads $0.00, not a conservative estimate, and the
 * operator's optional hard stop under-measures by that whole source.
 *
 * The mechanism is one branch. `reconcileOne` writes usage at
 * run-reconcile.ts:192-198, but a composer run is diverted at :165 into
 * `reconcileComposerRun`, and `finalizeComposerStage` never took a usage
 * argument to pass on — although the `result` it is called with carries one.
 *
 * This is the T-0030 defect in the source T-0030 did not measure, and it is the
 * same class of harm: unknown spend reading as free, on the number a hard stop
 * is compared against.
 */

import { join } from "path";

import type DatabaseNs from "better-sqlite3";

type RealDb = DatabaseNs.Database;
let testDb: RealDb | null = null;

jest.mock("@/lib/db", () => ({
  getDb: () => testDb!,
  ensureDb: () => undefined,
  now: () => new Date().toISOString(),
  uuid: () => `id-${Math.random().toString(36).slice(2)}`,
  inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
}));

const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;

import { readRunUsageSince } from "@/lib/spend/spend-repository";

beforeAll(() => {
  testDb = new Database(":memory:");
  testDb.exec(`
    CREATE TABLE runs (
      id TEXT PRIMARY KEY, mission_id TEXT, composer_node_run_id TEXT,
      status TEXT, output TEXT, usage_json TEXT, error TEXT, session_id TEXT,
      submitted_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      -- Added by migration 040 (T-0108). This hand-written fixture is the
      -- schema the read walks, so it carries the column with the same default
      -- the migration gives existing rows; the composer CASE fallback below is
      -- what these cases are actually about, and it still classifies rows that
      -- predate the column.
      story_id TEXT, spend_source TEXT NOT NULL DEFAULT 'agent'
    );
    CREATE TABLE missions (id TEXT PRIMARY KEY, model_id TEXT);
  `);
});
afterAll(() => testDb?.close());
beforeEach(() => testDb!.exec("DELETE FROM runs; DELETE FROM missions;"));

const USAGE = JSON.stringify({ inputTokens: 800, outputTokens: 400, totalTokens: 1200 });

function insertRun(id: string, opts: { composer?: boolean; usage?: string | null }) {
  testDb!
    .prepare(
      `INSERT INTO runs (id, mission_id, composer_node_run_id, status, usage_json, submitted_at, updated_at)
       VALUES (?, ?, ?, 'completed', ?, '2026-08-20 10:00:00', '2026-08-20 10:00:00')`,
    )
    .run(id, opts.composer ? null : "m1", opts.composer ? "node-1" : null, opts.usage ?? null);
}

describe("the spend read counts a Composer stage that recorded usage", () => {
  it("classifies it as composer, not agent", () => {
    insertRun("r1", { composer: true, usage: USAGE });
    const rows = readRunUsageSince("2026-08-01 00:00:00");
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("composer");
  });

  it("excludes a composer run with no usage, which is what shipped", () => {
    // Not a bug in the READ: a row with no tokens genuinely has nothing to
    // price. The defect is upstream, in never writing them.
    insertRun("r1", { composer: true, usage: null });
    expect(readRunUsageSince("2026-08-01 00:00:00")).toHaveLength(0);
  });
});

describe("the reconciler carries a stage's usage onto its run", () => {
  it("writes the gateway's usage onto a finished composer stage", async () => {
    // Behavioural, not source-scanning: drive the real reconciler with a fake
    // gateway and watch what it writes. A composer stage that reports 1,200
    // tokens must land those tokens on its run, exactly as the agent branch
    // does at run-reconcile.ts:192-198 -- otherwise readRunUsageSince, which
    // requires usage_json IS NOT NULL, can never see it.
    jest.resetModules();

    const updateRun = jest.fn();
    const listActiveRuns = jest.fn(() => [
      {
        id: "run-1",
        runId: "gw-1",
        composerNodeRunId: "node-1",
        missionId: null,
        profileName: null,
        status: "started",
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    const getRun = jest.fn(async () => ({
      status: "completed" as const,
      output: "stage output",
      error: null,
      usage: { inputTokens: 800, outputTokens: 400, totalTokens: 1200 },
    }));

    jest.doMock("@/lib/runs-repository", () => ({ listActiveRuns, updateRun }));
    jest.doMock("@/lib/runtime", () => ({ runtime: { getRun, stopRun: jest.fn() } }));
    jest.doMock("@/lib/composer/engine", () => ({
      finalizeComposerNodeRun: jest.fn(() => null),
      advanceComposerRun: jest.fn(),
    }));
    jest.doMock("@/lib/missions/mission-repository", () => ({
      updateMission: jest.fn(),
      getMission: jest.fn(() => null),
    }));
    jest.doMock("@/lib/sessions/session-repository", () => ({ closeSessionForMission: jest.fn() }));
    jest.doMock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
    jest.doMock("@/lib/artifacts-repository", () => ({ captureArtifactOnce: jest.fn() }));
    jest.doMock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

    const { reconcileActiveRuns } = await import("@/lib/orchestration/run-reconcile");
    await reconcileActiveRuns();

    expect(updateRun).toHaveBeenCalledTimes(1);
    const [id, patch] = updateRun.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe("run-1");
    expect(patch.status).toBe("completed");
    expect(patch.usage).toEqual({ inputTokens: 800, outputTokens: 400, totalTokens: 1200 });
  });

  it("writes null usage rather than inventing tokens when the gateway reports none", async () => {
    // The complement, and the reason this is not "just always write something":
    // a stage the gateway gave no usage for must stay uncounted. Priced-at-zero
    // and not-priced are different claims, and only the second is honest.
    jest.resetModules();

    const updateRun = jest.fn();
    jest.doMock("@/lib/runs-repository", () => ({
      updateRun,
      listActiveRuns: jest.fn(() => [
        {
          id: "run-2",
          runId: "gw-2",
          composerNodeRunId: "node-2",
          missionId: null,
          profileName: null,
          status: "started",
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
    }));
    jest.doMock("@/lib/runtime", () => ({
      runtime: {
        getRun: jest.fn(async () => ({ status: "completed" as const, output: "x", error: null })),
        stopRun: jest.fn(),
      },
    }));
    jest.doMock("@/lib/composer/engine", () => ({
      finalizeComposerNodeRun: jest.fn(() => null),
      advanceComposerRun: jest.fn(),
    }));
    jest.doMock("@/lib/missions/mission-repository", () => ({
      updateMission: jest.fn(),
      getMission: jest.fn(() => null),
    }));
    jest.doMock("@/lib/sessions/session-repository", () => ({ closeSessionForMission: jest.fn() }));
    jest.doMock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
    jest.doMock("@/lib/artifacts-repository", () => ({ captureArtifactOnce: jest.fn() }));
    jest.doMock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

    const { reconcileActiveRuns } = await import("@/lib/orchestration/run-reconcile");
    await reconcileActiveRuns();

    const [, patch] = updateRun.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch.usage).toBeNull();
  });

  it("records no usage for a stage that never reached the gateway", async () => {
    // Found by mutation. Replacing finalizeComposerStage's `= null` default
    // with a zero-token object survived the two tests above, because both
    // drive the GATEWAY path, where usage is passed explicitly and the default
    // never applies. The default governs the three callers that finalize a
    // stage without a gateway answer -- never submitted, past its deadline,
    // backend gone -- which are precisely the ones with nothing to report.
    //
    // A zero there would be worse than the bug this file fixes: an unsubmitted
    // stage would enter the priced total as a measured $0.00 and make the
    // hard-stop number look better-founded than it is.
    jest.resetModules();

    const updateRun = jest.fn();
    jest.doMock("@/lib/runs-repository", () => ({
      updateRun,
      listActiveRuns: jest.fn(() => [
        {
          id: "run-3",
          runId: null, // never submitted to the backend
          composerNodeRunId: "node-3",
          missionId: null,
          profileName: null,
          status: "started",
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
    }));
    const getRun = jest.fn();
    jest.doMock("@/lib/runtime", () => ({ runtime: { getRun, stopRun: jest.fn() } }));
    jest.doMock("@/lib/composer/engine", () => ({
      finalizeComposerNodeRun: jest.fn(() => null),
      advanceComposerRun: jest.fn(),
    }));
    jest.doMock("@/lib/missions/mission-repository", () => ({
      updateMission: jest.fn(),
      getMission: jest.fn(() => null),
    }));
    jest.doMock("@/lib/sessions/session-repository", () => ({ closeSessionForMission: jest.fn() }));
    jest.doMock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
    jest.doMock("@/lib/artifacts-repository", () => ({ captureArtifactOnce: jest.fn() }));
    jest.doMock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

    const { reconcileActiveRuns } = await import("@/lib/orchestration/run-reconcile");
    await reconcileActiveRuns();

    expect(getRun).not.toHaveBeenCalled(); // it really did not reach the gateway
    const [, patch] = updateRun.mock.calls[0] as [string, Record<string, unknown>];
    expect(patch.status).toBe("failed");
    expect(patch.usage).toBeNull();
  });
});

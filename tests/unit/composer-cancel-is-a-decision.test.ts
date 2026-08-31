/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

// T-0076 acceptance oracle — a Composer run can be stopped, and stopping it is
// recorded as a decision.
//
// WHAT THE PRODUCT DOES TODAY. Nothing. There is no cancel endpoint, no cancel
// control, and no way out of a paused run except approving or rejecting the
// gate it is parked at. A workflow with a live run then refuses to be edited or
// deleted — "let them finish or cancel them first" — which promises an
// affordance that does not exist. That message is the dead end.
//
// `cancelled` HAS BEEN IN THE VOCABULARY THE WHOLE TIME. It is in
// ComposerRunStatus, in the composer_runs CHECK, and in
// TERMINAL_COMPOSER_RUN_STATUSES — read in three places and written in none.
// composer-reject-is-not-a-cliff.test.ts names this in its own header: it
// warned that `rejected` "must not become the second one". This file is the
// discharge of that promise for the first one.
//
// THE BLOCKER NOBODY NAMED. NodeRunStatus has no `cancelled`, so the in-flight
// STAGE could not be marked at all. Reusing `failed` would recreate exactly the
// defect T-0069 fixed — a deliberate act painted as a crash, a pink stage under
// an orange header. Reusing `skipped` would be false: the stage WAS running,
// and `skipped` is itself unwritten vocabulary. So migration 037 widens the
// node CHECK. It is a single-table rebuild: nothing holds a foreign key INTO
// composer_node_runs, which makes it strictly simpler than 035's.
//
// THE SEAM THAT MAKES THIS SAFE. Writing the linked `runs` row to `cancelled`
// removes it from listActiveRuns (`WHERE status='started'`), so the reconciler
// stops polling it and can never overwrite the decision. The guard in
// finalizeComposerNodeRun is defence in depth for the race that remains:
// reconcile snapshots the active set, awaits the gateway, and can come back
// holding stale output for a run that ended while it waited.

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";
import { applyComposerRejectedMigration } from "@/lib/db/apply-composer-rejected-migration";
import { applyComposerNodeCancelledMigration } from "@/lib/db/apply-composer-node-cancelled-migration";

let testDb: import("better-sqlite3").Database | null = null;

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

const mockStopRun = jest.fn(async () => undefined);
jest.mock("@/lib/runtime", () => ({
  runtime: {
    submitRun: jest.fn(async () => ({ runId: "b1", status: "started" })),
    getRun: jest.fn(),
    stopRun: (...a: unknown[]) => mockStopRun(...(a as [])),
  },
}));
jest.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: () => true }));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: (...a: unknown[]) => mockAudit(...a) }));
jest.mock("@/lib/api-logger", () => ({
  logApiError: (...a: unknown[]) => mockLogApiError(...a),
  serverErrorFromCatch: jest.fn(),
}));
const mockAudit = jest.fn();
const mockLogApiError = jest.fn();

import {
  createComposerRun,
  createNodeRun,
  createWorkflowFromDef,
  getComposerRun,
  getComposerRunByParentNodeRunId,
  listNodeRuns,
  updateComposerRun,
  updateNodeRun,
  workflowHasActiveRuns,
  deleteWorkflow,
} from "@/lib/composer/composer-repository";
import { advanceComposerRun, finalizeComposerNodeRun } from "@/lib/composer/engine";
import { createRun, getRun, listActiveRuns, attachBackendRun, updateRun } from "@/lib/runs-repository";
import { POST as cancelPOST } from "@/app/api/composer/runs/[id]/cancel/route";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");
const flush = () => new Promise((r) => setTimeout(r, 30));

const GATED = {
  key: "cancel-gate-wf",
  name: "Cancel gate",
  nodes: [
    { key: "stage", label: "Plan", kind: "plan", gate: "hil" as const, isStart: true },
    { key: "done", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
  ],
  edges: [{ from: "stage", to: "done", condition: "on_approve" }],
};

function freshDb(): import("better-sqlite3").Database {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  const db = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  db.pragma("foreign_keys = ON");
  execBaselineSchema(db);
  applyComposerMigration(db, migrationsDir);
  applyComposerGroupLinkMigration(db, migrationsDir);
  applyComposerRejectedMigration(db, migrationsDir);
  return db;
}

beforeEach(() => {
  jest.clearAllMocks();
  testDb = freshDb();
  // The migration under test. Without it every `cancelled` node-run write below
  // throws a CHECK violation — which is the honest reason those tests are red
  // before 037 lands, exactly as the 035 harness was.
  applyComposerNodeCancelledMigration(testDb, migrationsDir);
});
afterEach(async () => {
  await flush();
  testDb?.close();
  testDb = null;
});

/** A run mid-flight: one stage running, with a real agent run behind it. */
function runInFlight(): { runId: string; nodeRunId: string; nodeId: string; agentRunId: string } {
  const wf = createWorkflowFromDef(GATED);
  const run = createComposerRun({ workflowId: wf.id, input: "ship it" });
  const stage = wf.nodes.find((n) => n.label === "Plan")!;
  const nodeRun = createNodeRun({
    composerRunId: run.id,
    nodeId: stage.id,
    attempt: 1,
    input: "ship it",
  });
  // dispatch.ts links the node-run to a PatterStage run row named cn_<nodeRunId>,
  // and the BACKEND id lands on that row via attachBackendRun.
  const agentRunId = `cn_${nodeRun.id}`;
  createRun({ id: agentRunId, composerNodeRunId: nodeRun.id });
  attachBackendRun(agentRunId, { runId: "backend-xyz" });
  updateNodeRun(nodeRun.id, { status: "running", runId: agentRunId });
  updateComposerRun(run.id, { status: "running", currentNodeId: stage.id });
  return { runId: run.id, nodeRunId: nodeRun.id, nodeId: stage.id, agentRunId };
}

async function cancel(runId: string) {
  const res = await cancelPOST({} as never, { params: Promise.resolve({ id: runId }) });
  return { status: res.status, body: (await res.json()) as { error?: string; data?: unknown } };
}

describe("cancelled stops being dead vocabulary", () => {
  it("the RUN is written cancelled, with a reason and an end time", async () => {
    // The assertion composer-reject-is-not-a-cliff.test.ts's header promised.
    // A status that is permitted by the CHECK and produced by nothing is not a
    // feature; `cancelled` has been in the union since the table was created.
    const { runId } = runInFlight();

    const { status } = await cancel(runId);

    expect(status).toBe(200);
    const run = getComposerRun(runId)!;
    expect(run.status).toBe("cancelled");
    expect(run.error).toBe("Cancelled by user");
    expect(run.completedAt).toBeTruthy();
  });

  it("the in-flight STAGE is cancelled, not failed", async () => {
    // T-0069 established that a deliberate act must not render as a defect.
    // `failed` here would put a pink stage under an orange run header — the
    // exact contradiction that task existed to remove.
    const { runId, nodeRunId } = runInFlight();

    await cancel(runId);

    const stage = listNodeRuns(runId).find((n) => n.id === nodeRunId)!;
    expect(stage.status).toBe("cancelled");
    expect(stage.completedAt).toBeTruthy();
  });

  it("the agent run row is cancelled, so the reconciler stops polling it", async () => {
    // This is the seam. listActiveRuns is `WHERE status='started'`; taking the
    // row out of that set is what makes the decision un-overwritable.
    const { runId, agentRunId } = runInFlight();

    await cancel(runId);

    expect(getRun(agentRunId)!.status).toBe("cancelled");
    expect(listActiveRuns().map((r) => r.id)).not.toContain(agentRunId);
  });

  it("asks the backend to stop, with the BACKEND id and not the local one", async () => {
    const { runId } = runInFlight();

    await cancel(runId);
    await flush();

    expect(mockStopRun).toHaveBeenCalledWith("backend-xyz", undefined);
  });

  it("still records the decision when the backend refuses to stop", async () => {
    // Best-effort by design: the local record is written the same way whether
    // or not the gateway answers (the T-0070 doctrine). A gateway that is down
    // is the most likely reason to be cancelling in the first place.
    mockStopRun.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { runId, nodeRunId } = runInFlight();

    const { status } = await cancel(runId);
    await flush();

    expect(status).toBe(200);
    expect(getComposerRun(runId)!.status).toBe("cancelled");
    expect(listNodeRuns(runId).find((n) => n.id === nodeRunId)!.status).toBe("cancelled");
  });

  it("leaves an agent run that had ALREADY finished with its real ending", async () => {
    // Found by mutation: nothing exercised the `status === "started"` guard, so
    // widening it to "any run at all" passed. A stage that completed a second
    // before the cancel really did complete, and overwriting that with
    // `cancelled` would misreport what the agent actually did — the same rule
    // cancel-finalise.ts applies on the mission side.
    const { runId, nodeRunId, agentRunId } = runInFlight();
    updateRun(agentRunId, { status: "completed", output: "it finished first" });
    updateNodeRun(nodeRunId, { status: "running" });

    await cancel(runId);

    const agentRun = getRun(agentRunId)!;
    expect(agentRun.status).toBe("completed");
    expect(agentRun.error).toBeNull();
  });

  it("logs a backend that refused to stop rather than swallowing it", async () => {
    // Found by mutation: Promise.allSettled already prevents the rejection from
    // breaking the cancellation, so deleting the catch changed nothing
    // observable. The catch earns its place by making the failure VISIBLE — a
    // gateway that ignored a stop request is exactly the kind of thing this
    // codebase keeps discovering was silently dropped.
    mockStopRun.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { runId } = runInFlight();

    await cancel(runId);
    await flush();

    expect(mockLogApiError).toHaveBeenCalledWith(
      "composer.cancel",
      expect.stringContaining("backend-xyz"),
      expect.any(Error),
    );
  });

  it("writes one audit line, not one per row it touched", async () => {
    const { runId } = runInFlight();

    await cancel(runId);

    expect(
      mockAudit.mock.calls.filter((c) => (c[0] as { action?: string }).action === "composer.cancel"),
    ).toHaveLength(1);
  });
});

describe("the reconciler cannot undo the decision", () => {
  it("a late finalize for a cancelled run is ignored", async () => {
    // The race is real: reconcile snapshots listActiveRuns, awaits the gateway,
    // and can return holding output for a run that ended while it waited.
    // Without this guard it overwrites the stage's status and merges stale
    // output into a cancelled run's context.
    const { runId, nodeRunId, agentRunId } = runInFlight();
    await cancel(runId);

    const result = finalizeComposerNodeRun(agentRunId, "completed", "late output", null);

    expect(result).toBeNull();
    const stage = listNodeRuns(runId).find((n) => n.id === nodeRunId)!;
    expect(stage.status).toBe("cancelled");
    expect(stage.output).not.toBe("late output");
  });

  it("advancing a cancelled run does nothing", async () => {
    const { runId } = runInFlight();
    await cancel(runId);
    const before = getComposerRun(runId)!;

    await advanceComposerRun(runId);

    const after = getComposerRun(runId)!;
    expect(after.status).toBe("cancelled");
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(listNodeRuns(runId)).toHaveLength(1);
  });
});

describe("the endpoint explains itself", () => {
  it("cancelling twice is a no-op, not an error", async () => {
    // The operator's intent is already satisfied. A second click — or a double
    // click — must not paint a failure for a state that is what they asked for.
    const { runId } = runInFlight();
    await cancel(runId);
    const first = getComposerRun(runId)!;

    const { status } = await cancel(runId);

    expect(status).toBe(200);
    expect(getComposerRun(runId)!.updatedAt).toBe(first.updatedAt);
  });

  it("refuses a run that already completed, and says so", async () => {
    const { runId } = runInFlight();
    updateComposerRun(runId, { status: "completed", completedAt: new Date().toISOString() });

    const { status, body } = await cancel(runId);

    expect(status).toBe(400);
    expect(body.error).toMatch(/completed/i);
  });

  it("refuses a rejected run, and repeats the reason it ended", async () => {
    const { runId } = runInFlight();
    updateComposerRun(runId, {
      status: "rejected",
      error: "Plan was rejected and the workflow has no recovery path from here.",
      completedAt: new Date().toISOString(),
    });

    const { status, body } = await cancel(runId);

    expect(status).toBe(400);
    expect(body.error).toMatch(/rejected/i);
    expect(body.error).toContain("no recovery path");
  });

  it("404s an unknown run", async () => {
    expect((await cancel("no-such-run")).status).toBe(404);
  });
});

describe("a group stage cancels what it started", () => {
  function parentOf(childWorkflowId: string) {
    return createWorkflowFromDef({
      key: "cancel-parent-wf",
      name: "Parent",
      nodes: [
        {
          key: "grp",
          label: "Sub",
          kind: "group",
          gate: "auto" as const,
          isStart: true,
          config: { workflowRef: childWorkflowId },
        },
        { key: "pdone", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
      ],
      edges: [{ from: "grp", to: "pdone", condition: "on_pass" }],
    });
  }

  it("cancelling the parent cancels the child run it spawned", async () => {
    // Otherwise the child keeps running and keeps spending against a parent
    // that has already ended.
    const child = createWorkflowFromDef(GATED);
    const parent = parentOf(child.id);
    const run = createComposerRun({ workflowId: parent.id, input: "go" });
    await advanceComposerRun(run.id);
    await flush();
    const grpNodeRun = listNodeRuns(run.id).find((nr) => nr.status === "running")!;
    const childRun = getComposerRunByParentNodeRunId(grpNodeRun.id)!;

    await cancel(run.id);

    expect(getComposerRun(childRun.id)!.status).toBe("cancelled");
    expect(listNodeRuns(run.id).find((n) => n.id === grpNodeRun.id)!.status).toBe("cancelled");
  });

  it("cancelling a child settles the parent's group stage as not-delivered", async () => {
    // The engine's existing rule for any terminal child: from the parent's side
    // the stage did not deliver. This pins settleGroupNode's cancelled branch,
    // which nothing could reach before this batch.
    const child = createWorkflowFromDef(GATED);
    const parent = parentOf(child.id);
    const run = createComposerRun({ workflowId: parent.id, input: "go" });
    await advanceComposerRun(run.id);
    await flush();
    const grpNodeRun = listNodeRuns(run.id).find((nr) => nr.status === "running")!;
    const childRun = getComposerRunByParentNodeRunId(grpNodeRun.id)!;

    await cancel(childRun.id);
    await flush();
    await advanceComposerRun(run.id);

    const settled = listNodeRuns(run.id).find((n) => n.id === grpNodeRun.id)!;
    expect(settled.status).not.toBe("running");
    expect(settled.error).toMatch(/cancel/i);
  });
});

describe("a cancelled run stops blocking its workflow", () => {
  it("the delete guard lets go once the run is cancelled", async () => {
    // The guard's message promises exactly this affordance. Until now it
    // promised something that did not exist.
    const { runId } = runInFlight();
    const wfId = getComposerRun(runId)!.workflowId;
    expect(workflowHasActiveRuns(wfId)).toBe(true);

    await cancel(runId);

    expect(workflowHasActiveRuns(wfId)).toBe(false);
    expect(() => deleteWorkflow(wfId)).not.toThrow();
  });
});

describe("migration 037 rebuilds the node table without losing anything", () => {
  function dbAt036(): import("better-sqlite3").Database {
    return freshDb();
  }

  it("widens the node CHECK and leaves the run CHECK alone", () => {
    const sql = require("fs").readFileSync(
      join(migrationsDir, "037_composer_node_cancelled.sql"),
      "utf-8",
    ) as string;
    expect(sql).toMatch(/composer_node_runs/);
    expect(sql).toMatch(/'cancelled'/);
    // 035 already admitted cancelled on composer_runs; rebuilding it again
    // would be a second table rebuild for no reason.
    expect(sql).not.toMatch(/CREATE TABLE composer_runs_new/);
  });

  it("the head constant moves with it", () => {
    expect(
      require("fs").readFileSync(join(process.cwd(), "src", "lib", "db-schema.ts"), "utf-8"),
    ).toMatch(/MIGRATION_HEAD_SCHEMA_VERSION = 37/);
  });

  it("refuses to rebuild a drifted table rather than truncating it", () => {
    const db = dbAt036();
    db.exec("ALTER TABLE composer_node_runs ADD COLUMN cost_usd REAL");

    expect(() => applyComposerNodeCancelledMigration(db, migrationsDir)).toThrow(
      /composer_node_runs[\s\S]*drifted/,
    );
    expect(
      (db.prepare("PRAGMA table_info(composer_node_runs)").all() as { name: string }[]).map(
        (r) => r.name,
      ),
    ).toContain("cost_usd");
    db.close();
  });

  it("cleans up a half-applied rebuild left by the legacy prebuild loop", () => {
    // Same hazard 035 documented: db-schema-ensure.mjs exec's every .sql under
    // a blanket catch and leaves the staging table behind.
    const db = dbAt036();
    db.exec("CREATE TABLE composer_node_runs_new (id TEXT PRIMARY KEY)");

    expect(() => applyComposerNodeCancelledMigration(db, migrationsDir)).not.toThrow();

    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'composer%'")
        .all() as { name: string }[]
    ).map((r) => r.name);
    expect(tables).not.toContain("composer_node_runs_new");
    db.close();
  });

  it("GREEN CONTROL: rows, foreign keys and the CHECK all survive", () => {
    const db = dbAt036();
    db.prepare("INSERT INTO composer_workflows (id, name) VALUES ('w-keep','W')").run();
    db.prepare(
      "INSERT INTO composer_runs (id, workflow_id, status) VALUES ('r-keep','w-keep','running')",
    ).run();
    db.prepare("INSERT INTO composer_nodes (id, workflow_id, key, label) VALUES ('n1','w-keep','k','L')").run();
    db.prepare(
      "INSERT INTO composer_node_runs (id, composer_run_id, node_id, status, output) VALUES ('nr-keep','r-keep','n1','completed','kept')",
    ).run();

    applyComposerNodeCancelledMigration(db, migrationsDir);

    expect(
      db.prepare("SELECT status, output FROM composer_node_runs WHERE id='nr-keep'").get(),
    ).toEqual({ status: "completed", output: "kept" });
    expect(db.pragma("foreign_key_check")).toEqual([]);
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(() =>
      db
        .prepare("INSERT INTO composer_node_runs (id, composer_run_id, node_id, status) VALUES ('x','r-keep','n1','banana')")
        .run(),
    ).toThrow(/CHECK/);
    db.close();
  });
});

describe("the UI shows the cancel and its refusal", () => {
  const page = require("fs").readFileSync(
    join(process.cwd(), "src", "app", "orchestration", "composer", "page.tsx"),
    "utf-8",
  ) as string;

  it("the handler checks the result rather than discarding it", () => {
    const fn = page.slice(page.indexOf("async function cancelRun"));
    expect(fn.slice(0, 900)).toMatch(/\.ok/);
    expect(fn.slice(0, 900)).toMatch(/setGateError/);
  });

  it("cancelled is filterable, so a cancelled run is findable", () => {
    expect(page).toMatch(/value:\s*"cancelled"/);
  });
});

/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

// T-0069 acceptance oracle — a rejected Composer gate must say so, and must not
// strand the operator.
//
// WHAT WORKS ALREADY, and is pinned here so the fix cannot regress it: rejecting
// a gate that has no `on_reject` edge ends the run with a genuinely good
// sentence, built by describeStageFailure -- "Gate was rejected and the workflow
// has no recovery path from here."
//
// WHAT DOES NOT. That sentence is written to `composer_runs.error` and then
// never reaches a human:
//
//   1. applyNext's fail branch writes ONLY the run row. The rejected gate's
//      node-run keeps the `completed` that finalizeComposerNodeRun just wrote,
//      so the canvas draws it GREEN, labelled completed, two elements below a
//      pink "failed" run header. The picture contradicts the status line.
//   2. The approve route's guard answers a bare "Run is not awaiting approval"
//      while run.status and run.error are both in scope. The exact sentence the
//      operator needs is sitting in the variable being tested.
//
// THE OPERATOR RULED for a distinct `rejected` terminal state rather than
// reusing `failed`, so a rejection renders as the deliberate act it is. That
// needs migration 035, because SQLite cannot ALTER a CHECK constraint -- and the
// harness below proves it, because the beforeEach applies the real appliers and
// an unwidened CHECK makes the write throw rather than quietly pass.
//
// WHY THIS DRIVES THE REAL ENGINE against real SQLite rather than reading source
// with regexes. A source-shape assertion cannot tell a status that is WRITTEN
// from one that is merely permitted, and `cancelled` is already proof that the
// difference is not theoretical: it is in the CHECK, in the union, read in two
// places, and written nowhere. `rejected` must not become the second one.

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";
import { applyComposerRejectedMigration } from "@/lib/db/apply-composer-rejected-migration";

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
jest.mock("@/lib/runtime", () => ({
  runtime: {
    submitRun: jest.fn(async () => ({ runId: "b1", status: "started" })),
    getRun: jest.fn(),
    stopRun: jest.fn(),
  },
}));
jest.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: () => true }));

import {
  createComposerRun,
  createNodeRun,
  createWorkflowFromDef,
  getComposerRun,
  listNodeRuns,
  recordComposerApproval,
  updateComposerRun,
  updateNodeRun,
} from "@/lib/composer/composer-repository";
import { advanceComposerRun } from "@/lib/composer/engine";
import {
  TERMINAL_COMPOSER_RUN_STATUSES,
  isTerminalComposerRunStatus,
} from "@/lib/composer/schema";
import { POST as approvePOST } from "@/app/api/composer/runs/[id]/nodes/[nodeId]/approve/route";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");
const flush = () => new Promise((r) => setTimeout(r, 30));

/**
 * A gate with nowhere to go on reject. `on_approve` exists, `on_reject` does
 * not, which is the branch the report hit and the one with no coverage at all.
 */
const DEAD_END_GATE = {
  key: "dead-end-gate",
  name: "Dead end gate",
  nodes: [
    { key: "gate", label: "Plan", kind: "plan", gate: "hil" as const, isStart: true },
    { key: "done", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
  ],
  edges: [{ from: "gate", to: "done", condition: "on_approve" }],
};

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(
    ":memory:",
  );
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyComposerMigration(testDb, migrationsDir);
  applyComposerGroupLinkMigration(testDb, migrationsDir);
  // The migration under test. Without it every `rejected` write below throws a
  // CHECK violation, which is the point: the status has to be admitted by the
  // schema before it can be written.
  applyComposerRejectedMigration(testDb, migrationsDir);
});
afterEach(async () => {
  await flush();
  testDb?.close();
  testDb = null;
});

/** Park a fresh run at its HIL gate with the stage already completed. */
function runParkedAtGate(): { runId: string; nodeRunId: string; nodeId: string } {
  const wf = createWorkflowFromDef(DEAD_END_GATE);
  const run = createComposerRun({ workflowId: wf.id, input: "ship it" });
  const gate = wf.nodes.find((n) => n.label === "Plan")!;
  const nodeRun = createNodeRun({
    composerRunId: run.id,
    nodeId: gate.id,
    attempt: 1,
    input: "ship it",
  });
  // finalizeComposerNodeRun's own output for a stage whose agent run succeeded.
  updateNodeRun(nodeRun.id, {
    status: "completed",
    output: "ok",
    completedAt: new Date().toISOString(),
  });
  updateComposerRun(run.id, { status: "awaiting_approval", currentNodeId: gate.id });
  return { runId: run.id, nodeRunId: nodeRun.id, nodeId: gate.id };
}

async function reject(runId: string, nodeId: string): Promise<void> {
  recordComposerApproval({ composerRunId: runId, nodeId, action: "reject" });
  updateComposerRun(runId, { status: "running" });
  await advanceComposerRun(runId);
}

describe("a rejected gate with no recovery edge", () => {
  it("ends the RUN as rejected, not as a failure", async () => {
    const { runId, nodeId } = runParkedAtGate();
    await reject(runId, nodeId);

    const run = getComposerRun(runId)!;
    expect(run.status).toBe("rejected");
    // The good sentence survives -- this is the part that already worked.
    expect(run.error).toMatch(/rejected/i);
    expect(run.completedAt).toBeTruthy();
  });

  it("ends the STAGE as rejected, so the canvas cannot draw it green", async () => {
    // The defect in one assertion. The node-run was left `completed` by
    // finalizeComposerNodeRun and applyNext never touched it, so
    // WorkflowRunCanvas's STATUS_BORDER lookup returned border-neon-green under
    // a pink "failed" header.
    const { runId, nodeId, nodeRunId } = runParkedAtGate();
    await reject(runId, nodeId);

    const stage = listNodeRuns(runId).find((n) => n.id === nodeRunId)!;
    expect(stage.status).toBe("rejected");
    expect(stage.status).not.toBe("completed");
  });

  it("is terminal, so the backstop cannot re-enter a finished run", async () => {
    const { runId, nodeId } = runParkedAtGate();
    await reject(runId, nodeId);

    const before = getComposerRun(runId)!;
    await advanceComposerRun(runId); // the tick's backstop pass
    const after = getComposerRun(runId)!;

    expect(after.status).toBe("rejected");
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(listNodeRuns(runId)).toHaveLength(1); // no second attempt started
  });
});

describe("a stage that genuinely failed is still a failure", () => {
  it("keeps its own status and error rather than being relabelled rejected", async () => {
    // The control that stops the fix over-reaching. `on_fail` with no edge takes
    // the SAME branch in applyNext, and a crashed stage carries a real cause
    // that the routing error must not overwrite.
    const wf = createWorkflowFromDef({
      key: "dead-end-fail",
      name: "Dead end fail",
      nodes: [
        { key: "s", label: "Step", kind: "custom", gate: "auto" as const, isStart: true },
        { key: "done", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
      ],
      edges: [{ from: "s", to: "done", condition: "on_pass" }],
    });
    const run = createComposerRun({ workflowId: wf.id, input: "x" });
    const node = wf.nodes.find((n) => n.label === "Step")!;
    const nodeRun = createNodeRun({
      composerRunId: run.id,
      nodeId: node.id,
      attempt: 1,
      input: "x",
    });
    updateNodeRun(nodeRun.id, {
      status: "failed",
      error: "the container died",
      completedAt: new Date().toISOString(),
    });
    updateComposerRun(run.id, { status: "running", currentNodeId: node.id });

    await advanceComposerRun(run.id);

    expect(getComposerRun(run.id)!.status).toBe("failed");
    const stage = listNodeRuns(run.id).find((n) => n.id === nodeRun.id)!;
    expect(stage.status).toBe("failed");
    expect(stage.error).toBe("the container died"); // not overwritten by the routing error
  });
});

describe("the terminal vocabulary is stated once", () => {
  it("classifies rejected as terminal", () => {
    // Three sites open-coded this list -- the engine's do-not-advance set,
    // settleGroupNode's did-the-child-end check, and the SSE route's
    // stop-streaming set. Adding `rejected` to the union alone would have hung a
    // parent's group stage on a rejected sub-workflow forever and left the event
    // stream open on a finished run.
    expect(isTerminalComposerRunStatus("rejected")).toBe(true);
    expect(TERMINAL_COMPOSER_RUN_STATUSES).toEqual(
      expect.arrayContaining(["completed", "failed", "cancelled", "rejected"]),
    );
    expect(isTerminalComposerRunStatus("awaiting_approval")).toBe(false);
    expect(isTerminalComposerRunStatus("running")).toBe(false);
  });
});

describe("the approve route explains the state it is refusing from", () => {
  async function approve(runId: string, nodeId: string) {
    const res = await approvePOST(
      { json: async () => ({ action: "accept" }) } as never,
      { params: Promise.resolve({ id: runId, nodeId }) },
    );
    return { status: res.status, body: (await res.json()) as { error?: string } };
  }

  it("names the rejection and repeats the reason, instead of 'not awaiting approval'", async () => {
    // The race this actually happens in: the gate panel renders from a polled
    // copy, so a run that ended between poll and click still shows Accept and
    // Reject. The click has to explain that the decision is already made.
    const { runId, nodeId } = runParkedAtGate();
    await reject(runId, nodeId);
    const stored = getComposerRun(runId)!.error!;

    const { status, body } = await approve(runId, nodeId);

    expect(status).toBe(400);
    expect(body.error).not.toBe("Run is not awaiting approval");
    expect(body.error).toMatch(/rejected/i);
    expect(body.error).toContain(stored); // the sentence the engine already wrote
  });

  it("reads differently for a run that completed", async () => {
    const { runId, nodeId } = runParkedAtGate();
    updateComposerRun(runId, { status: "completed" });

    const { status, body } = await approve(runId, nodeId);

    expect(status).toBe(400);
    expect(body.error).toMatch(/completed/i);
    expect(body.error).not.toMatch(/rejected/i);
  });

  it("still refuses a run that never reached its gate, and says which state it is in", async () => {
    const { runId, nodeId } = runParkedAtGate();
    updateComposerRun(runId, { status: "running" });

    const { status, body } = await approve(runId, nodeId);

    expect(status).toBe(400);
    expect(body.error).toContain("running");
  });

  it("GREEN CONTROL: a run genuinely at its gate is still accepted", async () => {
    // Load-bearing. It stops the fix being "refuse harder", and it is the only
    // assertion here that exercises the success path the feature exists for.
    const { runId, nodeId } = runParkedAtGate();

    const { status } = await approve(runId, nodeId);

    expect(status).toBe(200);
    expect(getComposerRun(runId)!.status).not.toBe("awaiting_approval");
  });
});

describe("the UI shows the refusal instead of swallowing it", () => {
  it("decideGate checks safeApiCall's result rather than discarding it", () => {
    // safeApiCall RETURNS { ok, error } rather than throwing, and the return
    // value was dropped on the floor. A better message written to a response
    // nobody reads is not an improvement: the 400 landed and nothing appeared on
    // screen at all -- the button simply stopped spinning.
    //
    // Source-shape, deliberately: the alternative is mounting a react-flow
    // canvas, and the behaviour that matters here (a 400 becomes visible text)
    // is asserted end-to-end by the route tests above plus this wiring check.
    const page = require("fs").readFileSync(
      join(process.cwd(), "src", "app", "orchestration", "composer", "page.tsx"),
      "utf-8",
    ) as string;
    const fn = page.slice(page.indexOf("async function decideGate"));
    const body = fn.slice(0, fn.indexOf("\n  }"));
    expect(body).toMatch(/res\.ok|result\.ok|\.ok\b/);
    expect(body).toMatch(/setGateError/);
    // …and the state it sets has to actually render.
    expect(page).toMatch(/gateError\s*\?/);
  });
});

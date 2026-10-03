/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// ═══════════════════════════════════════════════════════════════
// A stage badged HIL asks the human, even when the reviewing model said FAIL.
//
// THE DEFECT, found by running a real workflow. engine.ts treats "the stage
// crashed" and "the reviewing model wrote FAIL" as the same thing:
//
//   const stageFailed = current.status === "failed" || current.verdict?.pass === false;
//   if (node.gate === "hil" && !stageFailed) { …park at the gate… }
//
// So a FAIL verdict skips the gate entirely and routes on_fail. The seeded
// "Check the findings" gate has only on_approve and on_reject edges, so the run
// dead-ends and ENDS -- with the board still drawing an HIL badge on the stage
// that was supposed to wait for a person. The badge promises a decision the code
// never asks for.
//
// WHICH HALF IS WRONG. The behaviour. The badge, the seeded workflow's own edges
// (on_approve / on_reject and no on_fail), the gate concept doc and the run row's
// "waiting for you · at a gate" all say a person decides. The guard's own reason
// -- committed as "a human clicking Accept on a crashed stage could carry the run
// to completed with no artifact behind it" -- is about a stage whose RUN failed
// and left nothing behind. A FAIL verdict is not that: the stage ran, produced
// its output, and a model wrote a judgement on it. Overruling that judgement is
// the whole purpose of the gate.
//
// The crashed half is kept, and the last two describes are its controls.
// ═══════════════════════════════════════════════════════════════

import { openBaselineDb } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
jest.mock("@/lib/runtime", () => ({
  runtime: { submitRun: jest.fn(), getRun: jest.fn(), stopRun: jest.fn() },
}));

import { runtime } from "@/lib/runtime";
import {
  createComposerRun,
  createWorkflowFromDef,
  getComposerRun,
  getWorkflowGraph,
  listNodeRuns,
  maxAttemptForNode,
  recordComposerApproval,
  updateComposerRun,
} from "@/lib/composer/composer-repository";
import { advanceComposerRun, finalizeComposerNodeRun } from "@/lib/composer/engine";
import type { ComposerNodeRun } from "@/lib/composer/schema";

const mockSubmit = runtime.submitRun as jest.Mock;

/**
 * The shape of the seeded "Research then summarise" workflow: a stage, a HIL
 * gate of an assessing kind (so the model emits a PASS/FAIL verdict), the stage
 * that does the work, and the inert end marker. The first stage is `custom`
 * rather than `research` only so it dispatches as an ordinary agent run.
 */
const GATED = {
  key: "gated-wf",
  name: "Gated",
  nodes: [
    { key: "gather", label: "Gather", kind: "custom", gate: "auto" as const, isStart: true },
    { key: "gate", label: "Check the findings", kind: "review", gate: "hil" as const },
    { key: "write", label: "Write the summary", kind: "documentation", gate: "auto" as const },
    { key: "done", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
  ],
  edges: [
    { from: "gather", to: "gate", condition: "always" },
    { from: "gate", to: "write", condition: "on_approve" },
    { from: "gate", to: "gather", condition: "on_reject", label: "gather again" },
    { from: "write", to: "done", condition: "always" },
  ],
};

/** The same graph with the check on an AUTO gate, which must still route itself. */
const UNGATED = {
  ...GATED,
  key: "ungated-wf",
  name: "Ungated",
  nodes: GATED.nodes.map((n) => (n.key === "gate" ? { ...n, gate: "auto" as const } : n)),
  edges: [
    { from: "gather", to: "gate", condition: "always" },
    { from: "gate", to: "write", condition: "on_pass" },
    { from: "gate", to: "gather", condition: "on_fail", label: "gather again" },
    { from: "write", to: "done", condition: "always" },
  ],
};

const FAIL_OUTPUT = "The findings are thin.\nVERDICT: FAIL\nREASONS: no sources are cited";

beforeEach(() => {
  testDb = openBaselineDb([
    applyComposerMigration,
    applyComposerGroupLinkMigration,
  ]);
  mockSubmit.mockReset();
  mockSubmit.mockImplementation(async () => ({ runId: "b-" + Math.random().toString(36).slice(2), status: "started" }));
});
afterEach(() => {
  testDb?.close();
  testDb = null;
});

function runningNodeRun(composerRunId: string): ComposerNodeRun {
  const nr = listNodeRuns(composerRunId).find((r) => r.status === "running");
  if (!nr) throw new Error("no running node-run");
  return nr;
}

async function finishStage(composerRunId: string, output: string): Promise<void> {
  const nr = runningNodeRun(composerRunId);
  finalizeComposerNodeRun(nr.runId!, "completed", output, null);
  await advanceComposerRun(composerRunId);
}

/** Drive a fresh run up to the gate and settle the gate stage with `output`. */
async function runToTheGate(output: string, def = GATED) {
  const wf = createWorkflowFromDef(def);
  const graph = getWorkflowGraph(wf.id)!;
  const run = createComposerRun({
    workflowId: wf.id,
    input: "Give a short overview of what a CSV file is.",
  });
  await advanceComposerRun(run.id); // pending → running, dispatch 'gather'
  await finishStage(run.id, "Some findings."); // → dispatch the check
  await finishStage(run.id, output); // the check settles
  return { runId: run.id, graph };
}

function nodeIdFor(graph: { nodes: { id: string; key: string }[] }, key: string): string {
  return graph.nodes.find((n) => n.key === key)!.id;
}

function nodeRunsFor(runId: string, nodeId: string): ComposerNodeRun[] {
  return listNodeRuns(runId).filter((nr) => nr.nodeId === nodeId);
}

describe("a reviewer's FAIL at an HIL gate is put to the human", () => {
  it("parks the run at the gate instead of ending it", async () => {
    const { runId } = await runToTheGate(FAIL_OUTPUT);

    const run = getComposerRun(runId)!;
    expect(run.status).toBe("awaiting_approval");
    expect(run.completedAt).toBeNull();
  });

  it("does not kill the run with a failure nobody was asked about", async () => {
    const { runId } = await runToTheGate(FAIL_OUTPUT);

    const run = getComposerRun(runId)!;
    expect(run.status).not.toBe("failed");
    expect(run.error).toBeNull();
  });

  it("keeps the model's FAIL and its reasons, which are what the human judges", async () => {
    const { runId, graph } = await runToTheGate(FAIL_OUTPUT);

    const gateRun = nodeRunsFor(runId, nodeIdFor(graph, "gate")).at(-1)!;
    expect(gateRun.status).toBe("completed"); // the stage ran; only its judgement was negative
    expect(gateRun.verdict?.pass).toBe(false);
    expect(gateRun.verdict?.reasons.join(" ")).toMatch(/no sources are cited/i);
  });

  it("accepting over the FAIL carries the work on to the next stage", async () => {
    const { runId, graph } = await runToTheGate(FAIL_OUTPUT);

    recordComposerApproval({ composerRunId: runId, nodeId: nodeIdFor(graph, "gate"), action: "accept" });
    updateComposerRun(runId, { status: "running" }); // what the approve route does before advancing
    await advanceComposerRun(runId);

    expect(nodeRunsFor(runId, nodeIdFor(graph, "write"))).toHaveLength(1);
    expect(getComposerRun(runId)!.status).toBe("running");
  });

  it("rejecting sends the work back, which is what the reject route is for", async () => {
    const { runId, graph } = await runToTheGate(FAIL_OUTPUT);

    recordComposerApproval({ composerRunId: runId, nodeId: nodeIdFor(graph, "gate"), action: "reject" });
    updateComposerRun(runId, { status: "running" });
    await advanceComposerRun(runId);

    expect(maxAttemptForNode(runId, nodeIdFor(graph, "gather"))).toBe(2);
    expect(getComposerRun(runId)!.status).toBe("running");
  });

  it("GREEN CONTROL: a PASS at the gate still waits for the human", async () => {
    const { runId, graph } = await runToTheGate("All sound.\nVERDICT: PASS");

    expect(getComposerRun(runId)!.status).toBe("awaiting_approval");
    expect(nodeRunsFor(runId, nodeIdFor(graph, "write"))).toHaveLength(0);
  });
});

describe("CONTROL: the two cases that must NOT start asking a human", () => {
  it("a stage whose own run crashed is still a failure, with nothing to approve", async () => {
    // The reason the guard exists (committed with the 2026-07 silent-failure
    // batch): a crashed stage left no output behind, so an Accept on it could
    // carry the run to `completed` with no artifact. That half stands.
    const wf = createWorkflowFromDef(GATED);
    const graph = getWorkflowGraph(wf.id)!;
    const run = createComposerRun({ workflowId: wf.id, input: "x" });
    await advanceComposerRun(run.id);
    await finishStage(run.id, "Some findings."); // → dispatch the gate stage

    const gateRun = runningNodeRun(run.id);
    finalizeComposerNodeRun(gateRun.runId!, "failed", null, "the container died");
    await advanceComposerRun(run.id);

    const ended = getComposerRun(run.id)!;
    expect(ended.status).toBe("failed");
    expect(ended.status).not.toBe("awaiting_approval");
    expect(ended.error).toContain("Check the findings failed");
    expect(nodeRunsFor(run.id, nodeIdFor(graph, "write"))).toHaveLength(0);
  });

  it("an AUTO stage's FAIL still routes on its own, with no human in it", async () => {
    const { runId, graph } = await runToTheGate(FAIL_OUTPUT, UNGATED);

    expect(getComposerRun(runId)!.status).toBe("running");
    expect(getComposerRun(runId)!.status).not.toBe("awaiting_approval");
    expect(maxAttemptForNode(runId, nodeIdFor(graph, "gather"))).toBe(2); // looped back by itself
  });
});

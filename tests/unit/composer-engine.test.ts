/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// Walks the Composer graph engine through a PASS path + HIL gate + a FAIL
// loop-back, against REAL SQLite with a mocked runtime.

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    db: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});
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
import { advanceComposerRun, finalizeComposerNodeRun, resolveNext } from "@/lib/composer/engine";
import { dispatchComposerNode } from "@/lib/composer/dispatch";
import type { ComposerNodeRun } from "@/lib/composer/schema";

const mockSubmit = runtime.submitRun as jest.Mock;
const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

const SMALL = {
  key: "test-wf",
  name: "Test",
  nodes: [
    { key: "a", label: "A", kind: "custom", gate: "auto" as const, isStart: true },
    { key: "check", label: "Check", kind: "validate", gate: "auto" as const },
    { key: "gate", label: "Gate", kind: "plan", gate: "hil" as const },
    { key: "done", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
  ],
  edges: [
    { from: "a", to: "check", condition: "always" },
    { from: "check", to: "gate", condition: "on_pass" },
    { from: "check", to: "a", condition: "on_fail" },
    { from: "gate", to: "done", condition: "on_approve" },
    { from: "gate", to: "a", condition: "on_reject" },
  ],
};

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyComposerMigration(testDb, migrationsDir);
  applyComposerGroupLinkMigration(testDb, migrationsDir);
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

describe("composer engine", () => {
  it("walks PASS → HIL gate (accept) → terminal completion", async () => {
    const wf = createWorkflowFromDef(SMALL);
    const graph = getWorkflowGraph(wf.id)!;
    const gateNode = graph.nodes.find((n) => n.key === "gate")!;

    const run = createComposerRun({ workflowId: wf.id, input: "do X" });
    await advanceComposerRun(run.id); // pending → running, dispatch 'a'
    expect(runningNodeRun(run.id)).toBeTruthy();

    await finishStage(run.id, "did a"); // a (auto) → always → dispatch 'check'
    await finishStage(run.id, "all good\nVERDICT: PASS"); // check PASS → dispatch 'gate'
    await finishStage(run.id, "the plan"); // gate completes; gate is HIL → awaiting_approval
    expect(getComposerRun(run.id)!.status).toBe("awaiting_approval");

    recordComposerApproval({ composerRunId: run.id, nodeId: gateNode.id, action: "accept" });
    updateComposerRun(run.id, { status: "running" });
    await advanceComposerRun(run.id); // on_approve → 'done' (terminal) → completed

    expect(getComposerRun(run.id)!.status).toBe("completed");
    // 'done' is a terminal marker — it does not run an agent.
    expect(listNodeRuns(run.id).some((nr) => getWorkflowGraph(wf.id)!.nodes.find((n) => n.id === nr.nodeId)?.key === "done")).toBe(false);
  });

  it("loops back to a prior stage on a FAIL verdict (new attempt)", async () => {
    const wf = createWorkflowFromDef(SMALL);
    const aNode = getWorkflowGraph(wf.id)!.nodes.find((n) => n.key === "a")!;

    const run = createComposerRun({ workflowId: wf.id, input: "do X" });
    await advanceComposerRun(run.id); // dispatch 'a' (attempt 1)
    await finishStage(run.id, "did a"); // → 'check'
    await finishStage(run.id, "broken\nVERDICT: FAIL\nREASONS: x is wrong"); // FAIL → on_fail → loop to 'a'

    expect(maxAttemptForNode(run.id, aNode.id)).toBe(2);
    expect(getComposerRun(run.id)!.status).toBe("running");
  });

  it("fails with a readable error (label + reasons) when a stage dead-ends", async () => {
    const wf = createWorkflowFromDef({
      key: "deadend-wf",
      name: "Deadend",
      nodes: [
        { key: "a", label: "A", kind: "custom", gate: "auto" as const, isStart: true },
        { key: "assess", label: "Assess", kind: "validate", gate: "auto" as const },
        { key: "done", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
      ],
      edges: [
        { from: "a", to: "assess", condition: "always" },
        { from: "assess", to: "done", condition: "on_pass" },
        // no on_fail edge from 'assess' → a FAIL dead-ends the run
      ],
    });
    const run = createComposerRun({ workflowId: wf.id, input: "x" });
    await advanceComposerRun(run.id); // dispatch 'a'
    await finishStage(run.id, "did a"); // → 'assess'
    await finishStage(run.id, "nope\nVERDICT: FAIL\nREASONS: the goal is too vague");

    const failed = getComposerRun(run.id)!;
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("Assess failed: the goal is too vague");
    expect(failed.error).not.toContain("no recovery path");
  });

  it("stops a runaway loop at the per-node attempt cap", async () => {
    const wf = createWorkflowFromDef(SMALL);
    const graph = getWorkflowGraph(wf.id)!;
    const aNode = graph.nodes.find((n) => n.key === "a")!;
    const run = createComposerRun({ workflowId: wf.id, input: "x" });
    await advanceComposerRun(run.id); // dispatch 'a' (attempt 1)

    // Loop forever in principle: 'a' proceeds to 'check', 'check' always FAILs
    // and loops back to 'a'. The guardrail must stop it.
    for (let i = 0; i < 25; i++) {
      if (getComposerRun(run.id)!.status === "failed") break;
      const nr = runningNodeRun(run.id);
      const key = graph.nodes.find((n) => n.id === nr.nodeId)!.key;
      const output = key === "check" ? "broken\nVERDICT: FAIL\nREASONS: still wrong" : "did a";
      finalizeComposerNodeRun(nr.runId!, "completed", output, null);
      await advanceComposerRun(run.id);
    }

    const failed = getComposerRun(run.id)!;
    expect(failed.status).toBe("failed");
    expect(failed.error).toMatch(/exceeded 5 attempts/i);
    expect(maxAttemptForNode(run.id, aNode.id)).toBeLessThanOrEqual(5); // capped, not unbounded
  });

  it("pauses for clarification on a vague objective, then resumes on an answer", async () => {
    const wf = createWorkflowFromDef({
      key: "clarify-wf",
      name: "Clarify",
      nodes: [
        { key: "ask", label: "Ask", kind: "review", gate: "auto" as const, isStart: true },
        { key: "done", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
      ],
      edges: [{ from: "ask", to: "done", condition: "on_pass" }],
    });
    const run = createComposerRun({ workflowId: wf.id, input: "Hydrogen Report" });
    await advanceComposerRun(run.id); // dispatch 'ask'

    // 'ask' can't proceed → asks the user a question instead of dead-ending.
    await finishStage(run.id, "Too vague.\nOUTCOME: needs_clarification\nQUESTION: What subject and length?");
    const paused = getComposerRun(run.id)!;
    expect(paused.status).toBe("awaiting_approval");
    expect((paused.context?.__clarify as { question?: string }).question).toMatch(/subject and length/i);

    // Simulate the /clarify route: enrich the objective, clear the marker, re-run 'ask'.
    const askNode = getWorkflowGraph(wf.id)!.nodes.find((n) => n.key === "ask")!;
    const ctx = { ...(paused.context ?? {}) };
    delete (ctx as Record<string, unknown>).__clarify;
    updateComposerRun(run.id, {
      status: "running",
      input: `${paused.input}\n\n## Clarification\nA 500-word report on hydrogen energy.`,
      context: ctx,
      currentNodeId: askNode.id,
    });
    await dispatchComposerNode(run.id, askNode.id);

    // 'ask' now passes with the clarified objective → completes.
    await finishStage(run.id, "Clear now.\nVERDICT: PASS");
    expect(getComposerRun(run.id)!.status).toBe("completed");
  });

  it("resolveNext routes by approval then verdict", () => {
    const wf = createWorkflowFromDef(SMALL);
    const graph = getWorkflowGraph(wf.id)!;
    const check = graph.nodes.find((n) => n.key === "check")!;
    const gate = graph.nodes.find((n) => n.key === "gate")!;

    const failRun = { status: "completed", verdict: { pass: false, reasons: [], suggestions: [] } } as ComposerNodeRun;
    const passRun = { status: "completed", verdict: { pass: true, reasons: [], suggestions: [] } } as ComposerNodeRun;
    expect(resolveNext(check, failRun, null)).toEqual({ kind: "node", nodeId: graph.nodes.find((n) => n.key === "a")!.id });
    expect(resolveNext(check, passRun, null)).toEqual({ kind: "node", nodeId: gate.id });

    const reject = { approved: false } as never;
    expect(resolveNext(gate, passRun, reject)).toEqual({ kind: "node", nodeId: graph.nodes.find((n) => n.key === "a")!.id });
  });
});

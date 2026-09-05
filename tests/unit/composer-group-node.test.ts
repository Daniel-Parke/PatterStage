/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 1.5-B3b — a Composer "group" node runs a referenced sub-workflow as a
// nested ComposerRun; the engine settles the group stage when the child run
// finishes, and recursion is blocked.

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";

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
  runtime: { submitRun: jest.fn(async () => ({ runId: "b1", status: "started" })), getRun: jest.fn(), stopRun: jest.fn() },
}));

import {
  createComposerRun,
  createWorkflowFromDef,
  getComposerRun,
  getComposerRunByParentNodeRunId,
  listNodeRuns,
  updateComposerRun,
} from "@/lib/composer/composer-repository";
import { advanceComposerRun } from "@/lib/composer/engine";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");
const flush = () => new Promise((r) => setTimeout(r, 30)); // let the async child-advance settle

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyComposerMigration(testDb, migrationsDir); // v21 composer tables (+ runs.composer_node_run_id)
  applyComposerGroupLinkMigration(testDb, migrationsDir); // v26 composer_runs.parent_node_run_id
});
afterEach(async () => {
  await flush();
  testDb?.close();
  testDb = null;
});

const CHILD = {
  key: "child-wf",
  name: "Child",
  nodes: [
    { key: "c1", label: "Step", kind: "custom", gate: "auto" as const, isStart: true },
    { key: "cdone", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
  ],
  edges: [{ from: "c1", to: "cdone", condition: "always" }],
};

function parentDef(childId: string) {
  return {
    key: "parent-wf",
    name: "Parent",
    nodes: [
      { key: "grp", label: "Sub", kind: "group", gate: "auto" as const, isStart: true, config: { workflowRef: childId } },
      { key: "pdone", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
    ],
    edges: [{ from: "grp", to: "pdone", condition: "on_pass" }],
  };
}

describe("composer group node", () => {
  it("runs a sub-workflow run (no agent run for the group) and settles on child completion", async () => {
    const child = createWorkflowFromDef(CHILD);
    const parent = createWorkflowFromDef(parentDef(child.id));
    const run = createComposerRun({ workflowId: parent.id, input: "go" });

    await advanceComposerRun(run.id); // dispatch the group node
    await flush();

    const grpNodeRun = listNodeRuns(run.id).find((nr) => nr.status === "running")!;
    expect(grpNodeRun.runId).toBeNull(); // the GROUP node itself has no agent run
    const childRun = getComposerRunByParentNodeRunId(grpNodeRun.id)!;
    expect(childRun.workflowId).toBe(child.id);
    expect(childRun.parentNodeRunId).toBe(grpNodeRun.id);

    // Force the child to a terminal state, then settle the parent group stage.
    updateComposerRun(childRun.id, { status: "completed", context: { result: "ok" } });
    await advanceComposerRun(run.id);

    const settled = listNodeRuns(run.id).find((nr) => nr.nodeId === grpNodeRun.nodeId)!;
    expect(settled.status).toBe("completed");
    expect(getComposerRun(run.id)!.status).toBe("completed");
    expect(getComposerRun(run.id)!.context?.grp).toEqual({ result: "ok" });
  });

  it("fails the group stage when the sub-workflow fails", async () => {
    const child = createWorkflowFromDef(CHILD);
    const parent = createWorkflowFromDef(parentDef(child.id));
    const run = createComposerRun({ workflowId: parent.id, input: "go" });
    await advanceComposerRun(run.id);
    await flush();

    const grpNodeRun = listNodeRuns(run.id).find((nr) => nr.status === "running")!;
    const childRun = getComposerRunByParentNodeRunId(grpNodeRun.id)!;
    updateComposerRun(childRun.id, { status: "failed", error: "child blew up" });
    await advanceComposerRun(run.id);

    expect(listNodeRuns(run.id).find((nr) => nr.nodeId === grpNodeRun.nodeId)!.status).toBe("failed");
    // No on_fail edge from the group → the run fails (no recovery path).
    expect(getComposerRun(run.id)!.status).toBe("failed");
  });

  it("blocks recursion: a group node referencing its own workflow fails", async () => {
    // Create the workflow, then re-create it referencing its own id (idempotent by key).
    const wf = createWorkflowFromDef({
      key: "self-wf",
      name: "Self",
      nodes: [
        { key: "g", label: "Self", kind: "group", gate: "auto", isStart: true, config: {} },
        { key: "d", label: "Done", kind: "custom", gate: "auto", isTerminal: true },
      ],
      edges: [{ from: "g", to: "d", condition: "on_pass" }],
    });
    createWorkflowFromDef({
      key: "self-wf",
      name: "Self",
      nodes: [
        { key: "g", label: "Self", kind: "group", gate: "auto", isStart: true, config: { workflowRef: wf.id } },
        { key: "d", label: "Done", kind: "custom", gate: "auto", isTerminal: true },
      ],
      edges: [{ from: "g", to: "d", condition: "on_pass" }],
    });

    const run = createComposerRun({ workflowId: wf.id, input: "go" });
    await advanceComposerRun(run.id);
    await flush();

    const grpNodeRun = listNodeRuns(run.id).find((nr) => nr.nodeId !== null)!;
    expect(grpNodeRun.status).toBe("failed");
    expect(grpNodeRun.error).toMatch(/recursion/i);
    // No child run was spawned.
    expect(getComposerRunByParentNodeRunId(grpNodeRun.id)).toBeNull();
  });
});

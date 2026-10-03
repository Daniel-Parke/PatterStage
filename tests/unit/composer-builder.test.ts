/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 1.5-B — the workflow builder (whole-graph replace + guards) and the
// conditional branch routing (OUTCOME → on_<outcome>), backward-compatible.

import { openBaselineDb } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";

let testDb: import("better-sqlite3").Database | null = null;
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
jest.mock("@/lib/runtime", () => ({
  runtime: { submitRun: jest.fn(), getRun: jest.fn(), stopRun: jest.fn() },
}));

import {
  createComposerRun,
  createWorkflowFromDef,
  deleteWorkflow,
  getWorkflowGraph,
  replaceWorkflowGraph,
  workflowHasActiveRuns,
} from "@/lib/composer/composer-repository";
import { resolveNext } from "@/lib/composer/engine";
import { parseVerdict } from "@/lib/composer/verdict";
import type { ComposerNodeRun } from "@/lib/composer/schema";

const BRANCHY = {
  key: "branchy",
  name: "Branchy",
  nodes: [
    { key: "triage", label: "Triage", kind: "review", gate: "auto" as const, isStart: true },
    { key: "fix", label: "Fix", kind: "implement", gate: "auto" as const },
    { key: "report", label: "Report", kind: "custom", gate: "auto" as const },
    { key: "done", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
  ],
  edges: [
    { from: "triage", to: "fix", condition: "on_implement_fix" },
    { from: "triage", to: "report", condition: "on_write_report" },
    { from: "triage", to: "done", condition: "on_pass" },
    { from: "fix", to: "done", condition: "always" },
    { from: "report", to: "done", condition: "always" },
  ],
};

beforeEach(() => {
  testDb = openBaselineDb([
    applyComposerMigration,
    applyComposerGroupLinkMigration,
  ]);
});
afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("composer builder — whole-graph save", () => {
  it("replaces nodes/edges and bumps version", () => {
    const wf = createWorkflowFromDef({
      key: "wf",
      name: "WF",
      nodes: [{ key: "a", label: "A", kind: "custom", gate: "auto", isStart: true, isTerminal: true }],
      edges: [],
    });
    expect(getWorkflowGraph(wf.id)!.nodes).toHaveLength(1);

    const replaced = replaceWorkflowGraph(wf.id, {
      key: "wf",
      name: "WF v2",
      nodes: [
        { key: "x", label: "X", kind: "custom", gate: "auto", isStart: true },
        { key: "y", label: "Y", kind: "custom", gate: "auto", isTerminal: true },
      ],
      edges: [{ from: "x", to: "y", condition: "always" }],
    })!;
    expect(replaced.name).toBe("WF v2");
    expect(replaced.version).toBe(2);
    expect(replaced.nodes.map((n) => n.key).sort()).toEqual(["x", "y"]);
    expect(replaced.edges).toHaveLength(1);
  });

  it("flags active runs and deletes the whole graph", () => {
    const wf = createWorkflowFromDef(BRANCHY);
    expect(workflowHasActiveRuns(wf.id)).toBe(false);
    createComposerRun({ workflowId: wf.id, input: "go" }); // 'pending' = active
    expect(workflowHasActiveRuns(wf.id)).toBe(true);

    expect(deleteWorkflow(wf.id)).toBe(true);
    expect(getWorkflowGraph(wf.id)).toBeNull();
  });
});

describe("composer branch routing (OUTCOME)", () => {
  it("parseVerdict reads an OUTCOME marker on any node kind", () => {
    expect(parseVerdict("done\nOUTCOME: write_report", "custom")).toMatchObject({
      pass: true,
      outcome: "write_report",
    });
    // No marker on a non-assessing kind → null (engine treats it as on_pass).
    expect(parseVerdict("just text", "custom")).toBeNull();
  });

  it("resolveNext follows on_<outcome>, falling back to on_pass for unknown outcomes", () => {
    const wf = createWorkflowFromDef(BRANCHY);
    const g = getWorkflowGraph(wf.id)!;
    const triage = g.nodes.find((n) => n.key === "triage")!;
    const fix = g.nodes.find((n) => n.key === "fix")!;
    const done = g.nodes.find((n) => n.key === "done")!;

    const withOutcome = (o: string) =>
      ({ status: "completed", verdict: { pass: true, reasons: [], suggestions: [], outcome: o } }) as unknown as ComposerNodeRun;

    expect(resolveNext(triage, withOutcome("implement_fix"), null)).toEqual({ kind: "node", nodeId: fix.id });
    // Unknown outcome → on_pass edge (triage → done).
    expect(resolveNext(triage, withOutcome("nonsense"), null)).toEqual({ kind: "node", nodeId: done.id });
    // No outcome → on_pass (backward-compatible with existing workflows).
    const plain = { status: "completed", verdict: { pass: true, reasons: [], suggestions: [] } } as unknown as ComposerNodeRun;
    expect(resolveNext(triage, plain, null)).toEqual({ kind: "node", nodeId: done.id });
  });
});

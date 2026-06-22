/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// CRUD + graph-navigation coverage for the Composer repository (real SQLite;
// the @/lib/db singleton is mocked to a fresh in-memory DB per test).

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";
import {
  createComposerRun,
  createNodeRun,
  createWorkflowFromDef,
  getNodeRunByRunId,
  getOutgoingEdges,
  getStartNode,
  getWorkflowByKey,
  getWorkflowGraph,
  listComposerApprovals,
  recordComposerApproval,
  updateNodeRun,
} from "@/lib/composer/composer-repository";
import { ensureDefaultComposerWorkflows } from "@/lib/composer/seed";
import { DEFAULT_SOFTWARE_DELIVERY_WORKFLOW, SOFTWARE_DELIVERY_WORKFLOW_KEY, getInputSpec } from "@/lib/composer/schema";

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

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb); // missions + runs, schema_version 3
  applyComposerMigration(testDb, migrationsDir); // composer tables + runs column
  applyComposerGroupLinkMigration(testDb, migrationsDir); // composer_runs.parent_node_run_id (v26)
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("composer-repository", () => {
  it("seeds the Software Delivery workflow graph idempotently", () => {
    ensureDefaultComposerWorkflows();
    ensureDefaultComposerWorkflows(); // idempotent

    const wf = getWorkflowByKey(SOFTWARE_DELIVERY_WORKFLOW_KEY);
    expect(wf).not.toBeNull();
    const graph = getWorkflowGraph(wf!.id)!;
    expect(graph.nodes).toHaveLength(DEFAULT_SOFTWARE_DELIVERY_WORKFLOW.nodes.length);
    expect(graph.edges).toHaveLength(DEFAULT_SOFTWARE_DELIVERY_WORKFLOW.edges.length);

    const start = getStartNode(wf!.id)!;
    expect(start.key).toBe("review");

    // The final-assessment node has both a pass and a fail (loop-back) edge.
    const finalNode = graph.nodes.find((n) => n.key === "final_assessment")!;
    const outs = getOutgoingEdges(finalNode.id);
    expect(outs.map((e) => e.condition).sort()).toEqual(["on_fail", "on_pass"]);
  });

  it("seeds the Software-Delivery input contract on the start node", () => {
    ensureDefaultComposerWorkflows();
    const wf = getWorkflowByKey(SOFTWARE_DELIVERY_WORKFLOW_KEY)!;
    const spec = getInputSpec(getWorkflowGraph(wf.id)!);
    expect(spec.objectiveLabel).toBe("Feature request / bug report");
    expect(spec.examples.length).toBeGreaterThan(0);
  });

  it("getInputSpec falls back to a generic default when the start node has no contract", () => {
    const wf = createWorkflowFromDef({
      key: "no-spec",
      name: "No spec",
      nodes: [{ key: "a", label: "A", kind: "custom", gate: "auto", isStart: true }],
      edges: [],
    });
    expect(getInputSpec(wf).objectiveLabel).toBe("Objective");
  });

  it("back-fills the input contract onto an older seeded workflow (idempotent)", () => {
    // Simulate a pre-contract install: the seeded workflow without inputSpec.
    const oldDef = {
      ...DEFAULT_SOFTWARE_DELIVERY_WORKFLOW,
      nodes: DEFAULT_SOFTWARE_DELIVERY_WORKFLOW.nodes.map((n) => (n.isStart ? { ...n, config: undefined } : n)),
    };
    createWorkflowFromDef(oldDef);
    const wfId = getWorkflowByKey(SOFTWARE_DELIVERY_WORKFLOW_KEY)!.id;
    expect(getInputSpec(getWorkflowGraph(wfId)!).objectiveLabel).toBe("Objective"); // default

    ensureDefaultComposerWorkflows(); // back-fills the contract
    ensureDefaultComposerWorkflows(); // idempotent

    const after = getWorkflowGraph(getWorkflowByKey(SOFTWARE_DELIVERY_WORKFLOW_KEY)!.id)!;
    expect(getInputSpec(after).objectiveLabel).toBe("Feature request / bug report");
  });

  it("back-fills the recovery edges into an older seeded workflow (idempotent)", () => {
    // Simulate an install seeded BEFORE the recovery edges shipped: same key,
    // but the research/hypothesise on_fail edges stripped out.
    const oldDef = {
      ...DEFAULT_SOFTWARE_DELIVERY_WORKFLOW,
      edges: DEFAULT_SOFTWARE_DELIVERY_WORKFLOW.edges.filter((e) => e.condition !== "on_fail" || (e.from !== "research" && e.from !== "hypothesise")),
    };
    const seeded = createWorkflowFromDef(oldDef);
    const research = seeded.nodes.find((n) => n.key === "research")!;
    expect(getOutgoingEdges(research.id).some((e) => e.condition === "on_fail")).toBe(false);

    ensureDefaultComposerWorkflows(); // back-fills the recovery edges
    ensureDefaultComposerWorkflows(); // idempotent — no duplicates

    const wf = getWorkflowByKey(SOFTWARE_DELIVERY_WORKFLOW_KEY)!;
    const graph = getWorkflowGraph(wf.id)!;
    const researchOut = getOutgoingEdges(graph.nodes.find((n) => n.key === "research")!.id);
    const onFail = researchOut.filter((e) => e.condition === "on_fail");
    expect(onFail).toHaveLength(1);
    expect(graph.nodes.find((n) => n.id === onFail[0].toNodeId)!.key).toBe("hypothesise");
    expect(getOutgoingEdges(graph.nodes.find((n) => n.key === "hypothesise")!.id).filter((e) => e.condition === "on_fail")).toHaveLength(1);
  });

  it("re-creating a keyed workflow bumps the version and replaces the graph", () => {
    const g1 = createWorkflowFromDef({ key: "k", name: "W", nodes: [{ key: "a", label: "A", kind: "custom", gate: "auto", isStart: true }], edges: [] });
    expect(g1.version).toBe(1);
    const g2 = createWorkflowFromDef({ key: "k", name: "W2", nodes: [{ key: "b", label: "B", kind: "custom", gate: "auto", isStart: true }], edges: [] });
    expect(g2.version).toBe(2);
    expect(g2.name).toBe("W2");
    expect(g2.nodes.map((n) => n.key)).toEqual(["b"]);
  });

  it("runs a node-run lifecycle: create → verdict → reconcile-by-run-id → approval", () => {
    ensureDefaultComposerWorkflows();
    const wf = getWorkflowByKey(SOFTWARE_DELIVERY_WORKFLOW_KEY)!;
    const start = getStartNode(wf.id)!;

    const run = createComposerRun({ workflowId: wf.id, input: "Add dark mode", currentNodeId: start.id });
    expect(run.status).toBe("pending");

    const nodeRun = createNodeRun({ composerRunId: run.id, nodeId: start.id, attempt: 1 });
    testDb!.prepare("INSERT INTO runs (id) VALUES ('r1')").run();
    updateNodeRun(nodeRun.id, { status: "completed", runId: "r1", output: "ok", verdict: { pass: true, reasons: [], suggestions: [] } });

    expect(getNodeRunByRunId("r1")?.id).toBe(nodeRun.id);
    expect(getNodeRunByRunId("r1")?.verdict?.pass).toBe(true);

    recordComposerApproval({ composerRunId: run.id, nodeId: start.id, action: "accept", note: "lgtm" });
    const approvals = listComposerApprovals(run.id);
    expect(approvals).toHaveLength(1);
    expect(approvals[0].approved).toBe(true);
  });
});

/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3 is resolution-mapped to a stub for the suite; the real CJS entry is required directly here, exactly as composer-builder.test.ts does, so the seed runs against real SQL */
// ═══════════════════════════════════════════════════════════════
// B12 oracle, group starters.
//
// Written before the product code moved. Contract section 7: a fresh install
// ships three workflows, not one. "Software Delivery" is a sixteen-stage
// software pipeline; a first-time user with a research question or a piece of
// writing has nothing to press, and building a graph by hand is not a first
// run. So: "Research then summarise" (research -> gate -> write) and "Draft
// and review" (draft -> review).
//
// The seed path is the one that already exists: a keyed WorkflowDef constant
// in schema.ts, created by key in ensureDefaultComposerWorkflows(). Keyed is
// what makes the second boot a no-op, so idempotence is asserted by running
// the seed twice and reading the versions, not by trusting the guard.
//
// The shapes are asserted, not just the names, because the two starters exist
// to demonstrate the two things Composer does that a single linear pipeline
// does not: a human gate that can send the run back, and a loop that revises.
// A "Draft and review" whose reviewer is terminal would demonstrate neither --
// resolveNext returns `complete` for a terminal node BEFORE it reads a single
// edge, so a terminal reviewer's FAIL could never reach the draft.
// ═══════════════════════════════════════════════════════════════

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
  runtime: { submitRun: jest.fn(), getRun: jest.fn(), stopRun: jest.fn() },
}));

import {
  getWorkflowByKey,
  getWorkflowGraph,
  listWorkflows,
} from "@/lib/composer/composer-repository";
import { ensureDefaultComposerWorkflows } from "@/lib/composer/seed";
import { getInputSpec } from "@/lib/composer/schema";
import type { ComposerWorkflowGraph } from "@/lib/composer/schema";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

const RESEARCH_KEY = "research-then-summarise-v1";
const DRAFT_KEY = "draft-and-review-v1";

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyComposerMigration(testDb, migrationsDir);
  applyComposerGroupLinkMigration(testDb, migrationsDir);
});
afterEach(() => {
  testDb?.close();
  testDb = null;
});

function graphFor(key: string): ComposerWorkflowGraph {
  const wf = getWorkflowByKey(key);
  if (!wf) throw new Error(`no workflow seeded for key ${key}`);
  return getWorkflowGraph(wf.id)!;
}

/** Edges as `from -> to (condition)` on node KEYS, which is how the def reads. */
function edgeSpecs(graph: ComposerWorkflowGraph): string[] {
  const keyById = new Map(graph.nodes.map((n) => [n.id, n.key]));
  return graph.edges
    .map((e) => `${keyById.get(e.fromNodeId)} -> ${keyById.get(e.toNodeId)} (${e.condition})`)
    .sort();
}

describe("a fresh install ships two starter workflows beside Software Delivery", () => {
  it("both are seeded, named as the plan names them", () => {
    ensureDefaultComposerWorkflows();

    expect(getWorkflowByKey(RESEARCH_KEY)?.name).toBe("Research then summarise");
    expect(getWorkflowByKey(DRAFT_KEY)?.name).toBe("Draft and review");
  });

  it("each says what it is for, so the Run form's preview is not blank", () => {
    ensureDefaultComposerWorkflows();

    expect((getWorkflowByKey(RESEARCH_KEY)?.description ?? "").trim().length).toBeGreaterThan(0);
    expect((getWorkflowByKey(DRAFT_KEY)?.description ?? "").trim().length).toBeGreaterThan(0);
  });

  it('"Research then summarise" is research -> gate -> write, and the gate is a human one', () => {
    ensureDefaultComposerWorkflows();
    const graph = graphFor(RESEARCH_KEY);

    const byKey = new Map(graph.nodes.map((n) => [n.key, n]));
    expect([...byKey.keys()].sort()).toEqual(["gate", "research", "write"]);
    expect(byKey.get("research")!.kind).toBe("research");
    expect(byKey.get("research")!.isStart).toBe(true);
    expect(byKey.get("gate")!.gate).toBe("hil");
    expect(byKey.get("write")!.isTerminal).toBe(true);
  });

  it('"Research then summarise" sends a rejected gate back to the research, not off a cliff', () => {
    ensureDefaultComposerWorkflows();

    expect(edgeSpecs(graphFor(RESEARCH_KEY))).toEqual([
      "gate -> research (on_reject)",
      "gate -> write (on_approve)",
      "research -> gate (always)",
    ]);
  });

  it('"Draft and review" loops a failed review back to the draft, and its reviewer is not terminal', () => {
    ensureDefaultComposerWorkflows();
    const graph = graphFor(DRAFT_KEY);
    const byKey = new Map(graph.nodes.map((n) => [n.key, n]));

    expect(byKey.get("draft")!.isStart).toBe(true);
    expect(byKey.get("review")!.kind).toBe("review");
    // A terminal reviewer short-circuits resolveNext and the loop below is dead.
    expect(byKey.get("review")!.isTerminal).toBe(false);
    expect(edgeSpecs(graph)).toContain("review -> draft (on_fail)");
  });

  it("both declare their own input contract, so the Run form is not asking for a feature request", () => {
    ensureDefaultComposerWorkflows();

    const research = getInputSpec(graphFor(RESEARCH_KEY));
    const draft = getInputSpec(graphFor(DRAFT_KEY));

    expect(research.objectiveLabel).not.toBe("Objective");
    expect(draft.objectiveLabel).not.toBe("Objective");
    expect(research.objectiveLabel).not.toBe(draft.objectiveLabel);
    expect(research.examples.length).toBeGreaterThan(0);
  });

  it("seeding twice writes nothing the second time", () => {
    ensureDefaultComposerWorkflows();
    const first = listWorkflows().map((w) => `${w.key}@${w.version}`).sort();

    ensureDefaultComposerWorkflows();

    expect(listWorkflows().map((w) => `${w.key}@${w.version}`).sort()).toEqual(first);
    expect(listWorkflows()).toHaveLength(3);
  });

  it("GREEN CONTROL: Software Delivery is still seeded, unchanged", () => {
    ensureDefaultComposerWorkflows();

    const wf = getWorkflowByKey("software-delivery-v1");
    expect(wf?.name).toBe("Software Delivery");
    expect(graphFor("software-delivery-v1").nodes).toHaveLength(16);
  });
});

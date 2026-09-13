/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3 is resolution-mapped to a stub for the suite; the real CJS entry is required directly, exactly as b12-starter-workflows.test.ts does, so the seed runs against real SQL */
// ═══════════════════════════════════════════════════════════════
// T-0113: an install that already booted keeps the broken workflow otherwise.
//
// Fixing the seed DEFINITION fixes a fresh install. The seeder is idempotent by
// key -- its own comment says "a second call writes nothing" -- so every install
// that has already started once keeps the workflow it was first given, and for
// "Research then summarise" that is one which reports success without ever
// writing the summary. A fix that only reaches people who have not used the
// product yet is not a fix.
//
// The repair is safe to apply unasked, which is why it can be automatic: a
// terminal stage with a working kind is a shape the engine cannot honour and the
// Build tab now refuses, so it cannot be something an operator chose. It is a
// defect wherever it is found. Run history is untouched -- the repair moves the
// End marker rather than recreating the workflow.
//
// The "old install" is reproduced with raw SQL on purpose: that state can no
// longer be reached through the product's own API, which is the point of having
// fixed it.
// ═══════════════════════════════════════════════════════════════

import { openBaselineDb } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";

let testDb: import("better-sqlite3").Database | null = null;
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
jest.mock("@/lib/runtime", () => ({
  runtime: { submitRun: jest.fn(), getRun: jest.fn(), stopRun: jest.fn() },
}));

import {
  getWorkflowByKey,
  listWorkflowNodes,
  listWorkflowEdges,
} from "@/lib/composer/composer-repository";
import { ensureDefaultComposerWorkflows } from "@/lib/composer/seed";
import { RESEARCH_SUMMARISE_WORKFLOW_KEY } from "@/lib/composer/schema";

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

function nodesFor(key: string) {
  const wf = getWorkflowByKey(key);
  if (!wf) throw new Error(`no workflow seeded for key ${key}`);
  return { wf, nodes: listWorkflowNodes(wf.id), edges: listWorkflowEdges(wf.id) };
}

describe("a workflow seeded before the fix is repaired in place", () => {
  it("GREEN CONTROL: a fresh seed already ends on an inert marker", () => {
    ensureDefaultComposerWorkflows();
    const { nodes } = nodesFor(RESEARCH_SUMMARISE_WORKFLOW_KEY);

    expect(nodes.find((n) => n.key === "write")!.isTerminal).toBe(false);
    expect(nodes.some((n) => n.isTerminal && n.kind === "custom")).toBe(true);
  });

  it("clears End from a stage that does work, and gives the run somewhere to stop", () => {
    ensureDefaultComposerWorkflows();
    const { wf, nodes } = nodesFor(RESEARCH_SUMMARISE_WORKFLOW_KEY);
    const write = nodes.find((n) => n.key === "write")!;
    const done = nodes.find((n) => n.key === "done")!;

    // Put the install back exactly as it shipped: the deliverable is the end of
    // the road, and the marker after it never existed.
    testDb!.prepare("DELETE FROM composer_edges WHERE to_node_id = ?").run(done.id);
    testDb!.prepare("DELETE FROM composer_nodes WHERE id = ?").run(done.id);
    testDb!.prepare("UPDATE composer_nodes SET is_terminal = 1 WHERE id = ?").run(write.id);

    const broken = listWorkflowNodes(wf.id);
    expect(broken.find((n) => n.key === "write")!.isTerminal).toBe(true);
    expect(broken.some((n) => n.key === "done")).toBe(false);

    // Boot again.
    ensureDefaultComposerWorkflows();

    const after = listWorkflowNodes(wf.id);
    const writeAfter = after.find((n) => n.key === "write")!;
    expect(writeAfter.isTerminal).toBe(false);

    const terminal = after.find((n) => n.isTerminal);
    expect(terminal).toBeDefined();
    expect(terminal!.kind).toBe("custom");

    // And the deliverable must route to it, or the run has no end at all.
    expect(
      listWorkflowEdges(wf.id).some((e) => e.fromNodeId === writeAfter.id && e.toNodeId === terminal!.id),
    ).toBe(true);
  });

  it("leaves a sound workflow completely alone, however many times it boots", () => {
    ensureDefaultComposerWorkflows();
    const first = nodesFor(RESEARCH_SUMMARISE_WORKFLOW_KEY);
    const before = { nodes: first.nodes.length, edges: first.edges.length };

    ensureDefaultComposerWorkflows();
    ensureDefaultComposerWorkflows();

    const again = nodesFor(RESEARCH_SUMMARISE_WORKFLOW_KEY);
    expect({ nodes: again.nodes.length, edges: again.edges.length }).toEqual(before);
  });
});

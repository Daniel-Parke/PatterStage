/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// ═══════════════════════════════════════════════════════════════
// The artifact a run files is the work, not the commentary on the work.
//
// THE DEFECT, found by running a real workflow. captureComposerArtifact files
// `fromNodeRun.output` -- whatever stage happened to route to the end -- under
// the run's objective as its name and "Composer run output" as its description.
// "Draft and review" ends on its REVIEWER, so what was filed as the run's
// deliverable was the critique of the deliverable, named after the objective as
// though it were the thing itself. The draft, the only thing anyone wanted to
// keep, was filed nowhere.
//
// THE RULE THIS PINS: the deliverable is the last completed stage that PRODUCED
// work rather than judged it, and the name says which stage that was. The
// artifacts list renders the name and never the description, so the name is
// where the honesty has to live.
//
// It agrees with the fix already made this round -- the starter workflow now
// ends on an inert `done` marker so its `write` stage actually runs -- and the
// second describe below is that workflow's shape, pinned so the two cannot
// drift apart.
// ═══════════════════════════════════════════════════════════════

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";
import { applyArtifactsMigration } from "@/lib/db/sql-migrations";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
jest.mock("@/lib/runtime", () => ({
  runtime: { submitRun: jest.fn(), getRun: jest.fn(), stopRun: jest.fn() },
}));

import { runtime } from "@/lib/runtime";
import { getArtifact, listArtifacts } from "@/lib/runs/artifacts-repository";
import {
  createComposerRun,
  createWorkflowFromDef,
  getComposerRun,
  getWorkflowGraph,
  listNodeRuns,
  recordComposerApproval,
  updateComposerRun,
} from "@/lib/composer/composer-repository";
import { advanceComposerRun, finalizeComposerNodeRun } from "@/lib/composer/engine";
import type { ComposerNodeRun } from "@/lib/composer/schema";

const mockSubmit = runtime.submitRun as jest.Mock;
const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

/** The shape of the seeded "Draft and review": the reviewer routes to the end. */
const DRAFT_REVIEW = {
  key: "draft-review-wf",
  name: "Draft and review",
  nodes: [
    { key: "draft", label: "Draft", kind: "custom", gate: "auto" as const, isStart: true },
    { key: "review", label: "Review", kind: "review", gate: "auto" as const },
    { key: "done", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
  ],
  edges: [
    { from: "draft", to: "review", condition: "always" },
    { from: "review", to: "done", condition: "on_pass" },
    { from: "review", to: "draft", condition: "on_fail", label: "revise" },
  ],
};

/** The shape of the seeded "Research then summarise", gate and all. */
const RESEARCH_SUMMARISE = {
  key: "research-summarise-wf",
  name: "Research then summarise",
  nodes: [
    { key: "gather", label: "Research", kind: "custom", gate: "auto" as const, isStart: true },
    { key: "gate", label: "Check the findings", kind: "review", gate: "hil" as const },
    { key: "write", label: "Write the summary", kind: "documentation", gate: "auto" as const },
    { key: "done", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
  ],
  edges: [
    { from: "gather", to: "gate", condition: "always" },
    { from: "gate", to: "write", condition: "on_approve" },
    { from: "gate", to: "gather", condition: "on_reject" },
    { from: "write", to: "done", condition: "always" },
  ],
};

const THE_DRAFT = "# Backups\nThe backups page keeps three days of snapshots.";
const THE_CRITIQUE = "Clear enough, but the tone drifts.\nVERDICT: PASS";

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyComposerMigration(testDb, migrationsDir);
  applyComposerGroupLinkMigration(testDb, migrationsDir);
  applyArtifactsMigration(testDb, migrationsDir); // after the two composer ones: it guards on schema_version
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

/** The one artifact a finished run filed, with its body. */
function theArtifact() {
  const list = listArtifacts({ sourceKind: "composer" });
  expect(list).toHaveLength(1);
  return getArtifact(list[0].id)!;
}

describe("a workflow that ends on its reviewer files the draft, not the review of it", () => {
  async function runIt(): Promise<{ runId: string; graphId: string }> {
    const wf = createWorkflowFromDef(DRAFT_REVIEW);
    const run = createComposerRun({
      workflowId: wf.id,
      input: "A 400-word release note for the new backups page.",
    });
    await advanceComposerRun(run.id); // dispatch 'draft'
    await finishStage(run.id, THE_DRAFT); // → dispatch 'review'
    await finishStage(run.id, THE_CRITIQUE); // review PASSes → 'done' → completed
    expect(getComposerRun(run.id)!.status).toBe("completed");
    return { runId: run.id, graphId: wf.id };
  }

  it("the content is the draft", async () => {
    await runIt();

    expect(theArtifact().content).toContain("three days of snapshots");
  });

  it("the content is NOT the critique of the draft", async () => {
    await runIt();

    const content = theArtifact().content ?? "";
    expect(content).not.toContain("the tone drifts");
    expect(content).not.toContain("VERDICT");
  });

  it("it points at the stage that actually produced it", async () => {
    const { runId, graphId } = await runIt();
    const draftNodeId = getWorkflowGraph(graphId)!.nodes.find((n) => n.key === "draft")!.id;
    const draftNodeRun = listNodeRuns(runId).find((nr) => nr.nodeId === draftNodeId)!;

    expect(theArtifact().sourceNodeId).toBe(draftNodeRun.id);
  });

  it("the name says which stage's output this is, rather than only the objective", async () => {
    await runIt();

    const artifact = theArtifact();
    expect(artifact.name).toContain("Draft");
    expect(artifact.name).toContain("release note"); // the objective is still in it
    expect(artifact.name.length).toBeLessThanOrEqual(81); // the cap, plus its ellipsis
  });

  it("a redraft after a FAIL files the LAST draft, not the first", async () => {
    const wf = createWorkflowFromDef(DRAFT_REVIEW);
    const run = createComposerRun({ workflowId: wf.id, input: "A release note." });
    await advanceComposerRun(run.id);
    await finishStage(run.id, "First go, too long.");
    await finishStage(run.id, "Too long.\nVERDICT: FAIL\nREASONS: cut it down"); // → back to 'draft'
    await finishStage(run.id, "Second go, tighter.");
    await finishStage(run.id, "Better.\nVERDICT: PASS");

    const content = theArtifact().content ?? "";
    expect(content).toContain("Second go, tighter.");
    expect(content).not.toContain("First go");
  });
});

describe("GREEN CONTROL: a workflow that ends on the stage that writes still files that", () => {
  it("files the summary the gate was passed for, not the gate's own note", async () => {
    const wf = createWorkflowFromDef(RESEARCH_SUMMARISE);
    const graph = getWorkflowGraph(wf.id)!;
    const run = createComposerRun({ workflowId: wf.id, input: "What is a CSV file?" });
    await advanceComposerRun(run.id); // dispatch 'gather'
    await finishStage(run.id, "Findings: it is a text format."); // → the gate
    await finishStage(run.id, "Thin, but usable.\nVERDICT: PASS"); // the gate parks for a human

    recordComposerApproval({
      composerRunId: run.id,
      nodeId: graph.nodes.find((n) => n.key === "gate")!.id,
      action: "accept",
    });
    updateComposerRun(run.id, { status: "running" });
    await advanceComposerRun(run.id); // on_approve → dispatch 'write'
    await finishStage(run.id, "A CSV file stores a table as plain text."); // → 'done' → completed

    const artifact = theArtifact();
    expect(getComposerRun(run.id)!.status).toBe("completed");
    expect(artifact.content).toContain("stores a table as plain text");
    expect(artifact.name).toContain("Write the summary");
  });
});

describe("CONTROL: a run whose only output IS a judgement still files it", () => {
  it("nothing is thrown away, and the name says whose judgement it is", async () => {
    const wf = createWorkflowFromDef({
      key: "assess-only-wf",
      name: "Assess only",
      nodes: [
        { key: "check", label: "Check", kind: "validate", gate: "auto" as const, isStart: true },
        { key: "done", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
      ],
      edges: [{ from: "check", to: "done", condition: "on_pass" }],
    });
    const run = createComposerRun({ workflowId: wf.id, input: "Check the migration plan." });
    await advanceComposerRun(run.id);
    await finishStage(run.id, "The plan holds.\nVERDICT: PASS");

    const artifact = theArtifact();
    expect(artifact.content).toContain("The plan holds.");
    expect(artifact.name).toContain("Check");
  });
});

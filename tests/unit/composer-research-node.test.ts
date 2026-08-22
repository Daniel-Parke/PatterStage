/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */
// Phase 1.5-C — a Composer "research" node drives a Deep Research run (not a
// Hermes agent run); the engine settles the stage from the linked research run.

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyDeepResearchMigration } from "@/lib/db/apply-deep-research-migration";
import { applyResearchOptionsMigration } from "@/lib/db/apply-research-options-migration";
import { applyResearchComposerLinkMigration } from "@/lib/db/apply-research-composer-link-migration";
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
// Never resolves: the test drives settling by updating the research run directly
// (so no real LLM/search work happens and the .finally() advance can't race).
const mockRunResearchJob = jest.fn((..._a: unknown[]) => new Promise<void>(() => {}));
jest.mock("@/lib/laboratory/deep-research/run-job", () => ({
  runResearchJob: (...a: unknown[]) => mockRunResearchJob(...a),
}));

import { runtime } from "@/lib/runtime";
import {
  createComposerRun,
  createWorkflowFromDef,
  getComposerRun,
  listNodeRuns,
} from "@/lib/composer/composer-repository";
import { advanceComposerRun } from "@/lib/composer/engine";
import {
  getResearchRunByComposerNodeRunId,
  updateResearchRun,
} from "@/lib/laboratory/deep-research/research-repository";

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");
const mockSubmit = runtime.submitRun as jest.Mock;

const WF = {
  key: "research-wf",
  name: "Research WF",
  nodes: [
    { key: "research", label: "Research", kind: "research", gate: "auto" as const, isStart: true },
    { key: "done", label: "Done", kind: "custom", gate: "auto" as const, isTerminal: true },
  ],
  edges: [{ from: "research", to: "done", condition: "on_pass" }],
};

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  applyDeepResearchMigration(testDb, migrationsDir); // v19: research_runs/steps
  applyComposerMigration(testDb, migrationsDir); // v21: composer tables
  applyResearchOptionsMigration(testDb, migrationsDir); // v23: research_runs.config_json
  applyResearchComposerLinkMigration(testDb, migrationsDir); // v25: link column
  applyComposerGroupLinkMigration(testDb, migrationsDir); // v26: composer_runs.parent_node_run_id
  mockSubmit.mockReset();
  mockRunResearchJob.mockClear();
});
afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("composer research node", () => {
  it("runs Deep Research (no agent run) and settles on completion", async () => {
    const wf = createWorkflowFromDef(WF);
    const run = createComposerRun({ workflowId: wf.id, input: "How cheap is hydrogen?" });

    await advanceComposerRun(run.id); // pending → running, dispatch the research node

    expect(mockSubmit).not.toHaveBeenCalled(); // NOT an agent run
    expect(mockRunResearchJob).toHaveBeenCalledTimes(1);

    const nodeRun = listNodeRuns(run.id).find((nr) => nr.status === "running")!;
    expect(nodeRun.runId).toBeNull(); // no agent run id → stays out of reconcile
    const research = getResearchRunByComposerNodeRunId(nodeRun.id)!;
    expect(research.query).toBe("How cheap is hydrogen?");

    // Research finishes → settle the stage, merge the report, route on_pass → done.
    updateResearchRun(research.id, { status: "completed", report: "# Hydrogen report" });
    await advanceComposerRun(run.id);

    const settled = listNodeRuns(run.id).find((nr) => nr.nodeId === nodeRun.nodeId)!;
    expect(settled.status).toBe("completed");
    expect(settled.output).toBe("# Hydrogen report");
    expect(getComposerRun(run.id)!.status).toBe("completed");
    expect(getComposerRun(run.id)!.context?.research).toBe("# Hydrogen report");
  });

  it("fails the stage when the research run fails", async () => {
    const wf = createWorkflowFromDef(WF);
    const run = createComposerRun({ workflowId: wf.id, input: "q" });
    await advanceComposerRun(run.id);
    const nodeRun = listNodeRuns(run.id).find((nr) => nr.status === "running")!;
    const research = getResearchRunByComposerNodeRunId(nodeRun.id)!;

    updateResearchRun(research.id, { status: "failed", error: "search provider down" });
    await advanceComposerRun(run.id);

    const settled = listNodeRuns(run.id).find((nr) => nr.nodeId === nodeRun.nodeId)!;
    expect(settled.status).toBe("failed");
    // No on_fail edge from the research node → the run fails (no recovery path).
    expect(getComposerRun(run.id)!.status).toBe("failed");
  });
});

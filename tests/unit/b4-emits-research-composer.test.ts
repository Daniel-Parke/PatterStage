/** @jest-environment node */

// B4 (T-0098) oracle for the research + composer group: the ledger learns
// that a research run started, ended, or died, and that a Composer run
// started, ended, died, had a gate accepted, or had its workflow saved.
//
// Written before the emits exist. Every positive test below goes red on the
// missing recordEvent call and nowhere else; every negative test is green
// today and must stay green, because it pins the one rule an emit has to
// obey: it comes AFTER the write it reports on, and only from a write path.
// An event recorded before createResearchRun threw would be a ledger line
// for a run that does not exist. The negatives are what make that placement
// wrong rather than merely untidy.
//
// The doubles mirror the suites that already exercise these handlers
// (research-gather-is-persisted, approve-verbs-are-two, lists-are-bounded):
// real handlers, mocked repositories, no database, no file system. The two
// modules under test that the routes fire-and-forget into (run-job and the
// engine) are mocked at the boundary and pulled in with requireActual where
// they are the thing being tested.

jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

jest.mock("@/lib/db", () => ({
  ensureDb: jest.fn(),
  now: () => "2026-09-05T12:00:00.000Z",
}));
jest.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: () => true }));
// A real 500 on the failure path, without the console line the real helper writes.
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: (_route: string, _ctx: string, _err: unknown, message: string) =>
    (jest.requireActual("@/lib/api-response") as typeof import("@/lib/api-response")).serverError(message),
}));
jest.mock("@/lib/artifacts-repository", () => ({ captureArtifactOnce: jest.fn() }));
jest.mock("@/lib/spend/spend-guard", () => ({ checkUnattendedSpend: () => ({ allowed: true }) }));

// ── research doubles ─────────────────────────────────────────────
const mockCreateResearchRun = jest.fn();
const mockUpdateResearchRun = jest.fn();
const mockGetResearchRunByComposerNodeRunId = jest.fn(() => null as unknown);
jest.mock("@/lib/laboratory/deep-research/research-repository", () => ({
  createResearchRun: (...a: unknown[]) => mockCreateResearchRun(...a),
  updateResearchRun: (...a: unknown[]) => mockUpdateResearchRun(...a),
  insertResearchStep: jest.fn(),
  listResearchRuns: jest.fn(() => []),
  // See research-gather-is-persisted.test.ts: the job reads the row back to
  // notice a cancel (T-0108, D98), and nothing here is ever cancelled.
  getResearchRun: jest.fn(() => ({ status: "running" })),
  getResearchRunByComposerNodeRunId: (...a: unknown[]) => mockGetResearchRunByComposerNodeRunId(...(a as [])),
}));
const mockRunDeepResearch = jest.fn();
jest.mock("@/lib/laboratory/deep-research/engine", () => ({
  runDeepResearch: (...a: unknown[]) => mockRunDeepResearch(...a),
  defaultLlm: jest.fn(),
  defaultVisit: jest.fn(),
}));
jest.mock("@/lib/laboratory/deep-research/search", () => ({
  resolveSearchProvider: () => ({ name: "fake", search: async () => [] }),
}));
// The POST route fires this and forgets it; the run-job describe requireActuals it.
jest.mock("@/lib/laboratory/deep-research/run-job", () => ({
  runResearchJob: jest.fn(async () => undefined),
}));

// ── composer doubles ─────────────────────────────────────────────
const mockCreateComposerRun = jest.fn();
const mockGetWorkflow = jest.fn();
const mockGetComposerRun = jest.fn();
const mockGetNode = jest.fn();
const mockRecordComposerApproval = jest.fn();
const mockUpdateComposerRun = jest.fn();
const mockUpdateNodeRun = jest.fn();
const mockListNodeRuns = jest.fn(() => [] as unknown[]);
const mockListComposerApprovals = jest.fn(() => [] as unknown[]);
const mockGetOutgoingEdges = jest.fn(() => [] as unknown[]);
const mockMaxAttemptForNode = jest.fn(() => 1);
const mockCreateWorkflowFromDef = jest.fn();
const mockGetWorkflowGraph = jest.fn();
const mockReplaceWorkflowGraph = jest.fn();
const mockWorkflowHasActiveRuns = jest.fn(() => false);
jest.mock("@/lib/composer/composer-repository", () => {
  const actual = jest.requireActual("@/lib/composer/composer-repository") as typeof import("@/lib/composer/composer-repository");
  return {
    WorkflowHistoryWouldBeLost: actual.WorkflowHistoryWouldBeLost,
    createComposerRun: (...a: unknown[]) => mockCreateComposerRun(...a),
    getWorkflow: (...a: unknown[]) => mockGetWorkflow(...a),
    getWorkflowByKey: (...a: unknown[]) => mockGetWorkflow(...a),
    listComposerRuns: jest.fn(() => []),
    getComposerRun: (...a: unknown[]) => mockGetComposerRun(...a),
    getComposerRunByParentNodeRunId: jest.fn(() => null),
    getNode: (...a: unknown[]) => mockGetNode(...a),
    getNodeRun: jest.fn(() => null),
    getNodeRunByRunId: jest.fn(() => null),
    getOutgoingEdges: (...a: unknown[]) => mockGetOutgoingEdges(...(a as [])),
    getStartNode: jest.fn(() => null),
    listActiveComposerRuns: jest.fn(() => []),
    listComposerApprovals: (...a: unknown[]) => mockListComposerApprovals(...(a as [])),
    listNodeRuns: (...a: unknown[]) => mockListNodeRuns(...(a as [])),
    maxAttemptForNode: (...a: unknown[]) => mockMaxAttemptForNode(...(a as [])),
    recordComposerApproval: (...a: unknown[]) => mockRecordComposerApproval(...a),
    updateComposerRun: (...a: unknown[]) => mockUpdateComposerRun(...a),
    updateNodeRun: (...a: unknown[]) => mockUpdateNodeRun(...a),
    createWorkflowFromDef: (...a: unknown[]) => mockCreateWorkflowFromDef(...a),
    listWorkflows: jest.fn(() => []),
    getWorkflowGraph: (...a: unknown[]) => mockGetWorkflowGraph(...a),
    replaceWorkflowGraph: (...a: unknown[]) => mockReplaceWorkflowGraph(...a),
    deleteWorkflow: jest.fn(),
    workflowHasActiveRuns: (...a: unknown[]) => mockWorkflowHasActiveRuns(...(a as [])),
  };
});
jest.mock("@/lib/composer/dispatch", () => ({ dispatchComposerNode: jest.fn(async () => ({})) }));
// The routes kick the engine and forget it; the engine describe requireActuals it.
jest.mock("@/lib/composer/engine", () => ({
  advanceComposerRun: jest.fn(async () => undefined),
  finalizeComposerNodeRun: jest.fn(() => null),
}));

import { NextRequest } from "next/server";

import { recordEvent } from "@/lib/analytics/record-event";
import { WorkflowHistoryWouldBeLost } from "@/lib/composer/composer-repository";
import { POST as researchPOST } from "@/app/api/laboratory/research/route";
import { POST as composerRunsPOST } from "@/app/api/composer/runs/route";
import { POST as approvePOST } from "@/app/api/composer/runs/[id]/nodes/[nodeId]/approve/route";
import { POST as workflowsPOST } from "@/app/api/composer/workflows/route";
import { PUT as workflowPUT } from "@/app/api/composer/workflows/[id]/route";

const { runResearchJob } = jest.requireActual(
  "@/lib/laboratory/deep-research/run-job",
) as typeof import("@/lib/laboratory/deep-research/run-job");
const { advanceComposerRun } = jest.requireActual(
  "@/lib/composer/engine",
) as typeof import("@/lib/composer/engine");

function jsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Every call of a given type, so "not emitted" can be asserted per type. */
const emitsOf = (type: string) =>
  (recordEvent as jest.Mock).mock.calls.filter((c) => c[0] === type);

beforeEach(() => {
  jest.clearAllMocks();
  mockGetResearchRunByComposerNodeRunId.mockReturnValue(null);
  mockListNodeRuns.mockReturnValue([]);
  mockListComposerApprovals.mockReturnValue([]);
  mockGetOutgoingEdges.mockReturnValue([]);
  mockMaxAttemptForNode.mockReturnValue(1);
  mockWorkflowHasActiveRuns.mockReturnValue(false);
});

// ═══════════════════════════════════════════════════════════════
// 1. research.started — POST /api/laboratory/research
// ═══════════════════════════════════════════════════════════════
describe("POST /api/laboratory/research", () => {
  const start = (body: unknown = { query: "How cheap is hydrogen?" }) =>
    researchPOST(jsonRequest("/api/laboratory/research", "POST", body));

  it("the operator starts a run and the ledger shows research.started for that run", async () => {
    mockCreateResearchRun.mockReturnValue({ id: "run-r1", query: "How cheap is hydrogen?", status: "pending" });

    const res = await start();

    expect(res.status).toBe(201);
    expect(mockCreateResearchRun).toHaveBeenCalledTimes(1);
    expect(recordEvent).toHaveBeenCalledWith(
      "research.started",
      expect.objectContaining({ entityType: "research", entityId: "run-r1" }),
    );
  });

  it("the row could not be created, so nothing is recorded", async () => {
    mockCreateResearchRun.mockImplementation(() => {
      throw new Error("SQLITE_FULL");
    });

    const res = await start();

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("a query too short to run is refused before anything is written, and nothing is recorded", async () => {
    const res = await start({ query: "hi" });

    expect(res.status).toBe(400);
    expect(mockCreateResearchRun).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 2 + 3. research.completed / research.failed — runResearchJob
// ═══════════════════════════════════════════════════════════════
describe("runResearchJob", () => {
  const RUN_ID = "run-r1";
  const USAGE = { inputTokens: 800, outputTokens: 400, totalTokens: 1200 };

  function engineResult(over: Record<string, unknown> = {}) {
    return {
      report: "The answer is 42.",
      provider: "fake",
      searchAttempts: 2,
      searchFailures: 0,
      visitAttempts: 0,
      visitFailures: 0,
      usage: USAGE,
      ...over,
    };
  }
  /** The terminal write: the last updateResearchRun call (the first flips the run to `running`). */
  const terminalWrite = () => mockUpdateResearchRun.mock.calls.at(-1)! as [string, Record<string, unknown>];

  it("the engine finishes cleanly and the ledger shows research.completed for the run", async () => {
    mockRunDeepResearch.mockResolvedValue(engineResult());

    await runResearchJob(RUN_ID, "How cheap is hydrogen?", null);

    expect(terminalWrite()[0]).toBe(RUN_ID);
    expect(terminalWrite()[1].status).toBe("completed");
    expect(recordEvent).toHaveBeenCalledWith(
      "research.completed",
      expect.objectContaining({ entityType: "research", entityId: RUN_ID }),
    );
    expect(emitsOf("research.failed")).toHaveLength(0);
  });

  it("every search failed, so the ledger shows research.failed with reason search-unavailable, and no completed", async () => {
    mockRunDeepResearch.mockResolvedValue(engineResult({ searchAttempts: 2, searchFailures: 2 }));

    await runResearchJob(RUN_ID, "q", null);

    expect(terminalWrite()[1].status).toBe("failed");
    expect(recordEvent).toHaveBeenCalledWith(
      "research.failed",
      expect.objectContaining({
        entityType: "research",
        entityId: RUN_ID,
        metadata: expect.objectContaining({ reason: "search-unavailable" }),
      }),
    );
    expect(emitsOf("research.completed")).toHaveLength(0);
  });

  it("the engine threw, so the ledger shows research.failed with reason error, and no completed", async () => {
    mockRunDeepResearch.mockRejectedValue(new Error("model gateway unreachable"));

    await runResearchJob(RUN_ID, "q", null);

    expect(terminalWrite()[1].status).toBe("failed");
    expect(recordEvent).toHaveBeenCalledWith(
      "research.failed",
      expect.objectContaining({
        entityType: "research",
        entityId: RUN_ID,
        metadata: expect.objectContaining({ reason: "error" }),
      }),
    );
    expect(emitsOf("research.completed")).toHaveLength(0);
  });

  it("the terminal write itself fails, so no research.completed is recorded", async () => {
    // The row never became `completed`, so the ledger must not say it did. The
    // catch branch's own write throws too, which is why the job rejects today;
    // the emit has to sit after a write that succeeded, and none did.
    mockRunDeepResearch.mockResolvedValue(engineResult());
    mockUpdateResearchRun.mockImplementation((_id: string, patch: { status?: string }) => {
      if (patch.status !== "running") throw new Error("SQLITE_BUSY");
    });

    await expect(runResearchJob(RUN_ID, "q", null)).rejects.toThrow("SQLITE_BUSY");

    expect(emitsOf("research.completed")).toHaveLength(0);
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. composer.run_started — POST /api/composer/runs
// ═══════════════════════════════════════════════════════════════
describe("POST /api/composer/runs", () => {
  const start = (body: unknown = { workflowId: "wf-1", input: "ship the thing" }) =>
    composerRunsPOST(jsonRequest("/api/composer/runs", "POST", body));

  it("the operator starts a workflow run and the ledger shows composer.run_started for that run", async () => {
    mockGetWorkflow.mockReturnValue({ id: "wf-1", name: "Two step" });
    mockCreateComposerRun.mockReturnValue({ id: "run-1", workflowId: "wf-1", status: "pending" });

    const res = await start();

    expect(res.status).toBe(201);
    expect(mockCreateComposerRun).toHaveBeenCalledTimes(1);
    expect(recordEvent).toHaveBeenCalledWith(
      "composer.run_started",
      expect.objectContaining({ entityType: "composer_run", entityId: "run-1" }),
    );
  });

  it("the run row could not be created, so nothing is recorded", async () => {
    mockGetWorkflow.mockReturnValue({ id: "wf-1", name: "Two step" });
    mockCreateComposerRun.mockImplementation(() => {
      throw new Error("SQLITE_FULL");
    });

    const res = await start();

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("an unknown workflow is refused before any write, and nothing is recorded", async () => {
    mockGetWorkflow.mockReturnValue(null);

    const res = await start();

    expect(res.status).toBe(400);
    expect(mockCreateComposerRun).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. composer.run_completed / composer.run_failed — applyNext in the engine
// ═══════════════════════════════════════════════════════════════
describe("advanceComposerRun, at each terminal write in applyNext", () => {
  const RUN_ID = "run-1";
  const STAGE = "n-stage";
  const DONE = "n-done";
  const NEXT = "n-next";

  const nodes: Record<string, Record<string, unknown>> = {
    [STAGE]: { id: STAGE, key: "stage", label: "Stage", kind: "custom", gate: "auto", isStart: true, isTerminal: false, config: null },
    [DONE]: { id: DONE, key: "done", label: "Done", kind: "custom", gate: "auto", isStart: false, isTerminal: true, config: null },
    [NEXT]: { id: NEXT, key: "next", label: "Next", kind: "custom", gate: "auto", isStart: false, isTerminal: false, config: null },
  };

  /** A run parked on STAGE, whose latest node-run is terminal. */
  function runOn(nodeOver: Record<string, unknown>, nodeRunOver: Record<string, unknown>, runOver: Record<string, unknown> = {}) {
    mockGetComposerRun.mockReturnValue({
      id: RUN_ID,
      workflowId: "wf-1",
      status: "running",
      currentNodeId: STAGE,
      input: "ship the thing",
      context: null,
      parentNodeRunId: null,
      error: null,
      ...runOver,
    });
    mockGetNode.mockImplementation((id: string) =>
      id === STAGE ? { ...nodes[STAGE], ...nodeOver } : (nodes[id] ?? null),
    );
    mockListNodeRuns.mockReturnValue([
      {
        id: "nr-1",
        composerRunId: RUN_ID,
        nodeId: STAGE,
        attempt: 1,
        status: "completed",
        output: "the deliverable",
        verdict: { pass: true, reasons: [], suggestions: [] },
        error: null,
        runId: "gw-1",
        createdAt: "2026-09-05T11:00:00.000Z",
        startedAt: "2026-09-05T11:00:00.000Z",
        completedAt: "2026-09-05T11:30:00.000Z",
        ...nodeRunOver,
      },
    ]);
  }
  const terminalRunWrite = () =>
    mockUpdateComposerRun.mock.calls.find((c) => (c[1] as { completedAt?: string }).completedAt) as
      | [string, Record<string, unknown>]
      | undefined;

  it("the current stage is the terminal node (the complete kind): run_completed", async () => {
    runOn({ isTerminal: true }, {});

    await advanceComposerRun(RUN_ID);

    expect(terminalRunWrite()).toEqual([RUN_ID, expect.objectContaining({ status: "completed" })]);
    expect(recordEvent).toHaveBeenCalledWith(
      "composer.run_completed",
      expect.objectContaining({ entityType: "composer_run", entityId: RUN_ID }),
    );
    expect(emitsOf("composer.run_failed")).toHaveLength(0);
  });

  it("the stage passes and its edge lands on the end marker (the terminal-node site): run_completed", async () => {
    runOn({}, {});
    mockGetOutgoingEdges.mockReturnValue([{ id: "e1", fromNodeId: STAGE, toNodeId: DONE, condition: "on_pass" }]);

    await advanceComposerRun(RUN_ID);

    expect(terminalRunWrite()).toEqual([
      RUN_ID,
      expect.objectContaining({ status: "completed", currentNodeId: DONE }),
    ]);
    expect(recordEvent).toHaveBeenCalledWith(
      "composer.run_completed",
      expect.objectContaining({ entityType: "composer_run", entityId: RUN_ID }),
    );
    expect(emitsOf("composer.run_failed")).toHaveLength(0);
  });

  it("the stage failed with no recovery edge (the fail kind): run_failed", async () => {
    runOn({}, { status: "failed", error: "the container died", verdict: { pass: false, reasons: ["the container died"], suggestions: [] } });

    await advanceComposerRun(RUN_ID);

    expect(terminalRunWrite()).toEqual([RUN_ID, expect.objectContaining({ status: "failed" })]);
    expect(recordEvent).toHaveBeenCalledWith(
      "composer.run_failed",
      expect.objectContaining({ entityType: "composer_run", entityId: RUN_ID }),
    );
    expect(emitsOf("composer.run_completed")).toHaveLength(0);
  });

  it("the operator rejected the gate with no recovery edge (the fail kind, rejected): run_failed with status rejected", async () => {
    runOn({ gate: "hil" }, {});
    mockListComposerApprovals.mockReturnValue([
      { id: "a1", composerRunId: RUN_ID, nodeId: STAGE, action: "reject", approved: false, note: null, createdAt: "2026-09-05T11:45:00.000Z" },
    ]);

    await advanceComposerRun(RUN_ID);

    expect(terminalRunWrite()).toEqual([RUN_ID, expect.objectContaining({ status: "rejected" })]);
    expect(recordEvent).toHaveBeenCalledWith(
      "composer.run_failed",
      expect.objectContaining({
        entityType: "composer_run",
        entityId: RUN_ID,
        metadata: expect.objectContaining({ status: "rejected" }),
      }),
    );
    expect(emitsOf("composer.run_completed")).toHaveLength(0);
  });

  it("the next stage is over its attempt cap (the loop cap): run_failed", async () => {
    runOn({}, {});
    mockGetOutgoingEdges.mockReturnValue([{ id: "e1", fromNodeId: STAGE, toNodeId: NEXT, condition: "on_pass" }]);
    mockMaxAttemptForNode.mockReturnValue(5); // MAX_NODE_ATTEMPTS

    await advanceComposerRun(RUN_ID);

    expect(terminalRunWrite()).toEqual([
      RUN_ID,
      expect.objectContaining({ status: "failed", error: expect.stringMatching(/exceeded 5 attempts/) }),
    ]);
    expect(recordEvent).toHaveBeenCalledWith(
      "composer.run_failed",
      expect.objectContaining({ entityType: "composer_run", entityId: RUN_ID }),
    );
    expect(emitsOf("composer.run_completed")).toHaveLength(0);
  });

  it("GREEN CONTROL: routing to a live next stage is not terminal, so nothing is recorded", async () => {
    runOn({}, {});
    mockGetOutgoingEdges.mockReturnValue([{ id: "e1", fromNodeId: STAGE, toNodeId: NEXT, condition: "on_pass" }]);

    await advanceComposerRun(RUN_ID);

    expect(terminalRunWrite()).toBeUndefined();
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("the terminal write throws, so the run is not recorded as completed", async () => {
    runOn({ isTerminal: true }, {});
    mockUpdateComposerRun.mockImplementation((_id: string, patch: { completedAt?: string }) => {
      if (patch.completedAt) throw new Error("SQLITE_BUSY");
      return null;
    });

    await expect(advanceComposerRun(RUN_ID)).rejects.toThrow("SQLITE_BUSY");

    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("the terminal write throws on the fail branch, so the run is not recorded as failed either", async () => {
    runOn({}, { status: "failed", error: "the container died", verdict: { pass: false, reasons: ["x"], suggestions: [] } });
    mockUpdateComposerRun.mockImplementation((_id: string, patch: { completedAt?: string }) => {
      if (patch.completedAt) throw new Error("SQLITE_BUSY");
      return null;
    });

    await expect(advanceComposerRun(RUN_ID)).rejects.toThrow("SQLITE_BUSY");

    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. composer.gate_approved — POST /api/composer/runs/[id]/nodes/[nodeId]/approve
// ═══════════════════════════════════════════════════════════════
describe("POST /api/composer/runs/[id]/nodes/[nodeId]/approve", () => {
  const decide = (body: unknown) =>
    approvePOST(jsonRequest("/api/composer/runs/r1/nodes/n1/approve", "POST", body), {
      params: Promise.resolve({ id: "r1", nodeId: "n1" }),
    });

  beforeEach(() => {
    mockGetComposerRun.mockReturnValue({ id: "r1", status: "awaiting_approval", currentNodeId: "n1", error: null, workflowId: "wf-1" });
    mockGetNode.mockReturnValue({ id: "n1", gate: "hil" });
    mockRecordComposerApproval.mockReturnValue({ id: "a1", action: "accept" });
  });

  it("the operator accepts the gate and the ledger shows composer.gate_approved naming the node", async () => {
    const res = await decide({ action: "accept" });

    expect(res.status).toBe(200);
    expect(mockRecordComposerApproval).toHaveBeenCalledWith(expect.objectContaining({ action: "accept" }));
    expect(recordEvent).toHaveBeenCalledWith(
      "composer.gate_approved",
      expect.objectContaining({
        entityType: "composer_run",
        entityId: "r1",
        metadata: expect.objectContaining({ nodeId: "n1" }),
      }),
    );
  });

  it("the operator rejects the gate: recorded, answered 200, and NOT a gate_approved", async () => {
    const res = await decide({ action: "reject" });

    expect(res.status).toBe(200);
    expect(mockRecordComposerApproval).toHaveBeenCalledWith(expect.objectContaining({ action: "reject" }));
    expect(emitsOf("composer.gate_approved")).toHaveLength(0);
  });

  it("the approval could not be recorded, so nothing is recorded in the ledger either", async () => {
    mockRecordComposerApproval.mockImplementation(() => {
      throw new Error("SQLITE_FULL");
    });

    const res = await decide({ action: "accept" });

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("a run not at its gate is refused before any write, and nothing is recorded", async () => {
    mockGetComposerRun.mockReturnValue({ id: "r1", status: "running", currentNodeId: "n1", error: null, workflowId: "wf-1" });

    const res = await decide({ action: "accept" });

    expect(res.status).toBe(400);
    expect(mockRecordComposerApproval).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. composer.workflow_saved — POST /api/composer/workflows, PUT /[id]
// ═══════════════════════════════════════════════════════════════
const WORKFLOW_DEF = {
  key: "two-step",
  name: "Two step",
  nodes: [
    { key: "stage", label: "Stage", kind: "custom", gate: "auto", isStart: true },
    { key: "done", label: "Done", kind: "custom", gate: "auto", isTerminal: true },
  ],
  edges: [{ from: "stage", to: "done", condition: "on_pass" }],
};
const SAVED_GRAPH = { id: "wf-1", key: "two-step", name: "Two step", description: "", version: 1, nodes: [], edges: [] };

describe("POST /api/composer/workflows", () => {
  const create = (body: unknown = WORKFLOW_DEF) =>
    workflowsPOST(jsonRequest("/api/composer/workflows", "POST", body));

  it("the operator saves a new workflow and the ledger shows composer.workflow_saved as created", async () => {
    mockCreateWorkflowFromDef.mockReturnValue(SAVED_GRAPH);

    const res = await create();

    expect(res.status).toBe(201);
    expect(mockCreateWorkflowFromDef).toHaveBeenCalledTimes(1);
    expect(recordEvent).toHaveBeenCalledWith(
      "composer.workflow_saved",
      expect.objectContaining({
        entityType: "workflow",
        entityId: "wf-1",
        metadata: expect.objectContaining({ action: "created" }),
      }),
    );
  });

  it("the graph could not be written, so nothing is recorded", async () => {
    mockCreateWorkflowFromDef.mockImplementation(() => {
      throw new Error("edge references unknown node: stage -> nowhere");
    });

    const res = await create();

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("a definition with no nodes is refused before any write, and nothing is recorded", async () => {
    const res = await create({ name: "Empty", nodes: [] });

    expect(res.status).toBe(400);
    expect(mockCreateWorkflowFromDef).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

describe("PUT /api/composer/workflows/[id]", () => {
  const replace = (query = "") =>
    workflowPUT(jsonRequest(`/api/composer/workflows/wf-1${query}`, "PUT", WORKFLOW_DEF), {
      params: Promise.resolve({ id: "wf-1" }),
    });

  beforeEach(() => {
    mockGetWorkflowGraph.mockReturnValue(SAVED_GRAPH);
    mockReplaceWorkflowGraph.mockReturnValue({ ...SAVED_GRAPH, version: 2 });
  });

  it("the operator replaces the graph and the ledger shows composer.workflow_saved as replaced", async () => {
    const res = await replace();

    expect(res.status).toBe(200);
    expect(mockReplaceWorkflowGraph).toHaveBeenCalledWith("wf-1", expect.anything(), expect.anything());
    expect(recordEvent).toHaveBeenCalledWith(
      "composer.workflow_saved",
      expect.objectContaining({
        entityType: "workflow",
        entityId: "wf-1",
        metadata: expect.objectContaining({ action: "replaced" }),
      }),
    );
  });

  it("the save would destroy run history and is refused with 409, so nothing is recorded", async () => {
    mockReplaceWorkflowGraph.mockImplementation(() => {
      throw new WorkflowHistoryWouldBeLost(3);
    });

    const res = await replace();

    expect(res.status).toBe(409);
    expect(((await res.json()) as { runCount: number }).runCount).toBe(3);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("the repository threw mid-write, so nothing is recorded", async () => {
    mockReplaceWorkflowGraph.mockImplementation(() => {
      throw new Error("SQLITE_BUSY");
    });

    const res = await replace("?discardRunHistory=1");

    expect(res.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("a workflow with active runs is refused before any write, and nothing is recorded", async () => {
    mockWorkflowHasActiveRuns.mockReturnValue(true);

    const res = await replace();

    expect(res.status).toBe(400);
    expect(mockReplaceWorkflowGraph).not.toHaveBeenCalled();
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

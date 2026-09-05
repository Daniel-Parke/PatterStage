/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// B12 oracle, group gate-notes, server half (D8, major).
//
// Written before the product code moved. Contract section 6.
//
// ComposerGatePrompt asks for "Optional note (e.g. what to change on reject)".
// The approve route persists it. `listComposerApprovals` is then called from
// exactly one place -- engine.ts:88, to decide routing -- and that caller
// reads `approved` and ignores `note`. So the operator types the one sentence
// that says WHY they rejected the plan, the workflow loops back to the stage
// that has to act on it, and the agent re-runs having never been told.
//
// Two halves, both here:
//   6.1  the run payload carries the approvals, so a UI can show them;
//   6.2  a note becomes a `__gateNote` marker on the run's context, and
//        buildStagePrompt renders it into the retried stage's prompt.
//
// The `__` prefix is the existing convention for a reserved context key
// (`__clarify`), and it is why formatContext must learn to skip them: the
// "outputs of prior stages" dump would otherwise print the marker's JSON
// under a heading claiming a stage produced it.
//
// Doubles: the repository and the engine are mocked, so the assertions are
// about what each ROUTE decided. buildStagePrompt is the real, pure function.
// ═══════════════════════════════════════════════════════════════

let composerOn = true;
jest.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: () => composerOn }));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: (_route: string, _ctx: string, _err: unknown, message: string) =>
    (jest.requireActual("@/lib/api-response") as typeof import("@/lib/api-response")).serverError(message),
}));

jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

const mockAdvance = jest.fn(async () => undefined);
jest.mock("@/lib/composer/engine", () => ({ advanceComposerRun: (...a: unknown[]) => mockAdvance(...(a as [])) }));

const mockGetComposerRun = jest.fn();
const mockListNodeRuns = jest.fn(() => [] as unknown[]);
const mockGetWorkflowGraph = jest.fn(() => null as unknown);
const mockListComposerApprovals = jest.fn(() => [] as unknown[]);
const mockGetNode = jest.fn();
const mockRecordComposerApproval = jest.fn();
const mockUpdateComposerRun = jest.fn();

jest.mock("@/lib/composer/composer-repository", () => ({
  getComposerRun: (...a: unknown[]) => mockGetComposerRun(...(a as [])),
  listNodeRuns: (...a: unknown[]) => mockListNodeRuns(...(a as [])),
  getWorkflowGraph: (...a: unknown[]) => mockGetWorkflowGraph(...(a as [])),
  listComposerApprovals: (...a: unknown[]) => mockListComposerApprovals(...(a as [])),
  getNode: (...a: unknown[]) => mockGetNode(...(a as [])),
  recordComposerApproval: (...a: unknown[]) => mockRecordComposerApproval(...(a as [])),
  updateComposerRun: (...a: unknown[]) => mockUpdateComposerRun(...(a as [])),
}));

import { NextRequest } from "next/server";

import { GET as runDetailGET } from "@/app/api/composer/runs/[id]/route";
import { POST as approvePOST } from "@/app/api/composer/runs/[id]/nodes/[nodeId]/approve/route";
import { buildStagePrompt } from "@/lib/composer/stage-prompt";
import type { ComposerNode, ComposerRun } from "@/lib/composer/schema";

// ── fixtures ───────────────────────────────────────────────────

const RUN: ComposerRun = {
  id: "run-1",
  workflowId: "wf-1",
  status: "awaiting_approval",
  currentNodeId: "node-plan",
  input: "Add a dark-mode toggle.",
  context: { review: "Looks reasonable." },
  profileName: null,
  error: null,
  parentNodeRunId: null,
  createdAt: "2026-09-05T12:00:00.000Z",
  updatedAt: "2026-09-05T12:00:00.000Z",
  completedAt: null,
};

const PLAN_NODE: ComposerNode = {
  id: "node-plan",
  workflowId: "wf-1",
  key: "plan",
  label: "Plan",
  kind: "plan",
  gate: "hil",
  isStart: false,
  isTerminal: false,
  config: null,
  pos: 4,
};

const APPROVALS = [
  {
    id: "ap-1",
    composerRunId: "run-1",
    nodeId: "node-plan",
    action: "reject" as const,
    approved: false,
    note: "Use the existing adapter instead of a new one.",
    decidedBy: "user",
    createdAt: "2026-09-05T12:01:00.000Z",
  },
];

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function decide(body: unknown) {
  return approvePOST(jsonRequest("http://localhost/api/composer/runs/run-1/nodes/node-plan/approve", body), {
    params: Promise.resolve({ id: "run-1", nodeId: "node-plan" }),
  });
}

/** The context the route handed to updateComposerRun on the resume. */
function writtenContext(): Record<string, unknown> {
  const call = mockUpdateComposerRun.mock.calls.at(-1) as [string, { context?: Record<string, unknown> }] | undefined;
  return call?.[1]?.context ?? {};
}

beforeEach(() => {
  jest.clearAllMocks();
  composerOn = true;
  mockGetComposerRun.mockReturnValue(RUN);
  mockGetNode.mockReturnValue(PLAN_NODE);
  mockListNodeRuns.mockReturnValue([]);
  mockGetWorkflowGraph.mockReturnValue({ id: "wf-1", nodes: [], edges: [] });
  mockListComposerApprovals.mockReturnValue([]);
});

// ═══════════════════════════════════════════════════════════════
// 6.1 — the run payload carries the decisions
// ═══════════════════════════════════════════════════════════════

describe("GET /api/composer/runs/[id] hands back the gate decisions", () => {
  async function payload(): Promise<Record<string, unknown>> {
    const res = await runDetailGET(new NextRequest("http://localhost/api/composer/runs/run-1"), {
      params: Promise.resolve({ id: "run-1" }),
    });
    const body = (await res.json()) as { data?: Record<string, unknown> };
    return body.data ?? {};
  }

  it("the approvals for the run are in the payload", async () => {
    mockListComposerApprovals.mockReturnValue(APPROVALS);

    expect(await payload()).toEqual(expect.objectContaining({ approvals: APPROVALS }));
    expect(mockListComposerApprovals).toHaveBeenCalledWith("run-1");
  });

  it("a run with no decisions carries an empty list, not a missing key", async () => {
    const data = await payload();

    expect(Object.prototype.hasOwnProperty.call(data, "approvals")).toBe(true);
    expect(data.approvals).toEqual([]);
  });

  it("GREEN CONTROL: run, nodeRuns and graph are still there", async () => {
    const data = await payload();

    expect(data).toEqual(expect.objectContaining({ run: RUN, nodeRuns: [] }));
    expect(data.graph).not.toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.2 — the note becomes context
// ═══════════════════════════════════════════════════════════════

describe("a gate decision with a note leaves the note where the next stage will read it", () => {
  it("a rejection's note is written onto the run's context as __gateNote", async () => {
    await decide({ action: "reject", note: "Use the existing adapter instead of a new one." });

    expect(writtenContext().__gateNote).toEqual({
      nodeId: "node-plan",
      nodeLabel: "Plan",
      action: "reject",
      note: "Use the existing adapter instead of a new one.",
    });
  });

  it("an acceptance's note is kept too, because approving with a caveat is a caveat", async () => {
    await decide({ action: "accept", note: "Fine, but keep the migration reversible." });

    expect(writtenContext().__gateNote).toEqual(
      expect.objectContaining({ action: "accept", note: "Fine, but keep the migration reversible." }),
    );
  });

  it("a decision with no note CLEARS any earlier one, so a stale note never follows the run", async () => {
    mockGetComposerRun.mockReturnValue({
      ...RUN,
      context: { review: "Looks reasonable.", __gateNote: { nodeId: "node-plan", nodeLabel: "Plan", action: "reject", note: "old" } },
    });

    await decide({ action: "accept" });

    const context = writtenContext();
    expect(Object.prototype.hasOwnProperty.call(context, "__gateNote")).toBe(false);
    expect(context.review).toBe("Looks reasonable.");
  });

  it("a whitespace-only note is no note", async () => {
    await decide({ action: "reject", note: "   " });

    expect(Object.prototype.hasOwnProperty.call(writtenContext(), "__gateNote")).toBe(false);
  });

  it("GREEN CONTROL: the approval row is still written and the run still resumes", async () => {
    await decide({ action: "reject", note: "Use the existing adapter." });

    expect(mockRecordComposerApproval).toHaveBeenCalledWith(
      expect.objectContaining({ composerRunId: "run-1", nodeId: "node-plan", action: "reject", note: "Use the existing adapter." }),
    );
    const patch = (mockUpdateComposerRun.mock.calls.at(-1) as [string, { status?: string }])[1];
    expect(patch.status).toBe("running");
    expect(mockAdvance).toHaveBeenCalledWith("run-1");
  });

  it("GREEN CONTROL: a run that is not at a gate is still refused, and nothing is written", async () => {
    mockGetComposerRun.mockReturnValue({ ...RUN, status: "completed" });

    const res = await decide({ action: "accept", note: "too late" });

    expect(res.status).toBe(400);
    expect(mockUpdateComposerRun).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// 6.2 — and the retried stage is told
// ═══════════════════════════════════════════════════════════════

describe("buildStagePrompt reads the gate note back out", () => {
  const IMPLEMENT: ComposerNode = { ...PLAN_NODE, id: "node-impl", key: "implement", label: "Implement", kind: "implement", gate: "auto" };

  function promptWith(context: Record<string, unknown> | null): string {
    return buildStagePrompt(IMPLEMENT, { ...RUN, status: "running", context });
  }

  it("the note, the gate it came from, and the decision all reach the prompt", () => {
    const prompt = promptWith({
      __gateNote: { nodeId: "node-plan", nodeLabel: "Plan", action: "reject", note: "Use the existing adapter." },
    });

    expect(prompt).toContain("## Note from the operator's gate decision");
    expect(prompt).toContain('The gate at "Plan" was rejected.');
    expect(prompt).toContain("Use the existing adapter.");
  });

  it("an accepted gate's note says accepted", () => {
    const prompt = promptWith({
      __gateNote: { nodeId: "node-plan", nodeLabel: "Plan", action: "accept", note: "Keep it reversible." },
    });

    expect(prompt).toContain('The gate at "Plan" was accepted.');
  });

  it("reserved markers never appear in the prior-stage-outputs dump", () => {
    // Both of them: __clarify is already written there by the engine, and a
    // heading that says a stage produced `{"nodeId":…}` is a lie about where
    // the text came from.
    const prompt = promptWith({
      review: "Looks reasonable.",
      __clarify: { nodeId: "node-review", question: "Which page?" },
      __gateNote: { nodeId: "node-plan", nodeLabel: "Plan", action: "reject", note: "Use the existing adapter." },
    });

    expect(prompt).not.toContain("### __clarify");
    expect(prompt).not.toContain("### __gateNote");
    expect(prompt).toContain("### review");
  });

  it("GREEN CONTROL: a run with no gate note gets no gate-note section", () => {
    const prompt = promptWith({ review: "Looks reasonable." });

    expect(prompt).not.toContain("gate decision");
    expect(prompt).toContain("## Context so far (outputs of prior stages)");
  });

  it("GREEN CONTROL: the objective and the stage instruction are untouched", () => {
    const prompt = promptWith({
      __gateNote: { nodeId: "node-plan", nodeLabel: "Plan", action: "reject", note: "Use the existing adapter." },
    });

    expect(prompt).toContain("## Overall objective");
    expect(prompt).toContain("Add a dark-mode toggle.");
    expect(prompt).toContain("## Current stage: Implement (implement)");
  });
});

/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// B12 oracle, group delete-route (D1, blocker).
//
// Written before the product code moved. Contract section 1.2: DELETE
// /api/composer/workflows/[id] answers 409 with the run count unless the
// caller has said `?discardRunHistory=1`, exactly as PUT already does for a
// structural save.
//
// The asymmetry is the defect. `replaceWorkflowGraph` refuses to destroy run
// history without consent; `deleteWorkflow` destroys it on the first ask, and
// the route in front of it never counts. So a workflow with fifty runs and a
// workflow with none are the same one request, and the operator is told
// neither number before the rows are gone.
//
// Doubles: the repository is mocked wholesale (no database), so each
// assertion is about what the ROUTE decided, and "deleteWorkflow was not
// called" is a real statement about the write not happening rather than about
// a row surviving. The GREEN CONTROLs pin the three guards that already work
// and must keep working: the flag, the 404, and the active-runs refusal —
// which has to stay AHEAD of the new count, or a workflow with a running run
// would be offered a "delete the history" button it can never use.
// ═══════════════════════════════════════════════════════════════

let composerOn = true;
jest.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: () => composerOn }));

jest.mock("@/lib/db", () => ({ ensureDb: jest.fn(), now: () => "2026-09-05T12:00:00.000Z" }));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: (_route: string, _ctx: string, _err: unknown, message: string) =>
    (jest.requireActual("@/lib/api-response") as typeof import("@/lib/api-response")).serverError(message),
}));

jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));

const mockGetWorkflowGraph = jest.fn();
const mockWorkflowHasActiveRuns = jest.fn(() => false);
const mockCountWorkflowRuns = jest.fn(() => 0);
const mockDeleteWorkflow = jest.fn(() => true);
const mockReplaceWorkflowGraph = jest.fn();

jest.mock("@/lib/composer/composer-repository", () => {
  // The PUT branch of the same module imports this class at load time; the
  // delete tests never reach it, but an undefined import would be a setup
  // failure rather than the contract failure this file is for.
  class WorkflowHistoryWouldBeLost extends Error {
    constructor(readonly runCount: number) {
      super(`would delete ${runCount} run(s)`);
      this.name = "WorkflowHistoryWouldBeLost";
    }
  }
  return {
    WorkflowHistoryWouldBeLost,
    getWorkflowGraph: (...a: unknown[]) => mockGetWorkflowGraph(...a),
    workflowHasActiveRuns: (...a: unknown[]) => mockWorkflowHasActiveRuns(...(a as [])),
    countWorkflowRuns: (...a: unknown[]) => mockCountWorkflowRuns(...(a as [])),
    deleteWorkflow: (...a: unknown[]) => mockDeleteWorkflow(...(a as [])),
    replaceWorkflowGraph: (...a: unknown[]) => mockReplaceWorkflowGraph(...a),
  };
});

import { NextRequest } from "next/server";

import { DELETE } from "@/app/api/composer/workflows/[id]/route";

const GRAPH = {
  id: "wf-1",
  key: null,
  name: "Research then summarise",
  description: "",
  version: 3,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  nodes: [],
  edges: [],
};

function remove(query = "") {
  return DELETE(new NextRequest(`http://localhost/api/composer/workflows/wf-1${query}`, { method: "DELETE" }), {
    params: Promise.resolve({ id: "wf-1" }),
  });
}

async function bodyOf(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

beforeEach(() => {
  jest.clearAllMocks();
  composerOn = true;
  mockGetWorkflowGraph.mockReturnValue(GRAPH);
  mockWorkflowHasActiveRuns.mockReturnValue(false);
  mockCountWorkflowRuns.mockReturnValue(0);
  mockDeleteWorkflow.mockReturnValue(true);
});

describe("DELETE /api/composer/workflows/[id] counts the runs it is about to destroy", () => {
  it("refuses with 409 when runs exist and the caller has not said discardRunHistory", async () => {
    mockCountWorkflowRuns.mockReturnValue(7);

    const res = await remove();

    expect(res.status).toBe(409);
    expect(mockDeleteWorkflow).not.toHaveBeenCalled();
  });

  it("the 409 carries the count, the workflow's name, and how to confirm", async () => {
    mockCountWorkflowRuns.mockReturnValue(7);

    const body = await bodyOf(await remove());

    expect(body.runCount).toBe(7);
    expect(body.workflowName).toBe("Research then summarise");
    expect(body.confirmWith).toBe("?discardRunHistory=1");
    // The sentence names both, because a number with no subject and a subject
    // with no number are each half of the question being asked.
    expect(String(body.error)).toContain("Research then summarise");
    expect(String(body.error)).toContain("7");
  });

  it("deletes once the caller has confirmed, and answers 200", async () => {
    mockCountWorkflowRuns.mockReturnValue(7);

    const res = await remove("?discardRunHistory=1");

    expect(res.status).toBe(200);
    expect(mockDeleteWorkflow).toHaveBeenCalledTimes(1);
    expect(mockDeleteWorkflow).toHaveBeenCalledWith("wf-1");
    expect((await bodyOf(res)).data).toEqual({ deleted: true });
  });

  it("a value other than 1 is not consent", async () => {
    mockCountWorkflowRuns.mockReturnValue(2);

    for (const query of ["?discardRunHistory=0", "?discardRunHistory=true", "?discardRunHistory="]) {
      mockDeleteWorkflow.mockClear();
      const res = await remove(query);
      expect({ query, status: res.status, deleted: mockDeleteWorkflow.mock.calls.length }).toEqual({
        query,
        status: 409,
        deleted: 0,
      });
    }
  });

  it("GREEN CONTROL: a workflow with no runs still deletes on the first ask", async () => {
    mockCountWorkflowRuns.mockReturnValue(0);

    const res = await remove();

    expect(res.status).toBe(200);
    expect(mockDeleteWorkflow).toHaveBeenCalledTimes(1);
  });

  it("GREEN CONTROL: active runs are refused with 400 BEFORE the count is offered", async () => {
    mockWorkflowHasActiveRuns.mockReturnValue(true);
    mockCountWorkflowRuns.mockReturnValue(4);

    const res = await remove("?discardRunHistory=1");

    expect(res.status).toBe(400);
    expect(mockDeleteWorkflow).not.toHaveBeenCalled();
    expect(String((await bodyOf(res)).error)).toContain("active runs");
  });

  it("GREEN CONTROL: an unknown workflow is 404 and nothing is counted or deleted", async () => {
    mockGetWorkflowGraph.mockReturnValue(null);

    const res = await remove();

    expect(res.status).toBe(404);
    expect(mockDeleteWorkflow).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: the flag off is 503, ahead of every other guard", async () => {
    composerOn = false;
    mockCountWorkflowRuns.mockReturnValue(9);

    const res = await remove("?discardRunHistory=1");

    expect(res.status).toBe(503);
    expect(mockDeleteWorkflow).not.toHaveBeenCalled();
  });
});

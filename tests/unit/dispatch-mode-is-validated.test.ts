/** @jest-environment node */

// T-0067 acceptance oracle — an unrecognised dispatchMode must not run the
// mission.
//
// THE DEFECT. `POST /api/missions {"action":"dispatch","dispatchMode":"schedule"}`
// returns 201 and dispatches IMMEDIATELY. The operator asked for a schedule and
// got an unattended run.
//
// dispatch.ts:101 destructures parseDispatchMode's result as
// `{ isSaveMode, isQueueMode, isCronMode }` and drops `valid`, the flag that
// exists for exactly this. The run-now branch at :154 is then written as a
// NEGATIVE, `if (!isSaveMode && !isQueueMode)`, so it is the else-of-everything
// rather than `if (isNowMode)`. Any string the four `===` comparisons miss lands
// there. dispatch-mode.ts's own header says the flag "lets callers write
// `if (!valid) return error`"; one of its two callers never did.
// mission-promote-handler.ts:79 destructures all five and returns a 400.
//
// TWO DOORS, NOT ONE. `isCronMode` is `dispatchMode === "cron" && !!schedule`,
// so "cron" with a missing or empty schedule un-sets cron and falls through the
// same hole. The client refuses that combination (T-0063); the API does not.
//
// AND IT IS UI-REACHABLE. Templates persist an arbitrary dispatchMode
// (templates-handlers/shared.ts declares the body `any`, update.ts writes the
// field unvalidated) and useMissionComposer casts it back into form state. So a
// poisoned template turns this from an API-only defect into one an operator can
// trigger by clicking Apply.
//
// THE CONSTRAINT THAT SHAPES THE FIX. An ABSENT dispatchMode meaning "now" is a
// codified contract: tests/integration/runtime/full-stack-smoke.mjs posts
// without one under the heading "Legacy god-route now-dispatch" and asserts 201
// + dispatched. So the rule is absent -> now, present-but-unrecognised -> 400.
// A blanket `if (!valid)` would break that contract, which is why it is pinned
// below as a test rather than left to a comment.
//
// ORDERING. createMission runs at dispatch.ts:81, twenty lines BEFORE the mode
// is inspected, so a refusal added at the natural place would leave an orphan
// mission row. The cron-400 path at :118 already does exactly that, and the row
// surfaces on the board as a Draft with no sign it came from a rejected
// request. The validation therefore has to move up beside the `instruction`
// check, and there are assertions here for that specifically.

const mockCreateMission = jest.fn();
const mockUpdateMission = jest.fn();
const mockDispatchMissionNow = jest.fn<Promise<{ ok: boolean; error?: string }>, unknown[]>(
  async () => ({ ok: true }),
);
const mockRunMissionQueueTick = jest.fn();
const mockCreateSchedule = jest.fn();
const mockAppendAuditLine = jest.fn();

let missionSeq = 0;

jest.mock("@/lib/missions/mission-repository", () => ({
  createMission: (...a: unknown[]) => {
    missionSeq += 1;
    mockCreateMission(...a);
    return { id: `m${missionSeq}`, name: "n", status: "queued" };
  },
  updateMission: (...a: unknown[]) => {
    mockUpdateMission(...a);
    return { id: "m1", name: "n", status: "queued" };
  },
  getMission: () => ({ id: "m1", name: "n", status: "queued" }),
  buildMissionPrompt: () => "prompt",
}));

jest.mock("@/lib/missions/mission-dispatch", () => ({
  dispatchMissionNow: (...a: unknown[]) => mockDispatchMissionNow(...(a as [])),
}));

jest.mock("@/lib/missions/mission-queue-tick", () => ({
  runMissionQueueTick: (...a: unknown[]) => mockRunMissionQueueTick(...a),
}));

jest.mock("@/lib/missions/mission-response", () => ({
  missionResponse: (_id: string, status = 200) =>
    new Response(JSON.stringify({ data: { mission: { id: "m1", status: "dispatched" } } }), {
      status,
      headers: { "content-type": "application/json" },
    }),
}));

jest.mock("@/lib/agents/roster", () => ({ resolveAgentSlug: () => undefined }));

jest.mock("@/lib/schedules-repository", () => ({
  createSchedule: (...a: unknown[]) => {
    mockCreateSchedule(...a);
    return { id: "s1" };
  },
}));

jest.mock("@/lib/audit-log", () => ({
  appendAuditLine: (...a: unknown[]) => mockAppendAuditLine(...a),
}));
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(
    () =>
      new Response(JSON.stringify({ error: "server error" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
  ),
}));

import { handleDispatchMission } from "@/lib/missions/mission-handlers/dispatch";

type Body = Record<string, unknown>;

const BASE: Body = { action: "dispatch", name: "QA mission", instruction: "Tick." };

async function dispatch(extra: Body) {
  const res = await handleDispatchMission({ ...BASE, ...extra });
  const body = (await res.json()) as { error?: string; data?: unknown };
  return { status: res.status, body };
}

beforeEach(() => {
  jest.clearAllMocks();
  missionSeq = 0;
});

describe("an unrecognised dispatchMode is refused, not run", () => {
  it.each([["schedule"], ["draft"], ["SAVE"], ["Now"], ["run"], [""]])(
    "refuses %p with a 400",
    async (mode) => {
      const { status } = await dispatch({ dispatchMode: mode });
      expect(status).toBe(400);
    },
  );

  it("names the legal modes, so the operator can fix the call", async () => {
    // Neither this route nor promote currently enumerates them, which is why an
    // operator who typed "schedule" got no hint what to type instead.
    const { body } = await dispatch({ dispatchMode: "schedule" });
    for (const mode of ["now", "save", "queue", "cron"]) {
      expect(body.error).toContain(mode);
    }
  });

  it("does not dispatch the mission", async () => {
    // The assertion that pins the defect: today this fires.
    await dispatch({ dispatchMode: "schedule" });
    expect(mockDispatchMissionNow).not.toHaveBeenCalled();
  });

  it("leaves no orphan mission row behind", async () => {
    // createMission runs twenty lines before the mode is read, so a refusal
    // placed at the natural spot would still write a row. That row shows on the
    // board as a Draft the operator never created.
    await dispatch({ dispatchMode: "schedule" });
    expect(mockCreateMission).not.toHaveBeenCalled();
  });

  it("refuses a non-string mode rather than coercing it", async () => {
    const { status } = await dispatch({ dispatchMode: 42 });
    expect(status).toBe(400);
    expect(mockDispatchMissionNow).not.toHaveBeenCalled();
  });
});

describe("cron without a schedule is refused, not silently run now", () => {
  it.each([[undefined], [""], ["   "]])("refuses schedule=%p", async (schedule) => {
    // The second door. isCronMode is `mode === "cron" && !!schedule`, so a
    // missing schedule un-sets cron and drops into the same run-now else.
    const { status } = await dispatch({ dispatchMode: "cron", schedule });
    expect(status).toBe(400);
    expect(mockDispatchMissionNow).not.toHaveBeenCalled();
    expect(mockCreateMission).not.toHaveBeenCalled();
  });

  it("says that cron needs a schedule, rather than listing the modes", async () => {
    // A distinct message: "cron" IS a legal mode, so the modes list would be
    // the wrong advice here.
    const { body } = await dispatch({ dispatchMode: "cron" });
    expect(body.error).toMatch(/schedule/i);
  });
});

describe("every legal mode still works", () => {
  it("save creates a draft and dispatches nothing", async () => {
    const { status } = await dispatch({ dispatchMode: "save" });
    expect(status).toBe(201);
    expect(mockDispatchMissionNow).not.toHaveBeenCalled();
    expect(mockUpdateMission).toHaveBeenCalledWith("m1", { queuedForRun: false });
  });

  it("queue marks it queued and dispatches nothing directly", async () => {
    const { status } = await dispatch({ dispatchMode: "queue" });
    expect(status).toBe(201);
    expect(mockDispatchMissionNow).not.toHaveBeenCalled();
  });

  it("now dispatches", async () => {
    const { status } = await dispatch({ dispatchMode: "now" });
    expect(status).toBe(201);
    expect(mockDispatchMissionNow).toHaveBeenCalled();
  });

  it("cron with a schedule creates the schedule", async () => {
    const { status } = await dispatch({ dispatchMode: "cron", schedule: "*/13 4 * * 7" });
    expect(status).toBe(201);
    expect(mockCreateSchedule).toHaveBeenCalled();
  });

  it("an ABSENT mode still dispatches now, because that is the documented default", async () => {
    // GREEN PIN, and load-bearing. tests/integration/runtime/full-stack-smoke.mjs
    // asserts this over HTTP under "Legacy god-route now-dispatch". Without it
    // here, the obvious fix (`if (!valid) return badRequest`) looks correct in
    // the unit suite and breaks the integration smoke.
    const { status } = await dispatch({});
    expect(status).toBe(201);
    expect(mockDispatchMissionNow).toHaveBeenCalled();
  });
});

describe("a failed immediate dispatch is not reported as a success", () => {
  it("does not audit ok:true when the dispatch failed", async () => {
    // dispatch.ts discards dispatchMissionNow's result and audits ok:true
    // unconditionally, so a mission that dispatchMissionRun has already flipped
    // to failed still returns 201 with a success audit line. promote gets this
    // right and checks the result.
    mockDispatchMissionNow.mockResolvedValueOnce({ ok: false, error: "gateway down" });

    await dispatch({ dispatchMode: "now" });

    expect(mockAppendAuditLine).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "mission.dispatch", ok: true }),
    );
  });
});

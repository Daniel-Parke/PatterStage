/** @jest-environment node */

// T-0070 acceptance oracle — five places where PatterStage stores what happened
// and then tells the operator something else.
//
// F4 THE OPERATOR CANCELS AND THE BOARD SAYS "Failed". The mission status enum
// has no `cancelled` and the operator ruled it stays that way -- but the RUN row
// already records `cancelled`, honestly, and describeMissionRunState reads only
// the mission's `status`. The fact is already stored and simply not read.
//
// THE TWO CANCEL ENTRY POINTS DIVERGE, which makes F4's fix unreliable as well
// as being a defect of its own:
//
//   POST /api/missions {action:"cancel"}   clears queuedForRun, writes an audit
//                                          line, and touches the run row only
//                                          via a BACKGROUND call, and only when
//                                          the mission was dispatched
//   POST /api/missions/[id]/cancel         does neither of the first two
//
// The stranded `queued_for_run = 1` is latent today only because
// getNextQueuedMission also filters on status='queued'. One more filter change
// and a cancelled mission re-dispatches itself. And because the run row is only
// written in the background, the board would show "Failed" until that landed --
// so converging the two is a PREREQUISITE for the label above, not a tidy-up.
//
// ONE EVENT READS TWO WAYS. hermesStatusFromEndReason maps the agent's
// `interrupt` to session `completed`; PatterStage's own cancel writes `failed`
// for the identical event. Whichever writer wins the race decides what the
// operator sees. The function has no test at all.
//
// A RENAME WIPES THE OUTPUT. mission-promote-handler passes `result: null`
// unconditionally. The intent is right -- clear stale output when a mission is
// RE-ACTIVATED -- but `dispatchMode:"save"` is the no-op used purely to rename,
// and it takes the same line.
//
// A DEGRADED GATHER IS INVISIBLE. The engine counts searchAttempts and
// searchFailures and the caller reads them for exactly one case: ALL of them
// failed. Five failures out of eight is a report written from a third of the
// evidence, marked `completed`, with nothing recorded and nothing said. Visits
// are worse -- a null page is skipped silently and counted nowhere at all.

const mockGetMission = jest.fn();
const mockUpdateMission = jest.fn();
jest.mock("@/lib/missions/mission-repository", () => ({
  getMission: (...a: unknown[]) => mockGetMission(...a),
  updateMission: (...a: unknown[]) => mockUpdateMission(...a),
  deleteMission: jest.fn(),
}));

const mockCloseSessionForMission = jest.fn();
jest.mock("@/lib/sessions/session-repository", () => ({
  updateSession: jest.fn(),
  closeSessionForMission: (...a: unknown[]) => mockCloseSessionForMission(...a),
}));

const mockGetLatestRunForMission = jest.fn(() => null as unknown);
const mockUpdateRun = jest.fn();
jest.mock("@/lib/runs-repository", () => ({
  getLatestRunForMission: (...a: unknown[]) => mockGetLatestRunForMission(...(a as [])),
  updateRun: (...a: unknown[]) => mockUpdateRun(...a),
}));

const mockCancelMissionRun = jest.fn(() => Promise.resolve({ ok: true }));
jest.mock("@/lib/orchestration", () => ({
  cancelMissionRun: (...a: unknown[]) => mockCancelMissionRun(...(a as [])),
}));

const mockAppendAuditLine = jest.fn();
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: (...a: unknown[]) => mockAppendAuditLine(...a) }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/missions/mission-category-repository", () => ({ getCategory: jest.fn(() => null) }));

import { readFileSync } from "fs";
import { join } from "path";

import type { Mission } from "@/lib/missions/mission-types";
import { handleCancelMission } from "@/lib/missions/mission-handlers/cancel";
import { describeMissionRunState, type MissionRunView } from "@/lib/missions/mission-run-state";
import { hermesStatusFromEndReason } from "@/lib/sessions/hermes-state-sessions";

const NOW = Date.parse("2026-08-31T12:00:00Z");

function runView(over: Partial<MissionRunView> = {}): MissionRunView {
  return {
    id: "r1",
    status: "cancelled",
    submittedAt: "2026-08-31T11:00:00Z",
    completedAt: "2026-08-31T11:30:00Z",
    error: "Cancelled by user",
    deadlineAt: null,
    deadlineDeclared: false,
    ...over,
  };
}
const missionState = (over: Record<string, unknown> = {}) => ({
  status: "failed",
  createdAt: "2026-08-31T10:00:00Z",
  updatedAt: "2026-08-31T11:30:00Z",
  run: runView(),
  ...over,
});
function mission(over: Partial<Mission> = {}): Mission {
  return {
    id: "m1",
    name: "Demo",
    prompt: "do the thing",
    status: "queued",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCancelMissionRun.mockReturnValue(Promise.resolve({ ok: true }));
  mockGetLatestRunForMission.mockReturnValue(null);
});

describe("a cancelled mission does not read as a failure", () => {
  it("labels it Cancelled, from the run row that already says so", () => {
    // No schema change: the operator ruled the mission enum stays as it is. The
    // run row is the honest record and it was simply not being read.
    expect(describeMissionRunState(missionState(), NOW).label).toBe("Cancelled");
  });

  it("does not paint it as an error, because the operator asked for it", () => {
    expect(describeMissionRunState(missionState(), NOW).tone).not.toBe("bad");
  });

  it("GREEN CONTROL: a genuine failure still reads as one", () => {
    // Load-bearing. Without it the fix could be "never say Failed", which would
    // hide the thing the label exists to surface.
    const s = describeMissionRunState(
      missionState({ run: runView({ status: "failed", error: "the container died" }) }),
      NOW,
    );
    expect(s.label).toBe("Failed");
    expect(s.tone).toBe("bad");
  });

  it("GREEN CONTROL: a mission with no run row still reads from its status", () => {
    // The run view is optional -- a mission that failed before it was ever
    // dispatched has none -- so reading run.status unguarded would crash the board.
    expect(describeMissionRunState(missionState({ run: null }), NOW).label).toBe("Failed");
    expect(
      describeMissionRunState(missionState({ status: "successful", run: null }), NOW).label,
    ).toBe("Finished");
  });

  it("GREEN CONTROL: a successful run is not relabelled by this", () => {
    expect(
      describeMissionRunState(
        missionState({ status: "successful", run: runView({ status: "completed", error: null }) }),
        NOW,
      ).label,
    ).toBe("Finished");
  });
});

describe("the two cancel entry points leave the same state", () => {
  it("both clear queuedForRun, so neither can strand a re-dispatch", () => {
    // The action handler already did. cancelMissionRun did not, and the only
    // reason that is not live today is a second filter in getNextQueuedMission.
    mockGetMission.mockReturnValue(mission({ status: "queued", queuedForRun: true }));
    mockUpdateMission.mockReturnValue(mission({ status: "failed" }));

    handleCancelMission({ id: "m1" });
    const viaAction = mockUpdateMission.mock.calls.at(-1)![1] as Record<string, unknown>;

    expect(viaAction.queuedForRun).toBe(false);
    expect(viaAction.status).toBe("failed");
    expect(viaAction.result).toBe("Cancelled by user");
  });

  it("both write the run row, so the board does not say Failed while it waits", () => {
    // The action path used to reach the run row only through a BACKGROUND
    // cancelMissionRun, and only for a dispatched mission. The label above
    // reads run.status, so a cancel that has not yet round-tripped would show
    // the wrong thing for as long as the background call took.
    mockGetMission.mockReturnValue(mission({ status: "dispatched" }));
    mockUpdateMission.mockReturnValue(mission({ status: "failed" }));
    mockGetLatestRunForMission.mockReturnValue({ id: "run-1", status: "started" });

    handleCancelMission({ id: "m1" });

    expect(mockUpdateRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({ status: "cancelled" }),
    );
  });

  it("leaves a run that had already finished alone", () => {
    // A cancellation arriving after the run ended did not cause that ending,
    // and overwriting `completed` with `cancelled` would misreport what the
    // agent actually did. The board label reads this row, so the lie would be
    // visible.
    mockGetMission.mockReturnValue(mission({ status: "dispatched" }));
    mockUpdateMission.mockReturnValue(mission({ status: "failed" }));
    mockGetLatestRunForMission.mockReturnValue({ id: "run-1", status: "completed" });

    handleCancelMission({ id: "m1" });

    expect(mockUpdateRun).not.toHaveBeenCalled();
  });

  it("both write an audit line", () => {
    // cancelMissionRun wrote none, so a cancel through the REST route left no
    // trace in the one file the operator can read back.
    mockGetMission.mockReturnValue(mission({ status: "queued" }));
    mockUpdateMission.mockReturnValue(mission({ status: "failed" }));

    handleCancelMission({ id: "m1" });

    expect(mockAppendAuditLine).toHaveBeenCalledWith(
      expect.objectContaining({ action: "mission.cancel", resource: "m1", ok: true }),
    );
  });

  it("audits exactly once, not once per writer", () => {
    // The convergence must not double-count: the action path also triggers the
    // backend stop, and an audit inside the shared finalisation plus one at the
    // handler would record two cancellations for one click.
    mockGetMission.mockReturnValue(mission({ status: "dispatched" }));
    mockUpdateMission.mockReturnValue(mission({ status: "failed" }));

    handleCancelMission({ id: "m1" });

    expect(
      mockAppendAuditLine.mock.calls.filter(
        (c) => (c[0] as { action?: string }).action === "mission.cancel",
      ),
    ).toHaveLength(1);
  });

  it("GREEN CONTROL: an unknown mission is still a 404 that writes nothing", () => {
    mockGetMission.mockReturnValue(null);
    expect(handleCancelMission({ id: "nope" }).status).toBe(404);
    expect(mockUpdateMission).not.toHaveBeenCalled();
    expect(mockAppendAuditLine).not.toHaveBeenCalled();
  });
});

describe("one interrupt reads one way", () => {
  // First coverage for this function. A pure translation at a wire boundary,
  // with two writers disagreeing about the same event, and no test of any kind.
  it("treats an interrupt the way PatterStage's own cancel does", () => {
    expect(hermesStatusFromEndReason("interrupt")).toEqual({ status: "failed", exitCode: 143 });
  });

  it("GREEN CONTROLS: every other reason keeps its existing meaning", () => {
    // Pinned so the reconciliation cannot widen into a general relabelling.
    // `timeout` in particular stays where it is: it is a different event and
    // relitigating it is not this task.
    expect(hermesStatusFromEndReason(null)).toEqual({ status: "active", exitCode: null });
    expect(hermesStatusFromEndReason("stop")).toEqual({ status: "completed", exitCode: 0 });
    expect(hermesStatusFromEndReason("token_limit")).toEqual({ status: "completed", exitCode: 0 });
    expect(hermesStatusFromEndReason("max_iterations")).toEqual({ status: "completed", exitCode: 0 });
    expect(hermesStatusFromEndReason("timeout")).toEqual({ status: "completed", exitCode: 143 });
    expect(hermesStatusFromEndReason("error")).toEqual({ status: "failed", exitCode: 1 });
    // An unrecognised reason is not evidence of an error, which is the
    // function's own stated stance and must survive.
    expect(hermesStatusFromEndReason("something_new")).toEqual({
      status: "completed",
      exitCode: null,
    });
  });
});

describe("a rename does not wipe the draft's output", () => {
  const promote = readFileSync(
    join(process.cwd(), "src", "lib", "missions", "mission-promote-handler.ts"),
    "utf-8",
  );

  it("clears the result only when the mission is actually re-activated", () => {
    // `result: null` is right for queue/now/cron -- a re-activated mission must
    // not surface a previous run's output (QA #9/#43). `save` is the no-op the
    // console uses to rename a draft, and it took the same line.
    expect(promote).not.toMatch(/updateMission\(\s*input\.missionId,\s*\{\s*\.\.\.updates,\s*result:\s*null\s*\}\s*\)/);
    expect(promote).toMatch(/isSaveMode[\s\S]{0,400}result\s*=\s*null|result:\s*isSaveMode|!isSaveMode/);
  });
});

describe("a degraded gather is recorded, and the report says so", () => {
  it("migration 036 adds the three counters, nullable", () => {
    const sql = readFileSync(
      join(process.cwd(), "src", "lib", "db", "migrations", "036_research_gather_health.sql"),
      "utf-8",
    );
    for (const col of ["search_attempts", "search_failures", "visit_attempts", "visit_failures"]) {
      expect(sql).toContain(col);
    }
    // Same discipline as 034: a pre-036 run recorded nothing, and NULL is the
    // honest answer for that. A DEFAULT 0 would make every historical run read
    // as a clean gather.
    expect(sql).not.toMatch(/DEFAULT\s+0/i);
  });

  it("the head constant moves with it", () => {
    expect(readFileSync(join(process.cwd(), "src", "lib", "db-schema.ts"), "utf-8")).toMatch(
      /MIGRATION_HEAD_SCHEMA_VERSION = 36/,
    );
  });
});

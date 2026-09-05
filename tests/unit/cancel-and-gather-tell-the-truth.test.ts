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

const mockStopBackendRunForMission = jest.fn(() => Promise.resolve());
jest.mock("@/lib/orchestration", () => ({
  cancelMissionRun: jest.fn(),
  stopBackendRunForMission: (...a: unknown[]) => mockStopBackendRunForMission(...(a as [])),
}));

const mockAppendAuditLine = jest.fn();
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: (...a: unknown[]) => mockAppendAuditLine(...a) }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));
jest.mock("@/lib/schedules-repository", () => ({ createSchedule: jest.fn(() => ({ id: "s1" })) }));
const mockDispatchMissionNow = jest.fn().mockResolvedValue({ ok: true });
jest.mock("@/lib/missions/mission-dispatch", () => ({
  dispatchMissionNow: (...a: unknown[]) => mockDispatchMissionNow(...a),
}));
jest.mock("@/lib/missions/mission-queue-tick", () => ({ runMissionQueueTick: jest.fn() }));
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
  mockStopBackendRunForMission.mockReturnValue(Promise.resolve());
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
    // "Completed", not "Finished": decision 13's one vocabulary (B2, T-0096).
    expect(
      describeMissionRunState(missionState({ status: "successful", run: null }), NOW).label,
    ).toBe("Completed");
  });

  it("GREEN CONTROL: a successful run is not relabelled by this", () => {
    expect(
      describeMissionRunState(
        missionState({ status: "successful", run: runView({ status: "completed", error: null }) }),
        NOW,
      ).label,
    ).toBe("Completed");
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
  const draft = {
    id: "m_draft1",
    name: "Draft",
    prompt: "<hermes_mission></hermes_mission>",
    status: "queued",
    queuedForRun: false,
    result: "the output of the run that already happened",
  };
  const promote = async (dispatchMode: string, over: Record<string, unknown> = {}) => {
    mockGetMission.mockReturnValue(draft);
    mockUpdateMission.mockImplementation((_id: string, u: Record<string, unknown>) => ({
      ...draft,
      ...u,
    }));
    const { promoteMission } = await import("@/lib/missions/mission-promote-handler");
    await promoteMission({ missionId: "m_draft1", dispatchMode, ...over } as never);
    return mockUpdateMission.mock.calls.at(0)![1] as Record<string, unknown>;
  };

  it("keeps the result when save is being used to rename", async () => {
    // `dispatchMode:"save"` is the no-op the console uses to rename a draft or
    // edit its prompt. Nothing is being re-activated, so there is no stale
    // output to clear -- and clearing it destroyed a finished mission's report
    // with no warning and nothing to undo it with.
    const patch = await promote("save", { name: "A better name" });
    expect(patch).not.toHaveProperty("result", null);
  });

  it("GREEN CONTROL: re-activating still clears the stale result", async () => {
    // The behaviour QA #9/#43 asked for, and the reason the line exists. A
    // mission going back into the queue must not surface the previous run's
    // output as though it were the new one's.
    expect(await promote("queue")).toHaveProperty("result", null);
    jest.clearAllMocks();
    expect(await promote("now")).toHaveProperty("result", null);
  });

  it("GREEN CONTROL: save still parks the mission as a draft", async () => {
    // The rest of save's job must be untouched by the narrowing.
    expect(await promote("save", { name: "A better name" })).toHaveProperty("queuedForRun", false);
  });
});

describe("a degraded gather is recorded, and the report says so", () => {
  const CLEAN = { searchAttempts: 8, searchFailures: 0, visitAttempts: 6, visitFailures: 0 };

  it("says how much of the evidence is missing, in the report itself", async () => {
    // The counters were computed and thrown away, and the caller read them for
    // exactly ONE case: EVERY search failed. Five of eight was invisible -- a
    // report written from three sources, marked `completed`, reading exactly
    // like a healthy one.
    const { withGatherCaveat } = await import("@/lib/laboratory/deep-research/run-job");
    const out = withGatherCaveat("The answer is 42.", {
      ...CLEAN,
      searchFailures: 5,
      visitFailures: 4,
    });

    expect(out).toMatch(/5 of 8/);
    expect(out).toMatch(/4 of 6/);
    // It goes in the REPORT, not only in a column, because the report is what
    // gets read, exported and captured as an artifact.
    expect(out).toContain("The answer is 42.");
    expect(out.indexOf("Incomplete")).toBeLessThan(out.indexOf("The answer is 42."));
  });

  it("says nothing at all when the gather was clean", async () => {
    // GREEN CONTROL, and load-bearing: a caveat on every run is a caveat nobody
    // reads, which would make the degraded case invisible again by a different
    // route.
    const { withGatherCaveat } = await import("@/lib/laboratory/deep-research/run-job");
    expect(withGatherCaveat("The answer is 42.", CLEAN)).toBe("The answer is 42.");
  });

  it("reports only the half that actually degraded", async () => {
    const { withGatherCaveat } = await import("@/lib/laboratory/deep-research/run-job");
    const searchOnly = withGatherCaveat("x", { ...CLEAN, searchFailures: 2 });
    expect(searchOnly).toMatch(/2 of 8/);
    expect(searchOnly).not.toMatch(/pages could not be read/);

    const visitOnly = withGatherCaveat("x", { ...CLEAN, visitFailures: 3 });
    expect(visitOnly).toMatch(/3 of 6/);
    expect(visitOnly).not.toMatch(/searches failed/);
  });

  it("the ENGINE actually counts the failed page reads", async () => {
    // Found by mutation, not by design. Deleting `if (!page) visitFailures += 1`
    // left every assertion above green, because they all exercise the FORMATTER
    // and none of them exercise the code that produces the number. The counter
    // could have been permanently zero and the caveat would simply never have
    // mentioned visits -- which is the exact silence the counter was added to
    // break. Same lesson as T-0069's settleGroupNode.
    const { runDeepResearch } = await import("@/lib/laboratory/deep-research/engine");

    const result = await runDeepResearch("q", {
      llm: async () => ({ content: "DONE" }),
      search: {
        name: "fake",
        search: async () => [
          { title: "a", url: "https://a", snippet: "s" },
          { title: "b", url: "https://b", snippet: "s" },
        ],
      },
      // Every page read comes back with nothing usable: blocked, paywalled,
      // timed out. The old loop skipped each with a bare `if (page)`.
      visit: async () => null,
      onStep: () => {},
      maxRounds: 1,
      visitsPerRound: 2,
    });

    expect(result.visitAttempts).toBe(2);
    expect(result.visitFailures).toBe(2);
  });

  it("the ENGINE does not count a page it read successfully as a failure", async () => {
    // The other direction, so the counter cannot be "always increment".
    const { runDeepResearch } = await import("@/lib/laboratory/deep-research/engine");

    const result = await runDeepResearch("q", {
      llm: async () => ({ content: "DONE" }),
      search: {
        name: "fake",
        search: async () => [
          { title: "a", url: "https://a", snippet: "s" },
          { title: "b", url: "https://b", snippet: "s" },
        ],
      },
      visit: async (url: string) =>
        url === "https://a" ? { url, title: "a", content: "body" } : null,
      onStep: () => {},
      maxRounds: 1,
      visitsPerRound: 2,
    });

    expect(result.visitAttempts).toBe(2);
    expect(result.visitFailures).toBe(1);
    expect(result.searchFailures).toBe(0);
  });

  it("migration 036 adds the four counters, nullable and unbackfilled", () => {
    const sql = readFileSync(
      join(process.cwd(), "src", "lib", "db", "migrations", "036_research_gather_health.sql"),
      "utf-8",
    );
    for (const col of ["search_attempts", "search_failures", "visit_attempts", "visit_failures"]) {
      expect(sql).toContain(col);
    }
    // Same discipline as 034's token columns: a pre-036 run measured nothing,
    // and NULL is the honest answer for that. DEFAULT 0 would report every
    // historical run as a clean gather nobody observed.
    //
    // Scoped to the STATEMENTS. The first draft matched the whole file and went
    // red on the migration's own comment explaining why DEFAULT 0 is wrong --
    // a guard failing on its own rationale.
    const statements = sql
      .split(/\r?\n/)
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(statements).toMatch(/ALTER TABLE research_runs ADD COLUMN/);
    expect(statements).not.toMatch(/DEFAULT/i);
    expect(statements).not.toMatch(/NOT NULL/i);
  });

  it("the gather migration claims its own version, 36", async () => {
    // CHANGED at T-0076. This asserted MIGRATION_HEAD_SCHEMA_VERSION === 36,
    // which was only true while 036 happened to be the LAST migration. The head
    // moves every time anyone adds one, so pinning it here made this file fail
    // for a reason that has nothing to do with research gather counters.
    // run-migrations-upgrade.integration.test.ts is where the head belongs: it
    // asserts the head equals the last applier's gate, sits one above the gate
    // it displaced, and matches the highest file on disk. This asserts the only
    // thing that is this migration's business — its own number.
    const { RESEARCH_GATHER_SCHEMA_VERSION } = await import(
      "@/lib/db/apply-research-gather-migration"
    );
    expect(RESEARCH_GATHER_SCHEMA_VERSION).toBe(36);
  });
});

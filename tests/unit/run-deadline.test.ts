/** @jest-environment node */
//
// The deadline the reconciler enforces, published to the console. These
// constants used to be private to run-reconcile.ts, so the only way to know
// whether a two-hour run was fine or about to be killed was to read the
// reconciler's source.

import {
  DEFAULT_MAX_RUN_MINUTES,
  GRACE_MINUTES,
  buildMissionRunView,
  declaredTimeoutMinutes,
  parseRunTimestamp,
  runDeadline,
} from "@/lib/orchestration/run-deadline";
import type { RunRecord } from "@/lib/runs-repository";
import { MAX_TIMEOUT_MINUTES } from "@/lib/missions/mission-timeout";

const SUBMITTED = "2026-08-23T12:00:00.000Z";

function record(over: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "r1",
    runId: "backend-1",
    missionId: "m1",
    scheduleId: null,
    composerNodeRunId: null,
    profileName: null,
    sessionId: null,
    status: "started",
    output: null,
    usage: null,
    error: null,
    submittedAt: SUBMITTED,
    completedAt: null,
    updatedAt: SUBMITTED,
    ...over,
  };
}

describe("parseRunTimestamp", () => {
  it("reads the tz-less form the database writes as UTC", () => {
    expect(parseRunTimestamp("2026-08-23 12:00:00")).toBe(Date.parse(SUBMITTED));
    expect(parseRunTimestamp(SUBMITTED)).toBe(Date.parse(SUBMITTED));
    expect(Number.isNaN(parseRunTimestamp("nonsense"))).toBe(true);
  });
});

describe("declaredTimeoutMinutes", () => {
  it("prefers timeout over scope and ignores non-positive values", () => {
    expect(declaredTimeoutMinutes({ timeoutMinutes: 30, missionTimeMinutes: 90 })).toBe(30);
    expect(declaredTimeoutMinutes({ missionTimeMinutes: 90 })).toBe(90);
    expect(declaredTimeoutMinutes({})).toBeNull();
    expect(declaredTimeoutMinutes(null)).toBeNull();
  });

  it("treats an explicit zero timeout as 'no timeout', not as a fallback to scope", () => {
    // `??` only falls through on null/undefined, so a stored 0 wins over the
    // scope estimate and then fails the positive check. Pinned because it is
    // the reconciler's long-standing behaviour, moved here unchanged: the
    // deadline the console shows must be the deadline the reconciler enforces.
    expect(declaredTimeoutMinutes({ timeoutMinutes: 0, missionTimeMinutes: 45 })).toBeNull();
  });
});

describe("a stored timeout above the ceiling cannot replace the safety cap (T-0088)", () => {
  it("caps 1e9 at MAX_TIMEOUT_MINUTES instead of waiting forever", () => {
    // Round 6, finding 12, sharper than reported: `cap = declared ?? DEFAULT`
    // let a 1e9 timeout become the unreachable-backend deadline, so a mission
    // whose backend vanished never self-healed and wedged the single-flight
    // gate. Validation refuses it at the boundary; this is the belt for a
    // row written before the validation existed.
    expect(declaredTimeoutMinutes({ timeoutMinutes: 1e9 })).toBe(MAX_TIMEOUT_MINUTES);
    expect(declaredTimeoutMinutes({ missionTimeMinutes: 4321 })).toBe(MAX_TIMEOUT_MINUTES);
    expect(declaredTimeoutMinutes({ timeoutMinutes: 4320 })).toBe(4320);
  });
});

describe("runDeadline", () => {
  it("adds the grace window to a declared timeout", () => {
    const d = runDeadline(SUBMITTED, 30);
    expect(d).toEqual({
      at: new Date(Date.parse(SUBMITTED) + (30 + GRACE_MINUTES) * 60_000).toISOString(),
      declared: true,
    });
  });

  it("falls back to the safety cap and says so", () => {
    const d = runDeadline(SUBMITTED, null);
    expect(d).toEqual({
      at: new Date(
        Date.parse(SUBMITTED) + (DEFAULT_MAX_RUN_MINUTES + GRACE_MINUTES) * 60_000,
      ).toISOString(),
      declared: false,
    });
  });

  it("returns null rather than a deadline in 1970 for an unparseable timestamp", () => {
    expect(runDeadline("nonsense", 30)).toBeNull();
  });
});

describe("buildMissionRunView", () => {
  it("is null when the mission has never run", () => {
    expect(buildMissionRunView({ timeoutMinutes: 30 }, null)).toBeNull();
  });

  it("carries the run's verbatim error onto the wire", () => {
    const view = buildMissionRunView(
      {},
      record({ status: "failed", error: "fetch failed", completedAt: SUBMITTED }),
    );
    expect(view).toMatchObject({ status: "failed", error: "fetch failed" });
  });

  it("attaches a deadline only while the run is still going", () => {
    const live = buildMissionRunView({ timeoutMinutes: 15 }, record());
    expect(live?.deadlineAt).not.toBeNull();
    expect(live?.deadlineDeclared).toBe(true);

    // A finished run is not waiting on anything, so a deadline would render as
    // an "overdue" badge on a completed mission.
    const done = buildMissionRunView(
      { timeoutMinutes: 15 },
      record({ status: "completed", completedAt: SUBMITTED }),
    );
    expect(done?.deadlineAt).toBeNull();
    expect(done?.deadlineDeclared).toBe(false);
  });
});

/** @jest-environment node */
//
// The mission board's answer to "what is this mission doing right now".
// The bug this replaces: every card and the detail panel measured from
// mission.createdAt, so a mission authored last week and dispatched ten
// seconds ago read as seven days old, and a run that had genuinely been
// going for two hours looked no different from one that had just started.

import {
  describeMissionRunState,
  formatRunDuration,
  type MissionRunView,
} from "@/lib/missions/mission-run-state";

const NOW = Date.parse("2026-08-23T12:00:00.000Z");
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

function run(over: Partial<MissionRunView> = {}): MissionRunView {
  return {
    id: "r1",
    status: "started",
    submittedAt: at(0),
    completedAt: null,
    error: null,
    deadlineAt: null,
    deadlineDeclared: false,
    ...over,
  };
}

describe("formatRunDuration", () => {
  it("uses at most two units, seconds first", () => {
    expect(formatRunDuration(9_000)).toBe("9s");
    expect(formatRunDuration(90_000)).toBe("1m 30s");
    expect(formatRunDuration(3 * 3_600_000 + 25 * 60_000)).toBe("3h 25m");
    expect(formatRunDuration(50 * 3_600_000)).toBe("2d 2h");
  });

  it("clamps a negative span rather than rendering a minus sign", () => {
    expect(formatRunDuration(-5_000)).toBe("0s");
  });
});

describe("describeMissionRunState", () => {
  it("separates a saved draft from one waiting for the queue", () => {
    const base = { createdAt: at(120_000), updatedAt: at(120_000), status: "queued" };
    expect(describeMissionRunState({ ...base, queuedForRun: false }, NOW)).toMatchObject({
      tone: "idle",
      label: "Draft",
      duration: "2m 0s",
    });
    // "Queued", the ratified word for a mission waiting for the queue (B2, T-0096).
    expect(describeMissionRunState({ ...base, queuedForRun: true }, NOW)).toMatchObject({
      tone: "waiting",
      label: "Queued",
    });
  });

  it("measures a dispatched mission from the run, not from when it was written", () => {
    const state = describeMissionRunState(
      {
        status: "dispatched",
        // Authored a week ago; dispatched twelve seconds ago.
        createdAt: at(7 * 24 * 3_600_000),
        updatedAt: at(12_000),
        run: run({ submittedAt: at(12_000) }),
      },
      NOW,
    );
    expect(state).toMatchObject({ tone: "running", label: "Running", duration: "12s" });
  });

  it("falls back to the mission's updatedAt when the run row is not loaded yet", () => {
    const state = describeMissionRunState(
      { status: "dispatched", createdAt: at(999_000_000), updatedAt: at(65_000), run: null },
      NOW,
    );
    expect(state.duration).toBe("1m 5s");
    expect(state.note).toBeNull();
  });

  it("counts down to the deadline the reconciler will enforce", () => {
    const state = describeMissionRunState(
      {
        status: "dispatched",
        createdAt: at(600_000),
        updatedAt: at(600_000),
        run: run({ submittedAt: at(600_000), deadlineAt: at(-300_000), deadlineDeclared: true }),
      },
      NOW,
    );
    expect(state.tone).toBe("running");
    expect(state.note).toBe("5m 0s left before the declared timeout");
  });

  it("goes overdue past a declared timeout and promises the failure", () => {
    const state = describeMissionRunState(
      {
        status: "dispatched",
        createdAt: at(7_200_000),
        updatedAt: at(7_200_000),
        run: run({ submittedAt: at(7_200_000), deadlineAt: at(60_000), deadlineDeclared: true }),
      },
      NOW,
    );
    expect(state).toMatchObject({ tone: "overdue", duration: "2h 0m" });
    expect(state.note).toContain("declared timeout");
    expect(state.note).toContain("next reconcile tick will fail this run");
  });

  it("does not promise a failure past the safety cap, because the reconciler does not", () => {
    const state = describeMissionRunState(
      {
        status: "dispatched",
        createdAt: at(9_000_000),
        updatedAt: at(9_000_000),
        run: run({ submittedAt: at(9_000_000), deadlineAt: at(60_000), deadlineDeclared: false }),
      },
      NOW,
    );
    expect(state.tone).toBe("overdue");
    expect(state.note).toContain("safety cap");
    expect(state.note).toContain("once the backend stops answering");
  });

  it("reports terminal missions from the run's completion, not the mission row", () => {
    const done = describeMissionRunState(
      {
        status: "successful",
        createdAt: at(9_000_000),
        updatedAt: at(9_000_000),
        run: run({ status: "completed", completedAt: at(180_000) }),
      },
      NOW,
    );
    // "Completed", not "Finished": decision 13 ratified one status vocabulary
    // for every screen (B2, T-0096).
    expect(done).toMatchObject({ tone: "good", label: "Completed", duration: "3m 0s ago" });

    const failed = describeMissionRunState(
      { status: "failed", createdAt: at(600_000), updatedAt: at(600_000) },
      NOW,
    );
    expect(failed).toMatchObject({ tone: "bad", label: "Failed", duration: "10m 0s ago" });
  });

  it("renders an em-dash-free placeholder rather than NaN for an unparseable timestamp", () => {
    const state = describeMissionRunState(
      { status: "queued", queuedForRun: false, createdAt: "not-a-date", updatedAt: "not-a-date" },
      NOW,
    );
    expect(state.duration).toBe("—");
  });

  it("tolerates the database's timezone-less timestamp form", () => {
    const state = describeMissionRunState(
      {
        status: "dispatched",
        createdAt: "2026-08-23 11:00:00",
        updatedAt: "2026-08-23 11:59:30",
        run: null,
      },
      NOW,
    );
    expect(state.duration).toBe("30s");
  });
});

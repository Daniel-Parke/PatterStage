/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- the module under test does not exist yet; a static import would be a typecheck error rather than the runtime red this oracle is for */
// ═══════════════════════════════════════════════════════════════
// B10 oracle, group missions (D68, the "why isn't it firing" line).
//
// Written before the product code moved. Holds contract section 1.3.
//
// The defect: a mission's schedule card is dead (D68), and once it is alive
// the commonest question a scheduled mission raises has no answer on screen.
// A schedule that is paused, that has run all the times it was set to run, or
// whose next run was never computed looks exactly like one that is about to
// fire: same cadence, same "last: ok", nothing that says it is finished.
//
// The contract: one pure function, `describeScheduleFiring`, returns null when
// the schedule is going to fire and otherwise ONE sentence saying why it will
// not. Four cases, in a fixed precedence, asserted here to the character
// because the panel and the scheduled-missions list both render its output and
// a reworded string is a reworded product.
//
// This file fails today with "Cannot find module
// @/lib/missions/mission-schedule-view", which is the contract reason: the
// module is section 1.2 of the contract and does not exist yet.
// ═══════════════════════════════════════════════════════════════

/** The view the contract pins (section 1.2). Declared locally: the real type ships with the module. */
interface ScheduleView {
  id: string;
  missionId: string | null;
  name: string;
  schedule: string;
  scheduleDisplay: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  repeatTimes: number | null;
  repeatDone: number;
}

interface ScheduleViewModule {
  describeScheduleFiring: (s: ScheduleView) => string | null;
  toMissionScheduleView: (row: unknown) => ScheduleView | null;
}

function load(): ScheduleViewModule {
  return require("@/lib/missions/mission-schedule-view") as ScheduleViewModule;
}

/** A healthy schedule: linked, enabled, endless, with a next run pencilled in. */
function view(over: Partial<ScheduleView> = {}): ScheduleView {
  return {
    id: "sch-1",
    missionId: "m-1",
    name: "Nightly digest",
    schedule: "every 30m",
    scheduleDisplay: "every 30 minutes",
    enabled: true,
    nextRunAt: "2026-09-05T12:00:00.000Z",
    lastRunAt: "2026-09-05T11:30:00.000Z",
    lastStatus: "dispatched",
    repeatTimes: null,
    repeatDone: 0,
    ...over,
  };
}

describe("describeScheduleFiring: the four reasons a schedule will not fire", () => {
  it("says nothing about a schedule that is going to fire", () => {
    expect(load().describeScheduleFiring(view())).toBeNull();
  });

  it("names an orphan whose mission was deleted", () => {
    expect(load().describeScheduleFiring(view({ missionId: null }))).toBe(
      "No linked mission, so this schedule cannot fire.",
    );
  });

  it("names a paused schedule, and says what undoes it", () => {
    expect(load().describeScheduleFiring(view({ enabled: false }))).toBe(
      "Paused. It will not fire until you resume it.",
    );
  });

  it("names a finite schedule that has run its course", () => {
    // The tick nulls next_run_at when it exhausts a finite schedule, so this is
    // the shape that actually reaches the card.
    const exhausted = view({ repeatTimes: 3, repeatDone: 3, nextRunAt: null });
    expect(load().describeScheduleFiring(exhausted)).toBe(
      "Finished: it has run all 3 times it was set to run.",
    );
  });

  it("names a schedule with no next run", () => {
    expect(load().describeScheduleFiring(view({ nextRunAt: null }))).toBe(
      "No next run is set, so it will not fire again.",
    );
  });
});

describe("describeScheduleFiring: precedence is fixed", () => {
  it("puts the orphan first, ahead of paused and exhausted", () => {
    const s = view({ missionId: null, enabled: false, repeatTimes: 2, repeatDone: 2, nextRunAt: null });
    expect(load().describeScheduleFiring(s)).toBe("No linked mission, so this schedule cannot fire.");
  });

  it("puts paused ahead of exhausted", () => {
    const s = view({ enabled: false, repeatTimes: 2, repeatDone: 2, nextRunAt: null });
    expect(load().describeScheduleFiring(s)).toBe("Paused. It will not fire until you resume it.");
  });

  it("puts exhausted ahead of the missing next run, because it is the cause of it", () => {
    const s = view({ repeatTimes: 2, repeatDone: 2, nextRunAt: null });
    expect(load().describeScheduleFiring(s)).toBe("Finished: it has run all 2 times it was set to run.");
  });

  it("counts a schedule past its repeat count as finished, not merely at it", () => {
    const s = view({ repeatTimes: 2, repeatDone: 5, nextRunAt: null });
    expect(load().describeScheduleFiring(s)).toBe("Finished: it has run all 2 times it was set to run.");
  });

  it("leaves a finite schedule with repeats left alone", () => {
    expect(load().describeScheduleFiring(view({ repeatTimes: 5, repeatDone: 2 }))).toBeNull();
  });
});

describe("toMissionScheduleView: what the client is sent", () => {
  it("is null for a mission with no schedule", () => {
    expect(load().toMissionScheduleView(null)).toBeNull();
  });

  it("carries the ten fields the card reads, and nothing the client has no use for", () => {
    const row = {
      id: "sch-1",
      missionId: "m-1",
      name: "Nightly digest",
      schedule: "every 30m",
      scheduleDisplay: "every 30 minutes",
      enabled: true,
      catchUpPolicy: "fire_once",
      repeatTimes: 4,
      repeatDone: 1,
      profileName: "default",
      nextRunAt: "2026-09-05T12:00:00.000Z",
      lastRunAt: "2026-09-05T11:30:00.000Z",
      lastRunId: "run-9",
      lastStatus: "dispatched",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-05T11:30:00.000Z",
    };

    expect(load().toMissionScheduleView(row)).toEqual({
      id: "sch-1",
      missionId: "m-1",
      name: "Nightly digest",
      schedule: "every 30m",
      scheduleDisplay: "every 30 minutes",
      enabled: true,
      nextRunAt: "2026-09-05T12:00:00.000Z",
      lastRunAt: "2026-09-05T11:30:00.000Z",
      lastStatus: "dispatched",
      repeatTimes: 4,
      repeatDone: 1,
    });
  });
});

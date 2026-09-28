import type { ScheduleRecord } from "@/lib/schedule/schedules-repository";

/** A due mission schedule; callers override the fields relevant to each case. */
export function makeSchedule(overrides: Partial<ScheduleRecord> = {}): ScheduleRecord {
  return {
    id: "sch1",
    kind: "mission",
    scriptName: null,
    missionId: "m1",
    name: "S",
    schedule: "every 30m",
    scheduleDisplay: "every 30m",
    enabled: true,
    catchUpPolicy: "fire_once",
    repeatTimes: null,
    repeatDone: 0,
    profileName: null,
    nextRunAt: "2026-06-15T10:00:00.000Z",
    lastRunAt: null,
    lastRunId: null,
    lastStatus: null,
    createdAt: "2026-06-15T09:00:00.000Z",
    updatedAt: "2026-06-15T09:00:00.000Z",
    ...overrides,
  };
}

/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform */

/**
 * B10 oracle, the board's one-query schedule read (T-0104, D68).
 *
 * The sweep asked for this. The route oracle counts the CALL, so a reader that
 * asks the database for an empty page, or that picks the wrong row when a
 * mission has been rescheduled, walked through it: those are facts about the
 * repository, and this file asks the repository.
 */

import { execBaselineSchema } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;
let dbReads = 0;

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    getDb: () => {
      dbReads += 1;
      return testDb!;
    },
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});

import { listSchedulesForMissions } from "@/lib/schedules-repository";

/** Insert one schedule row directly, so createdAt is ours to choose. */
function insertSchedule(id: string, missionId: string, createdAt: string, name: string): void {
  testDb!
    .prepare(
      `INSERT INTO schedules
         (id, mission_id, name, schedule, schedule_display, enabled, catch_up_policy,
          repeat_times, repeat_done, profile_name, next_run_at, last_run_at, last_run_id,
          last_status, created_at, updated_at)
       VALUES (?, ?, ?, 'every 1h', 'every hour', 1, 'fire_once', NULL, 0, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
    )
    .run(id, missionId, name, createdAt, createdAt);
}

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => import("better-sqlite3").Database)(":memory:");
  execBaselineSchema(testDb);
  // After the schema: these rows are about the reader, not about referential
  // integrity, and inventing a mission for each one would say nothing extra.
  testDb.pragma("foreign_keys = OFF");
  dbReads = 0;
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("listSchedulesForMissions", () => {
  it("asks the database nothing at all for an empty page", () => {
    // `WHERE mission_id IN ()` is a syntax error, and an empty board has
    // nothing to ask about.
    const out = listSchedulesForMissions([]);

    expect(out.size).toBe(0);
    expect(dbReads).toBe(0);
  });

  it("takes ONE query for the whole page", () => {
    insertSchedule("s-1", "m-1", "2026-09-01T00:00:00.000Z", "one");
    insertSchedule("s-2", "m-2", "2026-09-01T00:00:00.000Z", "two");
    dbReads = 0;

    const out = listSchedulesForMissions(["m-1", "m-2", "m-3"]);

    expect(dbReads).toBe(1);
    expect([...out.keys()].sort()).toEqual(["m-1", "m-2"]);
  });

  it("gives a rescheduled mission its NEWEST schedule, as getScheduleForMission does", () => {
    insertSchedule("old", "m-1", "2026-09-01T00:00:00.000Z", "the old one");
    insertSchedule("new", "m-1", "2026-09-04T00:00:00.000Z", "the new one");

    expect(listSchedulesForMissions(["m-1"]).get("m-1")?.name).toBe("the new one");
  });

  it("GREEN CONTROL: a mission with no schedule is simply absent", () => {
    insertSchedule("s-1", "m-1", "2026-09-01T00:00:00.000Z", "one");

    const out = listSchedulesForMissions(["m-1", "m-2"]);

    expect(out.has("m-2")).toBe(false);
    expect(out.get("m-1")?.id).toBe("s-1");
  });
});

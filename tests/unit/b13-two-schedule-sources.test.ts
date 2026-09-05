/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform */

// ═══════════════════════════════════════════════════════════════
// B13 sweep answer: the two places a schedule can live, and what the first
// pass could not see from a page whose data hook was a double.
//
// FOUR GAPS.
//   1. `listScriptFiles` merges the host crontab with PatterStage's own rows,
//      and the host wins. Every case that reached it stubbed the repository to
//      an empty list, so a version that let a PatterStage row shadow a crontab
//      one, dropped `scheduleId`, or labelled everything "host" walked through.
//   2. `listScriptSchedules` filters on kind. Nothing asked it to.
//   3. `createSchedule` writes kind and script_name, and `rowToSchedule` reads
//      a pre-041 row back as a MISSION. Both were only ever seen through
//      doubles that returned the fields for it.
//   4. `parseScheduleMap` keeps the FIRST line for a script and reads only the
//      script token, not the redirect target beside it.
//
// Real SQLite for the repository half; real crontab text for the merge.
// ═══════════════════════════════════════════════════════════════

import type DatabaseNs from "better-sqlite3";

import { execBaselineSchema } from "../helpers/baseline-db";

type RealDb = DatabaseNs.Database;
let testDb: RealDb | null = null;

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    getDb: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});

import {
  createSchedule,
  getSchedule,
  listScriptSchedules,
} from "@/lib/schedules-repository";

beforeEach(() => {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (Database as unknown as new (p: string) => RealDb)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

// ═══════════════════════════════════════════════════════════════
// (1) a script row round-trips
// ═══════════════════════════════════════════════════════════════

describe("a script schedule survives the round trip", () => {
  it("keeps its kind and the script it names", () => {
    const row = createSchedule({
      kind: "script",
      scriptName: "ps-db-backup.mjs",
      name: "Ps Db Backup",
      schedule: "0 3 * * *",
    });

    expect(row.kind).toBe("script");
    expect(row.scriptName).toBe("ps-db-backup.mjs");
    // Read back through a second query, not from the insert's return value: a
    // repository that answered from its input and wrote 'mission' would pass
    // the assertion above.
    const again = getSchedule(row.id)!;
    expect(again.kind).toBe("script");
    expect(again.scriptName).toBe("ps-db-backup.mjs");
    expect(again.missionId).toBeNull();
  });

  it("GREEN CONTROL: a mission schedule is still a mission schedule", () => {
    testDb!
      .prepare(
        `INSERT INTO missions (id, name, prompt, status, created_at, updated_at)
         VALUES ('m1', 'M', '<hermes_mission></hermes_mission>', 'queued', datetime('now'), datetime('now'))`,
      )
      .run();
    const row = createSchedule({ missionId: "m1", schedule: "0 3 * * *" });
    expect(row.kind).toBe("mission");
    expect(row.scriptName).toBeNull();
  });

  it("a row written without naming a kind is a mission", () => {
    // What an INSERT written before 041 looks like. The column's DEFAULT is
    // what makes the migration backfill-free, so it is worth an assertion of
    // its own rather than a comment.
    testDb!
      .prepare(
        `INSERT INTO schedules (id, mission_id, name, schedule, created_at, updated_at)
         VALUES ('s-old', NULL, 'Nightly', '0 2 * * *', datetime('now'), datetime('now'))`,
      )
      .run();
    const row = getSchedule("s-old")!;
    expect(row.kind).toBe("mission");
    expect(row.scriptName).toBeNull();
  });
});

describe("listScriptSchedules", () => {
  it("returns the script rows and nothing else", () => {
    testDb!
      .prepare(
        `INSERT INTO missions (id, name, prompt, status, created_at, updated_at)
         VALUES ('m1', 'M', '<hermes_mission></hermes_mission>', 'queued', datetime('now'), datetime('now'))`,
      )
      .run();
    createSchedule({ missionId: "m1", schedule: "0 1 * * *" });
    createSchedule({ kind: "script", scriptName: "a.mjs", schedule: "0 2 * * *" });
    createSchedule({ kind: "script", scriptName: "b.sh", schedule: "0 3 * * *" });

    const rows = listScriptSchedules();
    expect(rows.map((r) => r.scriptName).sort()).toEqual(["a.mjs", "b.sh"]);
    // A mission row here would be offered to the Scripts page as a script's
    // schedule, under whatever name the mission happened to have.
    expect(rows.every((r) => r.kind === "script")).toBe(true);
  });
});

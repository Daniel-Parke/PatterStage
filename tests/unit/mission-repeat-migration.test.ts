/** @jest-environment node */

import { join } from "path";
import { execBaselineSchema } from "../helpers/baseline-db";
import { applyMissionRepeatMigration } from "@/lib/db/apply-mission-repeat-migration";

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

describe("applyMissionRepeatMigration", () => {
  it("repairs mission-linked cron jobs with times:1 to infinite repeat", () => {
    const Database = loadRealBetterSqlite3();
    const database = new Database(":memory:");
    execBaselineSchema(database);

    database
      .prepare(
        `INSERT INTO cron_jobs (
          id, name, prompt, skills, model, provider, base_url,
          schedule, schedule_display, repeat_json, enabled, state, deliver, script,
          profile_name, external_job_id, source, orphan, next_run_at, last_run_at,
          last_status, last_delivery_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "cj-mission",
        "Mission cron",
        "p",
        "[]",
        "",
        "",
        null,
        "{}",
        "every 5m",
        '{"times":1,"completed":0}',
        1,
        "scheduled",
        "none",
        null,
        "default",
        "cj-mission",
        "ch",
        0,
        null,
        null,
        null,
        null,
        "2026-05-01T00:00:00.000Z",
        "2026-05-01T00:00:00.000Z"
      );

    database
      .prepare(
        `INSERT INTO missions (
          id, name, prompt, status, created_at, updated_at, cron_job_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "m-1",
        "Test mission",
        "p",
        "queued",
        "2026-05-01T00:00:00.000Z",
        "2026-05-01T00:00:00.000Z",
        "cj-mission"
      );

    const migrationsDir = join(__dirname, "..", "..", "src", "lib", "db", "migrations");
    applyMissionRepeatMigration(database, migrationsDir);

    const row = database
      .prepare("SELECT repeat_json FROM cron_jobs WHERE id = ?")
      .get("cj-mission") as { repeat_json: string };

    expect(JSON.parse(row.repeat_json)).toEqual({ times: null, completed: 0 });

    const version = database
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string };
    expect(parseInt(version.value, 10)).toBe(4);

    database.close();
  });
});

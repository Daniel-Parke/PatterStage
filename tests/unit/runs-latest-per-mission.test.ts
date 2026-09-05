/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * @jest-environment node
 *
 * listLatestRunsForMissions — the mission board's run anchor for a whole page
 * in one query. The obvious alternative (getLatestRunForMission in a loop) is
 * one query per row on a 15-second poll, which is how a board with fifty
 * missions turns a freshness feature into a load problem.
 */
import type Database from "better-sqlite3";
import { join } from "path";

import { execBaselineSchema } from "../helpers/baseline-db";
import { applyRunsSchedulesMigration } from "@/lib/db/apply-runs-schedules-migration";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";

let testDb: Database.Database | null = null;

jest.mock("@/lib/db", () => ({
  getDb: () => testDb!,
  inTransaction: <T,>(fn: () => T) => fn(),
  uuid: () => "uuid",
  now: () => new Date().toISOString(),
  ensureDb: () => undefined,
}));

import { createRun, listLatestRunsForMissions, updateRun } from "@/lib/runs-repository";

function seedMission(id: string): void {
  testDb!
    .prepare(
      `INSERT INTO missions (id, name, prompt, status, created_at, updated_at)
       VALUES (?, ?, 'do the thing', 'queued', datetime('now'), datetime('now'))`,
    )
    .run(id, `mission ${id}`);
}

/** createRun stamps submitted_at with now(); the ordering here needs control of it. */
function stampSubmittedAt(runId: string, iso: string): void {
  testDb!.prepare("UPDATE runs SET submitted_at = ? WHERE id = ?").run(iso, runId);
}

beforeEach(() => {
  const RealDatabase = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  testDb = new (RealDatabase as unknown as new (path: string) => Database.Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
  // The runs table is post-baseline; apply it with the real applier rather
  // than a hand-written fixture, so this test cannot pass against a schema no
  // running install has.
  const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");
  applyRunsSchedulesMigration(testDb, migrationsDir);
  // runs.composer_node_run_id is added at v21 and written by createRun.
  applyComposerMigration(testDb, migrationsDir);
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("listLatestRunsForMissions", () => {
  it("returns the most recent run for each mission, keyed by mission id", () => {
    seedMission("m1");
    seedMission("m2");
    createRun({ id: "old", missionId: "m1" });
    stampSubmittedAt("old", "2026-08-01T10:00:00.000Z");
    createRun({ id: "new", missionId: "m1" });
    stampSubmittedAt("new", "2026-08-23T10:00:00.000Z");
    createRun({ id: "other", missionId: "m2" });
    stampSubmittedAt("other", "2026-08-10T10:00:00.000Z");
    updateRun("old", { status: "completed" });

    const byMission = listLatestRunsForMissions(["m1", "m2"]);
    expect(byMission.get("m1")?.id).toBe("new");
    expect(byMission.get("m2")?.id).toBe("other");
    expect(byMission.size).toBe(2);
  });

  it("omits missions that have never run", () => {
    seedMission("m1");
    expect(listLatestRunsForMissions(["m1"]).size).toBe(0);
  });

  it("short-circuits an empty id list rather than building IN (), which SQLite rejects", () => {
    expect(listLatestRunsForMissions([]).size).toBe(0);
  });
});

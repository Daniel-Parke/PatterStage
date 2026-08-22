/** @jest-environment node */

import { execBaselineSchema } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

jest.mock("@/lib/db", () => ({
  getDb: () => testDb!,
  ensureDb: () => undefined,
  now: () => "2026-01-01T00:00:00.000Z",
}));

import {
  auditForeignMissionModelRows,
  fixupForeignMissionModelRows,
} from "@/lib/missions/mission-model-audit";

beforeEach(() => {
  const Database = loadRealBetterSqlite3();
  testDb = new Database(":memory:");
  execBaselineSchema(testDb);
  // Seed the registry with two known models
  testDb.prepare(
    "INSERT INTO models (id, name, provider, model_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    "m1",
    "MiniMax-M3",
    "minimax",
    "MiniMax-M3",
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:00:00.000Z",
  );
  testDb.prepare(
    "INSERT INTO models (id, name, provider, model_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(
    "m2",
    "MiniMax-M2.7-highspeed",
    "minimax",
    "MiniMax-M2.7-highspeed",
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:00:00.000Z",
  );
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

function insertMission(
  id: string,
  name: string,
  modelId: string | null,
  provider: string | null,
  status: string = "successful",
): void {
  testDb!.prepare(
    `INSERT INTO missions
       (id, name, prompt, status, model_id, provider, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    name,
    "prompt",
    status,
    modelId,
    provider,
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:00:00.000Z",
  );
}

describe("auditForeignMissionModelRows", () => {
  it("returns an empty array when no missions have a model_id", () => {
    insertMission("m_clean_1", "Clean", null, null);
    expect(auditForeignMissionModelRows()).toEqual([]);
  });

  it("returns an empty array when every mission's model_id is in the registry", () => {
    insertMission("m_ok_1", "Ok 1", "MiniMax-M3", "minimax");
    insertMission("m_ok_2", "Ok 2", "MiniMax-M2.7-highspeed", "minimax");
    expect(auditForeignMissionModelRows()).toEqual([]);
  });

  it("flags missions whose model_id is not in the models table", () => {
    insertMission("m_orphan_1", "Orphan 1", "deepseek/deepseek-v4-flash", "nous");
    insertMission("m_ok_3", "Ok 3", "MiniMax-M3", "minimax");
    insertMission("m_orphan_2", "Orphan 2", "phantom/model", "phantom");

    const orphans = auditForeignMissionModelRows();
    expect(orphans).toHaveLength(2);
    const ids = orphans.map((o) => o.id).sort();
    expect(ids).toEqual(["m_orphan_1", "m_orphan_2"]);
    for (const o of orphans) {
      expect(["successful", "failed"]).toContain(o.status);
    }
  });
});

describe("fixupForeignMissionModelRows", () => {
  it("clears model_id and provider on rows whose model_id is not in the registry", () => {
    insertMission("m_orphan_3", "Orphan 3", "deepseek/deepseek-v4-flash", "nous");
    insertMission("m_ok_4", "Ok 4", "MiniMax-M3", "minimax");

    const fixed = fixupForeignMissionModelRows();
    expect(fixed).toBe(1);

    const after = testDb!
      .prepare("SELECT model_id, provider FROM missions WHERE id = ?")
      .get("m_orphan_3") as { model_id: string | null; provider: string | null };
    expect(after.model_id).toBeNull();
    expect(after.provider).toBeNull();

    // In-registry row must be untouched
    const okRow = testDb!
      .prepare("SELECT model_id, provider FROM missions WHERE id = ?")
      .get("m_ok_4") as { model_id: string | null; provider: string | null };
    expect(okRow.model_id).toBe("MiniMax-M3");
    expect(okRow.provider).toBe("minimax");
  });

  it("returns 0 when there are no orphans", () => {
    insertMission("m_ok_5", "Ok 5", "MiniMax-M3", "minimax");
    expect(fixupForeignMissionModelRows()).toBe(0);
  });

  it("does not touch rows with NULL model_id", () => {
    insertMission("m_null_1", "Null 1", null, null);
    const fixed = fixupForeignMissionModelRows();
    expect(fixed).toBe(0);
    const row = testDb!
      .prepare("SELECT model_id, provider FROM missions WHERE id = ?")
      .get("m_null_1") as { model_id: string | null; provider: string | null };
    expect(row.model_id).toBeNull();
    expect(row.provider).toBeNull();
  });
});

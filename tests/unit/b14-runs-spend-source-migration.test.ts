/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports -- better-sqlite3's package root is not newable under the jest transform, and the 040 applier is read through a loose require so this file loads before it exists */

// ═══════════════════════════════════════════════════════════════
// B14 oracle, group spend-plumbing, part one: migration 040 (D87, blocker).
//
// Written before the product code moved. Contract section 1.
//
// THE DEFECT. Every Story Weaver call goes through `callLLM` with no runs row
// behind it, so a chapter costs real money that `runs.usage_json` never sees.
// And the only source discriminator the runs table has is the structural
// `composer_node_run_id IS NOT NULL`, which can say "agent or composer" and
// nothing else — there is nowhere for a third or fourth feature to say it
// spent.
//
// THE CONTRACT. Migration 040 adds `runs.story_id` (nullable, FK to stories,
// ON DELETE SET NULL, because deleting a story must not delete the record that
// money was spent) and `runs.spend_source` (NOT NULL, DEFAULT 'agent', CHECK
// over the four SPEND_SOURCES), backfills 'composer' from the structural
// signal behind the applier's version gate, and moves the head 39 -> 40.
//
// The database is a real in-memory better-sqlite3, climbed with the REAL
// runMigrations pulled past jest.setup's global @/lib/db mock — the same
// fixture shape as b6-models-origin.test.ts, and for the same reason: the
// backfill only runs on a database that does NOT already have the columns.
// ═══════════════════════════════════════════════════════════════

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type DatabaseNs from "better-sqlite3";

import { MIGRATION_HEAD_SCHEMA_VERSION, getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { MODELS_ORIGIN_SCHEMA_VERSION } from "@/lib/db/apply-models-origin-migration";

type RealDb = DatabaseNs.Database;

const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");

// jest.setup globally mocks "@/lib/db"; runMigrations is the real wiring,
// pulled past it.
const { runMigrations } = jest.requireActual<typeof import("@/lib/db")>("@/lib/db");

// ── the applier, read loosely so this file loads before it exists ──

interface SpendSourceApplier {
  RUNS_SPEND_SOURCE_SCHEMA_VERSION: number;
  applyRunsSpendSourceMigration: (database: RealDb, dir: string) => number;
}

function loadApplier(): SpendSourceApplier | null {
  try {
    return require("@/lib/db/apply-runs-spend-source-migration") as SpendSourceApplier;
  } catch {
    return null;
  }
}

// ── helpers ─────────────────────────────────────────────────────

function openMemoryDb(): RealDb {
  const Database = require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
  const db = new (Database as unknown as new (path: string) => RealDb)(":memory:");
  db.pragma("foreign_keys = ON");
  return db;
}

function cols(db: RealDb, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}

interface RunRow {
  id: string;
  mission_id: string | null;
  composer_node_run_id: string | null;
  usage_json: string | null;
  story_id?: string | null;
  spend_source?: string;
}

function rawRun(db: RealDb, id: string): RunRow {
  return db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as RunRow;
}

/** A pre-040 database with its rows already in it — the shape an install climbs from. */
function legacyDbWithRows(seed: (db: RealDb) => void = () => {}): RealDb {
  const db = openMemoryDb();
  db.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  db.exec(readFileSync(join(migrationsDir, "001_baseline.sql"), "utf-8"));
  // 021 adds this one in TypeScript, as a guarded ALTER, so the baseline file
  // does not carry it. A pre-040 database has it; a pre-021 one does not, and
  // seeding rows that name it needs the column to exist first.
  db.exec("ALTER TABLE runs ADD COLUMN composer_node_run_id TEXT");
  setSchemaVersion(db, 2);
  seed(db);
  return db;
}

const USAGE = JSON.stringify({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });

/** A runs row as 001_baseline knows it: no story_id, no spend_source. */
function insertLegacyRun(
  db: RealDb,
  row: { id: string; missionId?: string | null; composerNodeRunId?: string | null },
): void {
  db.prepare(
    `INSERT INTO runs (id, mission_id, composer_node_run_id, status, usage_json, submitted_at, updated_at)
     VALUES (?, ?, ?, 'completed', ?, '2026-09-01 10:00:00', '2026-09-01 10:00:00')`,
  ).run(row.id, row.missionId ?? null, row.composerNodeRunId ?? null, USAGE);
}

function insertStory(db: RealDb, id: string): void {
  db.prepare(
    `INSERT INTO stories (id, title, config, chapters, chapter_contents, status, created_at, updated_at)
     VALUES (?, 'A story', '{}', '[]', '{}', 'active', '2026-09-01 10:00:00', '2026-09-01 10:00:00')`,
  ).run(id);
}

// ═══════════════════════════════════════════════════════════════
// (A) the ladder
// ═══════════════════════════════════════════════════════════════

describe("040 is a rung on the ladder", () => {
  // 040 was the head when this file was written; 041 displaced it in T-0107,
  // which this file's own contract said would happen. What is left here is the
  // part that is about 040: its gate is one above models-origin, and the ladder
  // never walks backwards past it. The head belongs to whichever oracle owns
  // the last rung.
  it("its gate sits one above models-origin, at or below the head", () => {
    const applier = loadApplier();
    expect(applier).not.toBeNull();
    expect(applier!.RUNS_SPEND_SOURCE_SCHEMA_VERSION).toBe(40);
    expect(applier!.RUNS_SPEND_SOURCE_SCHEMA_VERSION).toBe(MODELS_ORIGIN_SCHEMA_VERSION + 1);
    expect(MIGRATION_HEAD_SCHEMA_VERSION).toBeGreaterThanOrEqual(40);
  });

  it("040_runs_spend_source.sql is on disk, at or below the highest number", () => {
    const files = readdirSync(migrationsDir);
    const numbers = files.filter((f) => /^\d{3}_.*\.sql$/.test(f)).map((f) => parseInt(f.slice(0, 3), 10));
    expect(Math.max(...numbers)).toBeGreaterThanOrEqual(40);
    expect(files).toContain("040_runs_spend_source.sql");
  });

  it("the applier refuses to run twice: it gates on >= 40", () => {
    const applier = loadApplier();
    expect(applier).not.toBeNull();
    const db = legacyDbWithRows();
    setSchemaVersion(db, 40);
    expect(applier!.applyRunsSpendSourceMigration(db, migrationsDir)).toBe(40);
    // Gated out before the exec, so the columns are NOT there.
    expect(cols(db, "runs")).not.toContain("spend_source");
    db.close();
  });
});

// ═══════════════════════════════════════════════════════════════
// (B) runMigrations on a pre-040 database
// ═══════════════════════════════════════════════════════════════

describe("runMigrations on a v2 database", () => {
  it("adds story_id and spend_source to runs and climbs to the head", () => {
    const db = legacyDbWithRows();
    runMigrations(db);

    expect(cols(db, "runs")).toEqual(expect.arrayContaining(["story_id", "spend_source"]));
    expect(getSchemaVersion(db)).toBe(MIGRATION_HEAD_SCHEMA_VERSION);
    db.close();
  });

  it("backfills 'composer' from composer_node_run_id and leaves everything else 'agent'", () => {
    const db = legacyDbWithRows((seeded) => {
      insertLegacyRun(seeded, { id: "R-agent" });
      insertLegacyRun(seeded, { id: "R-composer", composerNodeRunId: "node-1" });
    });

    runMigrations(db);

    expect(rawRun(db, "R-agent").spend_source).toBe("agent");
    expect(rawRun(db, "R-composer").spend_source).toBe("composer");
    // The backfill classifies; it never invents a story link.
    expect(rawRun(db, "R-agent").story_id).toBeNull();
    expect(rawRun(db, "R-composer").story_id).toBeNull();
    db.close();
  });

  it("a second runMigrations is a no-op", () => {
    const db = legacyDbWithRows((seeded) => insertLegacyRun(seeded, { id: "R-composer", composerNodeRunId: "n" }));
    runMigrations(db);
    const before = rawRun(db, "R-composer");
    expect(before.spend_source).toBe("composer");

    expect(() => runMigrations(db)).not.toThrow();
    expect(getSchemaVersion(db)).toBe(MIGRATION_HEAD_SCHEMA_VERSION);
    expect(rawRun(db, "R-composer")).toEqual(before);
    db.close();
  });
});

// ═══════════════════════════════════════════════════════════════
// (C) what the two columns are FOR
// ═══════════════════════════════════════════════════════════════

describe("the columns hold what the contract says they hold", () => {
  function climbed(): RealDb {
    const db = legacyDbWithRows();
    runMigrations(db);
    return db;
  }

  it("spend_source admits the four sources and refuses a fifth", () => {
    const db = climbed();
    for (const source of ["agent", "composer", "research", "story"]) {
      db.prepare(
        `INSERT INTO runs (id, status, spend_source, submitted_at, updated_at)
         VALUES (?, 'completed', ?, '2026-09-01 10:00:00', '2026-09-01 10:00:00')`,
      ).run(`R-${source}`, source);
      expect(rawRun(db, `R-${source}`).spend_source).toBe(source);
    }
    expect(() =>
      db
        .prepare(
          `INSERT INTO runs (id, status, spend_source, submitted_at, updated_at)
           VALUES ('R-nope', 'completed', 'benchmark', '2026-09-01 10:00:00', '2026-09-01 10:00:00')`,
        )
        .run(),
    ).toThrow();
    db.close();
  });

  it("a row that names no source is an agent run", () => {
    const db = climbed();
    insertLegacyRun(db, { id: "R-default" });
    expect(rawRun(db, "R-default").spend_source).toBe("agent");
    db.close();
  });

  it("story_id links a spend row to its story, and deleting the story keeps the row", () => {
    const db = climbed();
    insertStory(db, "S-1");
    db.prepare(
      `INSERT INTO runs (id, story_id, spend_source, status, usage_json, submitted_at, updated_at)
       VALUES ('R-story', 'S-1', 'story', 'completed', ?, '2026-09-01 10:00:00', '2026-09-01 10:00:00')`,
    ).run(USAGE);

    expect(rawRun(db, "R-story").story_id).toBe("S-1");

    // ON DELETE SET NULL, never CASCADE: money spent is not un-spent by a
    // deleted story. (The product soft-deletes; this is the hard case.)
    db.prepare("DELETE FROM stories WHERE id = 'S-1'").run();
    const after = rawRun(db, "R-story");
    expect(after).toBeDefined();
    expect(after.story_id).toBeNull();
    expect(after.usage_json).toBe(USAGE);
    db.close();
  });
});

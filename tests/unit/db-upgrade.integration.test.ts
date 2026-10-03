/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-require-imports */

jest.unmock("better-sqlite3");

import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  BASELINE_SCHEMA_VERSION,
  exportLegacySnapshot,
  rebuildToBaseline,
} from "@/lib/db/upgrade";

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

const repoRoot = join(__dirname, "..", "..");
const baselinePath = join(repoRoot, "src", "lib", "db", "migrations", "001_baseline.sql");
const baselineSql = readFileSync(baselinePath, "utf-8");

describe("rebuildToBaseline integration", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "ch-db-upgrade-"));
    dbPath = join(tempDir, "control-hub.db");
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Windows may keep WAL handles briefly after close
    }
  });

  it("preserves models, credentials, cron_jobs, and sessions across baseline rebuild", () => {
    const Database = loadRealBetterSqlite3();
    const legacy = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
      dbPath
    );
    legacy.pragma("foreign_keys = ON");
    legacy.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO meta (key, value) VALUES ('schema_version', '32');
    `);
    legacy.exec(baselineSql);
    legacy
      .prepare("UPDATE meta SET value = ? WHERE key = 'schema_version'")
      .run("32");

    const ts = new Date().toISOString();
    legacy
      .prepare(
        "INSERT INTO credentials (id, label, provider, api_key, key_hint, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run("cred-1", "Test", "anthropic", "sk-test-key", "sk...key", ts, ts);

    legacy
      .prepare(
        "INSERT INTO models (id, name, provider, model_id, import_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .run("model-1", "claude", "anthropic", "claude-3", "imp-1", ts, ts);

    legacy
      .prepare(
        `INSERT INTO cron_jobs (
          id, name, prompt, schedule, schedule_display, profile_name, source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run("cron-1", "Daily", "run task", "0 9 * * *", "9am daily", "default", "ch", ts, ts);

    legacy
      .prepare(
        `INSERT INTO missions (id, name, prompt, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run("m-legacy", "Legacy Mission", "do work", "queued", ts, ts);

    legacy
      .prepare(
        `INSERT INTO sessions (id, agent_type, source, mission_id, started_at, status)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run("sess-1", "hermes", "mission", "m-legacy", ts, "active");

    const snapshot = exportLegacySnapshot(legacy);
    expect(snapshot.missions).toHaveLength(1);
    expect(snapshot.tables.credentials).toHaveLength(1);
    expect(snapshot.tables.models).toHaveLength(1);
    expect(snapshot.tables.cron_jobs).toHaveLength(1);
    expect(snapshot.tables.sessions).toHaveLength(1);

    rebuildToBaseline(legacy, dbPath, baselineSql);

    const reopened = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(
      dbPath
    );
    reopened.pragma("foreign_keys = ON");

    const version = reopened
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string };
    expect(parseInt(version.value, 10)).toBe(BASELINE_SCHEMA_VERSION);

    expect(
      (reopened.prepare("SELECT COUNT(*) AS n FROM credentials").get() as { n: number }).n
    ).toBeGreaterThanOrEqual(1);
    expect(
      (reopened.prepare("SELECT COUNT(*) AS n FROM models").get() as { n: number }).n
    ).toBeGreaterThanOrEqual(1);
    expect(
      (reopened.prepare("SELECT COUNT(*) AS n FROM cron_jobs").get() as { n: number }).n
    ).toBe(1);
    expect(reopened.prepare("SELECT id FROM missions WHERE id = ?").get("m-legacy")).toBeDefined();
    expect(
      (reopened.prepare("SELECT COUNT(*) AS n FROM sessions").get() as { n: number }).n
    ).toBe(1);

    reopened.close();
  });
});

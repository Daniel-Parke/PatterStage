/** @jest-environment node */
// ═══════════════════════════════════════════════════════════════
// Migration 030: the only RENAME in the chain, against real SQLite.
//
// Every other migration adds or creates, and is naturally idempotent. A rename
// is not: run it twice and SQLite throws "no such column". It also has to survive
// the table-creating paths that do NOT go through the migration chain
// (db/profiles-tools-parity-ensure.ts and scripts/tooling/db-schema-ensure.mjs
// both CREATE TABLE IF NOT EXISTS agent_root), so ordering is not guaranteed on
// every install shape.
//
// The properties that matter are therefore: data survives, constraints survive,
// and it is a no-op under every ordering rather than a throw.
// ═══════════════════════════════════════════════════════════════

import { join } from "path";
import type DatabaseNs from "better-sqlite3";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";
import { applyNeutralColumnNames } from "@/lib/db/apply-neutral-column-names";

type RealDb = DatabaseNs.Database;

const Database = jest.requireActual(
  join(process.cwd(), "node_modules", "better-sqlite3", "lib", "index.js"),
) as unknown as new (path: string) => RealDb;

function cols(db: RealDb, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}
function indexNames(db: RealDb, table: string): string[] {
  return (db.prepare(`PRAGMA index_list(${table})`).all() as { name: string }[]).map((r) => r.name);
}

/** A v29-shaped DB carrying the two vendor-named columns, with real values. */
function legacyDb(): RealDb {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE agent_root (
      id        INTEGER PRIMARY KEY CHECK (id = 1),
      soul_md   TEXT NOT NULL DEFAULT '',
      agents_md TEXT NOT NULL DEFAULT '',
      hermes_md TEXT NOT NULL DEFAULT '',
      user_md   TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO agent_root (id, soul_md, agents_md, hermes_md, user_md)
      VALUES (1, 'soul', 'agents', 'HERMES BODY', 'user');
    CREATE TABLE cron_jobs (
      id            TEXT PRIMARY KEY,
      hermes_job_id TEXT UNIQUE,
      schedule      TEXT
    );
    CREATE INDEX idx_cron_hermes_id ON cron_jobs(hermes_job_id) WHERE hermes_job_id IS NOT NULL;
    INSERT INTO cron_jobs (id, hermes_job_id, schedule) VALUES ('c1', 'job-abc', 'every 5m');
    INSERT INTO cron_jobs (id, hermes_job_id, schedule) VALUES ('c2', NULL, 'every 1h');
  `);
  setSchemaVersion(db, 29);
  return db;
}

describe("applyNeutralColumnNames (030)", () => {
  it("renames both columns and reports v30", () => {
    const db = legacyDb();
    expect(applyNeutralColumnNames(db)).toBe(30);
    expect(getSchemaVersion(db)).toBe(30);
    expect(cols(db, "agent_root")).toContain("framework_md");
    expect(cols(db, "agent_root")).not.toContain("hermes_md");
    expect(cols(db, "cron_jobs")).toContain("external_job_id");
    expect(cols(db, "cron_jobs")).not.toContain("hermes_job_id");
    db.close();
  });

  it("preserves the data, which is the whole risk of a rename", () => {
    const db = legacyDb();
    applyNeutralColumnNames(db);
    const root = db.prepare("SELECT * FROM agent_root WHERE id=1").get() as Record<string, string>;
    expect(root.framework_md).toBe("HERMES BODY");
    // Siblings one character apart must not have been touched.
    expect(root.soul_md).toBe("soul");
    expect(root.agents_md).toBe("agents");
    const job = db.prepare("SELECT * FROM cron_jobs WHERE id='c1'").get() as Record<string, string>;
    expect(job.external_job_id).toBe("job-abc");
    expect((db.prepare("SELECT COUNT(*) c FROM cron_jobs").get() as { c: number }).c).toBe(2);
    db.close();
  });

  it("keeps the UNIQUE constraint, so duplicate job ids stay impossible", () => {
    const db = legacyDb();
    applyNeutralColumnNames(db);
    expect(() =>
      db.prepare("INSERT INTO cron_jobs (id, external_job_id) VALUES ('c3','job-abc')").run(),
    ).toThrow();
    db.close();
  });

  it("renames the index too, not just the column it points at", () => {
    // SQLite rewrites an index's column REFERENCE on rename but keeps its old
    // NAME, which would leave idx_cron_hermes_id over external_job_id.
    const db = legacyDb();
    applyNeutralColumnNames(db);
    expect(indexNames(db, "cron_jobs")).toContain("idx_cron_external_id");
    expect(indexNames(db, "cron_jobs")).not.toContain("idx_cron_hermes_id");
    db.close();
  });

  it("is a no-op on a second run rather than throwing 'no such column'", () => {
    const db = legacyDb();
    applyNeutralColumnNames(db);
    expect(() => applyNeutralColumnNames(db)).not.toThrow();
    expect(getSchemaVersion(db)).toBe(30);
    db.close();
  });

  it("is a no-op when a table was already created with the NEW names", () => {
    // The ordering hazard: an ensure-path can create agent_root before the
    // migration chain reaches v30.
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE agent_root (id INTEGER PRIMARY KEY, framework_md TEXT NOT NULL DEFAULT '');
      INSERT INTO agent_root (id, framework_md) VALUES (1, 'already correct');
    `);
    setSchemaVersion(db, 29);

    expect(() => applyNeutralColumnNames(db)).not.toThrow();

    expect(cols(db, "agent_root")).toContain("framework_md");
    expect(
      (db.prepare("SELECT framework_md FROM agent_root WHERE id=1").get() as {
        framework_md: string;
      }).framework_md,
    ).toBe("already correct");
    db.close();
  });

  it("survives a minimal schema with neither table present", () => {
    const db = new Database(":memory:");
    db.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
    setSchemaVersion(db, 29);
    expect(() => applyNeutralColumnNames(db)).not.toThrow();
    expect(getSchemaVersion(db)).toBe(30);
    db.close();
  });

  it("does nothing when the DB is already past v30", () => {
    const db = legacyDb();
    setSchemaVersion(db, 31);
    expect(applyNeutralColumnNames(db)).toBe(31);
    // The version guard wins: an old-named column at a newer version is left
    // alone rather than silently rewritten.
    expect(cols(db, "agent_root")).toContain("hermes_md");
    db.close();
  });
});

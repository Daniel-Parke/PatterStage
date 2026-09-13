/** @jest-environment node */

// Tests for the schedule-canonicalisation migration
// (src/lib/db/apply-cron-schedule-canonicalisation.ts). Exercises the
// rewriter against the four storage shapes that exist in the wild so
// future refactors can't silently re-break the contract.
//
// The default jest config swaps `better-sqlite3` for a minimal mock
// (see tests/__mocks__/better-sqlite3.cjs), so this test installs a
// richer in-memory mock via `jest.mock` for the duration of the
// suite. The mock implements the subset of `better-sqlite3` the
// migration uses: prepare().run / .all / .get and exec.

import {
  applyCronScheduleCanonicalisation,
  CRON_SCHEDULE_CANONICALISATION_SCHEMA_VERSION,
} from "@/lib/db/apply-cron-schedule-canonicalisation";
import { getSchemaVersion, setSchemaVersion } from "@/lib/db-schema";

interface Row {
  [key: string]: unknown;
}

interface PrepareStub {
  run: (...args: unknown[]) => { changes: number };
  get: (...args: unknown[]) => Row | undefined;
  all: (...args: unknown[]) => Row[];
}

interface DbStub {
  pragma: (sql: string) => unknown;
  exec: (sql: string) => void;
  prepare: (sql: string) => PrepareStub;
  transaction: (fn: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown;
  _tables: Record<string, Row[]>;
  _schema: Record<string, { name: string }[]>;
  _meta: Record<string, string>;
}

function makeDbStub(): DbStub {
  const tables: Record<string, Row[]> = {};
  const schema: Record<string, { name: string }[]> = {};
  const meta: Record<string, string> = {};

  // Track rows by their SELECT-prepared statements. The migration
  // does: SELECT id, schedule FROM cron_jobs; UPDATE cron_jobs SET
  // schedule = ?, updated_at = ? WHERE id = ?; INSERT OR REPLACE INTO
  // meta.
  function makePrepare(sql: string): PrepareStub {
    const selectMatch = sql.match(/^SELECT\s+id,\s*schedule\s+FROM\s+cron_jobs$/i);
    const updateMatch = sql.match(/^UPDATE\s+cron_jobs\s+SET\s+schedule\s*=\s*\?,\s*updated_at\s*=\s*\?\s+WHERE\s+id\s*=\s*\?$/i);
    const metaInsertMatch = sql.match(/^INSERT\s+OR\s+REPLACE\s+INTO\s+meta\s*\(key,\s*value\)\s+VALUES\s*\(\?,\s*\?\)$/i);
    const metaSelectMatch = sql.match(/^SELECT\s+value\s+FROM\s+meta\s+WHERE\s+key\s*=\s*\?$/i);

    return {
      run: (...args: unknown[]) => {
        if (updateMatch) {
          const [schedule, _updatedAt, id] = args as [string, string, string];
          const rows = tables.cron_jobs ?? [];
          const row = rows.find((r) => r.id === id);
          if (row) {
            row.schedule = schedule;
            row.updated_at = _updatedAt;
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (metaInsertMatch) {
          const [key, value] = args as [string, string];
          meta[key] = String(value);
          return { changes: 1 };
        }
        return { changes: 0 };
      },
      get: (...args: unknown[]) => {
        if (metaSelectMatch) {
          const [key] = args as [string];
          const value = meta[key];
          return value === undefined ? undefined : { value };
        }
        return undefined;
      },
      all: (..._args: unknown[]) => {
        if (selectMatch) {
          return (tables.cron_jobs ?? []).map((r) => ({
            id: r.id,
            schedule: r.schedule,
          }));
        }
        return [];
      },
    };
  }

  return {
    _tables: tables,
    _schema: schema,
    _meta: meta,
    pragma: () => undefined,
    exec: () => undefined,
    prepare: (sql: string) => makePrepare(sql),
    // The migration wraps the rewrite in db.transaction(fn). The
    // mock's transaction simply invokes the function and returns its
    // value. (The mock at tests/__mocks__/better-sqlite3.cjs does
    // the same.)
    transaction: (fn: (...args: unknown[]) => unknown) => (...args: unknown[]) => fn(...args),
  };
}

function insertJob(db: DbStub, id: string, schedule: string, display: string | null = null): void {
  if (!db._tables.cron_jobs) db._tables.cron_jobs = [];
  db._tables.cron_jobs.push({
    id,
    name: `job-${id}`,
    schedule,
    schedule_display: display,
    repeat_json: '{"times":1,"completed":0}',
    enabled: 1,
    state: "scheduled",
    deliver: "none",
    profile_name: "default",
    source: "ch",
    orphan: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

function readSchedule(db: DbStub, id: string): string {
  const row = db._tables.cron_jobs.find((r) => r.id === id);
  if (!row) throw new Error(`No row with id ${id}`);
  return String(row.schedule);
}

describe("applyCronScheduleCanonicalisation", () => {
  it("rewrites a JSON-stringified ParsedSchedule to its raw cron expression", () => {
    const db = makeDbStub();
    const stored = JSON.stringify({ kind: "cron", expr: "0 9 * * 1-5", display: "0 9 * * 1-5" });
    insertJob(db, "a", stored, "0 9 * * 1-5");

    const rewritten = applyCronScheduleCanonicalisation(db as unknown as Parameters<typeof applyCronScheduleCanonicalisation>[0]);
    expect(rewritten).toBe(1);
    expect(readSchedule(db, "a")).toBe("0 9 * * 1-5");
  });

  it("recovers the raw cron from the corrupted {kind: invalid, raw: '...'} shape", () => {
    const db = makeDbStub();
    const inner = JSON.stringify({ kind: "cron", expr: "30 14 * * 1", display: "30 14 * * 1" });
    const corrupted = JSON.stringify({
      kind: "invalid",
      raw: inner,
      message: `Unrecognized schedule: ${inner}`,
      display: "30 14 * * 1",
    });
    insertJob(db, "b", corrupted, "30 14 * * 1");

    const rewritten = applyCronScheduleCanonicalisation(db as unknown as Parameters<typeof applyCronScheduleCanonicalisation>[0]);
    expect(rewritten).toBe(1);
    expect(readSchedule(db, "b")).toBe("30 14 * * 1");
  });

  it("leaves a row that's already in the canonical raw-cron form untouched", () => {
    const db = makeDbStub();
    insertJob(db, "c", "*/5 * * * *", "*/5 * * * *");

    const rewritten = applyCronScheduleCanonicalisation(db as unknown as Parameters<typeof applyCronScheduleCanonicalisation>[0]);
    expect(rewritten).toBe(0);
    expect(readSchedule(db, "c")).toBe("*/5 * * * *");
  });

  it("bumps schema_version to the canonicalisation version", () => {
    const db = makeDbStub();
    insertJob(db, "d", "0 9 * * 1-5", "0 9 * * 1-5");

    setSchemaVersion(db as unknown as Parameters<typeof setSchemaVersion>[0], 0);
    expect(getSchemaVersion(db as unknown as Parameters<typeof getSchemaVersion>[0])).toBe(0);

    applyCronScheduleCanonicalisation(db as unknown as Parameters<typeof applyCronScheduleCanonicalisation>[0]);
    expect(getSchemaVersion(db as unknown as Parameters<typeof getSchemaVersion>[0])).toBe(CRON_SCHEDULE_CANONICALISATION_SCHEMA_VERSION);
  });

  it("is idempotent — running twice does not double-rewrite", () => {
    const db = makeDbStub();
    const stored = JSON.stringify({ kind: "cron", expr: "0 9 * * 1-5", display: "0 9 * * 1-5" });
    insertJob(db, "e", stored, "0 9 * * 1-5");

    expect(applyCronScheduleCanonicalisation(db as unknown as Parameters<typeof applyCronScheduleCanonicalisation>[0])).toBe(1);
    expect(applyCronScheduleCanonicalisation(db as unknown as Parameters<typeof applyCronScheduleCanonicalisation>[0])).toBe(0);
    expect(readSchedule(db, "e")).toBe("0 9 * * 1-5");
  });

  it("returns 0 and is a no-op for an empty table", () => {
    const db = makeDbStub();
    expect(applyCronScheduleCanonicalisation(db as unknown as Parameters<typeof applyCronScheduleCanonicalisation>[0])).toBe(0);
  });

  it("rewrites a mix of canonical + legacy + corrupted rows in one pass", () => {
    const db = makeDbStub();
    // Already canonical
    insertJob(db, "ok1", "0 12 * * *", "0 12 * * *");
    // Legacy JSON-stringified ParsedSchedule
    insertJob(db, "ok2", JSON.stringify({ kind: "cron", expr: "0 9 * * 1-5", display: "0 9 * * 1-5" }), "0 9 * * 1-5");
    // Corrupted (the live mission's current shape)
    const inner = JSON.stringify({ kind: "cron", expr: "0 * * * *", display: "0 * * * *" });
    const corrupted = JSON.stringify({
      kind: "invalid",
      raw: inner,
      message: `Unrecognized schedule: ${inner}`,
      display: "0 * * * *",
    });
    insertJob(db, "ok3", corrupted, "0 * * * *");

    const rewritten = applyCronScheduleCanonicalisation(db as unknown as Parameters<typeof applyCronScheduleCanonicalisation>[0]);
    expect(rewritten).toBe(2);
    expect(readSchedule(db, "ok1")).toBe("0 12 * * *");
    expect(readSchedule(db, "ok2")).toBe("0 9 * * 1-5");
    expect(readSchedule(db, "ok3")).toBe("0 * * * *");
  });

  // ── "every Nm / Nh / Nd" shorthand rewrite (session 2026-06-10) ──
  // The live "Review & Refactor" mission had `schedule = "every 30m"`
  // stored verbatim in the DB. The pre-v7 migration treated this as
  // already-canonical and left it alone, which left the cron in a
  // broken state (the push path produced `{kind: "every 30m", ...}` in
  // jobs.json, an invalid `kind` the Python scheduler can't compute
  // `next_run_at` from). v7 rewrites the shorthand to a 5-field cron.
  it("rewrites 'every Nm' shorthand to a 5-field cron expression", () => {
    const db = makeDbStub();
    insertJob(db, "iv1", "every 30m", "every 30m");
    const rewritten = applyCronScheduleCanonicalisation(db as unknown as Parameters<typeof applyCronScheduleCanonicalisation>[0]);
    expect(rewritten).toBe(1);
    expect(readSchedule(db, "iv1")).toBe("*/30 * * * *");
  });

  it("rewrites 'every Nh' shorthand to a 5-field cron expression", () => {
    const db = makeDbStub();
    insertJob(db, "iv2", "every 2h", "every 2h");
    const rewritten = applyCronScheduleCanonicalisation(db as unknown as Parameters<typeof applyCronScheduleCanonicalisation>[0]);
    expect(rewritten).toBe(1);
    expect(readSchedule(db, "iv2")).toBe("0 */2 * * *");
  });

  it("rewrites 'every Nd' shorthand to a 5-field cron expression", () => {
    const db = makeDbStub();
    insertJob(db, "iv3", "every 1d", "every 1d");
    const rewritten = applyCronScheduleCanonicalisation(db as unknown as Parameters<typeof applyCronScheduleCanonicalisation>[0]);
    expect(rewritten).toBe(1);
    expect(readSchedule(db, "iv3")).toBe("0 0 * * *");
  });

  it("leaves an unsupported shorthand (e.g. 'every 1w') unchanged", () => {
    const db = makeDbStub();
    insertJob(db, "iv4", "every 1w", "every 1w");
    const rewritten = applyCronScheduleCanonicalisation(db as unknown as Parameters<typeof applyCronScheduleCanonicalisation>[0]);
    expect(rewritten).toBe(0);
    expect(readSchedule(db, "iv4")).toBe("every 1w");
  });
});

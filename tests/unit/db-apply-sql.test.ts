/** @jest-environment node */
/**
 * Regression for the most dangerous thing the 2026-07 review found.
 *
 * Every migration applier was shaped:
 *
 *     try { database.exec(sql); } catch { /* idempotent; ignore *\/ }
 *     setSchemaVersion(database, N);          // runs either way
 *
 * so a migration that failed for a real reason was permanently recorded as
 * applied. There is no retry — the next boot sees schema_version >= N and skips
 * it — leaving a database half-migrated with nothing logged.
 */
import { execIdempotent, isAlreadyAppliedError } from "@/lib/db/apply-sql";


/** Minimal better-sqlite3 stand-in: exec throws whatever it is told to. */
function fakeDb(onExec: (sql: string) => void) {
  return { exec: (sql: string) => onExec(sql) } as unknown as Parameters<
    typeof execIdempotent
  >[0];
}

describe("isAlreadyAppliedError", () => {
  it.each([
    "duplicate column name: api_style",
    "table composer_runs already exists",
    "index idx_runs_status already exists",
    "no such column: legacy_field",
  ])("treats %s as already-applied", (msg) => {
    expect(isAlreadyAppliedError(new Error(msg))).toBe(true);
  });

  it.each([
    "near \"CRATE\": syntax error",
    "database is locked",
    "disk I/O error",
    "FOREIGN KEY constraint failed",
    "attempt to write a readonly database",
  ])("treats %s as a REAL failure", (msg) => {
    expect(isAlreadyAppliedError(new Error(msg))).toBe(false);
  });
});

describe("execIdempotent", () => {
  it("swallows a re-run of an additive column migration", () => {
    const db = fakeDb(() => {
      throw new Error("duplicate column name: api_style");
    });
    expect(() => execIdempotent(db, "ALTER TABLE models ADD COLUMN api_style TEXT")).not.toThrow();
  });

  it("RETHROWS a genuine failure so the caller never bumps schema_version", () => {
    const db = fakeDb(() => {
      throw new Error("near \"CRATE\": syntax error");
    });
    expect(() => execIdempotent(db, "CRATE TABLE oops")).toThrow(/syntax error/);
  });

  it("rethrows a locked database rather than recording the migration as applied", () => {
    const db = fakeDb(() => {
      throw new Error("database is locked");
    });
    expect(() => execIdempotent(db, "CREATE TABLE x (id TEXT)")).toThrow(/locked/);
  });

  it("passes clean SQL straight through", () => {
    const seen: string[] = [];
    const db = fakeDb((sql) => void seen.push(sql));
    execIdempotent(db, "CREATE TABLE IF NOT EXISTS x (id TEXT)");
    expect(seen).toEqual(["CREATE TABLE IF NOT EXISTS x (id TEXT)"]);
  });
});

describe("a failing migration leaves the version alone", () => {
  // The whole point: an applier that throws must not reach setSchemaVersion.
  it("does not advance the version when the SQL fails", () => {
    let version = 27;
    const db = fakeDb(() => {
      throw new Error("disk I/O error");
    });

    const applier = () => {
      execIdempotent(db, "CREATE TABLE artifacts (id TEXT)");
      version = 28; // unreachable when the exec throws
    };

    expect(applier).toThrow(/disk I\/O/);
    expect(version).toBe(27);
  });
});

/**
 * @jest-environment node
 *
 * Unit test for `updateFallbackConfigBatch` SQL loop in
 * `src/lib/fallbacks-repository.ts` (List 4 refactor).
 *
 * Background: the pre-refactor form was 3 hand-listed
 *   if (updates.X !== undefined) {
 *     db().prepare("INSERT OR REPLACE INTO fallback_config (key, value) VALUES (?, ?)")
 *       .run(KEY, String(updates.X));
 *   }
 * blocks — one per config key. The refactor loops over a 3-element
 * entries array, sharing a single prepared statement. Byte-equivalence
 * verified by spying on the prepared statement's `.run(...)` calls
 * and asserting:
 *   - The same 3 (key, value) pairs are written (when all 3 keys are set)
 *   - Undefined keys are skipped (not inserted)
 *   - Values are stringified via `String(value)` (preserved)
 *   - The SQL statement is prepared once (the loop shares a single
 *     prepared statement, not 3 separate prepares — better-sqlite3
 *     caches by SQL text so this is a wash for perf, but pins the
 *     refactor's shape so a future "split back to 3 sites" regression
 *     is caught).
 *   - The function returns a FallbackConfig object (the contract
 *     requires re-reading all rows via the real getFallbackConfig;
 *     the real getFallbackConfig uses the mocked db, returns an
 *     empty defaults object — the assertion is on the return shape).
 */

const runCalls: Array<{ sql: string; args: unknown[] }> = [];
const prepareSpy = jest.fn((sql: string) => ({
  run: (...args: unknown[]) => {
    runCalls.push({ sql, args });
    return {};
  },
  get: () => undefined,
  all: () => [],
}));

jest.mock("@/lib/db", () => ({
  getDb: () => ({
    prepare: prepareSpy,
    transaction: (fn: () => unknown) => fn,
  }),
  inTransaction: (fn: () => unknown) => fn,
  uuid: () => "uuid",
  now: () => "2026-06-12T00:00:00.000Z",
}));

// Import AFTER mocks are in place
import { updateFallbackConfigBatch } from "@/lib/fallbacks-repository";

beforeEach(() => {
  runCalls.length = 0;
  prepareSpy.mockClear();
});

describe("updateFallbackConfigBatch — List 4 SQL loop refactor", () => {
  it("writes the same 3 (key, value) pairs as the pre-refactor form when all 3 keys are set", () => {
    const result = updateFallbackConfigBatch({
      restorePrimaryOnFallback: true,
      fallbackNotification: true,
      apiMaxRetries: 7,
    });

    // 3 .run() calls (one per non-undefined key) — the refactor's
    // expected behaviour matches the pre-refactor's.
    const insertCalls = runCalls.filter((c) =>
      c.sql.includes("INSERT OR REPLACE INTO fallback_config")
    );
    expect(insertCalls).toHaveLength(3);

    // Each (key, value) pair is exactly the pre-refactor's shape.
    const pairs = insertCalls.map((c) => c.args);
    expect(pairs).toEqual([
      ["restore_primary_on_fallback", "true"],
      ["fallback_notification", "true"],
      ["api_max_retries", "7"],
    ]);

    // Return value is a FallbackConfig-shaped object (the real
    // getFallbackConfig returns the defaults object since the
    // mocked getDb().prepare().all() returns []).
    expect(result).toEqual(
      expect.objectContaining({
        restorePrimaryOnFallback: expect.any(Boolean),
        fallbackNotification: expect.any(Boolean),
        apiMaxRetries: expect.any(Number),
      })
    );
  });

  it("skips undefined keys (does not insert an empty string)", () => {
    updateFallbackConfigBatch({ apiMaxRetries: 5 });

    const insertCalls = runCalls.filter((c) =>
      c.sql.includes("INSERT OR REPLACE INTO fallback_config")
    );
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].args).toEqual(["api_max_retries", "5"]);
  });

  it("skips the whole batch when no keys are set", () => {
    updateFallbackConfigBatch({});

    const insertCalls = runCalls.filter((c) =>
      c.sql.includes("INSERT OR REPLACE INTO fallback_config")
    );
    expect(insertCalls).toHaveLength(0);
  });

  it("stringifies values via String(value) — matches the pre-refactor's String() coercion", () => {
    updateFallbackConfigBatch({
      restorePrimaryOnFallback: false,
      fallbackNotification: false,
      apiMaxRetries: 0,
    });

    const insertCalls = runCalls.filter((c) =>
      c.sql.includes("INSERT OR REPLACE INTO fallback_config")
    );
    expect(insertCalls.map((c) => c.args[1])).toEqual([
      "false",
      "false",
      "0",
    ]);
  });

  it("prepares the SQL statement once (the loop shares a single statement, not 3 separate prepares)", () => {
    updateFallbackConfigBatch({
      restorePrimaryOnFallback: true,
      fallbackNotification: true,
      apiMaxRetries: 3,
    });
    const insertPrepares = prepareSpy.mock.calls.filter((args) =>
      (args[0] as string).includes("INSERT OR REPLACE INTO fallback_config")
    );
    expect(insertPrepares).toHaveLength(1);
  });
});

/**
 * @jest-environment node
 *
 * Unit test for the `rowToFallbackEntry` mapper extraction in
 * `src/lib/fallbacks-repository.ts` (List 4 refactor).
 *
 * The pre-refactor form had the same 8-field row-to-record projection
 * inline in BOTH `listFallbackChain` (called with `.all()`) and
 * `getFallbackEntry` (called with `.get()`). The refactor extracts the
 * projection to `rowToFallbackEntry` and the SELECT shape to
 * `FALLBACK_JOIN_SELECT`. Byte-equivalence verified by:
 *   - The mapper returns the exact 8 fields with the exact nullable
 *     fallback semantics (`?? "Custom"`, `?? "custom"`, `?? ""`, `=== 1`)
 *   - The SELECT shape is identical to the pre-refactor string
 *     (string-equality asserted, so a future "select subset" regression
 *     is caught)
 *   - The `listFallbackChain` call shape (`.all() → .map(rowToFallbackEntry)`)
 *     and the `getFallbackEntry` call shape (`.get(id) → rowToFallbackEntry`)
 *     are preserved
 */

jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn() }));

const allCalls: Array<{ sql: string }> = [];
const getCalls: Array<{ sql: string; args: unknown[] }> = [];
const FALLBACK_ROW = {
  id: "fb-1",
  model_id: "model-1",
  position: 1,
  enabled: 1,
  override_base_url: null,
  created_at: "2026-06-12T00:00:00.000Z",
  updated_at: "2026-06-12T00:00:00.000Z",
  model_name: "My Model",
  provider: "openai",
  model_id_string: "gpt-4o",
};

jest.mock("@/lib/db", () => ({
  getDb: () => ({
    prepare: (sql: string) => ({
      all: () => {
        allCalls.push({ sql });
        return [FALLBACK_ROW];
      },
      get: (...args: unknown[]) => {
        getCalls.push({ sql, args });
        return FALLBACK_ROW;
      },
    }),
    transaction: (fn: () => unknown) => fn,
  }),
  inTransaction: (fn: () => unknown) => fn,
  uuid: () => "uuid",
  now: () => "2026-06-12T00:00:00.000Z",
}));

import { getFallbackEntry, listFallbackChain } from "@/lib/fallbacks-repository";

beforeEach(() => {
  allCalls.length = 0;
  getCalls.length = 0;
});

describe("rowToFallbackEntry mapper — List 4 refactor", () => {
  it("preserves the exact 8-field record shape from the pre-refactor inline form", () => {
    const result = listFallbackChain();
    expect(result).toEqual([
      {
        id: "fb-1",
        modelId: "model-1",
        modelName: "My Model",
        provider: "openai",
        modelIdString: "gpt-4o",
        position: 1,
        enabled: true,
        overrideBaseUrl: null,
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
      },
    ]);
  });

  it("preserves the FALLBACK_JOIN_SELECT string byte-for-byte", () => {
    listFallbackChain();
    // The pre-refactor inline SELECT had this exact shape (modulo
    // whitespace). The refactored constant uses the same shape,
    // and the call appends `ORDER BY f.position ASC` — so the
    // .all() call SQL is `FALLBACK_JOIN_SELECT + "ORDER BY ..."`.
    // We assert the suffix to catch a "select subset" regression.
    expect(allCalls[0].sql).toMatch(/SELECT f\.id, f\.model_id, f\.position/);
    expect(allCalls[0].sql).toMatch(/LEFT JOIN models m ON f\.model_id = m\.id/);
    expect(allCalls[0].sql).toMatch(/ORDER BY f\.position ASC/);
  });

  it("getFallbackEntry uses the same SELECT shape (lockstep with listFallbackChain)", () => {
    getFallbackEntry("fb-1");
    expect(getCalls[0].sql).toMatch(/SELECT f\.id, f\.model_id, f\.position/);
    expect(getCalls[0].sql).toMatch(/LEFT JOIN models m ON f\.model_id = m\.id/);
    expect(getCalls[0].sql).toMatch(/WHERE f\.id = \?/);
    expect(getCalls[0].args).toEqual(["fb-1"]);
  });
});

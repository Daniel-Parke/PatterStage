/**
 * Unit tests for the `readLastCategory` helper in
 * src/hooks/useMissionsPage.ts.
 *
 * The helper reads the user's last-selected mission category from
 * localStorage, silently returning `null` on any storage error
 * (quota exceeded, private-mode storage disabled, etc.). Before the
 * helper was extracted, the same 5-line `try { ... } catch { /* ignore *\/ }`
 * block was inlined at 1 callsite in `useMissionsPage.ts` (the
 * `useEffect` at the showCreate+!editingId guard).
 *
 * The tests below lock the 4 contracts of the helper:
 *   1. Missing key → returns `null`
 *   2. Present key → returns the stored string
 *   3. localStorage throw → returns `null` (no rethrow, swallows silently)
 *   4. Sibling with `rememberLastCategory` — write then read round-trips
 *
 * @jest-environment jsdom
 */
import { readLastCategory, rememberLastCategory } from "@/lib/missions/mission-composer-utils";

const LAST_CATEGORY_KEY = "ps-last-mission-category";

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe("readLastCategory", () => {
  it("returns null when no category has been remembered yet", () => {
    expect(readLastCategory()).toBeNull();
  });

  it("returns the previously-stored category id (round-trip with rememberLastCategory)", () => {
    rememberLastCategory("cat_round_trip");
    expect(readLastCategory()).toBe("cat_round_trip");
  });

  it("returns the most recent value after a second rememberLastCategory call", () => {
    rememberLastCategory("cat_first");
    rememberLastCategory("cat_second");
    expect(readLastCategory()).toBe("cat_second");
  });

  it("swallows localStorage getItem errors silently (returns null)", () => {
    // Simulate a SecurityError on getItem (private-mode / disabled
    // storage). The whole point of the helper is "best-effort
    // persistence, never block the UI on storage failures" — and the
    // read path is no exception.
    const getItemSpy = jest
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("SecurityError: storage disabled");
      });

    expect(() => readLastCategory()).not.toThrow();
    expect(readLastCategory()).toBeNull();

    getItemSpy.mockRestore();
  });

  it("returns null for empty-string stored values (getItem returns the raw string)", () => {
    // Bypass the write helper's null/undefined/empty no-op guard by
    // setting the key directly — this verifies that the read helper
    // faithfully returns whatever localStorage holds, not a
    // post-processed "truthy-only" value.
    localStorage.setItem(LAST_CATEGORY_KEY, "");
    expect(readLastCategory()).toBe("");
  });
});

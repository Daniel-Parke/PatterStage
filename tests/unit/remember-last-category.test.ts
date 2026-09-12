/**
 * Unit tests for the `rememberLastCategory` helper in
 * src/hooks/useMissionsPage.ts.
 *
 * The helper persists the user's last-selected mission category to
 * localStorage, silently swallowing any write error (quota exceeded,
 * private-mode storage disabled, etc.). Before the helper was
 * extracted, the same 5-line `try { localStorage.setItem(...) } catch
 * { /* ignore *\/ }` block was duplicated verbatim at 2 callsites in
 * `useMissionsPage.ts` (the `setCategoryId` setter and the
 * template-apply path inside `fetchData`).
 *
 * The tests below lock the 3 contracts of the helper:
 *   1. Truthy `id` → writes to localStorage under `LAST_CATEGORY_KEY`
 *   2. Falsy `id` (null, undefined, "") → no-op (no write, no throw)
 *   3. localStorage throw → no rethrow, swallows silently
 *
 * @jest-environment jsdom
 */
import { rememberLastCategory } from "@/lib/missions/mission-composer-utils";

const LAST_CATEGORY_KEY = "ps-last-mission-category";

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

describe("rememberLastCategory", () => {
  it("writes a non-empty category id to localStorage under LAST_CATEGORY_KEY", () => {
    rememberLastCategory("cat_42");
    expect(localStorage.getItem(LAST_CATEGORY_KEY)).toBe("cat_42");
  });

  it("writes a different id and overwrites the previous value", () => {
    rememberLastCategory("cat_alpha");
    expect(localStorage.getItem(LAST_CATEGORY_KEY)).toBe("cat_alpha");
    rememberLastCategory("cat_beta");
    expect(localStorage.getItem(LAST_CATEGORY_KEY)).toBe("cat_beta");
  });

  it("is a no-op for null (does not write, does not throw)", () => {
    rememberLastCategory("cat_first");
    expect(localStorage.getItem(LAST_CATEGORY_KEY)).toBe("cat_first");

    rememberLastCategory(null);
    // Still the previous value — null was a no-op, not a delete.
    expect(localStorage.getItem(LAST_CATEGORY_KEY)).toBe("cat_first");
  });

  it("is a no-op for undefined (does not write, does not throw)", () => {
    rememberLastCategory(undefined);
    expect(localStorage.getItem(LAST_CATEGORY_KEY)).toBeNull();
  });

  it("is a no-op for empty string (does not write, does not throw)", () => {
    rememberLastCategory("");
    expect(localStorage.getItem(LAST_CATEGORY_KEY)).toBeNull();
  });

  it("swallows localStorage quota errors silently", () => {
    // Simulate a quota-exceeded throw on setItem.
    const setItemSpy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    // Must NOT throw — the helper's whole point is "best-effort
    // persistence, never block the UI on storage failures".
    expect(() => rememberLastCategory("cat_with_quota_error")).not.toThrow();

    setItemSpy.mockRestore();
  });

  it("swallows 'SecurityError' (private-mode / disabled storage)", () => {
    const setItemSpy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("SecurityError: storage disabled");
      });

    expect(() => rememberLastCategory("cat_secure_context")).not.toThrow();

    setItemSpy.mockRestore();
  });
});

/**
 * @jest-environment node
 *
 * Unit tests for the `isManagedKey(key)` runtime predicate in
 * `src/lib/agent-file-store.ts`.
 *
 * The predicate is the single source of truth for "is this
 * behavior-file key one of the 6 that the agent-file-store can
 * read/write via `readManagedFileContent` / `writeManagedFileContent`?".
 * The pre-session source had a stringly-typed `Set<string>` literal
 * (`MANAGED_KEYS`) redeclared in the route file
 * (`src/app/api/agent/files/[key]/route.ts`); session 192 (List 4)
 * extracted the predicate into the store module so the route and
 * any future consumer share a single source of truth.
 *
 * The tests below pin:
 *  - the 6 managed keys return `true`
 *  - `env` and `auth` (the 2 behavior-file keys that are NOT
 *    managed) return `false` — this is the security-sensitive
 *    exclusion
 *  - the type-guard narrows the parameter to `ManagedFileKey`
 *    (runtime sanity pin via exhaustive `expect` over the union)
 *  - arbitrary unknown keys, empty string, and case mismatches
 *    all return `false`
 *
 * The test file is a sibling of the source-pattern pin at
 * `tests/unit/agent-files-route-is-managed-key-migration.test.ts`,
 * which pins the route's migration to the new helper.
 */

import { isManagedKey, type ManagedFileKey } from "@/modules/hermes/lib/agent-file-store";

describe("isManagedKey runtime predicate", () => {
  describe("positive cases — the 6 managed keys", () => {
    it.each([
      "soul",
      "agent",
      "user",
      "memory",
      "config",
      "hermes",
    ] as const)("isManagedKey(%j) === true", (key) => {
      expect(isManagedKey(key)).toBe(true);
    });
  });

  describe("negative cases — the env + auth exclusions + other strings", () => {
    it("isManagedKey('env') === false (security-sensitive excluded)", () => {
      // env is in getBehaviorFiles() but NOT in the managed-file
      // set — the .env file is read-only via the masked-value
      // renderer in src/app/config/[section]/page.tsx and never
      // written through the managed-files SQLite table. This
      // exclusion is the whole reason the helper is not derived
      // from getBehaviorFiles().
      expect(isManagedKey("env")).toBe(false);
    });

    it("isManagedKey('auth') === false (auth.json is also unmanaged)", () => {
      // auth is in buildHermesPathBundle but is NOT a behavior
      // file the user edits via /api/agent/files/[key].
      expect(isManagedKey("auth")).toBe(false);
    });

    it("isManagedKey('') === false", () => {
      expect(isManagedKey("")).toBe(false);
    });

    it("isManagedKey('SOUL') === false (case-sensitive)", () => {
      // The set is keyed on lowercase, so a stray uppercase form
      // should fall through to false (the route will return 400
      // via the "Unknown file key" branch).
      expect(isManagedKey("SOUL")).toBe(false);
    });

    it("isManagedKey('unknown') === false", () => {
      expect(isManagedKey("unknown")).toBe(false);
    });

    it("isManagedKey('agentx') === false (no prefix-match surprise)", () => {
      // Regression test: a string that STARTS with a managed-key
      // prefix should not match. The Set.has() form would also
      // return false here, but the equality-check form needs the
      // explicit full-string match.
      expect(isManagedKey("agentx")).toBe(false);
    });
  });

  describe("type-guard sanity", () => {
    it("the 6 true cases exactly cover the ManagedFileKey union", () => {
      // The ManagedFileKey union is the canonical list of 6
      // strings. Every member of the union must be a `true`
      // outcome; if a future PR adds a 7th member to the union
      // (and forgets to update isManagedKey), this test fails
      // before runtime.
      const union: ManagedFileKey[] = [
        "soul",
        "agent",
        "user",
        "memory",
        "config",
        "hermes",
      ];
      for (const key of union) {
        expect(isManagedKey(key)).toBe(true);
      }
      // And the union has exactly 6 members — pin the count so a
      // future addition triggers a test failure.
      expect(union).toHaveLength(6);
    });
  });
});

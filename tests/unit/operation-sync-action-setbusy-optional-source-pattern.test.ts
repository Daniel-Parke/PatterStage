/** @jest-environment node */

/**
 * Source-pattern test for the `runSyncAction` `setBusy`-optional
 * migration in `src/app/operations/personalities/page.tsx`.
 *
 * Session 170: `runSyncAction`'s `setBusy` parameter became optional
 * (defaulting to a no-op), so callers that don't want a spinner
 * simply omit the key. The one site that previously passed the
 * odd-looking `setBusy: () => undefined` (the `handleActivate`
 * function in `src/app/operations/personalities/page.tsx`) was
 * updated to omit the key.
 *
 * Why this test exists:
 * - `setBusy: () => undefined` was a code smell — a no-op setter
 *   looked like a bug to a reader. The fix is structural
 *   (make the parameter optional), but the call-site change is what
 *   *demonstrates* the new contract is used in the wild. This
 *   source-pattern test pins the call-site shape so a regression
 *   that re-introduces `setBusy: () => undefined` is caught before
 *   the smell sneaks back in.
 * - The contract lives in `src/lib/operation-sync-action.ts` and is
 *   unit-tested in `tests/unit/operation-sync-action.test.ts`
 *   (tolerates a missing setBusy cases). This file is the
 *   CONSUMER-SIDE mirror of those unit tests.
 *
 * The fingerprint is the unique combination of:
 *   - `handleActivate` is the only function in the file that
 *     omits `setBusy` from a `runSyncAction` call,
 *   - the surrounding "No busy state for activation" comment
 *     explicitly justifies the omission.
 *
 * If a future session moves the activation logic to a hook or
 * inlines it into a sibling file, this test will throw via the
 * file-existence pre-flight. The actual contract lives in the
 * helper's test file, so the source-pattern test is the
 * "consumers are using the new contract" canary, not the contract
 * itself.
 *
 * Pre-flight recipe (run BEFORE any revert of the
 * `setBusy: () => undefined` migration):
 *
 *   # 1. Confirm the helper's `setBusy` parameter is optional
 *   sed -n '55,68p' src/lib/operation-sync-action.ts
 *   # Should show `setBusy?: (busy: boolean) => void;` (note the `?`).
 *
 *   # 2. Confirm the default is a no-op
 *   sed -n '88,95p' src/lib/operation-sync-action.ts
 *   # Should show `setBusy = () => undefined,` in the destructured
 *   # parameters.
 *
 *   # 3. Confirm the call-site omits the key
 *   rg -n 'handleActivate' src/app/operations/personalities/page.tsx
 *   # Follow the match into the function body; verify `setBusy:`
 *   # does NOT appear in the `runSyncAction` call.
 *
 * If any of these checks fails, the migration has been silently
 * reverted. Do not proceed.
 *
 * @see src/lib/operation-sync-action.ts — `runSyncAction` definition
 * @see src/app/operations/personalities/page.tsx — `handleActivate` consumer
 * @see tests/unit/operation-sync-action.test.ts — the helper's unit tests
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const PERSONALITIES_PAGE_PATH = join(
  REPO_ROOT,
  "src",
  "app",
  "operations",
  "personalities",
  "page.tsx",
);
const RUN_SYNC_ACTION_PATH = join(
  REPO_ROOT,
  "src",
  "lib",
  "operation-sync-action.ts",
);

describe("runSyncAction setBusy-optional — personalities page consumer", () => {
  const pageSource = readFileSync(PERSONALITIES_PAGE_PATH, "utf8");
  const helperSource = readFileSync(RUN_SYNC_ACTION_PATH, "utf8");

  it("the personalities page source file is readable", () => {
    expect(pageSource.length).toBeGreaterThan(0);
  });

  it("the operation-sync-action source file is readable", () => {
    expect(helperSource.length).toBeGreaterThan(0);
  });

  describe("helper contract — `setBusy` is optional", () => {
    it("declares `setBusy` as an optional parameter (`setBusy?:`)", () => {
      // The contract change: the parameter has a `?` so it can be
      // omitted. A future "un-optional" revert would drop the `?`
      // and require every caller to pass a setter again.
      expect(/setBusy\?\s*:\s*\(busy: boolean\) => void/.test(helperSource)).toBe(true);
    });

    it("has a no-op default in the destructured parameters", () => {
      // The default fallback `setBusy = () => undefined` ensures
      // that even if a caller omits the key, the helper's `setBusy(true)`
      // / `setBusy(false)` calls don't throw. Without the default,
      // TypeScript would infer `setBusy` as `undefined` and the
      // helper would crash.
      expect(/setBusy\s*=\s*\(\)\s*=>\s*undefined/.test(helperSource)).toBe(true);
    });
  });

  describe("page consumer — handleActivate omits setBusy", () => {
    /**
     * Extract the body of `handleActivate` so the test narrows its
     * scope to the function that was actually fixed (the file has
     * one other `runSyncAction` call in `closeEdit`'s sibling — no
     * wait, the file has only the one `runSyncAction` call in
     * `handleActivate`; every other operation uses raw `apiFetch`).
     */
    function extractHandleActivateBody(source: string): string {
      const anchor = /const handleActivate\s*=\s*\(name:\s*string\)\s*=>\s*\{/;
      const anchorMatch = anchor.exec(source);
      if (!anchorMatch) {
        throw new Error(
          `handleActivate function not found in ${PERSONALITIES_PAGE_PATH} — the function may have been renamed or removed`,
        );
      }
      const start = anchorMatch.index;
      let depth = 0;
      for (let i = start; i < source.length; i++) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}") {
          depth--;
          if (depth === 0) {
            return source.slice(start, i + 2);
          }
        }
      }
      throw new Error(
        `handleActivate function body has unbalanced braces (got to end of file without depth=0)`,
      );
    }

    let body: string;
    beforeAll(() => {
      body = extractHandleActivateBody(pageSource);
    });

    it("body extraction succeeded (non-empty body)", () => {
      expect(body.length).toBeGreaterThan(0);
    });

    it("handleActivate's runSyncAction call does NOT pass setBusy: () => undefined", () => {
      // The pre-fix shape was:
      //   return runSyncAction({
      //     setBusy: () => undefined,
      //     showToast,
      //     ...
      //   });
      // The post-fix shape is:
      //   return runSyncAction({
      //     showToast,
      //     ...
      //   });
      // This assertion fails if the smell is reintroduced.
      const code = body
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
      const smellFingerprint = /setBusy\s*:\s*\(\s*\)\s*=>\s*undefined/g;
      const matches = code.match(smellFingerprint) ?? [];
      expect(matches.length).toBe(0);
    });

    it("handleActivate's runSyncAction call does NOT pass any setBusy key (omitted entirely)", () => {
      // Stronger assertion: not only is the `() => undefined` smell
      // gone, but `setBusy` is not in the call's object literal at
      // all. This pins the "the new contract is being used"
      // half of the migration.
      const code = body
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
      // Look for `setBusy:` in the call site (the `setBusy` JSDoc
      // in the helper file is not in the page source, so the
      // string is unambiguous).
      const matches = code.match(/setBusy\s*:/g) ?? [];
      expect(matches.length).toBe(0);
    });

    it("handleActivate's runSyncAction call still passes showToast, url, method, body, successMessage, errorMessage, onSuccess", () => {
      // The optional-key migration is structurally minimal — the
      // other 7 keys must still be present (shorthand or
      // `key: value` form both count). This guards against a
      // "I'll just delete everything and start over" regression.
      const code = body
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
      for (const key of ["showToast", "url", "method", "body", "successMessage", "errorMessage", "onSuccess"]) {
        // Match either shorthand (`key,`) or explicit (`key: ...`).
        const re = new RegExp(`(^|\\s|,|\\{)\\s*${key}\\b\\s*[:,]`, "m");
        expect(code).toMatch(re);
      }
    });
  });
});

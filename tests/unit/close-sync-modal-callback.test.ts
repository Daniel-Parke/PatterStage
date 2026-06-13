/**
 * @jest-environment node
 *
 * Source-pattern test for the session-196 closeSyncModal refactor in
 * src/components/models/ModelSyncButtons.tsx.
 *
 * Locks the shape of the closeSyncModal callback so a future
 * "tidy up the 2 setModalState(null) sites" PR can't accidentally:
 *   - re-introduce the inline `() => setModalState(null)` form in JSX
 *   - thread a `ModalState` argument into the helper (the
 *     `setModalState({ ...prev, confirming: true })` sites are
 *     2-setter confirm-toggling, not close — different shape)
 *   - change the deps array (useState setters are stable)
 *
 * Why source-pattern instead of rendering the page:
 *   - The page is a 280+ line client component that consumes
 *     5+ parent-provided handlers. Rendering it requires mocking
 *     the parent + the SyncModal child — overkill for a 1-setter
 *     pure function.
 *   - The "useCallback with empty deps calling setModalState(null)"
 *     shape is the byte-level contract.
 *
 * What this test does NOT lock:
 *   - The exact number of `setModalState(null)` call sites in the
 *     handleConfirm success path (currently 1 — the `setModalState(null)`
 *     on the success branch). The helper extraction is for the
 *     CANCEL form (close), not the success form (also 1-setter
 *     `setModalState(null)` but inside a try/catch). The success-path
 *     call stays inline because it's nested in a 4-line try/catch
 *     block and the helper extraction is meant to consolidate the
 *     CANCEL form's 2 visual appearances (the X button + the Cancel
 *     button on the SyncModal). Both forms set `modalState = null`,
 *     but only the cancel form is in the user's "dismiss the modal"
 *     code path.
 *
 * If the helper is restructured (e.g. moved into a shared
 * `useModalDismiss` hook), the file path and shape-string assertions
 * will need to be updated — the test's failure will then force the
 * refactor author to consciously decide whether the new shape
 * preserves the single-setter + empty-deps invariant.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const COMPONENT_PATH = path.resolve(
  __dirname,
  "../../src/components/models/ModelSyncButtons.tsx",
);

describe("closeSyncModal callback (session 196)", () => {
  const source = fs.readFileSync(COMPONENT_PATH, "utf8");

  it("declares closeSyncModal as a useCallback that calls setModalState(null)", () => {
    // The helper body must be `setModalState(null)` — the
    // close-cancel form (a different value from the
    // `setModalState({ ...prev, confirming: true/false })`
    // 2-setter confirm-toggling in handleConfirm).
    expect(source).toMatch(
      /const\s+closeSyncModal\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setModalState\(\s*null\s*\)\s*,\s*\[\s*\]\s*\)/,
    );
  });

  it("uses empty deps array (useState setters are stable)", () => {
    // Use [\s\S]*? not [^)]* — see session-start-pickup pitfall S1.
    expect(source).toMatch(
      /const\s+closeSyncModal\s*=\s*useCallback\([\s\S]*?,\s*\[\s*\]\s*\)\s*;/,
    );
  });

  it("replaces the inline () => setModalState(null) cancel site in JSX", () => {
    // The page previously had 1 site of the inline
    // `() => setModalState(null)` form in JSX (the
    // `<SyncModal onCancel={...}>` binding at line 281).
    // After the refactor, the inline form must NOT appear
    // in JSX (it now lives only in the helper declaration).
    //
    // The success-path `setModalState(null)` call on line 238
    // (inside handleConfirm) is a bare statement (no `() =>`
    // wrapper) and is NOT counted by this regex. The discriminator
    // is the `() =>` form — only the JSX close-callback has it.
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

    // 1 (the helper itself) — the JSX site has been migrated.
    const inlineFormMatches =
      codeOnly.match(/\(\s*\)\s*=>\s*setModalState\(\s*null\s*\)/g) ?? [];
    expect(inlineFormMatches.length).toBe(1);

    // 1 declaration + 1 call site = 2.
    const helperIdMatches = codeOnly.match(/\bcloseSyncModal\b/g) ?? [];
    expect(helperIdMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("preserves the 2-setter confirm-toggling in handleConfirm (anti-A3)", () => {
    // The `setModalState((prev) => (prev ? { ...prev, confirming: true } : null))`
    // and `setModalState((prev) => (prev ? { ...prev, confirming: false } : null))`
    // sites in handleConfirm are 2-setter confirm-toggling (not
    // close), and stay inline. Migrating them to closeSyncModal
    // would break the 1-setter invariant (the helper sets
    // `modalState = null`, not `modalState = { ...prev, confirming: X }`).
    // The test locks the 2-setter shape so a future
    // "migrate all setModalState to closeSyncModal" PR is
    // forced to consciously justify the change.
    expect(source).toMatch(
      /setModalState\(\s*\(prev\)\s*=>\s*\(prev\s*\?\s*\{\s*\.\.\.prev,\s*confirming:\s*true\s*\}\s*:\s*null\)\s*\)/,
    );
    expect(source).toMatch(
      /setModalState\(\s*\(prev\)\s*=>\s*\(prev\s*\?\s*\{\s*\.\.\.prev,\s*confirming:\s*false\s*\}\s*:\s*null\)\s*\)/,
    );
  });
});

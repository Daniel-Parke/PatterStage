/**
 * @jest-environment node
 *
 * Source-pattern test for the session-196 closeAddCustom refactor in
 * src/components/models/FallbackChainList.tsx.
 *
 * Locks the shape of the closeAddCustom callback so a future
 * "tidy up the 2 setShowAddCustom(false) sites" PR can't accidentally:
 *   - re-introduce the inline `() => setShowAddCustom(false)` form in JSX
 *   - change the deps array (useState setters are stable)
 *
 * Why source-pattern instead of rendering the page:
 *   - The page is a 300+ line client component that consumes
 *     7+ parent-provided handlers. Rendering it requires mocking
 *     the parent + the AddCustomForm child — overkill for a
 *     1-setter pure function.
 *   - The "useCallback with empty deps calling setShowAddCustom(false)"
 *     shape is the byte-level contract.
 *
 * What this test does NOT lock:
 *   - The `setShowRegistryDropdown((v) => !v)` toggle is a different
 *     shape (toggle, not close) and stays inline.
 *   - The `setShowRegistryDropdown(false)` in handleAddFromRegistry
 *     is a multi-line closure body (not a 1-liner close-callback)
 *     and stays inline.
 *   - The `() => setShowAddCustom(true)` onClick on the "Add Custom"
 *     button (line 290) is an OPEN form (sets the flag to `true`,
 *     not `false`), not a close form — stays inline.
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
  "../../src/components/models/FallbackChainList.tsx",
);

describe("closeAddCustom callback (session 196)", () => {
  const source = fs.readFileSync(COMPONENT_PATH, "utf8");

  it("declares closeAddCustom as a useCallback that calls setShowAddCustom(false)", () => {
    // The helper body must be `setShowAddCustom(false)` — the
    // close-cancel form. The "Add Custom" button onClick at
    // line 290 uses `setShowAddCustom(true)` (open form) which
    // is a different shape and stays inline.
    expect(source).toMatch(
      /const\s+closeAddCustom\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setShowAddCustom\(\s*false\s*\)\s*,\s*\[\s*\]\s*\)/,
    );
  });

  it("uses empty deps array (useState setters are stable)", () => {
    // Use [\s\S]*? not [^)]* — see session-start-pickup pitfall S1.
    expect(source).toMatch(
      /const\s+closeAddCustom\s*=\s*useCallback\([\s\S]*?,\s*\[\s*\]\s*\)\s*;/,
    );
  });

  it("replaces the 2 inline () => setShowAddCustom(false) sites in the form", () => {
    // The page previously had 2 sites of the inline
    // `setShowAddCustom(false)` form: the Cancel button onClick
    // at line 249 (`() => setShowAddCustom(false)`) AND the
    // post-onConfirm bare statement at line 247
    // (`setShowAddCustom(false);`). After the refactor, both
    // sites must use closeAddCustom.
    //
    // The discriminator: the 2 pre-refactor sites had
    // DIFFERENT syntaxes — one is `() => setShowAddCustom(false)`
    // (the Cancel onClick), the other is the bare statement
    // `setShowAddCustom(false);` (the post-onConfirm side effect).
    // The post-onConfirm bare statement doesn't have `() =>` so
    // it's NOT counted by the regex below. Both sites now use
    // `closeAddCustom()` (the helper call), which has neither
    // `() =>` nor the bare-statement form.
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

    // 1 (the helper itself) — both JSX sites have been migrated.
    const inlineFormMatches =
      codeOnly.match(/\(\s*\)\s*=>\s*setShowAddCustom\(\s*false\s*\)/g) ?? [];
    expect(inlineFormMatches.length).toBe(1);

    // 0 (no bare-statement form). The post-onConfirm side effect
    // now goes through the helper call (not the bare setter).
    const bareStatementMatches =
      codeOnly.match(/(?<!\()\s*setShowAddCustom\(\s*false\s*\)\s*;/g) ?? [];
    expect(bareStatementMatches.length).toBe(0);

    // 1 declaration + 2 call sites = 3.
    const helperIdMatches = codeOnly.match(/\bcloseAddCustom\b/g) ?? [];
    expect(helperIdMatches.length).toBeGreaterThanOrEqual(3);
  });

  it("preserves the toggle form () => setShowRegistryDropdown((v) => !v) inline (anti-A3 — different shape)", () => {
    // The "Add from Registry" toggle button onClick uses
    // `setShowRegistryDropdown((v) => !v)` — a TOGGLE, not a
    // close. Different shape (function arg, not literal `false`).
    // Migrating to closeAddCustom would force a toggle signature
    // that doesn't fit the 1-setter close pattern. The test
    // locks the toggle form so a future "migrate all setters
    // to closeAddCustom" PR is forced to consciously justify.
    expect(source).toMatch(
      /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*setShowRegistryDropdown\(\s*\(v\)\s*=>\s*!v\s*\)\s*\}/,
    );
  });

  it("preserves the open form () => setShowAddCustom(true) inline (anti-A3 — different shape)", () => {
    // The "Add Custom" button onClick uses `setShowAddCustom(true)`
    // — the OPEN form, not the close form. Different shape
    // (literal `true`, not `false`). Migrating to closeAddCustom
    // would break the open semantic. The test locks the open
    // form so a future "migrate all setters" PR is forced to
    // consciously justify.
    expect(source).toMatch(
      /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*setShowAddCustom\(\s*true\s*\)\s*\}/,
    );
  });
});

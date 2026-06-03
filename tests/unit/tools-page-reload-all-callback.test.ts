/**
 * @jest-environment node
 *
 * Source-pattern test for the session-107 reloadAll refactor in
 * src/app/operations/tools/page.tsx.
 *
 * Locks the shape of the reloadAll callback so a future
 * "tidy up the loadToolsets+loadProfileSyncStatus pair" PR can't
 * accidentally:
 *   - re-introduce the inline `void loadToolsets(); void loadProfileSyncStatus();` form
 *   - drop the await in the pullFromHermes onSuccess (would race
 *     with the busy-spinner clear and show stale data)
 *   - re-order the two calls (toolsets first, then sync status —
 *     the order matters because the sync status banner reads
 *     from the same /api/agent/profiles data that the drift
 *     detection depends on; if a future refactor changes the
 *     order, the test will force a conscious justification)
 *   - change the deps array (would force unnecessary re-renders
 *     and re-fetch on every showToast/toast identity change)
 *
 * Why source-pattern instead of rendering the page:
 *   - The page is a 330+ line client component that consumes
 *     the useToast hook, 11 useState calls, 3 useCallback hooks
 *     (loadProfileSyncStatus, loadToolsets, reloadAll), and the
 *     runSyncAction helper. Rendering it requires mocking every
 *     dependency — the harness would dwarf the actual invariant
 *     we want to lock.
 *   - The "useCallback that awaits both loaders in order" shape
 *     is the byte-level contract.
 *
 * What this test does NOT lock:
 *   - The exact number of reloadAll call sites (currently 2: the
 *     useEffect and the pullFromHermes onSuccess). A 3rd
 *     "refresh after error" caller is fine — the invariant is
 *     "the pair goes through the helper", not "exactly 2 sites exist".
 *   - The saveToolsets onSuccess site (uses `loadToolsets` only,
 *     not the pair — different shape, intentionally not migrated).
 *   - The internal use of `expandUnifiedToAllPlatforms` and
 *     `unionToolsetsFromPlatforms` — those are tested in
 *     `tests/unit/hermes-toolset-unify.test.ts`.
 *
 * If the helper is restructured (e.g. moved into a shared
 * `useOperationsPageReload` hook), the file path and shape-string
 * assertions will need to be updated — the test's failure will
 * then force the refactor author to consciously decide whether
 * the new shape preserves the sequential-await + dep-array
 * invariant.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const PAGE_PATH = path.resolve(
  __dirname,
  "../../src/app/operations/tools/page.tsx",
);

describe("reloadAll callback (session 107)", () => {
  const source = fs.readFileSync(PAGE_PATH, "utf8");

  it("declares reloadAll as a useCallback that awaits both loaders in order", () => {
    // The helper body must be:
    //   await loadToolsets();
    //   await loadProfileSyncStatus();
    // (sequential awaits, toolsets first). The order matters
    // because the sync status banner shows drift detection that
    // depends on the latest /api/agent/profiles data — the
    // toolsets call is the "primary" reload (drives the page's
    // main UI), the sync status call is the "decorator"
    // (drives the warning banners at the top).
    expect(source).toMatch(
      /const\s+reloadAll\s*=\s*useCallback\(\s*async\s*\(\s*\)\s*=>\s*\{[\s\S]*?await\s+loadToolsets\s*\(\s*\)\s*;[\s\S]*?await\s+loadProfileSyncStatus\s*\(\s*\)\s*;[\s\S]*?\}/,
    );
  });

  it("uses the [loadToolsets, loadProfileSyncStatus] deps array", () => {
    // The deps array must list both loaders — the
    // `react-hooks/exhaustive-deps` lint rule will flag any
    // missing dep. The exact order in the array is not
    // enforced (alphabetical is conventional in this file, but
    // the test accepts either order).
    const startIdx = source.indexOf("const reloadAll = useCallback(");
    expect(startIdx).toBeGreaterThan(-1);
    // The callback body contains semicolons (the `await` calls
    // end with `;`), so a naive `indexOf(";")` from the start
    // lands on the first body semicolon. Instead, find the
    // closing `}, [...])` of the useCallback declaration.
    // The declaration's closing shape is `}, [<deps>]);` —
    // a `}` followed by `,` followed by the deps array,
    // followed by `)` and `;`.
    const afterCallback = source.indexOf("}, [loadToolsets", startIdx);
    expect(afterCallback).toBeGreaterThan(startIdx);
    // Walk forward to the closing `]);`.
    const closingIdx = source.indexOf("]);", afterCallback);
    expect(closingIdx).toBeGreaterThan(afterCallback);
    const fullDeclaration = source.slice(startIdx, closingIdx + 3);
    expect(fullDeclaration).toMatch(
      /\[\s*loadToolsets\s*,\s*loadProfileSyncStatus\s*\]/,
    );
  });

  it("replaces the inline void loadToolsets(); void loadProfileSyncStatus() pair in the useEffect", () => {
    // The useEffect previously had 2 separate `void` calls:
    //   useEffect(() => {
    //     void loadToolsets();
    //     void loadProfileSyncStatus();
    //   }, [loadToolsets, loadProfileSyncStatus]);
    // After the refactor, it should be:
    //   useEffect(() => {
    //     void reloadAll();
    //   }, [reloadAll]);
    // The inline pair must NOT appear anywhere in the file
    // (the only `void loadToolsets()` site, if any, is the
    // one inside the reloadAll callback's body — but that's
    // `await`, not `void`).
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

    // The inline `void loadToolsets();` + `void loadProfileSyncStatus();`
    // pair must NOT appear. We use a regex that matches the
    // exact 2-line sequence (any whitespace between).
    const inlinePairMatches =
      codeOnly.match(/void\s+loadToolsets\s*\(\s*\)\s*;[\s\S]*?void\s+loadProfileSyncStatus\s*\(\s*\)\s*;/g) ?? [];
    expect(inlinePairMatches.length).toBe(0);
  });

  it("uses reloadAll in the pullFromHermes onSuccess callback", () => {
    // The pullFromHermes onSuccess is the 2nd site of the
    // pair. It must call `await reloadAll();` (NOT the
    // inline `await loadToolsets(); await loadProfileSyncStatus();`
    // pair, NOT `void reloadAll();` — the helper's JSDoc
    // requires the call to be awaited so the busy spinner
    // doesn't clear before the refetch completes).
    //
    // We strip the JSDoc comment to avoid false positives
    // from the helper's JSDoc that mentions the old form
    // in the byte-equivalence explanation.
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");

    // The onSuccess callback body must contain `await reloadAll();`
    // (not the inline pair).
    expect(codeOnly).toMatch(/onSuccess\s*=\s*async\s*\(\s*\)\s*=>\s*\{[\s\S]*?await\s+reloadAll\s*\(\s*\)\s*;[\s\S]*?\}/);
  });

  it("preserves the saveToolsets onSuccess as a single loadToolsets() call (not the pair)", () => {
    // The saveToolsets onSuccess is intentionally NOT
    // migrated — it only needs to reload the toolsets
    // (the sync status doesn't change on a local save, only
    // on pull/push that touches Hermes disk). Locking this
    // invariant prevents a future "consolidate all onSuccess
    // callbacks" PR from accidentally using `reloadAll` here
    // and re-fetching the profiles list on every save.
    expect(source).toMatch(/onSuccess:\s*loadToolsets,/);
  });

  it("declares the useEffect that calls reloadAll with the reloadAll-only deps array", () => {
    // The useEffect must be:
    //   useEffect(() => {
    //     void reloadAll();
    //   }, [reloadAll]);
    // The deps array must NOT contain the 2 separate
    // loaders — that would be the pre-refactor shape.
    expect(source).toMatch(
      /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?void\s+reloadAll\s*\(\s*\)\s*;[\s\S]*?\},\s*\[\s*reloadAll\s*\]\s*\)/,
    );

    // The pre-refactor shape `[loadToolsets, loadProfileSyncStatus]`
    // in the useEffect deps must NOT appear anywhere.
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    // The reloadAll callback's own deps array IS
    // `[loadToolsets, loadProfileSyncStatus]`, so we can't
    // assert "0 occurrences of that string". Instead, we
    // assert that no `useEffect(..., [loadToolsets,
    // loadProfileSyncStatus])` remains.
    expect(codeOnly).not.toMatch(
      /useEffect\s*\([\s\S]*?,\s*\[\s*loadToolsets\s*,\s*loadProfileSyncStatus\s*\]\s*\)/,
    );
  });
});

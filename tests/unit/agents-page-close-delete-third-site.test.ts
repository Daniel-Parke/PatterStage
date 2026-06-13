/**
 * @jest-environment node
 *
 * Source-pattern test pinning the post-session-183 `closeDelete()`
 * call shape in `src/app/operations/agents/page.tsx`.
 *
 * Why this test exists: session 100 extracted `closeDelete =
 * useCallback(() => setDeleteTarget(null), [])` and migrated 2
 * sites (the Modal `onClose` + the Cancel button) to call
 * `closeDelete()`. The 3rd site — the unconditional
 * `setDeleteTarget(null)` inside `handleDelete`'s `onSuccess`
 * body — was deliberately left as an inline setter because the
 * original rationale ("threading a target into a setter-pair
 * callback is over-engineering") incorrectly conflated the
 * `setDeleteTarget(null)` call (no target param needed) with the
 * adjacent `if (selectedProfileId === target)` block (which DOES
 * need the target).
 *
 * Session 183 fixed this by migrating the 3rd site to
 * `closeDelete()`. The 2-setter conditional block in the same
 * `onSuccess` body (`setSelectedProfileId(null)` + `closeEditor()`)
 * stays inline because both setters are conditional on
 * `selectedProfileId === target` and aren't part of the close
 * pattern.
 *
 * The test pins:
 *   1. `closeDelete` is defined as a `useCallback` returning
 *      `setDeleteTarget(null)` (positive).
 *   2. `closeDelete()` is called from exactly 3 sites (positive —
 *      Modal onClose + Cancel + handleDelete onSuccess).
 *   3. No remaining inline `setDeleteTarget(null)` setter
 *      anywhere in the file (negative — would mean a site
 *      regressed to the inline form).
 *
 * Pre-flight recipe for a future "revert the 3rd-site migration"
 * PR: this test will fail with a positive `closeDelete()` count
 * of 2 + a positive `setDeleteTarget(null)` count of 1 — the
 * tell that someone re-inlined the handleDelete call.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const FILE_PATH = join(REPO_ROOT, "src", "app", "operations", "agents", "page.tsx");

// Strip block + line comments so the JSDoc-style "session 183
// migrated the 3rd site" note in the closeDelete comment block
// doesn't false-positive the negative assertion. Same pre-filter
// pattern as the session 172 / 178 / 181 tests.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("agents/page — closeDelete helper shape (post-session-183)", () => {
  const rawSource = readFileSync(FILE_PATH, "utf-8");
  const code = stripComments(rawSource);

  it("defines the closeDelete helper (positive)", () => {
    const matches = code.match(/const\s+closeDelete\s*=\s*useCallback/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(1);
  });

  it("calls closeDelete() from exactly 3 sites (positive)", () => {
    // Site 1: handleDelete's onSuccess body (line ~261) — `closeDelete();`
    // Site 2: Modal `onClose` prop (line ~623) — `onClose={closeDelete}`
    //   (passed by reference, no parens — JSX event-handler form)
    // Site 3: Modal Cancel button onClick (line ~630) — `onClick={closeDelete}`
    //   (also by reference, no parens)
    // The 3 sites use 2 different call shapes (call-site + JSX prop
    // reference), so the regex must match BOTH:
    //   - `closeDelete()` (line 261)
    //   - `closeDelete` (no parens, at the end of a prop value)
    // The `closeDelete = useCallback(...)` definition itself is
    // also a `closeDelete` reference — exclude it.
    const codeWithoutDef = code.replace(
      /const\s+closeDelete\s*=\s*useCallback[^;]*;/,
      "",
    );
    const matches = codeWithoutDef.match(/closeDelete\s*(?:\(\s*\))?/g);
    expect(matches).not.toBeNull();
    // Filter out the bare `closeDelete` reference inside the JSDoc
    // for the migration note — the stripComments pre-filter handles
    // it, but defensively dedupe by checking the count is exactly
    // 3 (the JSDoc mentions `closeDelete()` ~3 times in prose
    // form, but those are inside block comments already stripped).
    expect(matches?.length).toBe(3);
  });

  it("does NOT contain a remaining inline setDeleteTarget(null) setter (negative)", () => {
    // The pre-migration inline form was:
    //   setDeleteTarget(null);
    // The post-session-183 file has 0 inline sites — every
    // close-equivalent call goes through the helper. A duplicate
    // inline site would mean a future caller was added without
    // routing through closeDelete, regressing the 3-site lockstep.
    //
    // Scoped exclusion: the helper definition itself uses
    // `setDeleteTarget(null)` on the right-hand side of the
    // `useCallback` arrow. That's the helper's body, not a
    // "remaining inline site" — strip the helper definition
    // line before scanning.
    const codeWithoutHelperDef = code.replace(
      /const\s+closeDelete\s*=\s*useCallback\s*\(\s*\(\s*\)\s*=>\s*setDeleteTarget\s*\(\s*null\s*\)\s*,\s*\[\s*\]\s*\)\s*;/,
      "",
    );
    const inlineMatches = codeWithoutHelperDef.match(
      /setDeleteTarget\s*\(\s*null\s*\)/g,
    );
    expect(inlineMatches).toBeNull();
  });

  it("handleDelete's onSuccess body uses closeDelete() (scoped positive)", () => {
    // Belt-and-braces: also pin the call site is INSIDE the
    // onSuccess body of handleDelete (not somewhere unrelated
    // like the load effect). The whole point of the migration
    // is "dismiss the modal after a successful delete".
    const handleDeleteBlock = code.match(
      /const\s+handleDelete\s*=\s*async\s*\(\s*\)\s*=>\s*\{[\s\S]*?\n\s*\}\s*;/,
    );
    expect(handleDeleteBlock).not.toBeNull();
    expect(handleDeleteBlock?.[0]).toMatch(/closeDelete\s*\(\s*\)/);
    // The adjacent conditional block must still use direct setters
    // (they're conditional on `selectedProfileId === target` and
    // are not part of the close pattern).
    expect(handleDeleteBlock?.[0]).toMatch(/setSelectedProfileId\s*\(\s*null\s*\)/);
    expect(handleDeleteBlock?.[0]).toMatch(/closeEditor\s*\(\s*\)/);
  });
});

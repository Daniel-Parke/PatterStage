/**
 * Source-pattern test that pins the session-191 refactor:
 * the 2 `onToggleCollapse` inline arrow callbacks in
 * `src/app/operations/skills/page.tsx` (the Active section's
 * collapse header and the Inactive section's collapse header) are
 * consolidated through `toggleActiveCollapsed` /
 * `toggleInactiveCollapsed` `useCallback` siblings.
 *
 * The pre-refactor code inlined the same
 * `() => setXCollapsed((v) => !v)` callback at 2 sites (line 413
 * for Active, line 458 for Inactive). The 2 sites are
 * byte-equivalent (single boolean flip of the section's
 * `useState` setter, default value preserved). Extracting to
 * `useCallback` siblings matches the A3 single-setter close-
 * callback pattern that session 100/103 established for
 * `closeDelete` / `closeEditor` / `closeSkillEditor` and the
 * `closeEdit` extraction in operations/personalities (session
 * 100). The new toggle-callback siblings extend the same pattern
 * to the section-collapse use case.
 *
 * The post-refactor shape:
 *   - `toggleActiveCollapsed` is a `useCallback` in the
 *     component, deps `[]`, body `() => setActiveCollapsed((v) => !v)`.
 *   - `toggleInactiveCollapsed` is a `useCallback` in the
 *     component, deps `[]`, body `() => setInactiveCollapsed((v) => !v)`.
 *   - The Active call site uses
 *     `onToggleCollapse={toggleActiveCollapsed}` (no inline arrow).
 *   - The Inactive call site uses
 *     `onToggleCollapse={toggleInactiveCollapsed}` (no inline arrow).
 *
 * JSDoc / line comments that MENTION the pre-refactor inline form
 * are stripped from the source before scanning, so the
 * post-refactor JSDoc that quotes the pre-refactor shape
 * `() => setXCollapsed((v) => !v)` doesn't false-positive on the
 * negative-assertion regexes.
 *
 * @jest-environment node
 */
import { readFileSync } from "fs";
import { join } from "path";

const skillsPagePath = join(
  __dirname,
  "..",
  "..",
  "src",
  "app",
  "operations",
  "skills",
  "page.tsx",
);

/**
 * Strip block comments (JSDoc) and line comments from the source
 * before scanning. The post-refactor file contains JSDoc that
 * references the pre-refactor inline form for documentation; those
 * references would false-positive on the negative-assertion
 * regexes below. Strip them so the source scan reflects actual
 * code, not documentation.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

const skillsPageSrc = stripComments(readFileSync(skillsPagePath, "utf8"));

describe("session-191 skills page section collapse toggle-callback extraction", () => {
  it("toggleActiveCollapsed is declared as a useCallback with deps []", () => {
    // The toggleActiveCollapsed helper exists and its body is
    // the canonical 1-setter flip `setActiveCollapsed((v) => !v)`.
    // The deps array is `[]` per session 119 P-3 codebase
    // convention (useState setters are stable, no other captured
    // state). Pin the literal call shape to lock both the
    // declaration and the deps array in lockstep.
    const helperBlock = skillsPageSrc.match(
      /const toggleActiveCollapsed = useCallback\(\s*\(\) => setActiveCollapsed\(\(v\) => !v\),\s*\[\],?\s*\)/,
    );
    expect(helperBlock).not.toBeNull();
  });

  it("toggleInactiveCollapsed is declared as a useCallback with deps []", () => {
    // Same shape as toggleActiveCollapsed, but for the Inactive
    // section's collapse state. The deps array is `[]` and the
    // body is the canonical 1-setter flip on the Inactive
    // setter.
    const helperBlock = skillsPageSrc.match(
      /const toggleInactiveCollapsed = useCallback\(\s*\(\) => setInactiveCollapsed\(\(v\) => !v\),\s*\[\],?\s*\)/,
    );
    expect(helperBlock).not.toBeNull();
  });

  it("the Active section's onToggleCollapse is the helper directly (no inline arrow)", () => {
    // The pre-refactor form was
    //   onToggleCollapse={() => setActiveCollapsed((v) => !v)}
    // The post-refactor form is
    //   onToggleCollapse={toggleActiveCollapsed}
    // Pin the post-refactor shape: helper name, no inline arrow.
    // The active section passes `toggleActiveCollapsed` as a
    // value, not as a call. Match the literal
    // `={toggleActiveCollapsed}` (no `()` and no `() =>`) to
    // verify the helper is the callback, not an inline call
    // site.
    const activeMatch = skillsPageSrc.match(
      /onToggleCollapse=\{toggleActiveCollapsed\}/,
    );
    expect(activeMatch).not.toBeNull();
  });

  it("the Inactive section's onToggleCollapse is the helper directly (no inline arrow)", () => {
    // The pre-refactor form was
    //   onToggleCollapse={() => setInactiveCollapsed((v) => !v)}
    // The post-refactor form is
    //   onToggleCollapse={toggleInactiveCollapsed}
    // Pin the post-refactor shape: helper name, no inline arrow.
    const inactiveMatch = skillsPageSrc.match(
      /onToggleCollapse=\{toggleInactiveCollapsed\}/,
    );
    expect(inactiveMatch).not.toBeNull();
  });

  it("the pre-refactor Active inline 'setActiveCollapsed((v) => !v)' is gone (outside the helper)", () => {
    // The Active section used to inline
    // `setActiveCollapsed((v) => !v)` as the onToggleCollapse
    // arrow body. After the refactor, the inline form exists
    // ONLY inside the toggleActiveCollapsed helper's body. The
    // matched substring count in user-land JSX (the call-site
    // arrow) should be 0 — the helper's own body is excluded by
    // the regex (the body is `setActiveCollapsed((v) => !v)`
    // without the surrounding `() =>` arrow wrapper that
    // indicates a JSX inline callback).
    //
    // The negative assertion is on the EXACT pre-refactor form
    // — the JSX inline arrow `onToggleCollapse={() =>
    // setActiveCollapsed((v) => !v)}`. That 2-line shape is
    // gone (replaced by `onToggleCollapse={toggleActiveCollapsed}`).
    expect(skillsPageSrc).not.toMatch(
      /onToggleCollapse=\{\(\) => setActiveCollapsed\(\(v\) => !v\)\}/,
    );
  });

  it("the pre-refactor Inactive inline 'setInactiveCollapsed((v) => !v)' is gone (outside the helper)", () => {
    // The Inactive section used to inline
    // `setInactiveCollapsed((v) => !v)` as the onToggleCollapse
    // arrow body. The post-refactor helper takes care of it
    // instead. Pin the absence of the inline JSX form.
    expect(skillsPageSrc).not.toMatch(
      /onToggleCollapse=\{\(\) => setInactiveCollapsed\(\(v\) => !v\)\}/,
    );
  });

  it("toggleCategory remains a direct arrow (not part of the 1-setter family)", () => {
    // Sanity: the pre-existing `toggleCategory` callback takes
    // an argument (the category key) and is a 2-arg shape
    // (`setCategoryCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }))`).
    // It's NOT a member of the new toggleActiveCollapsed /
    // toggleInactiveCollapsed 1-setter family (different shape,
    // different intent: per-category collapse vs. per-section
    // collapse). Pin its shape so a future refactor doesn't
    // accidentally fold it into the same callback.
    const categoryMatch = skillsPageSrc.match(
      /const toggleCategory = \(cat: string\) =>\s*setCategoryCollapsed\(\(prev\) => \(\{ \.\.\.prev, \[cat\]: !prev\[cat\] \}\)\)/,
    );
    expect(categoryMatch).not.toBeNull();
  });
});

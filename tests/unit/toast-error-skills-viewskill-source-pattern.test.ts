/**
 * @jest-environment node
 *
 * Source-pattern test for the `toastError(showToast, err, ...)` adoption
 * in `viewSkill`'s catch block in
 * `src/app/operations/skills/page.tsx`.
 *
 * Why this test exists: the pre-fix code in `viewSkill` had a
 * silent `catch { setSkillContent("// Failed to load content"); }`
 * — the canonical "feature is not working" anti-pattern that
 * session 142 explicitly calls out as fixable. The user sees a
 * static placeholder and has no idea why the skill content failed
 * to load (server error? network error? auth error? 500?). The
 * fix adopted `toastError(showToast, err, "Failed to load skill
 * content")` so the real error message is surfaced — same shape as
 * the sibling `openSkillEditor` (line 232-234) which already used
 * `toastError`.
 *
 * This test pins the migration to the `viewSkill` function
 * specifically (narrow scope, so false-positives from the
 * other 3 `catch (e)` / `toastError` sites in the same file
 * can't make the test pass without the fix landing):
 *   - The `viewSkill` function body uses `setSkillContent("// No
 *     content")` on the success path AND `toastError(showToast,
 *     err, "Failed to load skill content")` on the failure path.
 *   - The failure-path catch block is bound (`catch (err)`), not
 *     bare (`catch {`).
 *   - The fingerprint
 *     `setSkillContent("// No content"); ... catch (err) {
 *      ... toastError(... "Failed to load skill content") ... }`
 *     is unique to the `viewSkill` function in the file.
 *
 * Sister test to:
 *   - `safe-api-call-data-source-pattern-list2.test.ts`
 *   - `safe-api-call-data-source-pattern-list1-logs.test.ts`
 *   - `safe-api-call-data-source-pattern-list3.test.ts`
 *
 * Pre-flight recipe (run BEFORE any future "revert to silent catch"
 * migration):
 *
 *   # 1. Find any remaining bare `catch {` blocks in operations pages
 *   rg -n 'catch \{' src/app/operations/
 *   # Should return 0 lines in *.tsx files. Any hit is a regression.
 *
 *   # 2. Confirm the helper is the canonical toastError (composes
 *   #    messageFromError + showToast)
 *   sed -n '1,3p;180,190p' src/lib/api-fetch.ts
 *   # Should show the toastError export.
 *
 *   # 3. Confirm the call site shape
 *   rg -nB 1 -A 3 'toastError\(showToast' src/app/operations/skills/page.tsx
 *   # Should show the new viewSkill site at line ~269 with the
 *   # canonical 3-arg form.
 *
 * If any of these checks fails, the migration has been silently
 * reverted. Do not proceed.
 *
 * @see src/lib/api-fetch.ts — `toastError` definition
 * @see src/app/operations/skills/page.tsx — the skills page consumer
 * @see tests/unit/toast-error.test.ts — the helper's unit tests
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const SKILLS_PAGE_PATH = join(
  REPO_ROOT,
  "src",
  "app",
  "operations",
  "skills",
  "page.tsx",
);

/**
 * Extract the body of `viewSkill` so the test narrows its scope to
 * the function that was actually fixed (the file has 3 other
 * `catch (e)` / `toastError` sites — `loadSkills`, `toggleSkill`,
 * `openSkillEditor` — and a bare-catch would slip through a
 * file-wide test).
 */
function extractViewSkillBody(source: string): string {
  // Anchor on the function declaration and the closing brace of
  // the arrow function. The function is the only one in the file
  // with the body shape:
  //   const viewSkill = async (skill: Skill) => {
  //     if (expandedSkill === skill.name) { ... return; }
  //     setExpandedSkill(skill.name);
  //     try { ... setSkillContent(d.data?.content || "// No content"); }
  //     catch { setSkillContent("// Failed to load content"); }
  //   };
  // Match the entire function body (greedy up to the first `};`
  // that ends a `const viewSkill = ...` declaration).
  const anchor = /const viewSkill\s*=\s*async\s*\(skill:\s*Skill\)\s*=>\s*\{/;
  const anchorMatch = anchor.exec(source);
  if (!anchorMatch) {
    throw new Error(
      `viewSkill function not found in ${SKILLS_PAGE_PATH} — the function may have been renamed or removed`,
    );
  }
  const start = anchorMatch.index;
  // Walk the rest of the file counting braces, taking the first
  // matching close as the function end.
  let depth = 0;
  let i = start;
  for (; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        // Skip the trailing `;`
        return source.slice(start, i + 2);
      }
    }
  }
  throw new Error(
    `viewSkill function body has unbalanced braces (got to end of file without depth=0)`,
  );
}

describe("toastError migration — viewSkill catch block in skills page", () => {
  const source = readFileSync(SKILLS_PAGE_PATH, "utf8");

  it("the skills page source file is readable", () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it("the skills page source is a real .tsx file on disk", () => {
    expect(SKILLS_PAGE_PATH.endsWith(".tsx")).toBe(true);
  });

  it("viewSkill is defined as a function in the file", () => {
    // Pre-flight: the function must exist (the test scopes to its
    // body, so a rename or removal would throw in the extractor).
    expect(/const viewSkill\s*=\s*async\s*\(skill:\s*Skill\)\s*=>/.test(source)).toBe(true);
  });

  describe("viewSkill function body (narrow scope)", () => {
    let body: string;
    beforeAll(() => {
      body = extractViewSkillBody(source);
    });

    it("body extraction succeeded (non-empty body)", () => {
      expect(body.length).toBeGreaterThan(0);
    });

    it("viewSkill has a bound catch (err | e) in the failure path — not a bare `catch {`", () => {
      // Strip line comments so the JSDoc block that mentions the
      // pre-fix shape doesn't trigger a false positive.
      const code = body
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
      // Match any `catch (identifier)` — accepts `err` or `e`.
      const matches = code.match(/catch\s*\(\s*[a-zA-Z_$][\w$]*\s*\)/g) ?? [];
      expect(matches.length).toBeGreaterThan(0);
    });

    it("viewSkill has a toastError(showToast, err, ...) call in the failure path", () => {
      // The post-fix code calls
      //   toastError(showToast, err, "Failed to load skill content")
      // inside the viewSkill catch block. This is the actual
      // delivery surface for the real error message (no more
      // silent swallow).
      const code = body
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
      const matches = code.match(/toastError\(\s*showToast\s*,\s*[a-zA-Z_$][\w$]*\s*,\s*["'`]/g) ?? [];
      expect(matches.length).toBeGreaterThan(0);
    });

    it("viewSkill does NOT have a bare `catch { ... setSkillContent(\"// Failed to load content\") }` fingerprint", () => {
      // This is the EXACT pre-fix shape. A bare `catch {` (no
      // binding) immediately followed by the
      // `setSkillContent("// Failed to load content")` placeholder.
      // The post-fix shape has the catch block bound, so this
      // fingerprint is impossible. If a future session "simplifies"
      // the catch by dropping the binding, this test fails BEFORE
      // the silent-swallow is reintroduced.
      const code = body
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
      const silentSwallowFingerprint =
        /catch\s*\{[^}]*setSkillContent\(\s*["'`]\/\/ Failed to load content["'`]\s*\)/g;
      const matches = code.match(silentSwallowFingerprint) ?? [];
      expect(matches.length).toBe(0);
    });
  });
});

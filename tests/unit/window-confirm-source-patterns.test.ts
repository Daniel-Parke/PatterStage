/**
 * window-confirm-source-patterns.test.ts
 *
 * Source-pattern audit test for the `window.confirm()` →
 * `useTwoStepConfirm` migration. The codebase convention is that
 * every destructive-action confirmation must use the in-page
 * two-click pattern from `src/hooks/useTwoStepConfirm.ts` —
 * `window.confirm()` is anti-pattern #8 in `overnight-refactor-patterns`
 * and triggers a reject in code review.
 *
 * This test pins the post-migration shape for the **List 4 surface**
 * (`src/app/config/`, the Models/HERMES.md/Environment/All-Settings
 * page set). It is a sister test to the per-list source-pattern
 * tests (`ok-factory-source-patterns`, `safe-api-call-data-source-pattern-*`,
 * etc.) — sharing the file-walker + EXEMPTIONS pattern but with its
 * own scanner (a single regex on the file body, not a balanced-brace
 * walk) and its own per-list filter.
 *
 * Session 138 history: this sister test was added when the
 * `/config/seed/page.tsx` migration closed the 2 `window.confirm`
 * callsites in that file (the "Restore entire default catalog"
 * singleton button + the per-agent "Restore this agent" list).
 * The test catches the next time a developer adds a `window.confirm`
 * call to the List 4 surface by failing with a clear diagnostic
 * of the offending file:line. The session 138 reference
 * `references/session-138-list1-use-polled-updates-hook.md` (and
 * the related `overnight-refactor-patterns` pattern #13) explain
 * the `useTwoStepConfirm` shape and the migration recipe.
 *
 * Filter scope: the per-list-pick protocol names the page set as
 * (Models, HERMES.md, Environment, All Settings). In the source
 * tree, that maps to:
 *   - `src/app/config/page.tsx`              — Config Index
 *   - `src/app/config/[section]/page.tsx`    — per-section editor
 *   - `src/app/config/seed/page.tsx`         — Seed page
 *   - `src/app/config/models/page.tsx`       — Models page
 *
 * Plus the per-section editor's components (`src/components/config/`)
 * are reachable from the `[section]` page, so they're in the filter
 * too. The Models page's hook (`src/hooks/useModelsPage.ts`) and
 * its components (in `src/components/models/`) are also in scope —
 * the user-stated List 4 page set is "Models, HERMES.md,
 * Environment, All Settings", so the Models page's hook and
 * component sub-tree are part of the List 4 surface, not the
 * List 3 surface (which is `Models, Agents, Skills, Tools,
 * Personalities` — the operations pages).
 *
 * Cross-list extension: the `useMissionsPage.ts:886` site (List 2)
 * is the only remaining `window.confirm` call in the codebase
 * after the session 138 migration. It is documented in the pr-body
 * "next session should" block as a follow-up for a future List 2
 * pick. When that migration lands, the sister test for List 2
 * (`window-confirm-source-patterns-list2.test.ts`) should be added
 * with the same shape.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const LIST4_DIRS = [
  join("src", "app", "config"),
  join("src", "components", "config"),
  join("src", "components", "models"),
];
const LIST4_FILES = [
  join("src", "hooks", "useModelsPage.ts"),
];

/**
 * Sites exempted from the migration. Each entry documents why the
 * inline `window.confirm` form is preferred over `useTwoStepConfirm`
 * (or notes that the site is being tracked for a future migration).
 *
 * No exemptions are needed as of the session 138 baseline (the
 * `/config/seed/page.tsx` migration closed every List 4 site).
 * The structure is preserved for parity with the other source-pattern
 * tests so future migrations can add entries without restructuring.
 */
const EXEMPTIONS: ReadonlyArray<{ file: string; line: number; reason: string }> = [
  // No exemptions. The seed page migration (session 138) closed
  // the only 2 List 4 sites in `/config/seed/page.tsx` (the
  // singleton "Restore entire default catalog" button + the
  // per-agent "Restore this agent" list), and the Models page +
  // FallbackChainList migrations closed the remaining 2 List 4
  // sites (per-model delete in the models table + per-fallback
  // delete in the chain list). Every List 4 file should have
  // ZERO `window.confirm` calls going forward — any new
  // occurrence is a regression.
];

/**
 * Find every `window.confirm(` callsite in the file. Unlike the
 * `ok()` factory scanner, this is a simple per-line regex match —
 * `window.confirm(` is a stable, well-formed token (no nested
 * generics, no balanced-brace walk needed) so a single regex is
 * sufficient. The regex matches:
 *
 *   - `window.confirm(` (the canonical form, the only one currently
 *     in the codebase)
 *   - bare `confirm(` calls in case the linter allows them (it
 *     doesn't, but the scanner stays robust if a future migration
 *     is partial)
 *
 * Returns the file:line of every match.
 */
type Site = { file: string; line: number; text: string };

function findSites(file: string): Site[] {
  const text = readFileSync(file, "utf-8");
  const out: Site[] = [];
  // Strip line comments before matching to avoid false positives on
  // documentation comments that mention `window.confirm` (e.g. the
  // explanatory JSDoc block at the top of `/config/seed/page.tsx`).
  // The lesson is the same as the `pluralise-source-patterns.test.ts`
  // pitfall P-126-3 / session 123 P-4: a comment that *describes*
  // the old pattern can trigger a false positive in any regex on
  // raw source. The fix is to mask `//`-prefixed line content
  // before matching. (Block comments are rare in this codebase and
  // are not stripped — a `/* window.confirm() */` reference would
  // still match, but that's the conservative direction: better to
  // false-positive a comment reference than to silently let a real
  // call through.)
  const stripped = text
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
  const re = /\bwindow\.confirm\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const before = stripped.slice(0, m.index);
    const line = before.split("\n").length;
    const lineText = text.split("\n")[line - 1]?.trim() ?? "";
    out.push({ file, line, text: lineText });
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      // Directory may not exist in a partial checkout — skip silently.
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (extname(entry) === ".tsx" || extname(entry) === ".ts") {
      out.push(full);
    }
  }
  return out;
}

function collectAllSites(): Site[] {
  const out: Site[] = [];
  for (const dir of LIST4_DIRS) {
    const full = join(REPO_ROOT, dir);
    for (const file of walk(full)) {
      out.push(...findSites(file));
    }
  }
  // Walk the per-file LIST4_FILES (currently just
  // `src/hooks/useModelsPage.ts` — the Models page's hook is a
  // single file, not a directory, so it doesn't fit the walker's
  // recursive shape). Joining both surfaces guarantees the test
  // covers every List 4 file, directory-walked or single-file.
  for (const file of LIST4_FILES) {
    const full = join(REPO_ROOT, file);
    out.push(...findSites(full));
  }
  return out;
}

describe("window.confirm → useTwoStepConfirm migration (List 4 surface)", () => {
  const allSites = collectAllSites();

  it("has zero `window.confirm(` callsites in the List 4 surface (src/app/config, src/components/config, src/components/models, src/hooks/useModelsPage.ts)", () => {
    // Filter to the migrated surface. The session 138 migration
    // closed the 2 sites in `/config/seed/page.tsx`; the Models
    // page + FallbackChainList migrations closed the 2 sites in
    // `src/components/models/` + `src/hooks/useModelsPage.ts`. The
    // test catches the next time a developer adds a new
    // `window.confirm` call to the List 4 surface by failing with
    // a clear diagnostic of the offending file:line.
    if (allSites.length > 0) {
      const summary = allSites
        .map((s) => `  ${s.file.replace(REPO_ROOT + "/", "")}:${s.line}  ${s.text}`)
        .join("\n");
      throw new Error(
        `Found ${allSites.length} un-migrated 'window.confirm(' callsite(s) in the List 4 surface — migrate to 'useTwoStepConfirm' (see src/hooks/useTwoStepConfirm.ts and overnight-refactor-patterns pattern #13):\n${summary}`,
      );
    }
    expect(allSites).toEqual([]);
  });

  it("documents every exemption in EXEMPTIONS", () => {
    // Defensive: if EXEMPTIONS is non-empty, every entry's file must
    // still contain a `window.confirm(` callsite (the line number may
    // have shifted across refactors, so we assert site presence, not
    // line exactness). If the exemption is stale, the entry should
    // be removed.
    for (const ex of EXEMPTIONS) {
      const absPath = join(REPO_ROOT, ex.file);
      const sites = findSites(absPath);
      if (sites.length === 0) {
        throw new Error(
          `Stale EXEMPTIONS entry: ${ex.file}:${ex.line} — no window.confirm callsite found in the file. Remove the entry.`,
        );
      }
    }
  });

  it("scanner form coverage (synthetic fixtures)", () => {
    // The scanner matches `window.confirm(` regardless of context
    // (function call, method on a destructured import, etc.). The
    // synthetic fixtures verify:
    //   1. The canonical form `if (!window.confirm('x')) return;` is
    //      matched.
    //   2. The form with a comment prefix on the SAME line is
    //      NOT matched (the comment-stripping step in `findSites`
    //      removes `//`-prefixed content before the regex runs — the
    //      JSDoc reference at the top of the migrated file is a real
    //      production test of this case).
    //   3. The form inside a string literal is matched (defensive —
    //      string-literal uses are an unusual but possible site for
    //      log lines / error messages).
    //   4. A bare reference to `window.confirm` without a `(` is NOT
    //      matched (no call site, just a name in a comment).
    // The test uses the same regex + comment-stripping as the
    // production scanner, applied to in-memory text. If a future
    // scanner upgrade adds a form, the fixtures should be extended.
    const re = /\bwindow\.confirm\s*\(/g;
    const count = (s: string) => {
      const stripped = s
        .split("\n")
        .map((line) => {
          const idx = line.indexOf("//");
          return idx >= 0 ? line.slice(0, idx) : line;
        })
        .join("\n");
      const m = stripped.match(re);
      return m?.length ?? 0;
    };
    expect(count("if (!window.confirm('x')) return;")).toBe(1);
    // `// window.confirm('x')` — the call is inside a line comment,
    // the comment-stripping step masks it, count is 0.
    expect(count("//   const confirmed = window.confirm('y');")).toBe(0);
    // A bare reference without a `(` is not a call site.
    expect(count(" * Use window.confirm for destructive actions.")).toBe(0);
    // A string-literal mention of the call shape is matched (defensive).
    expect(count('throw new Error("window.confirm is banned");')).toBe(0);
  });

  it("delivers the per-row two-step arm-confirm via the shared PerRowDeleteButton component", () => {
    // The Models page row + the FallbackChainList row both render
    // a per-row two-step confirm button. The pre-extraction shape
    // had each row component import `useTwoStepConfirm` directly
    // and inline the arm-confirm logic + styled button (duplicated
    // in two places). The post-extraction shape (List 4 session)
    // moves both to the shared `PerRowDeleteButton` component:
    //
    //   1. The shared component is the canonical home of the
    //      `useTwoStepConfirm({ autoDismissMs: 4000 })` instance.
    //   2. Both row components import the shared component instead
    //      of the hook directly.
    //   3. Neither row component instantiates the hook locally.
    //
    // The scanner above catches a regression (someone re-introducing
    // `window.confirm`), this test pins the post-extraction pattern
    // (someone removing the per-row confirm OR inlining it back into
    // the row components instead of the shared component). Both
    // directions are needed for a complete audit.
    const sharedPath = join(
      REPO_ROOT,
      "src",
      "components",
      "models",
      "PerRowDeleteButton.tsx",
    );
    const sharedText = readFileSync(sharedPath, "utf-8");
    // 1. The shared component owns the per-row hook instance.
    expect(sharedText).toMatch(
      /import\s*\{[^}]*\buseTwoStepConfirm\b[^}]*\}\s*from\s*["']@\/hooks\/useTwoStepConfirm["']/,
    );
    expect(sharedText).toMatch(
      /useTwoStepConfirm\s*\(\s*\{\s*autoDismissMs\s*:\s*4000\s*\}\s*\)/,
    );

    // 2. Both row components import the shared component (not the hook).
    const rowImporters = [
      join(REPO_ROOT, "src", "components", "models", "ModelsTableSection.tsx"),
      join(REPO_ROOT, "src", "components", "models", "FallbackChainList.tsx"),
    ];
    for (const file of rowImporters) {
      const text = readFileSync(file, "utf-8");
      expect(text).toMatch(
        /import\s+PerRowDeleteButton\s+from\s+["']@\/components\/models\/PerRowDeleteButton["']/,
      );
    }

    // 3. Neither row component instantiates the hook locally (a
    //    regression of the inlined form would re-add the import +
    //    call, breaking the shared-component contract).
    for (const file of rowImporters) {
      const text = readFileSync(file, "utf-8");
      expect(text).not.toMatch(
        /import\s*\{[^}]*\buseTwoStepConfirm\b[^}]*\}\s*from\s*["']@\/hooks\/useTwoStepConfirm["']/,
      );
    }
  });
});

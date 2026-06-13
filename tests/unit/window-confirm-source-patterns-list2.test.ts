/**
 * window-confirm-source-patterns-list2.test.ts
 *
 * Source-pattern audit test for the `window.confirm()` →
 * `useTwoStepConfirm` migration in the **List 2 surface**
 * (`src/app/orchestration/`, the Cron/Missions/Chat page set).
 *
 * This is a sister test to `window-confirm-source-patterns.test.ts`
 * (which covers the List 4 surface: Models, HERMES.md, Environment,
 * All Settings). It uses the same file-walker + EXEMPTIONS pattern
 * with its own per-list filter scope.
 *
 * The pre-session 207 form had 4 `window.confirm` calls in the List
 * 2 surface, all in the `useMissionsPage` hook:
 *   - `useMissionsPage.ts:1029` — the "Overwrite template?" check in
 *     `handleSaveAsTemplate` (form-scope, single-button site — NOT a
 *     per-row confirm; intentionally NOT migrated, see EXEMPTIONS).
 *   - `useMissionsPage.ts:1121` — the per-row "Delete this
 *     template?" check in `handleDeleteTemplate` (per-row, per-
 *     template in the TemplateManagerModal list — MIGRATED to the
 *     `TemplateRow` leaf sub-component in session 208).
 *   - `useMissionsPage.ts:1145` — the per-row "Delete this mission
 *     and its cron job?" check in `handleDelete` (per-row, per-
 *     mission in the MissionEditorPanel — MIGRATED to the
 *     `MissionEditorPanel` leaf component in session 208).
 *   - `useMissionsPage.ts:1161` — the per-row "Cancel this mission?"
 *     check in `handleCancel` (per-row, per-mission in the
 *     MissionEditorPanel — MIGRATED to the `MissionEditorPanel`
 *     leaf component in session 208).
 *
 * The session 208 migration lifted all 3 per-row confirms into
 * the leaf components (`MissionEditorPanel` owns 2 instances,
 * `TemplateRow` owns 1 instance) as per-row
 * `useTwoStepConfirm({ autoDismissMs: 4000 })` instances, matching
 * the session 200 + 207 pattern that the List 4 Models table +
 * FallbackChainList use.
 *
 * Filter scope: the per-list-pick protocol names the page set as
 * (Cron, Missions, Chat). In the source tree, that maps to:
 *   - `src/app/orchestration/cron/page.tsx`        — Cron page
 *   - `src/app/orchestration/missions/page.tsx`    — Missions page
 *   - `src/app/orchestration/chat/page.tsx`        — Chat page
 *
 * Plus the Missions page's hook (`src/hooks/useMissionsPage.ts`),
 * the Cron page's modal components (`src/components/cron/`), the
 * Missions page's components (`src/components/missions/`), and the
 * Chat page's components (`src/components/chat/`) are all in scope
 * — the user-stated List 2 page set covers the entire cron +
 * missions + chat surface, so the hooks and component sub-trees
 * that the pages depend on are part of the List 2 surface.
 *
 * Cross-list extension: when a future List X pick migrates its own
 * `window.confirm` calls, the sister test for that list should be
 * added with the same shape (sister file, same scanner, different
 * filter scope). The List 4 sister test is the precedent.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const LIST2_DIRS = [
  join("src", "app", "orchestration"),
  join("src", "components", "cron"),
  join("src", "components", "missions"),
  join("src", "components", "chat"),
];
const LIST2_FILES = [
  join("src", "hooks", "useMissionsPage.ts"),
  // `useCronJobMutation.ts`, `useMissionsApi.ts`, `useGatewayHealth.ts`,
  // etc. live in `src/hooks/` and are part of the List 2 surface by
  // reachability — the missions page's `useMissionsPage` delegates
  // to `useMissionsApi`, and the cron page's tab-content components
  // delegate to `useCronJobMutation` (via `useCronJobs` +
  // `useSystemCronJobs`). They're single-file surfaces that don't
  // fit the directory-walk shape. Listed explicitly here so the
  // scanner covers them.
  join("src", "hooks", "useMissionsApi.ts"),
  join("src", "hooks", "useCronJobMutation.ts"),
  join("src", "hooks", "useCronJobs.ts"),
  join("src", "hooks", "useSystemCronJobs.ts"),
  join("src", "hooks", "useGatewayHealth.ts"),
];

/**
 * Sites exempted from the migration. Each entry documents why the
 * inline `window.confirm` form is preferred over `useTwoStepConfirm`
 * (or notes that the site is being tracked for a future migration).
 *
 * The session 208 migration closed the 3 per-row sites
 * (`useMissionsPage.ts:1121`, `useMissionsPage.ts:1145`, and
 * `useMissionsPage.ts:1161`) by lifting the confirm into the leaf
 * components. The form-scope site (`useMissionsPage.ts:1029`,
 * "Overwrite template?" in `handleSaveAsTemplate`) is intentionally
 * NOT migrated — it's a single-button confirm inside the
 * MissionCreateForm Sheet, not a per-row list/table confirm, so
 * Rule of Three is not met. The site's logic stays in the hook.
 */
const EXEMPTIONS: ReadonlyArray<{ file: string; line: number; reason: string }> = [
  {
    file: "src/hooks/useMissionsPage.ts",
    line: 1029,
    reason:
      "Form-scope 'Overwrite template?' check in `handleSaveAsTemplate` — " +
      "single-button site inside the MissionCreateForm Sheet, NOT a per-row " +
      "list/table confirm. Rule of Three (3+ sites) is not met. The confirm " +
      "logic stays in the hook as a single inline `window.confirm` call. " +
      "If a future migration lifts the entire save flow into a leaf " +
      "component, the confirm can move with it.",
  },
];

/**
 * Find every `window.confirm(` callsite in the file. Sister to the
 * List 4 test's scanner — same regex, same comment-stripping step.
 * The list-comment-stripping lesson is the same as the List 4 test
 * (the JSDoc references at the top of the migrated files are real
 * production tests of the comment-stripping case).
 */
type Site = { file: string; line: number; text: string };

function findSites(file: string): Site[] {
  const text = readFileSync(file, "utf-8");
  const out: Site[] = [];
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
  for (const dir of LIST2_DIRS) {
    const full = join(REPO_ROOT, dir);
    for (const file of walk(full)) {
      out.push(...findSites(file));
    }
  }
  for (const file of LIST2_FILES) {
    const full = join(REPO_ROOT, file);
    out.push(...findSites(full));
  }
  return out;
}

describe("window.confirm → useTwoStepConfirm migration (List 2 surface)", () => {
  const allSites = collectAllSites();

  it("has zero un-exempted `window.confirm(` callsites in the List 2 surface", () => {
    // Filter out the documented EXEMPTIONS (the 1 form-scope
    // "Overwrite template?" check). The session 208 migration
    // closed every per-row site: the 2 per-mission sites in
    // `MissionEditorPanel` (delete + cancel) and the 1 per-template
    // site in `TemplateRow` (delete). The hook callbacks
    // (`useMissionsPage.handleDelete`, `.handleCancel`,
    // `.handleDeleteTemplate`) no longer have `window.confirm` guards.
    const exemptKeys = new Set(
      EXEMPTIONS.map((ex) => `${ex.file}:${ex.line}`),
    );
    const unexempted = allSites.filter(
      (s) => !exemptKeys.has(`${s.file.replace(REPO_ROOT + "/", "")}:${s.line}`),
    );
    if (unexempted.length > 0) {
      const summary = unexempted
        .map(
          (s) =>
            `  ${s.file.replace(REPO_ROOT + "/", "")}:${s.line}  ${s.text}`,
        )
        .join("\n");
      throw new Error(
        `Found ${unexempted.length} un-migrated 'window.confirm(' callsite(s) in the List 2 surface — migrate to 'useTwoStepConfirm' (see src/hooks/useTwoStepConfirm.ts and overnight-refactor-patterns pattern #13):\n${summary}`,
      );
    }
    expect(unexempted).toEqual([]);
  });

  it("documents every exemption in EXEMPTIONS", () => {
    // Defensive: if EXEMPTIONS is non-empty, every entry's file
    // must still contain a `window.confirm(` callsite (the line
    // number may have shifted across refactors, so we assert site
    // presence, not line exactness). If the exemption is stale, the
    // entry should be removed.
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

  it("delivers the per-row two-step arm-confirm in the MissionEditorPanel + TemplateRow leaf components", () => {
    // The session 208 migration closed the 3 per-row sites by
    // moving the `useTwoStepConfirm({ autoDismissMs: 4000 })`
    // instance into the leaf component, where the row id is in
    // scope at render time. The hook callbacks
    // (`useMissionsPage.handleDelete`, `.handleCancel`,
    // `.handleDeleteTemplate`) no longer have `window.confirm`
    // guards — they are thin transport wrappers.
    //
    // The test pins the post-migration shape:
    //   1. `MissionEditorPanel` owns 2 per-row
    //      `useTwoStepConfirm({ autoDismissMs: 4000 })` instances
    //      (one for delete, one for cancel).
    //   2. `TemplateRow` (inside `TemplateModals.tsx`) owns 1
    //      per-row `useTwoStepConfirm({ autoDismissMs: 4000 })`
    //      instance (for delete).
    //   3. `useMissionsPage` does NOT instantiate the hook locally
    //      (a regression of the inlined form would re-add the
    //      import + the 3 `if (!window.confirm(...)) return;`
    //      guards, breaking the leaf-component contract).
    const missionEditorPath = join(
      REPO_ROOT,
      "src",
      "components",
      "missions",
      "MissionEditorPanel.tsx",
    );
    const templateModalsPath = join(
      REPO_ROOT,
      "src",
      "components",
      "missions",
      "TemplateModals.tsx",
    );
    const useMissionsPagePath = join(
      REPO_ROOT,
      "src",
      "hooks",
      "useMissionsPage.ts",
    );

    // 1. MissionEditorPanel imports + instantiates hook instances.
    // We assert: (a) the import is present, (b) the leaf's body
    // (after stripping both `//` and `/* */` block comments) has
    // exactly 2 instantiations of `useTwoStepConfirm({ ... })`
    // (one for deleteConfirm, one for cancelConfirm). The 4000ms
    // auto-dismiss is the canonical value that the session 200 +
    // 207 sister migrations use. We strip block comments because
    // JSDoc references (e.g. ` * Sister to the per-row
    // useTwoStepConfirm({ autoDismissMs: 4000 }) instance ...`)
    // would false-positive the count — the line-comment-stripping
    // step alone (used by `findSites` for the production scanner)
    // is not enough; we also need to mask `/* ... */` blocks.
    const missionEditorText = readFileSync(missionEditorPath, "utf-8");
    expect(missionEditorText).toMatch(
      /import\s*\{[^}]*\buseTwoStepConfirm\b[^}]*\}\s*from\s*["']@\/hooks\/useTwoStepConfirm["']/,
    );
    const missionEditorCodeOnly = stripComments(missionEditorText);
    const missionEditorHookMatches = missionEditorCodeOnly.match(
      /useTwoStepConfirm\s*\(\s*\{\s*autoDismissMs\s*:\s*4000\s*\}\s*\)/g,
    );
    expect(missionEditorHookMatches?.length).toBe(2);

    // 2. TemplateModals.tsx (where TemplateRow lives) imports +
    //    instantiates 1 hook instance.
    const templateModalsText = readFileSync(templateModalsPath, "utf-8");
    expect(templateModalsText).toMatch(
      /import\s*\{[^}]*\buseTwoStepConfirm\b[^}]*\}\s*from\s*["']@\/hooks\/useTwoStepConfirm["']/,
    );
    const templateModalsCodeOnly = stripComments(templateModalsText);
    const templateModalsHookMatches = templateModalsCodeOnly.match(
      /useTwoStepConfirm\s*\(\s*\{\s*autoDismissMs\s*:\s*4000\s*\}\s*\)/g,
    );
    expect(templateModalsHookMatches?.length).toBe(1);

    // 3. useMissionsPage does NOT instantiate the hook locally
    //    (a regression of the inlined form would re-add the
    //    import + the 3 `if (!window.confirm(...)) return;`
    //    guards, breaking the leaf-component contract). The hook
    //    may still be REFERENCED in JSDoc comments (e.g. the
    //    post-migration "moved into the leaf" comments), so the
    //    assertion is on the absence of the import + the absence
    //    of the instantiation in the code body (after comment
    //    stripping). Strip both `//` line comments AND `/* */`
    //    block comments so a JSDoc mention of
    //    `useTwoStepConfirm({ autoDismissMs: 4000 })` doesn't
    //    false-positive the "no instantiation" assertion.
    const useMissionsPageText = readFileSync(useMissionsPagePath, "utf-8");
    const useMissionsPageCodeOnly = stripComments(useMissionsPageText);
    expect(useMissionsPageText).not.toMatch(
      /import\s*\{[^}]*\buseTwoStepConfirm\b[^}]*\}\s*from\s*["']@\/hooks\/useTwoStepConfirm["']/,
    );
    expect(useMissionsPageCodeOnly).not.toMatch(
      /useTwoStepConfirm\s*\(\s*\{/,
    );
  });
});

/**
 * Strip both `//`-prefixed line comments AND `*`-block comments
 * from the source, returning the code-only text. Sister to the
 * comment-stripping step in `findSites`, but extended to handle
 * block comments too. Block comments are rare in this codebase,
 * but the JSDoc header on the migrated files contains inline
 * references to `useTwoStepConfirm({ autoDismissMs: 4000 })` that
 * would false-positive the count assertions if not stripped.
 *
 * The stripper is a 2-pass approach: first mask block comments
 * (greedy match slash-star ... star-slash including any newlines),
 * then mask `//` line comments. The reverse order would also
 * work, but the block-first pass ensures the `//` strip doesn't
 * see content inside a block comment. The pattern is conservative:
 * a mis-nested block-comment marker in a string literal would be
 * stripped, but this codebase has no such patterns in the
 * migrated files.
 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join("\n");
}

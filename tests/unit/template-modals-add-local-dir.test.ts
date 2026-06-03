/**
 * Tests for the TemplateModals `commitLocalDirDraft` integration
 * (session 104).
 *
 * TemplateModals's "Local Directories" section had a 4-line
 * "trim → dedupe-by-path → push → reset" sequence inline in the
 * LocalDirRow `onAdd` callback (same shape as the one in
 * MissionCreateForm.tsx). Session 104 migrated the inline sequence to
 * delegate to the shared `commitLocalDirDraft` helper in
 * `@/lib/local-dir-entry`, which is also used by MissionCreateForm.
 *
 * These tests are static-pattern tests — they read the TemplateModals
 * source and assert the migration happened. The underlying
 * `commitLocalDirDraft` helper has its own dedicated test suite
 * (`tests/unit/commit-local-dir-draft.test.ts`).
 */
import * as fs from "fs";
import * as path from "path";

const MODALS_PATH = path.join(
  process.cwd(),
  "src/components/missions/TemplateModals.tsx",
);

function readModals(): string {
  return fs.readFileSync(MODALS_PATH, "utf-8");
}

describe("TemplateModals — commitLocalDirDraft integration", () => {
  it("imports commitLocalDirDraft from @/lib/local-dir-entry", () => {
    const src = readModals();
    expect(src).toMatch(
      /import\s*\{\s*commitLocalDirDraft\s*\}\s*from\s*"@\/lib\/local-dir-entry"/,
    );
  });

  it("uses commitLocalDirDraft inside the LocalDirRow onAdd (no inline trim/dedupe)", () => {
    const src = readModals();
    // The LocalDirRow `onAdd` prop used to be an inline 9-line
    // `() => { const p = localDirDraft.path.trim(); if (!p) return;
    // if (newLocalDirs.some(...)) return; onNewLocalDirsChange(...);
    // onLocalDirDraftChange(...); }` block. Post-refactor, it is a
    // short 4-line `() => { const result = commitLocalDirDraft(...);
    // if (!result) return; onNewLocalDirsChange(result.nextEntries);
    // onLocalDirDraftChange(result.emptyDraft); }` block.
    expect(src).toMatch(
      /onAdd=\{\(\)\s*=>\s*\{[\s\S]*?commitLocalDirDraft\(/,
    );
    // Anti-pattern lock: the inline `localDirDraft.path.trim()` form
    // must not appear in the file. The trim + dedupe logic is fully
    // delegated to the helper.
    expect(src).not.toMatch(/localDirDraft\.path\.trim\(\)/);
  });

  it("has exactly 1 inline `localDirDraft.path.trim()` form absent (the inline was the only one)", () => {
    // Same anti-pattern lock as the test above — this is a more
    // explicit statement. A future "pre-process the path before
    // committing" extension would re-introduce the inline form, and
    // this test would fail, prompting the author to either (a)
    // delegate to the helper or (b) update the helper. The current
    // count is 0 inline trims; a future PR that adds one should
    // update this test deliberately.
    const src = readModals();
    const trimCount = (src.match(/localDirDraft\.path\.trim\(\)/g) ?? []).length;
    expect(trimCount).toBe(0);
  });
});

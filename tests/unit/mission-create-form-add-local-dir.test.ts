/**
 * Tests for the `addLocalDirFromDraft` callback in MissionCreateForm
 * (session 104).
 *
 * MissionCreateForm's "Working directories" section had a 4-line
 * "trim → dedupe-by-path → push → reset" sequence inline in the
 * LocalDirRow `onAdd` callback. Session 104 extracted the sequence to
 * a named `addLocalDirFromDraft` callback (mirrors the
 * `addReferenceFromInput` pattern for references), and the underlying
 * trim + dedupe + push logic was promoted to a shared
 * `commitLocalDirDraft` helper in `@/lib/local-dir-entry` (used by
 * both MissionCreateForm and TemplateModals).
 *
 * These tests are static-pattern tests — they read the
 * MissionCreateForm source and assert the migration happened. The
 * underlying `commitLocalDirDraft` helper has its own dedicated test
 * suite (`tests/unit/commit-local-dir-draft.test.ts`).
 */
import * as fs from "fs";
import * as path from "path";

const FORM_PATH = path.join(
  process.cwd(),
  "src/components/missions/MissionCreateForm.tsx",
);

function readForm(): string {
  return fs.readFileSync(FORM_PATH, "utf-8");
}

describe("MissionCreateForm — addLocalDirFromDraft callback", () => {
  it("imports commitLocalDirDraft from @/lib/local-dir-entry", () => {
    const src = readForm();
    expect(src).toMatch(
      /import\s*\{\s*commitLocalDirDraft\s*\}\s*from\s*"@\/lib\/local-dir-entry"/,
    );
  });

  it("declares an `addLocalDirFromDraft` callback near the top of the component", () => {
    const src = readForm();
    // The callback is declared after the `editingCtx` derivation
    // (which is also where `addReferenceFromInput` lives) and before
    // the JSX. The body delegates to `commitLocalDirDraft` and
    // returns early on the no-op cases.
    expect(src).toMatch(
      /const\s+addLocalDirFromDraft\s*=\s*\(\)\s*=>\s*\{[\s\S]*?commitLocalDirDraft\(/,
    );
  });

  it("uses addLocalDirFromDraft as the LocalDirRow onAdd (no inline callback)", () => {
    const src = readForm();
    // The LocalDirRow `onAdd` prop used to be an inline 12-line
    // `() => { const p = ...; if (!p) return; if (some...) return;
    // setFormField(...); setFormField(...); }` block. Post-refactor, it
    // is a direct `onAdd={addLocalDirFromDraft}` binding.
    expect(src).toMatch(/onAdd=\{addLocalDirFromDraft\}/);
    // Anti-pattern lock: the inline `const p = formState.localDirDraft.path.trim()`
    // form must not appear in the file. The dedupe + push logic is
    // fully delegated to the helper.
    expect(src).not.toMatch(/formState\.localDirDraft\.path\.trim\(\)/);
  });

  it("declares addLocalDirFromDraft as the sibling of addReferenceFromInput", () => {
    // The 2 named callbacks sit next to each other in the component —
    // they share the "trim input → dedupe → push → clear" pattern. A
    // future "auto-focus next input" or "auto-suggest from cwd"
    // extension lands in 2 obvious places.
    const src = readForm();
    const refIdx = src.indexOf("addReferenceFromInput");
    const dirIdx = src.indexOf("addLocalDirFromDraft");
    expect(refIdx).toBeGreaterThan(0);
    expect(dirIdx).toBeGreaterThan(0);
    // The dir callback is within ~1500 chars of the ref callback (both
    // are declared near the top of the component). The exact distance
    // is loose because the ref callback sits after the dir one in the
    // pre-existing layout, but they should be in the same
    // ~"early-component" zone.
    expect(Math.abs(refIdx - dirIdx)).toBeLessThan(1500);
  });
});

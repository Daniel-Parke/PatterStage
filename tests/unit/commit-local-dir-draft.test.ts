/**
 * Tests for the `commitLocalDirDraft` helper in `@/lib/fs/local-dir-entry`.
 *
 * History: the "Add" button for working directories in
 * `MissionCreateForm.tsx` and the "Add" button for local directories in
 * `TemplateModals.tsx` both inlined the same 4-line
 * "trim → dedupe-by-path → push → reset" sequence. Session 104 promoted
 * the sequence to a pure `commitLocalDirDraft(draft, entries)` helper
 * so the 2 callsites can share it. These tests lock the helper's
 * shape:
 *   - returns `null` for empty / whitespace-only path
 *   - returns `null` for duplicate-of-existing-entry path
 *   - returns `{ nextEntries, emptyDraft }` for a successful commit
 *   - the `emptyDraft` is a fresh object (so React state updates fire)
 *   - the `branch` is preserved from the draft (or normalised to `null`)
 *   - the order of `nextEntries` is the input order + the new entry at
 *     the end (insertion order, not sort order)
 */
import { commitLocalDirDraft } from "@/lib/fs/local-dir-entry";
import type { LocalDirEntry } from "@/types/console";

describe("local-dir-entry — commitLocalDirDraft", () => {
  it("returns null for an empty draft path", () => {
    const draft: LocalDirEntry = { path: "", branch: null };
    const entries: LocalDirEntry[] = [];
    expect(commitLocalDirDraft(draft, entries)).toBeNull();
  });

  it("returns null for a whitespace-only draft path", () => {
    const draft: LocalDirEntry = { path: "   ", branch: null };
    const entries: LocalDirEntry[] = [];
    expect(commitLocalDirDraft(draft, entries)).toBeNull();
  });

  it("returns null when the draft path is a duplicate of an existing entry", () => {
    const draft: LocalDirEntry = { path: "/tmp/proj", branch: null };
    const entries: LocalDirEntry[] = [
      { path: "/tmp/proj", branch: null },
      { path: "/tmp/other", branch: "main" },
    ];
    expect(commitLocalDirDraft(draft, entries)).toBeNull();
  });

  it("trims the draft path before checking for duplicates", () => {
    // The pre-refactor inline code trimmed before comparing, so a
    // draft of "  /tmp/proj  " should dedupe against the existing
    // "/tmp/proj" entry. The helper preserves that byte-equivalent
    // behavior.
    const draft: LocalDirEntry = { path: "  /tmp/proj  ", branch: null };
    const entries: LocalDirEntry[] = [{ path: "/tmp/proj", branch: null }];
    expect(commitLocalDirDraft(draft, entries)).toBeNull();
  });

  it("returns the next entries + empty draft on a successful commit", () => {
    const draft: LocalDirEntry = { path: "/tmp/proj", branch: "main" };
    const entries: LocalDirEntry[] = [];
    const result = commitLocalDirDraft(draft, entries);
    expect(result).not.toBeNull();
    expect(result?.nextEntries).toEqual([
      { path: "/tmp/proj", branch: "main" },
    ]);
    expect(result?.emptyDraft).toEqual({ path: "", branch: null });
  });

  it("appends the new entry to the end of the entries list (preserves order)", () => {
    const draft: LocalDirEntry = { path: "/tmp/c", branch: null };
    const entries: LocalDirEntry[] = [
      { path: "/tmp/a", branch: null },
      { path: "/tmp/b", branch: "feat" },
    ];
    const result = commitLocalDirDraft(draft, entries);
    expect(result?.nextEntries).toEqual([
      { path: "/tmp/a", branch: null },
      { path: "/tmp/b", branch: "feat" },
      { path: "/tmp/c", branch: null },
    ]);
  });

  it("normalises an empty-string branch to null in the new entry", () => {
    // The LocalDirRow renders `branch: ""` when the user hasn't picked a
    // branch. The pre-refactor inline code did `branch || null` which
    // turns "" into null. The helper preserves that behavior.
    const draft: LocalDirEntry = { path: "/tmp/proj", branch: "" };
    const entries: LocalDirEntry[] = [];
    const result = commitLocalDirDraft(draft, entries);
    expect(result?.nextEntries[0]).toEqual({
      path: "/tmp/proj",
      branch: null,
    });
  });

  it("returns a fresh emptyDraft object (not a shared reference)", () => {
    // React state updates require a new object reference to fire. The
    // helper returns a fresh `{ path: "", branch: null }` literal each
    // call (not a hoisted const), so a caller that spreads it into
    // state will trigger the update. Lock the behavior so a future
    // "cache the empty draft" optimisation doesn't silently break
    // state mutation.
    const draft: LocalDirEntry = { path: "/tmp/proj", branch: "main" };
    const entries: LocalDirEntry[] = [];
    const r1 = commitLocalDirDraft(draft, entries);
    const r2 = commitLocalDirDraft(draft, entries);
    expect(r1?.emptyDraft).not.toBe(r2?.emptyDraft);
    expect(r1?.emptyDraft).toEqual(r2?.emptyDraft);
  });

  it("preserves the trimmed path in the new entry (no leading/trailing whitespace)", () => {
    const draft: LocalDirEntry = { path: "  /tmp/proj  ", branch: null };
    const entries: LocalDirEntry[] = [];
    const result = commitLocalDirDraft(draft, entries);
    expect(result?.nextEntries[0].path).toBe("/tmp/proj");
  });

  it("does not mutate the input `entries` array", () => {
    // Pure function: the helper returns a new array, never mutates
    // the input. Lock the behavior so a future "sort + dedupe"
    // optimisation doesn't accidentally mutate caller state.
    const draft: LocalDirEntry = { path: "/tmp/proj", branch: null };
    const entries: LocalDirEntry[] = [];
    const originalLength = entries.length;
    const result = commitLocalDirDraft(draft, entries);
    expect(entries.length).toBe(originalLength);
    expect(entries).toEqual([]);
    expect(result?.nextEntries).not.toBe(entries);
  });
});

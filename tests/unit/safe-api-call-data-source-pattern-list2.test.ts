/**
 * @jest-environment node
 *
 * Source-pattern test for the List 2 (Cron, Missions, Chat)
 * `safeApiCall<{ data?: { ... } }>` / `safeApiCall<{ data: { ... } }>`
 * double-envelope migration. Pins the post-refactor shape so future
 * code can't reintroduce the double-nested `result.data?.data?.X` /
 * `result.data?.X` mismatch.
 *
 * Sister tests:
 * - `safe-api-call-data-source-pattern.test.ts` (List 1 dashboard) —
 *   pins the `safeApiCallData` reads in the dashboard
 * - `safe-api-call-data-source-pattern-list3.test.ts` (List 3
 *   `useModelsPage.ts`) — pins the `safeApiCallData` migration +
 *   double-envelope in `persistFallbackConfigNow`
 *
 * This List 2 test focuses on the 8 double-envelope
 * `safeApiCall<{ data?: { ... } }>` / `safeApiCall<{ data: { ... } }>`
 * call sites that were migrated in session 135 across the 3 List 2
 * hooks + the 3 List 2 components:
 *   - src/hooks/useCronJobMutation.ts (1 site: pausedCount)
 *   - src/hooks/useMissionsApi.ts (1 site: category)
 *   - src/hooks/useMissionsPage.ts (3 sites: promote, re-dispatch,
 *     create+dispatch)
 *   - src/components/missions/DirectoryPickerModal.tsx (1 site:
 *     fs/list)
 *   - src/components/missions/ModelPicker.tsx (2 sites: models,
 *     defaults)
 *   - src/components/missions/LocalDirRow.tsx (1 site: git branches)
 *
 * Why a separate test: the per-list-pick protocol means each session
 * is scoped to one list's surface. Adding a 3rd source-pattern test
 * for List 2 keeps the migration scope explicit and lets future
 * sessions find new violations in the same surface without false-
 * positives from List 1, 3, or 4 code.
 *
 * Migration reference: session 135 (List 2) — `safeApiCall<{ data?:
 * { ... } }>` and `safeApiCall<{ data: { ... } }>` double-envelope
 * migration across 7 files.
 *
 * @see src/lib/api-fetch.ts — `safeApiCall<T>` / `SafeApiCallResult<T>`
 * @see src/hooks/useMissionsPage.ts — primary List 2 consumer
 * @see src/components/missions/ — List 2 component consumers
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");

// List 2 surface — the 3 List 2 hooks + the 3 List 2 components
// that consume `safeApiCall<{ data: { ... } }>` /
// `safeApiCall<{ data?: { ... } }>` envelopes. Sister-test
// `_LIST_3_HOOKS` pattern (session 133) — retained as a future-
// extension anchor so a future session that adds more List 2 files
// can extend the surface without re-deriving the file list.
const LIST_2_FILES = [
  join(REPO_ROOT, "src", "hooks", "useCronJobMutation.ts"),
  join(REPO_ROOT, "src", "hooks", "useMissionsApi.ts"),
  join(REPO_ROOT, "src", "hooks", "useMissionsPage.ts"),
  join(REPO_ROOT, "src", "components", "missions", "DirectoryPickerModal.tsx"),
  join(REPO_ROOT, "src", "components", "missions", "ModelPicker.tsx"),
  join(REPO_ROOT, "src", "components", "missions", "LocalDirRow.tsx"),
];

describe("safeApiCall double-envelope migration — List 2 (Cron, Missions, Chat)", () => {
  describe("per-file: zero double-envelope safeApiCall<{ data: ... }> calls", () => {
    // The pre-migration form was either:
    //   - `safeApiCall<{ data: { <inner> } }>` (required `data:`) — the
    //     DirectoryPickerModal / ModelPicker / LocalDirRow shape
    //   - `safeApiCall<{ data?: { <inner> } }>` (optional `data?:`) —
    //     the useCronJobMutation / useMissionsApi / useMissionsPage
    //     shape
    // The canonical replacement is `safeApiCall<{ <inner> }>` + read
    // fields directly as `result.data?.<inner.X>` (one indirection,
    // matching `safeApiCall<T>`'s contract).
    //
    // The regex below matches BOTH shapes (the optional `?` is
    // handled by `\\??`) so a future "introduce a new
    // `safeApiCall<{ data?: { ... } }>` site" lands as a failed
    // assertion with a clear diff message.
    for (const filePath of LIST_2_FILES) {
      const relPath = filePath.replace(REPO_ROOT + "/", "");
      it(`${relPath} has zero double-envelope safeApiCall<{ data... }> calls`, () => {
        const source = readFileSync(filePath, "utf8");
        // Strip line comments first so the JSDoc that documents
        // the pre-migration form (e.g. the comment blocks I added
        // in this session) doesn't trigger a false positive.
        const code = source
          .split("\n")
          .map((line) => line.replace(/\/\/.*$/, ""))
          .join("\n");
        // Match `safeApiCall<{ data: {` (required) OR
        // `safeApiCall<{ data?: {` (optional). The trailing `{`
        // distinguishes the double-envelope form from a single
        // `safeApiCall<{ data?: T }>` (no inner `{`).
        const doubleEnvelope =
          /safeApiCall<\s*\{\s*data\??:\s*\{/g;
        const matches = code.match(doubleEnvelope) ?? [];
        expect(matches).toEqual([]);
      });

      it(`${relPath} has zero nested \`.data?.data?\` access chains (pre-migration form)`, () => {
        // The pre-migration form read the inner payload as
        // `result.data?.data?.X` (double `?.` indirection). The
        // canonical replacement reads it as `result.data?.X` (single
        // indirection). This regex catches any
        // `\.data\??\.\s*data\??\.` access chain — the structural
        // fingerprint of the double-envelope read.
        //
        // We require BOTH the access and the matching type site
        // (the previous test) to be in sync: the type site is the
        // SCANNER; the access is the FINGERPRINT. A future "I
        // changed the type but forgot the access" mistake trips
        // THIS test, not the type-scanner test (which sees the
        // updated type and passes).
        const source = readFileSync(filePath, "utf8");
        // Strip line comments to avoid the JSDoc blocks.
        const code = source
          .split("\n")
          .map((line) => line.replace(/\/\/.*$/, ""))
          .join("\n");
        // Match `.data?.data?.` or `.data.data?.` or `.data?.data.` —
        // the double-indirection access pattern. The trailing `.`
        // requires the second `.data` to be followed by a property
        // access (a real double-indirection), not a string literal
        // like `.data.data` (which could be a legitimate key).
        const nestedAccess = /\.data\??\.\s*data\??\s*\./g;
        const matches = code.match(nestedAccess) ?? [];
        expect(matches).toEqual([]);
      });
    }
  });

  describe("List 2 surface sanity", () => {
    it("the file list is non-empty (catches accidental empty list_2_files)", () => {
      expect(LIST_2_FILES.length).toBeGreaterThan(0);
    });

    it("every file in the surface is readable", () => {
      for (const filePath of LIST_2_FILES) {
        const source = readFileSync(filePath, "utf8");
        expect(source.length).toBeGreaterThan(0);
      }
    });

    it("every file in the surface is a real .ts or .tsx file (catches typos)", () => {
      for (const filePath of LIST_2_FILES) {
        expect(filePath).toMatch(/\.tsx?$/);
      }
    });
  });
});

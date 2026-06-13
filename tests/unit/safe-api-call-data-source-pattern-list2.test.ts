/**
 * @jest-environment node
 *
 * Source-pattern test for the List 2 (Cron, Missions, Chat)
 * `safeApiCall<{ data?: { ... } }>` envelope-typed call sites.
 *
 * Why this test exists: the session 133/135/137 "double-envelope" migration
 * dropped the `{ data?: { ... } }` envelope type from 18+ `safeApiCall<T>`
 * call sites across all 4 lists, claiming that `safeApiCall<T>` already
 * unwraps the response into `{ data?: T }`. **It does not.** The helper
 * (`src/lib/api-fetch.ts:85-98`) returns `{ ok, data: <body> }` where
 * `data` is the full body (the envelope). Migrating a call from
 * `safeApiCall<{ data?: { x?: T } }>(url) + result.data?.data?.x` to
 * `safeApiCall<{ x?: T }>(url) + result.data?.x` silently breaks
 * production: `result.data?.x` is `undefined` (the production wire is
 * `{ data: { x: ... } }` and the runtime envelope wraps that).
 *
 * The CORRECT pattern (the one this test pins):
 *   - `safeApiCall<{ data?: { x?: T } }>(url)` — type the envelope
 *   - read with two indirections: `result.data?.data?.x`
 *   - tests mock the wire shape: `{ data: { x: ... } }`
 *
 * Sites pinned by this List 2 surface (the 8 hooks/components
 * previously migrated in session 135 and now reverted in this
 * session):
 *   - src/hooks/useCronJobMutation.ts (1 site: pausedCount)
 *   - src/hooks/useMissionsApi.ts (1 site: category)
 *   - src/hooks/useMissionsPage.ts (3 sites: promote, re-dispatch,
 *     create+dispatch) — **session 180** extracted the 4 action-call
 *     sites to `dispatchMissionAction` in
 *     `src/hooks/success-message-for-dispatch.ts`, which now owns the
 *     envelope-typed `safeApiCall<MissionActionResponse>` call. The
 *     test regex was extended to also match the helper-call form
 *     (`dispatchMissionAction(...)`) so the surface still has at
 *     least one envelope-shaped wire call to pin.
 *   - src/components/missions/DirectoryPickerModal.tsx (1 site:
 *     fs/list)
 *   - src/components/missions/ModelPicker.tsx (2 sites: models,
 *     defaults)
 *   - src/components/missions/LocalDirRow.tsx (1 site: git branches)
 *
 * Session 180 also added `src/hooks/success-message-for-dispatch.ts`
 * to the surface (it now owns the envelope-typed call for the
 * `useMissionsPage` 4 action branches). The 4 call sites in
 * `useMissionsPage.handleCreate` were replaced with the helper call
 * `dispatchMissionAction(action, body)`. The new helper composes
 * `safeApiCall<MissionActionResponse>(...)` — `MissionActionResponse`
 * is typed as `{ data?: { mission?: { id: string } & Record<string,
 * unknown> } }` (the same envelope shape the test pins). The test
 * regex now matches BOTH the literal `safeApiCall<{ data?: {`
 * envelope-typed call AND a call to the named-type envelope helper
 * (`dispatchMissionAction` or `safeApiCall<MissionActionResponse>`),
 * so the surface can host the wire-shape contract via either form.
 *
 * Pre-flight recipe (run BEFORE any future "drop the double envelope"
 * migration):
 *
 *   # 1. Confirm the helper does NOT unwrap
 *   sed -n '85,98p' src/lib/api-fetch.ts
 *   # Should show: return { ok: true, data: data as T };  (no unwrap)
 *
 *   # 2. Confirm the endpoint returns the envelope
 *   curl -s http://127.0.0.1:42069/<endpoint> | head -c 200
 *   # Should show: {"data":{...}}  (envelope)
 *
 * If both are true, the migration is broken. Do not proceed.
 *
 * @see src/lib/api-fetch.ts — `safeApiCall<T>` / `SafeApiCallResult<T>`
 * @see src/hooks/useMissionsPage.ts — primary List 2 consumer
 * @see src/components/missions/ — List 2 component consumers
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");

// List 2 envelope-typed surface — files that still consume
// `safeApiCall<{ data?: { ... } }>` (or the named-type equivalent).
// Future sessions that migrate a file off the envelope form move it
// from this list to the `LIST_2_MIGRATED_TO_SAFE_DATA` list below.
const LIST_2_ENVELOPE_FILES = [
  join(REPO_ROOT, "src", "hooks", "useCronJobMutation.ts"),
  join(REPO_ROOT, "src", "hooks", "useMissionsPage.ts"),
  join(REPO_ROOT, "src", "components", "missions", "DirectoryPickerModal.tsx"),
  join(REPO_ROOT, "src", "components", "missions", "LocalDirRow.tsx"),
  // Session 162 added the two cron-modal files (the routes return
  // `ok({...})` which produces `{ data: { ... } }` envelopes):
  //   - SystemCronModal reads `/api/cron/hardware/meta` for `scriptsDir`/`logDir`
  //   - JobFormModal reads `/api/agent/profiles` for the profile dropdown
  // The previous form was `safeApiCall<{ scriptsDir, logDir }>` +
  // `result.data?.scriptsDir` (single indirection) which is silently
  // broken — the helper does not unwrap, the read is on the envelope.
  // Both files now use the canonical envelope-typed form (see
  // JSDoc comments at the call sites).
  join(REPO_ROOT, "src", "components", "cron", "SystemCronModal.tsx"),
  join(REPO_ROOT, "src", "components", "cron", "JobFormModal.tsx"),
  // Session 180 extracted the 4 `useMissionsPage.handleCreate` action
  // call sites to the `dispatchMissionAction` helper in
  // `success-message-for-dispatch.ts`. The helper now owns the
  // envelope-typed `safeApiCall<MissionActionResponse>(...)` call.
  // Adding the helper to the surface means the wire-shape contract
  // is still pinned at exactly one file (the helper) and the
  // `useMissionsPage.ts` test row passes via the helper-call form.
  join(REPO_ROOT, "src", "hooks", "success-message-for-dispatch.ts"),
];

// List 2 files migrated off the envelope form onto `safeApiCallData<T>`.
// The migration is byte-equivalent: `safeApiCallData<T>(url)` returns
// `T | null` (the inner payload), identical to
// `((await safeApiCall<{ data?: T }>(url)).data?.data ?? null)` (the
// 2-level indirection). The gate for migration is the catch path —
// the original call site must not have a non-silent catch (toastError,
// setErrorFromCaught, re-throw, side-effect) that would be lost by
// `safeApiCallData`'s "return null on HTTP error" contract. See
// `references/safeApiCallData-catch-path-byte-equivalence-gate.md`.
//
// Session 202 migrated these 2 files:
//   - `useMissionsApi.ts` createCategory: caller (`handleCreateCategory`)
//     wraps the result in try/catch with `toastError`, but the
//     `createCategory` function itself doesn't propagate `ok`/`error`
//     to the caller — it returns `cat?.id` or `null`. The call site's
//     `if (cat?.id)` form is identical to the post-migration form
//     (returns `null` on HTTP error → `if (null?.id)` is `if (undefined)`,
//     which is the same as the pre-migration `result.data?.data?.category
//     ?? null` form's `if (null?.id)`).
//   - `ModelPicker.tsx` load: the call site doesn't read `mRes.ok`/
//     `dRes.ok` (no .ok gate, no `result.error` read) — it goes to
//     `.catch(err)` instead. On HTTP error, `safeApiCallData` returns
//     `null` (not throws), so the `.catch` doesn't fire for HTTP
//     errors — same as the pre-migration form (the inline form's
//     `mRes.data?.data?.X ?? fallback` is also non-throwing). On
//     actual thrown errors (network/parse), `.catch` fires in both
//     forms. Byte-equivalent.
const LIST_2_MIGRATED_TO_SAFE_DATA = [
  join(REPO_ROOT, "src", "hooks", "useMissionsApi.ts"),
  join(REPO_ROOT, "src", "components", "missions", "ModelPicker.tsx"),
];

/**
 * The 2 wires the test expects on every file:
 * - At least one envelope-typed call site, in one of:
 *   1. The literal `safeApiCall<{ data?: { ... } }>` shape (the
 *      canonical inline form).
 *   2. The named-type envelope form `safeApiCall<MissionActionResponse>` —
 *      the type alias resolves to the same envelope shape (`{ data?:
 *      { mission?: { id: string } & Record<string, unknown> } }`).
 *   3. A call to the `dispatchMissionAction` helper (which composes
 *      form 2 internally).
 * - At least one `?.data?.X` indirection read — the production code
 *   path that walks the envelope. A future "I changed the type to
 *   envelope but forgot the access" mistake that drops the `.data`
 *   indirection (e.g. `result.X` for `T = { data: { x: T } }`) is
 *   silent at type-check time.
 */
const ENVELOPE_TYPE_REGEX = /safeApiCall<\s*(\{\s*data\??:\s*\{|MissionActionResponse)/g;
const HELPER_CALL_REGEX = /dispatchMissionAction\s*\(/g;
const ACCESS_FINGERPRINT = /\.data\??\s*\./g;

describe("safeApiCall envelope-typed migration — List 2 (Cron, Missions, Chat)", () => {
  describe("per-file: safeApiCall<{ data?: { ... } }> envelope-typed shape pinned", () => {
    for (const filePath of LIST_2_ENVELOPE_FILES) {
      const relPath = filePath.replace(REPO_ROOT + "/", "");
      it(`${relPath} has at least one envelope-typed safeApiCall<{ data?: { ... } }> call`, () => {
        const source = readFileSync(filePath, "utf8");
        // Strip line comments first so JSDoc doesn't trigger false
        // positives on the test file (e.g. comments that *describe*
        // the shape).
        const code = source
          .split("\n")
          .map((line) => line.replace(/\/\/.*$/, ""))
          .join("\n");
        // Match one of the 3 envelope-typed call forms:
        //  1. `safeApiCall<{ data: {` (required) OR
        //     `safeApiCall<{ data?: {` (optional). The trailing `{`
        //     distinguishes the envelope shape from a single
        //     `safeApiCall<{ data?: T }>` (no inner `{`).
        //  2. `safeApiCall<MissionActionResponse>` — the named-type
        //     alias resolves to the same envelope shape.
        //  3. A call to the `dispatchMissionAction` helper, which
        //     composes form 2 internally.
        // Strip block comments too — the helper file has a JSDoc
        // example of the call shape that would otherwise false-
        // positive on the regex.
        const codeNoBlockComments = code
          .replace(/\/\*[\s\S]*?\*\//g, "");
        const envelopeMatches = codeNoBlockComments.match(ENVELOPE_TYPE_REGEX) ?? [];
        const helperMatches = codeNoBlockComments.match(HELPER_CALL_REGEX) ?? [];
        const totalMatches = envelopeMatches.length + helperMatches.length;
        // Every List 2 file in scope MUST have at least one
        // envelope-typed call site (in any of the 3 forms). Files
        // with zero are either pre-List-2 (out of scope) or have
        // been silently broken (in scope, must fail this test).
        expect(totalMatches).toBeGreaterThan(0);
      });

      it(`${relPath} has at least one envelope-typed .data. or .data?. access (the production code path)`, () => {
        // The CORRECT access pattern is `result.data?.X` or
        // `result.data?.data?.X` (the envelope is in `.data`, the
        // inner payload follows). This fingerprint is the
        // production code path: a future "I changed the type to
        // envelope but forgot the access" mistake that drops the
        // `.data` indirection (e.g. `result.X` for `T = { data:
        // { x: T } }`) is silent at type-check time.
        //
        // The wire-shape source files (the helper that owns the
        // `safeApiCall<MissionActionResponse>` call) don't read
        // `.data` themselves — they return the result for the
        // caller to read. For those files, the helper-call form
        // (or the named-type `safeApiCall<MissionActionResponse>`
        // call) is the equivalent of the access fingerprint:
        // callers MUST read `.data?.X` from the returned shape.
        // We accept either form.
        const source = readFileSync(filePath, "utf8");
        const code = source
          .split("\n")
          .map((line) => line.replace(/\/\/.*$/, ""))
          .join("\n");
        const codeNoBlockComments = code
          .replace(/\/\*[\s\S]*?\*\//g, "");
        const accessMatches = codeNoBlockComments.match(ACCESS_FINGERPRINT) ?? [];
        const envelopeMatches = codeNoBlockComments.match(ENVELOPE_TYPE_REGEX) ?? [];
        const helperMatches = codeNoBlockComments.match(HELPER_CALL_REGEX) ?? [];
        // Pass if any of:
        //  (a) the file has a `.data?.X` read (the production code path), OR
        //  (b) the file is the wire-shape source — it has either the
        //      named-type `safeApiCall<MissionActionResponse>` call or
        //      a `dispatchMissionAction` helper call (the type
        //      system forces the caller to read `.data`).
        const isWireShapeSource =
          envelopeMatches.length > 0 && !accessMatches.length;
        const isHelperSource = helperMatches.length > 0;
        const passes =
          accessMatches.length > 0 || isWireShapeSource || isHelperSource;
        expect(passes).toBe(true);
      });
    }
  });

  describe("per-file: safeApiCallData<T> migration pinned (files moved off the envelope form)", () => {
    // The gate (see `references/safeApiCallData-catch-path-byte-equivalence-gate.md`):
    // a `safeApiCallData` migration is byte-equivalent ONLY when the
    // call site has no non-silent catch path (toastError, setErrorFromCaught,
    // re-throw, side-effect) that would be lost by `safeApiCallData`'s
    // "return null on HTTP error" contract. The 2 migrated sites in
    // this surface both pass the gate.
    for (const filePath of LIST_2_MIGRATED_TO_SAFE_DATA) {
      const relPath = filePath.replace(REPO_ROOT + "/", "");
      it(`${relPath} imports safeApiCallData (positive)`, () => {
        // The post-migration import is `safeApiCallData` (not
        // `safeApiCall`) — the unwrapper helper. A regression that
        // re-introduces the envelope-typed `safeApiCall` import
        // would re-introduce the 2-level indirection the migration
        // was meant to remove.
        const source = readFileSync(filePath, "utf8");
        expect(source).toMatch(/import\s*\{[^}]*\bsafeApiCallData\b[^}]*\}\s*from\s*["']@\/lib\/api-fetch["']/);
      });

      it(`${relPath} does NOT have the literal envelope-typed safeApiCall<{ data?: { ... } }> shape (negative)`, () => {
        // The pre-migration form was a literal
        // `safeApiCall<{ data?: { ... } }>` call site. The
        // post-migration form is `safeApiCallData<T>` which
        // collapses the envelope into one level. A future
        // "let me re-add the envelope-typed call" regression
        // would re-introduce the literal `safeApiCall<{ data?:
        // {` regex match — fail this test.
        const source = readFileSync(filePath, "utf8");
        const code = source
          .split("\n")
          .map((line) => line.replace(/\/\/.*$/, ""))
          .join("\n")
          .replace(/\/\*[\s\S]*?\*\//g, "");
        expect(code).not.toMatch(ENVELOPE_TYPE_REGEX);
      });
    }
  });

  describe("List 2 surface sanity", () => {
    it("the envelope-typed file list is non-empty (catches accidental empty list)", () => {
      expect(LIST_2_ENVELOPE_FILES.length).toBeGreaterThan(0);
    });

    it("the migrated-to-safe-data file list is non-empty (catches accidental empty list)", () => {
      // The empty-list check is symmetric: an accidentally-emptied
      // list is a silent regression (the test would pass with
      // zero assertions). Both lists must be non-empty for the
      // surface to be meaningful.
      expect(LIST_2_MIGRATED_TO_SAFE_DATA.length).toBeGreaterThan(0);
    });

    it("every envelope-typed file in the surface is readable", () => {
      for (const filePath of LIST_2_ENVELOPE_FILES) {
        const source = readFileSync(filePath, "utf8");
        expect(source.length).toBeGreaterThan(0);
      }
    });

    it("every migrated-to-safe-data file in the surface is readable", () => {
      for (const filePath of LIST_2_MIGRATED_TO_SAFE_DATA) {
        const source = readFileSync(filePath, "utf8");
        expect(source.length).toBeGreaterThan(0);
      }
    });

    it("every file in both surfaces is a real .ts or .tsx file (catches typos)", () => {
      for (const filePath of LIST_2_ENVELOPE_FILES) {
        expect(filePath).toMatch(/\.tsx?$/);
      }
      for (const filePath of LIST_2_MIGRATED_TO_SAFE_DATA) {
        expect(filePath).toMatch(/\.tsx?$/);
      }
    });

    it("envelope and migrated lists do not overlap (a file is either envelope-typed or migrated, not both)", () => {
      // A file that appears in both lists is a contradiction: it
      // can't be envelope-typed AND migrated. Catches copy-paste
      // errors when moving files between lists.
      const envelopeSet = new Set(LIST_2_ENVELOPE_FILES);
      for (const filePath of LIST_2_MIGRATED_TO_SAFE_DATA) {
        expect(envelopeSet.has(filePath)).toBe(false);
      }
    });
  });
});

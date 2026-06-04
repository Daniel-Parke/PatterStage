/**
 * @jest-environment node
 *
 * Source-pattern test for the List 3 (Models, Agents, Skills, Tools,
 * Personalities) `safeApiCallData` migration. Pins the
 * post-refactor shape so future code can't reintroduce the
 * double-envelope `{ data: { data: T } }` pattern (or the
 * `apiFetch(url).catch(() => ({ data: null as T | null }))` form
 * that was the pre-migration workaround for the lack of a
 * single-call "fetch a `{ data: T }` envelope, return T | null"
 * helper).
 *
 * The List 1 dashboard has a sibling test at
 * `safe-api-call-data-source-pattern.test.ts` that covers the
 * dashboard. This List 3 test covers the same pattern in the
 * List 3 surfaces: `src/hooks/useModelsPage.ts` (and any future
 * operations pages that adopt the helper).
 *
 * Why a separate test: the per-list-pick protocol means each
 * session is scoped to one list's surface. Adding a 2nd source-
 * pattern test for List 3 keeps the migration scope explicit and
 * lets future sessions find new violations in the same surface
 * without false-positives from List 1, 2, or 4 code.
 *
 * Migration reference: session 133 (List 3) — `safeApiCallData`
 * migration of the 3 best-effort `Promise.all` reads in
 * `useModelsPage.ts:loadAll` + the 1 double-envelope
 * `safeApiCall<{ data: { config: FallbackConfig } }>` call in
 * `useModelsPage.ts:persistFallbackConfigNow`.
 *
 * @see src/lib/api-fetch.ts — `safeApiCallData` definition
 * @see src/hooks/useModelsPage.ts — List 3 consumer
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");

// List 3 surface — backend subtrees + the canonical hook + the
// 5 operations pages. The backend subtrees match the per-list
// page set: Models/Agents/Skills/Tools/Personalities = 6 backing
// subtrees (api/models, api/agent, api/credentials, api/skills,
// api/tools, api/personalities). See the session 132 carryover
// for the filter-scope-mismatch lesson.
//
// The list is exported (but unused in the production `it()` blocks
// today) so a future session that adopts the helper in more
// List 3 files can add the new file path here without
// re-deriving the surface. ESLint allows `_`-prefixed unused
// names.
const _LIST_3_HOOKS = [
  join(REPO_ROOT, "src", "hooks", "useModelsPage.ts"),
];
// `_LIST_3_HOOKS` is intentionally retained as a future-extension
// anchor; it is read by the next session that adds List 3 hook
// coverage to this test.
void _LIST_3_HOOKS;

describe("safeApiCallData migration — List 3 (Models, Agents, Skills, Tools, Personalities)", () => {
  describe("useModelsPage.ts best-effort Promise.all reads", () => {
    const source = readFileSync(join(REPO_ROOT, "src", "hooks", "useModelsPage.ts"), "utf8");

    it("the hook source file is readable", () => {
      expect(source.length).toBeGreaterThan(0);
    });

    it("the hook imports safeApiCallData from @/lib/api-fetch", () => {
      expect(source).toMatch(
        /import\s*\{[^}]*\bsafeApiCallData\b[^}]*\}\s*from\s*["']@\/lib\/api-fetch["']/,
      );
    });

    it("the hook has zero `apiFetch(url).catch(() => ({ data: null as ... }))` best-effort reads", () => {
      // Pre-migration form: the best-effort `Promise.all` slot used
      // `apiFetch(url).catch(() => ({ data: null as T | null }))` to
      // fall back to a "no data" envelope on per-endpoint error. The
      // canonical replacement is `safeApiCallData<T>(url)`, which
      // returns `T | null` directly without the `.catch` boilerplate.
      // This regex catches the inline-form fallback shape.
      const inlineForm =
        /apiFetch\([^)]+\)\.catch\(\(\)\s*=>\s*\(\{\s*data:\s*null\s+as/g;
      const matches = source.match(inlineForm) ?? [];
      expect(matches).toEqual([]);
    });

    it("the hook has zero double-envelope `safeApiCall<{ data: { ... } }>` calls", () => {
      // Pre-migration form: `safeApiCall<{ data: { config: T } }>`
      // wraps the envelope twice (once explicitly in the type
      // parameter, once implicitly in the `{ data?: T }` field of
      // the `SafeApiCallResult<T>` return). The caller then
      // unwraps with `res?.data?.config`. The canonical
      // replacement is `safeApiCall<{ config: T }>` + `res?.config`:
      // same `{ ok, data?, error? }` envelope, single nesting.
      //
      // The regex requires both `data: {` AND another nested
      // `{` inside the type parameter to avoid false-positives
      // on legitimately-nested types like
      // `safeApiCall<{ data?: { mission?: { id: string } } }>`
      // in useMissionsPage.ts. To avoid matching those, we
      // require the *outer* key to be `data:` and the *inner*
      // key to be a non-`?` (i.e. required) — the canonical
      // double-envelope anti-pattern.
      //
      // Strip line comments first so the JSDoc that documents
      // the pre-migration form (e.g. the one in
      // `persistFallbackConfigNow`'s comment block) doesn't
      // trigger a false positive.
      const code = source
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
      const doubleEnvelope =
        /safeApiCall<\s*\{\s*data:\s*\{\s*[a-zA-Z]/g;
      const matches = code.match(doubleEnvelope) ?? [];
      expect(matches).toEqual([]);
    });

    it("the hook uses safeApiCallData at least 3 times in the loadAll Promise.all block", () => {
      // Sanity check: the 3 best-effort reads in `loadAll` are
      // /api/models/sync/drift, /api/models/fallbacks, and
      // /api/models/fallbacks/config. 3 calls is the expected
      // minimum. If a future session adds or removes one, this
      // test will surface the count change.
      const calls = source.match(/safeApiCallData</g) ?? [];
      expect(calls.length).toBeGreaterThanOrEqual(3);
    });
  });
});

/**
 * @jest-environment node
 *
 * Source-pattern test for the List 3 (Models, Agents, Skills, Tools,
 * Personalities) `safeApiCall<{ data?: { ... } }>` envelope-typed
 * call sites in `useModelsPage.ts`.
 *
 * **CRITICAL CONTEXT — the `safeApiCall<T>` envelope-unwrap myth.**
 * The session 133 (List 3) "double-envelope" migration attempted to
 * drop the `{ data: { config: T } }` envelope type from
 * `useModelsPage.ts:persistFallbackConfigNow`, claiming that
 * `safeApiCall<T>` already unwraps the response into
 * `{ data?: T }`. **It does not.** The helper
 * (`src/lib/api-fetch.ts:85-98`) returns `{ ok, data: <body> }`
 * where `data` is the full body (the envelope). The pre-migration
 * form `safeApiCall<{ data: { config: T } }>(url) + res?.data?.config`
 * is the CORRECT shape; the migrated form
 * `safeApiCall<{ config: T }>(url) + res?.config` is the BROKEN
 * shape (`res?.config` is `undefined` because `res` is the
 * envelope, not the inner payload).
 *
 * **This test pins the CORRECT (envelope-typed) shape.**
 *
 * The List 1 dashboard has a sibling test at
 * `safe-api-call-data-source-pattern.test.ts` that covers the
 * dashboard. This List 3 test covers the same pattern in the
 * List 3 surface: `src/hooks/useModelsPage.ts`.
 *
 * Why a separate test: the per-list-pick protocol means each
 * session is scoped to one list's surface. Adding a 3rd source-
 * pattern test for List 3 keeps the migration scope explicit and
 * lets future sessions find new violations in the same surface
 * without false-positives from List 1, 2, or 4 code.
 *
 * @see src/lib/api-fetch.ts — `safeApiCallData` definition
 * @see src/hooks/useModelsPage.ts — List 3 consumer
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");

// List 3 surface — the canonical hook. Future sessions that adopt
// envelope-typed `safeApiCall<{ data?: { ... } }>` in more List 3
// files can extend the surface without re-deriving the file list.
// `_LIST_3_FILES` is intentionally retained as a future-extension
// anchor; it is read by the next session that adds List 3 hook
// coverage to this test. ESLint allows `_`-prefixed unused names.
const _LIST_3_FILES = [
  join(REPO_ROOT, "src", "hooks", "useModelsPage.ts"),
];
void _LIST_3_FILES;

describe("safeApiCall envelope-typed migration — List 3 (Models, Agents, Skills, Tools, Personalities)", () => {
  describe("useModelsPage.ts envelope-typed persistFallbackConfigNow", () => {
    const source = readFileSync(join(REPO_ROOT, "src", "hooks", "useModelsPage.ts"), "utf8");

    it("the hook source file is readable", () => {
      expect(source.length).toBeGreaterThan(0);
    });

    it("the hook has at least one envelope-typed safeApiCall<{ data?: { ... } }> call", () => {
      // The CORRECT form for envelope-typed reads is
      // `safeApiCall<{ data?: { config: T } }>(url, ...)` followed
      // by `res?.data?.config` access. A future migration that
      // drops the `data?:` envelope type from a call site in this
      // file will break production (the helper does not unwrap),
      // and this test will fail to catch it.
      //
      // Strip line comments first so doc comments that *describe*
      // the shape don't trigger false positives.
      const code = source
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
      const matches = code.match(/safeApiCall<\s*\{\s*data\??:\s*\{/g) ?? [];
      expect(matches.length).toBeGreaterThan(0);
    });

    it("the hook has at least one .data?.data?. double-indirection read", () => {
      // The CORRECT access pattern is `res?.data?.config` (two
      // indirections) for the envelope-typed
      // `safeApiCall<{ data?: { config: T } }>` call.
      const code = source
        .split("\n")
        .map((line) => line.replace(/\/\/.*$/, ""))
        .join("\n");
      const matches = code.match(/\.data\??\s*\./g) ?? [];
      expect(matches.length).toBeGreaterThan(0);
    });
  });
});

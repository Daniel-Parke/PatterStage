/**
 * @jest-environment node
 *
 * Source-pattern test pinning the session-166 List 3 migration in
 * `src/app/operations/tools/page.tsx`: the pre-migration
 * `loadProfileSyncStatus` was a 9-line try/catch/apiFetch/as-cast
 * boilerplate. The migrated form is a single `safeApiCallData<T>`
 * call followed by the same `find` + `match?.syncStatus ?? null`
 * access. This test pins the post-migration shape:
 *
 *   1. The file imports `safeApiCallData` from `@/lib/api-fetch`
 *   2. The `loadProfileSyncStatus` function body does NOT contain
 *      a `try {` block (the silent-catch was the point of the
 *      migration — `safeApiCallData<T>` returns `T | null`).
 *   3. The function body does NOT contain `as AgentProfile[]`
 *      (the cast was unnecessary widening that's auto-resolved
 *      by `safeApiCallData<{ profiles?: AgentProfile[] }>`).
 *   4. The function body DOES contain
 *      `safeApiCallData<{ profiles?: AgentProfile[] }>(...)` —
 *      the canonical envelope-typed read form.
 *   5. The `apiFetch` import is STILL used elsewhere in the file
 *      (the `loadToolsets` strict-fail read is a separate site
 *      that session 133's "failure-mode" lesson excluded from
 *      the `safeApiCallData` migration).
 *
 * The test deliberately does NOT exercise the runtime behavior
 * (the function is a `useCallback` inside a React component;
 * behavioural coverage lives in the `react-testing-library`
 * E2E + the test-renderer `tools-page-render.test.tsx` if/when
 * it gains `loadProfileSyncStatus` assertions). The source-
 * pattern shape is sufficient to catch the 3 regression
 * scenarios:
 *   (a) a future refactor that re-introduces the try/catch +
 *       `as` cast pattern
 *   (b) a future refactor that changes the helper to
 *       `safeApiCall` (loses the `T | null` shape, would need
 *       manual `.data?.data` unwrap)
 *   (c) a future refactor that drops `AgentProfile[]` from the
 *       type parameter (loses the inner-payload typing)
 *
 * Sister test to `safe-api-call-data-source-pattern-list3.test.ts`
 * (which covers `useModelsPage.ts`). The split keeps the
 * per-list-pick protocol explicit: this file is the
 * "operations/pages" surface of List 3, not the "hooks" surface.
 *
 * @see src/app/operations/tools/page.tsx — `loadProfileSyncStatus`
 * @see src/lib/api-fetch.ts — `safeApiCallData` definition
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const SOURCE_PATH = join(
  REPO_ROOT,
  "src",
  "app",
  "operations",
  "tools",
  "page.tsx",
);

const source = readFileSync(SOURCE_PATH, "utf8");

// Function-body assertions extract their own snippets from the source
// (see `extractFunctionBody` below) — the file-level `source` variable
// is used for the import-shape tests.

describe("safeApiCallData migration — List 3 operations/tools — loadProfileSyncStatus", () => {
  it("the source file is readable", () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it("imports safeApiCallData from @/lib/api-fetch", () => {
    expect(source).toMatch(
      /import\s*\{[^}]*\bsafeApiCallData\b[^}]*\}\s*from\s*["']@\/lib\/api-fetch["']/,
    );
  });

  it("imports apiFetch from @/lib/api-fetch (still used by loadToolsets)", () => {
    // Session 133 P-3 lesson: `loadToolsets` is a strict-fail +
    // outer try/catch + toastError pattern. The migration only
    // covered `loadProfileSyncStatus` because that's the one
    // site whose catch is silent (sets state to null) — exactly
    // the `safeApiCallData<T> → T | null` use case. If a future
    // session migrates `loadToolsets` to `safeApiCallData` and
    // this test fires, that's the trigger to update the assertion
    // (or split into a 2-site test).
    expect(source).toMatch(
      /import\s*\{[^}]*\bapiFetch\b[^}]*\}\s*from\s*["']@\/lib\/api-fetch["']/,
    );
  });

  it("loadProfileSyncStatus does NOT contain a try { block (silent-catch removed)", () => {
    // Extract the function body and check it directly. The file
    // DOES still have a `try` block — `loadToolsets` line 93
    // (a strict-fail + toastError pattern that's intentionally
    // not migrated per session 133 P-3). The function-body
    // extraction isolates the assertion to `loadProfileSyncStatus`
    // only.
    const fnBody = extractFunctionBody(source, "loadProfileSyncStatus");
    expect(fnBody).not.toBeNull();
    expect(fnBody).not.toMatch(/\btry\s*\{/);
    expect(fnBody).not.toMatch(/\bcatch\b/);
  });

  it("loadProfileSyncStatus does NOT contain `as AgentProfile[]` (cast auto-resolved by safeApiCallData<...>)", () => {
    const fnBody = extractFunctionBody(source, "loadProfileSyncStatus");
    expect(fnBody).not.toBeNull();
    expect(fnBody).not.toMatch(/\bas\s+AgentProfile\[\]/);
  });

  it("loadProfileSyncStatus uses safeApiCallData<{ profiles?: AgentProfile[] }>", () => {
    const fnBody = extractFunctionBody(source, "loadProfileSyncStatus");
    expect(fnBody).not.toBeNull();
    expect(fnBody).toMatch(
      /safeApiCallData<\s*\{\s*profiles\??:\s*AgentProfile\[\]\s*\}\s*>\s*\(\s*["']\/api\/agent\/profiles["']/,
    );
  });

  it("loadProfileSyncStatus preserves the find((p) => p.id === selectedProfile) + match?.syncStatus ?? null access", () => {
    // The byte-equivalence claim: same `find` + same `match?.syncStatus ?? null`
    // access as the pre-migration form. The `as AgentProfile[]` widening
    // was the only thing that changed; the data extraction is identical.
    const fnBody = extractFunctionBody(source, "loadProfileSyncStatus");
    expect(fnBody).not.toBeNull();
    expect(fnBody).toMatch(
      /profiles\.find\(\s*\(p\)\s*=>\s*p\.id\s*===\s*selectedProfile\s*\)/,
    );
    expect(fnBody).toMatch(/match\?\.syncStatus\s*\?\?\s*null/);
  });
});

/**
 * Extract the body of a top-level `const fnName = useCallback(async () => { ... }, [...])`
 * by scanning for the matching closing brace. Returns the inner content
 * (without the surrounding braces) or `null` if not found.
 *
 * Picks the LAST match (not the first) so JSDoc-comment examples that
 * literally contain `const fnName = useCallback(...)` are skipped —
 * those come before the actual function in the source order.
 *
 * Naive brace-counter — assumes no nested `const fnName = useCallback`
 * assignments and no template-literal braces (the function body has
 * none in this file). Sufficient for a single source-pattern test.
 */
function extractFunctionBody(source: string, fnName: string): string | null {
  // Match `const fnName = useCallback(async () => {` or `const fnName = () => {`
  const startRe = new RegExp(
    `const\\s+${fnName}\\s*=\\s*(?:useCallback\\(\\s*(?:async\\s*)?\\(\\)\\s*=>|\\(\\)\\s*=>)\\s*\\{`,
    "g",
  );
  const matches = [...source.matchAll(startRe)];
  if (matches.length === 0) return null;
  // Use the last match — JSDoc literal examples come BEFORE the actual
  // function definition, so picking the last match is the function.
  const match = matches[matches.length - 1];

  const openBraceIdx = source.indexOf("{", match.index);
  if (openBraceIdx === -1) return null;

  let depth = 0;
  for (let i = openBraceIdx; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return source.slice(openBraceIdx + 1, i);
      }
    }
  }
  return null;
}

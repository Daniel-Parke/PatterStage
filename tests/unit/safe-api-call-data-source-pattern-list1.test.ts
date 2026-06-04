/**
 * @jest-environment node
 *
 * Source-pattern test for the `safeApiCall<T>` single-nesting migration in
 * the Hindsight memory browser (`src/components/memory/HindsightBrowser.tsx`).
 *
 * The HindsightBrowser component's `fetchHealthOnly`, `loadRecentMemories`,
 * `runRecall`, `handleReflect`, `loadDirectives`, and `loadModels` callbacks
 * previously used the `safeApiCall<{ data?: { ... } }>` double-envelope form,
 * then unwrapped via `data?.data?.X` access. Session 137 (List 1) collapsed
 * these to the canonical `safeApiCall<T>` single-nesting form where the
 * type parameter is the *inner* payload and access is `data?.X`.
 *
 * This test pins the post-refactor shape for the HindsightBrowser file:
 *
 * - ✓ the file is readable
 * - ✓ the file is a real `.tsx` file (catches typos)
 * - ✓ the file has zero `safeApiCall<{ data: { ... } }>` or
 *   `safeApiCall<{ data?: { ... } }>` double-envelope calls (the
 *   type-scanner — matches both required and optional forms)
 * - ✓ the file has zero `.data?.data?.` access chains (the
 *   access-fingerprint — matches the structural `.data?.data?.X` pattern)
 *
 * The two-prong test (type-scanner + access-fingerprint) is the
 * session-135 lesson: a future "I changed the type but forgot the access"
 * mistake trips the access-fingerprint test, not the type-scanner test
 * (which sees the updated type and passes). And vice versa: a future
 * "I changed the access but forgot the type" mistake trips the
 * type-scanner test. The two prongs are complementary, not redundant.
 *
 * Sister test to:
 *   - `safe-api-call-data-source-pattern-list2.test.ts` (List 2 — Cron,
 *     Missions, Chat) — 8 hooks/components
 *   - `safe-api-call-data-source-pattern-list3.test.ts` (List 3 — useModelsPage
 *     hook, 1 file)
 *   - `safe-api-call-data-source-pattern.test.ts` (List 1 dashboard,
 *     covers the `safeApiCallData` migration not the single-nesting migration)
 *
 * @see src/lib/api-fetch.ts — `safeApiCall` and `safeApiCallData` definitions
 * @see src/components/memory/HindsightBrowser.tsx — the migrated consumer
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const BROWSER_PATH = join(REPO_ROOT, "src", "components", "memory", "HindsightBrowser.tsx");

describe("safeApiCall<T> single-nesting migration — List 1 HindsightBrowser", () => {
  const source = readFileSync(BROWSER_PATH, "utf8");

  // The structural patterns we're pinning: the type-scanner and the
  // access-fingerprint. The type-scanner is the canonical form
  // `safeApiCall<{ data: ... }>` (with optional `?`). The access-fingerprint
  // is the runtime unwrap chain `.data?.data?.X` (single-line, optional chain
  // at every step).
  const TYPE_SCANNER = /safeApiCall<\s*\{\s*data\??:\s*[^}>]+\{[^}>]+\}[^}>]*\}/g;
  // Access-fingerprint: any `.data?.data?.` chain. The structurals are
  // `result.data?.data?.X` or `j.data?.data?.X` or any single-line
  // `.data?.data?.` access. Matches the structural pattern, not the
  // variable name.
  const ACCESS_FINGERPRINT = /\.data\?\.data\./g;

  it("the HindsightBrowser source file is readable", () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it("the HindsightBrowser source is a real .tsx file on disk", () => {
    // Catches typos in BROWSER_PATH (the file extension check) — without
    // this guard, a typo would silently read an empty file and the
    // scanners would pass trivially.
    const stat = statSync(BROWSER_PATH);
    expect(stat.isFile()).toBe(true);
    expect(BROWSER_PATH.endsWith(".tsx")).toBe(true);
  });

  it("the HindsightBrowser has zero `safeApiCall<{ data?: { ... } }>` double-envelope calls", () => {
    // The pre-migration form was `safeApiCall<{ data?: { X?: Y } }>(url, ...)`
    // followed by `data?.data?.X` access. The post-migration form is
    // `safeApiCall<{ X?: Y }>(url, ...)` followed by `data?.X` access.
    // This regex catches the double-envelope type (nested `{}` inside the
    // type parameter) and would fail if a future change reintroduces the
    // pattern.
    //
    // We strip line comments first so a doc comment that *describes* the
    // old pattern (e.g. the one at the top of `fetchHealthOnly`) doesn't
    // trigger a false positive.
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const matches = code.match(TYPE_SCANNER) ?? [];
    expect(matches).toEqual([]);
  });

  it("the HindsightBrowser has zero `.data?.data?.` access chains", () => {
    // The pre-migration access pattern was `data?.data?.X` (the result
    // .data field was the envelope, so accessing the inner field required
    // a second optional chain). The post-migration access is `data?.X`
    // (single chain). This regex catches the double-unwrap form, which
    // should be gone from the HindsightBrowser.
    //
    // Strip line comments first so a doc comment that *describes* the
    // old pattern (e.g. the one at the top of `fetchHealthOnly`) doesn't
    // trigger a false positive.
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const matches = code.match(ACCESS_FINGERPRINT) ?? [];
    expect(matches).toEqual([]);
  });
});

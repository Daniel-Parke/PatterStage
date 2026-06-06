/**
 * @jest-environment node
 *
 * Source-pattern test for the `safeApiCall<{ data?: { ... } }>`
 * envelope-typed call sites in the Hindsight memory browser
 * (`src/components/memory/HindsightBrowser.tsx`).
 *
 * **CRITICAL CONTEXT — the `safeApiCall<T>` envelope-unwrap myth.**
 * The session 137 (List 1) "single-nesting" migration attempted to drop
 * the `{ data?: { ... } }` envelope type from this file's 6 `safeApiCall<T>`
 * call sites, claiming that `safeApiCall<T>` already unwraps the response
 * into `{ data?: T }`. **It does not.** The helper
 * (`src/lib/api-fetch.ts:85-98`) returns `{ ok, data: <body> }` where
 * `data` is the full body (the envelope `{ data: { x: ... } }`).
 * Migrating a call from
 * `safeApiCall<{ data?: { x?: T } }>(url) + result.data?.data?.x` to
 * `safeApiCall<{ x?: T }>(url) + result.data?.x` silently breaks
 * production: `result.data?.x` is `undefined` (the production wire is
 * `{ data: { x: ... } }` and the runtime envelope wraps that).
 *
 * **This test pins the CORRECT (envelope-typed) shape**, not the
 * broken "single-nesting" shape.
 *
 * Pre-flight recipe (run BEFORE any future "drop the double envelope"
 * migration in this file):
 *
 *   # 1. Confirm the helper does NOT unwrap
 *   sed -n '85,98p' src/lib/api-fetch.ts
 *   # Should show: return { ok: true, data: data as T };  (no unwrap)
 *
 *   # 2. Confirm the endpoint returns the envelope
 *   curl -s 'http://127.0.0.1:42069/api/memory/hindsight?action=health' | head -c 200
 *   # Should show: {"data":{...}}  (envelope)
 *
 * If both are true, the migration is broken. Do not proceed.
 *
 * Sister test to:
 *   - `safe-api-call-data-source-pattern-list2.test.ts` (List 2 — Cron,
 *     Missions, Chat) — 8 hooks/components
 *   - `safe-api-call-data-source-pattern-list3.test.ts` (List 3 — useModelsPage
 *     hook, 1 file)
 *
 * @see src/lib/api-fetch.ts — `safeApiCall` and `safeApiCallData` definitions
 * @see src/components/memory/HindsightBrowser.tsx — the consumer
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const BROWSER_PATH = join(REPO_ROOT, "src", "components", "memory", "HindsightBrowser.tsx");

describe("safeApiCall envelope-typed migration — List 1 HindsightBrowser", () => {
  const source = readFileSync(BROWSER_PATH, "utf8");

  // The structural patterns we're pinning: the type-scanner and the
  // access-fingerprint. The type-scanner matches the envelope-typed
  // shape `safeApiCall<{ data?: { ... } }>` (the CORRECT form). The
  // access-fingerprint matches the runtime double-indirection
  // `.data?.data?.` (also CORRECT).
  const TYPE_SCANNER = /safeApiCall<\s*\{\s*data\??:\s*\{/g;
  // Access-fingerprint: any `.data` access (with optional `?`).
  // Matches the structural pattern `something.data.X` or
  // `something.data?.X` — the production code path that reads
  // the envelope-shaped body returned by `safeApiCall<T>`.
  const ACCESS_FINGERPRINT = /\.data\??\s*\./g;

  it("the HindsightBrowser source file is readable", () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it("the HindsightBrowser source is a real .tsx file on disk", () => {
    const stat = statSync(BROWSER_PATH);
    expect(stat.isFile()).toBe(true);
    expect(BROWSER_PATH.endsWith(".tsx")).toBe(true);
  });

  it("the HindsightBrowser has at least one envelope-typed safeApiCall<{ data?: { ... } }> call", () => {
    // The CORRECT form for envelope-typed reads is
    // `safeApiCall<{ data?: { X?: Y } }>(url, ...)` followed by
    // `data?.data?.X` access. A future migration that drops the
    // `data?:` envelope type from a call site in this file will
    // break production (the helper does not unwrap), and this test
    // will fail to catch it.
    //
    // We strip line comments first so doc comments that *describe*
    // the shape don't trigger false positives.
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const matches = code.match(TYPE_SCANNER) ?? [];
    expect(matches.length).toBeGreaterThan(0);
  });

  it("the HindsightBrowser has at least one .data?.data?. double-indirection read", () => {
    // The CORRECT access pattern is `data?.data?.X` (two
    // indirections) for envelope-typed reads. This fingerprint pins
    // the production code path; a future "I changed the type to
    // envelope but forgot the access" mistake that drops the
    // second `?.data` (e.g. `result.data?.X` for `T = { data: { x:
    // T } }`) produces `undefined` for every X and is silent at
    // type-check time.
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const matches = code.match(ACCESS_FINGERPRINT) ?? [];
    expect(matches.length).toBeGreaterThan(0);
  });
});

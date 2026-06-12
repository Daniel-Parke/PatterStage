/**
 * @jest-environment node
 *
 * Source-pattern test for the `safeApiCall<{ data?: { ... } }>`
 * envelope-typed call site in the Logs page
 * (`src/app/(main)/logs/page.tsx`).
 *
 * Why this test exists: the session 133/135/137 "double-envelope"
 * migration dropped the `{ data?: { ... } }` envelope type from 18+
 * `safeApiCall<T>` call sites across all 4 lists, claiming that
 * `safeApiCall<T>` already unwraps the response into `{ data?: T }`.
 * **It does not.** The helper (`src/lib/api-fetch.ts:85-98`) returns
 * `{ ok, data: <body> }` where `data` is the full body (the envelope).
 * Migrating a call from
 * `safeApiCall<{ data?: { cleared?: number } }>(url) + result.data?.data?.cleared`
 * to
 * `safeApiCall<{ cleared?: number }>(url) + result.data?.cleared`
 * silently breaks production: `result.data?.cleared` is `undefined`
 * (the production wire is `{ data: { cleared: N } }` and the runtime
 * envelope wraps that).
 *
 * Session 141 reverted the 8 List 2 sites + 1 List 3 site + 6 List 1
 * HindsightBrowser sites. Session 138 named 5 additional "Sites NOT
 * yet audited" sites that the cross-list revert didn't touch; this
 * test pins the Logs page, which session 162 fixed.
 *
 * The CORRECT pattern (the one this test pins):
 *   - `safeApiCall<{ data?: { cleared?: number } }>(url)` — type the envelope
 *   - read with two indirections: `result.data?.data?.cleared`
 *   - tests mock the wire shape: `{ data: { cleared: N } }`
 *
 * Pre-flight recipe (run BEFORE any future "drop the double envelope"
 * migration):
 *
 *   # 1. Confirm the helper does NOT unwrap
 *   sed -n '85,98p' src/lib/api-fetch.ts
 *   # Should show: return { ok: true, data: data as T };  (no unwrap)
 *
 *   # 2. Confirm the endpoint returns the envelope
 *   curl -s -X DELETE http://127.0.0.1:42069/api/logs | head -c 200
 *   # Should show: {"data":{...}}  (envelope)
 *
 * If both are true, the migration is broken. Do not proceed.
 *
 * Sister test to:
 *   - `safe-api-call-data-source-pattern-list2.test.ts` (List 2 — Cron,
 *     Missions, Chat) — 8 hooks/components
 *   - `safe-api-call-data-source-pattern-list1.test.ts` (List 1 —
 *     HindsightBrowser, the Hindsight-memory-specific case)
 *
 * @see src/lib/api-fetch.ts — `safeApiCall<T>` / `SafeApiCallResult<T>`
 * @see src/app/(main)/logs/page.tsx — the Logs page consumer
 * @see src/app/api/logs/route.ts — the DELETE handler returning `ok({ cleared })`
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const LOGS_PAGE_PATH = join(REPO_ROOT, "src", "app", "(main)", "logs", "page.tsx");

/**
 * The 2 wires the test expects on the file:
 * - At least one `safeApiCall<{ data?: { ... } }>` call site (the
 *   envelope-typed shape). This is the scanner pin — future "drop
 *   the double envelope" migrations that remove this shape will fail
 *   the test.
 * - At least one `?.data?.X` indirection read on the result variable
 *   (the canonical envelope-typed access shape — `delData?.data?.cleared`).
 *   The `?.data` is the envelope (the value is `{ cleared?: number }`),
 *   the `?.X` is the inner field. This fingerprint is a
 *   "result has been envelope-typed" signal: a future "I changed
 *   the type to envelope but forgot the access" mistake that drops
 *   the `?.data` (e.g. reads `delData?.cleared` directly) is silent
 *   at type-check time and returns `undefined` in production.
 */
const ENVELOPE_TYPE_REGEX = /safeApiCall<\s*\{\s*data\??:\s*\{/g;
// Match `.data` (the envelope access) — appears in canonical
// envelope-typed reads like `result.data?.X` or `result.data?.data?.X`.
// Mirrors the relaxed regex from the list2 sister test (per session 141
// P-3 #2 "regex fingerprinting envelope access" — the strict form
// required trailing `.` and missed real production access).
const ENVELOPE_DATA_ACCESS = /\.data\??\s*\./g;

describe("safeApiCall envelope-typed migration — List 1 Logs page", () => {
  const source = readFileSync(LOGS_PAGE_PATH, "utf8");

  it("the logs page source file is readable", () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it("the logs page source is a real .tsx file on disk", () => {
    expect(LOGS_PAGE_PATH.endsWith(".tsx")).toBe(true);
  });

  it("the logs page has at least one envelope-typed safeApiCall<{ data?: { ... } }> call (the delete path)", () => {
    // The DELETE /api/logs call must be typed as the envelope. If
    // a future migration drops the `{ data?: { ... } }` shape, the
    // inner `cleared` read becomes `undefined` in production.
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const matches = code.match(ENVELOPE_TYPE_REGEX) ?? [];
    expect(matches.length).toBeGreaterThan(0);
  });

  it("the logs page has at least one envelope-typed .data. (envelope access) read", () => {
    // The CORRECT access pattern is `delData?.data?.cleared` (the
    // first `?.data` is the envelope, the `?.cleared` is the inner
    // payload field). A future "I changed the type to envelope but
    // forgot the access" mistake that drops the `?.data` indirection
    // (e.g. reads `delData?.cleared` directly when T is
    // `{ data: { cleared: number } }`) is silent at type-check time
    // and returns `undefined` in production. The relaxed
    // `\.data\??\s*\.` regex matches any envelope-typed read; the
    // sister list2 test (per session 141 P-3 #2) uses the same
    // relaxed form.
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const matches = code.match(ENVELOPE_DATA_ACCESS) ?? [];
    expect(matches.length).toBeGreaterThan(0);
  });
});

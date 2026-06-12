/**
 * @jest-environment node
 *
 * Source-pattern test for the `safeApiCallData` migration in the
 * Logs page (`src/app/(main)/logs/page.tsx`).
 *
 * Pre-session-174: the `handleDeleteAllLogs` site used the
 * `safeApiCall<{ data?: { cleared?: number } }>(url) +
 * result.data?.data?.cleared` double-indirection pattern. This
 * worked but required callers to know the wire shape was
 * `{ data: T }` and unwrap it manually.
 *
 * Session 174 closed the last surviving `safeApiCall<{ data?: T }>`
 * envelope-typed site in any List 1 surface by migrating the delete
 * path to `safeApiCallData<{ cleared?: number }>(url)` — the helper
 * unwraps the envelope in one step, so the consumer sees
 * `delData.cleared` directly.
 *
 * This test pins the post-migration shape. If a future change
 * reintroduces the `safeApiCall<{ data?: { ... } }>(...)` pattern
 * (or a `?.data?.X` double-indirection read) in the Logs page, this
 * test fails and the author is prompted to use `safeApiCallData`
 * instead.
 *
 * The change in semantics vs. the prior test (`safeApiCallData-
 * source-pattern-list1-logs.test.ts` v1, which pinned the pre-174
 * shape) is intentional: the bug being pinned is "double-envelope
 * indirection" and the fix is to use the helper that unwraps it.
 * The sister tests
 *   - `safe-api-call-data-source-pattern-list2.test.ts`
 *   - `safe-api-call-data-source-pattern-list1.test.ts`
 * cover List 2 + HindsightBrowser. The Logs page was the last
 * surviving List 1 site of the old pattern; this is the
 * post-migration pin.
 *
 * @see src/lib/api-fetch.ts — `safeApiCallData` definition
 * @see src/app/(main)/logs/page.tsx — the Logs page consumer
 * @see src/app/api/logs/route.ts — the DELETE handler returning
 *      `ok({ cleared })`
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const LOGS_PAGE_PATH = join(REPO_ROOT, "src", "app", "(main)", "logs", "page.tsx");

/**
 * The 2 wires the test expects on the file:
 * - At least one `safeApiCallData<{ ... }>` call site (the
 *   envelope-unwrapping helper). This is the scanner pin — future
 *   migrations that drop this shape in favour of the legacy
 *   `safeApiCall<{ data?: { ... } }>` + double-indirection pattern
 *   will fail the test.
 * - Zero `?.data?.X` double-indirection reads. The helper unwraps
 *   the envelope, so consumers should read `delData.cleared`
 *   directly — NOT `delData?.data?.cleared`.
 */
const ENVELOPE_UNWRAP_CALL_REGEX = /safeApiCallData<\s*\{[^}]*\}\s*>\s*\(/g;
// Match `.data?.X` (the double-indirection access shape). A
// `?.data?.X` read in the Logs page is the signature of the
// pre-174 bug — the helper should have unwrapped it.
const DOUBLE_INDIRECTION_REGEX = /\.\s*data\s*\?\s*\.\s*\w/g;

describe("safeApiCallData migration — List 1 Logs page", () => {
  const source = readFileSync(LOGS_PAGE_PATH, "utf8");

  it("the logs page source file is readable", () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it("the logs page source is a real .tsx file on disk", () => {
    expect(LOGS_PAGE_PATH.endsWith(".tsx")).toBe(true);
  });

  it("the logs page has at least one safeApiCallData<{ ... }>(...) call site (the delete path)", () => {
    // The DELETE /api/logs call must use `safeApiCallData`. If a
    // future migration reverts this to the legacy
    // `safeApiCall<{ data?: { ... } }>(...)` + double-indirection
    // pattern, the production wire is `{ data: { cleared: N } }`
    // and the call silently reads `undefined`.
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const matches = code.match(ENVELOPE_UNWRAP_CALL_REGEX) ?? [];
    expect(matches.length).toBeGreaterThan(0);
  });

  it("the logs page has zero `?.data?.X` double-indirection reads (post-helper-unwrap shape)", () => {
    // The CORRECT post-migration access pattern is
    // `delData.cleared` (the helper has already unwrapped the
    // envelope). A `?.data?.X` read in the Logs page is the
    // signature of the pre-174 bug — the helper should have
    // unwrapped it.
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const matches = code.match(DOUBLE_INDIRECTION_REGEX) ?? [];
    expect(matches).toEqual([]);
  });
});

/**
 * @jest-environment node
 *
 * Source-pattern test for the `safeApiCallData` migration in the
 * dashboard (`src/app/page.tsx`).
 *
 * The dashboard's `initialLoad`, `refreshMonitor`, and
 * `handleRefreshProcesses` previously used the
 * `safeApiCall<{ data?: T }>(url)` + manual `result.data?.data ?? null`
 * unwrap pattern. Session 123 (List 1) introduced `safeApiCallData<T>(url)`
 * to collapse that pattern to a single call returning `T | null`.
 *
 * This test pins the post-refactor shape: the dashboard must use
 * `safeApiCallData` for all `{ data: T }` envelope reads. If a future
 * change adds a new `safeApiCall<{ data?: ... }>(url, ...)` site in
 * the dashboard, this test fails and the author is prompted to use
 * `safeApiCallData` instead.
 *
 * The exceptions to the rule are documented below:
 *   - Sites that need `ok`/`error` (e.g. mutations with `toastFromResult`)
 *     stay on `safeApiCall`. The dashboard has 2 such sites
 *     (cancel mission POST + cron PUT), neither of which is a
 *     read-only envelope fetch.
 *   - The polling block uses `safeApiCall` + `unwrapPollPath` because
 *     the per-endpoint extractors need the raw envelope shape to
 *     walk the response. Not a read-only envelope fetch either.
 *
 * @see src/lib/api-fetch.ts — `safeApiCallData` definition
 * @see src/app/page.tsx — dashboard consumers
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const DASHBOARD_PATH = join(REPO_ROOT, "src", "app", "page.tsx");

describe("safeApiCallData migration — List 1 dashboard", () => {
  const source = readFileSync(DASHBOARD_PATH, "utf8");

  it("the dashboard source file is readable", () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it("the dashboard imports safeApiCallData from @/lib/api-fetch", () => {
    // The import line includes `safeApiCallData` as a named import.
    expect(source).toMatch(
      /import\s*\{[^}]*\bsafeApiCallData\b[^}]*\}\s*from\s*["']@\/lib\/api-fetch["']/,
    );
  });

  it("the dashboard has zero `safeApiCall<{ data?: ... }>(...)` read-only envelope sites", () => {
    // Match the read-only form: `safeApiCall<{ data?: T }>(url, ...)`,
    // optionally followed by the manual `?.data?.` unwrap. Mutations
    // (POST/PUT/DELETE) and the polling block use `safeApiCall` without
    // the `<{ data?: ... }>` type parameter or with the envelope
    // passed straight to `unwrapPollPath`, so this regex doesn't catch
    // them.
    const envelopeReadPattern =
      /safeApiCall<\s*\{\s*data\??:\s*[^}>]+\}[^>]*>\s*\([^)]*\)/g;
    const matches = source.match(envelopeReadPattern) ?? [];
    // Filter out lines that are part of a multi-line statement where
    // the call's intended use is the polling block (the polling block
    // uses `safeApiCall(url, ...)` without the `<{ data?: ... }>`
    // type, so it won't match this regex anyway).
    expect(matches).toEqual([]);
  });

  it("the dashboard has zero `safeApiCall<{ data: T }>(...)` typed envelope sites (now uses safeApiCallData)", () => {
    // The old form was `safeApiCall<{ data: T }>(url, init)` followed
    // by `result.data.data` access. After the migration, every read
    // site uses `safeApiCallData<T>(url, init)`. This regex catches
    // the typed form (the `?` is absent from the inner key) and would
    // fail if a future change reintroduces the pattern.
    const typedEnvelopePattern =
      /safeApiCall<\s*\{\s*data:\s*[^}>]+\}[^>]*>\s*\([^)]*\)/g;
    const matches = source.match(typedEnvelopePattern) ?? [];
    expect(matches).toEqual([]);
  });

  it("the dashboard uses safeApiCallData in the initialLoad Promise.all block", () => {
    // Sanity check: at least 8 safeApiCallData calls (matches the 8
    // endpoints in the initialLoad Promise.all). The polling and
    // mutation sites don't use the helper, so 8 is the expected
    // minimum.
    const calls = source.match(/safeApiCallData</g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(8);
  });

  it("the dashboard no longer accesses `.data?.data` (double-unwrap) on safeApiCall results", () => {
    // The pre-migration pattern was `result.data?.data` for the
    // envelope-typed form. After the migration, the inner data is
    // accessed via a single field read (e.g. `data?.processes`), not
    // via a double-unwrap chain. This regex catches the double-unwrap
    // form, which should be gone from the dashboard.
    //
    // Strip line comments first so a doc comment that *describes* the
    // old pattern (e.g. the one in `initialLoad`'s JSDoc) doesn't
    // trigger a false positive.
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const doubleUnwrap = code.match(/\.data\?\.data/g) ?? [];
    expect(doubleUnwrap).toEqual([]);
  });
});

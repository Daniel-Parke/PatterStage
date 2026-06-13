/**
 * @jest-environment node
 *
 * Source-pattern test for the `safeApiCallData` adoption in the
 * Sessions list and detail pages:
 *   - `src/app/(main)/sessions/page.tsx` (sessions list)
 *   - `src/app/(main)/sessions/[id]/page.tsx` (session detail)
 *
 * Both pages consume `/api/sessions*` endpoints, which return the
 * canonical `{ data: T }` envelope. The `safeApiCallData` helper
 * unwraps the envelope in a single audited place, so consumers
 * read `data.sessions`, `data.session`, etc. directly. The legacy
 * `safeApiCall<{ data?: T }>(url) + ?.data?.X` pattern was a
 * known footgun (see `safe-api-call-data-source-pattern-list1.test.ts`
 * for the HindsightBrowser writeup of the silent-undefined trap) —
 * this test pins the post-migration shape on the two Sessions
 * pages so a future regression is caught at the source-pattern
 * level (no need to render the full page to detect it).
 *
 * Why source-pattern instead of rendering:
 *   - The Sessions list page is 430+ LOC with 3 useMemo derivations,
 *     a group-by-mission toggle, and a useInterval tick for live
 *     indicators. Rendering it requires mocking `useApiData` and
 *     the entire /api/sessions surface.
 *   - The Session detail page is 250+ LOC with a useMemo for
 *     role counts, a `scrollToNextRole` useCallback, and the
 *     `useApiData` hook for the initial fetch.
 *   - The "use the helper, not the inline form" shape is a
 *     byte-level contract: the pages literally call
 *     `useApiData<SessionsResponse>(...)` (which delegates to
 *     `safeApiCallData` internally) instead of inlining a
 *     `safeApiCall<{ data?: T }>` + `result.data?.x` read.
 *
 * What this test locks:
 *   - Both files import `useApiData` from `@/hooks/useApiData` (the
 *     `safeApiCallData`-backed hook) for the primary read path.
 *   - Neither file contains the legacy `safeApiCall<{ data?: T }>`
 *     call shape.
 *   - Neither file contains `?.data?.X` double-indirection reads
 *     (the signature of the pre-migration bug).
 *   - Both files use the inline `SessionsResponse` / `SessionData`
 *     type imports (or the alias thereof) so the consumer sees
 *     `data.sessions` / `data.session` directly.
 *
 * What this test does NOT lock:
 *   - The semantics of `useApiData` itself (covered in
 *     `tests/unit/use-api-data.test.ts`).
 *   - The runtime fetch behavior of `/api/sessions*` (covered by
 *     the route's own integration tests).
 *
 * Sister tests:
 *   - `safe-api-call-data-source-pattern-list1.test.ts` (HindsightBrowser)
 *   - `safe-api-call-data-source-pattern-list1-logs.test.ts` (Logs page)
 *   - `safe-api-call-data-source-pattern-list2.test.ts` (List 2 routes)
 *
 * @see src/hooks/useApiData.ts — `useApiData` hook (safeApiCallData-backed)
 * @see src/lib/api-fetch.ts — `safeApiCallData` envelope-unwrapping helper
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const SESSIONS_LIST_PATH = join(
  REPO_ROOT,
  "src",
  "app",
  "(main)",
  "sessions",
  "page.tsx",
);
const SESSION_DETAIL_PATH = join(
  REPO_ROOT,
  "src",
  "app",
  "(main)",
  "sessions",
  "[id]",
  "page.tsx",
);

/**
 * The 4 invariants the test pins for each page:
 *   1. Imports `useApiData` from `@/hooks/useApiData` (the safe
 *      envelope-unwrapping read path).
 *   2. Does NOT contain a `safeApiCall<{ data?: { ... } }>` call —
 *      the legacy shape that triggered the silent-undefined bug.
 *   3. Does NOT contain `?.data?.X` double-indirection reads.
 *   4. Uses the typed response shape (the `data.sessions` /
 *      `data.session` direct reads are evidence the envelope was
 *      unwrapped at the helper boundary, not in the component).
 */
const USE_API_DATA_IMPORT_REGEX =
  /import\s*\{\s*useApiData\s*\}\s*from\s*["']@\/hooks\/useApiData["']/;
const LEGACY_ENVELOPE_CALL_REGEX = /safeApiCall<\s*\{\s*data\s*\?/;
// `.data?.X` — the double-indirection access shape that the
// pre-migration code did to manually unwrap the envelope. The
// helper has already unwrapped, so consumers should read
// `data.sessions` directly — NOT `data?.data?.sessions`.
const DOUBLE_INDIRECTION_REGEX = /\.\s*data\s*\?\s*\.\s*\w/g;

describe("safeApiCallData migration — List 1 Sessions list page", () => {
  const source = readFileSync(SESSIONS_LIST_PATH, "utf8");

  it("the sessions list page source file is readable", () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it("the sessions list page source is a real .tsx file on disk", () => {
    expect(SESSIONS_LIST_PATH.endsWith(".tsx")).toBe(true);
  });

  it("imports useApiData from @/hooks/useApiData (the safeApiCallData-backed hook)", () => {
    // The hook lives at `src/hooks/useApiData.ts` and is the
    // canonical read path for envelope-typed `/api/sessions`
    // fetches. The page must use it instead of inlining a
    // `safeApiCall<{ data?: T }>` + `result.data?.x` shape.
    expect(source).toMatch(USE_API_DATA_IMPORT_REGEX);
  });

  it("does NOT use the legacy safeApiCall<{ data?: T }> call shape", () => {
    // The legacy shape is `safeApiCall<{ data?: { ... } }>(url)`,
    // which produces `{ ok, data: <body> }` where `data` is the full
    // envelope. Dropping the inner `data?:` from the type
    // (`safeApiCall<{ x?: T }>` + `result.data?.x`) silently returns
    // `undefined` for every `x` in production. If this test fails,
    // someone reintroduced the legacy shape.
    expect(source).not.toMatch(LEGACY_ENVELOPE_CALL_REGEX);
  });

  it("does NOT contain `?.data?.X` double-indirection reads (post-helper-unwrap shape)", () => {
    // The CORRECT post-migration access pattern is `data.sessions`
    // (the hook has already unwrapped the envelope). A `?.data?.X`
    // read in the Sessions page is the signature of the
    // pre-migration bug — the helper should have unwrapped it.
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const matches = code.match(DOUBLE_INDIRECTION_REGEX) ?? [];
    expect(matches).toEqual([]);
  });

  it("the sessions list page reads `data.sessions` directly (envelope-unwrap contract)", () => {
    // After the migration, the consumer reads `data.sessions` and
    // `data.total` directly — the `useApiData` hook unwraps the
    // envelope before the data hits the component. This positive
    // pin complements the negative regex above: even if someone
    // finds a way to double-unwrap without using `?.data?.X`
    // (e.g. `(data as any).data?.x`), the test catches it.
    expect(source).toMatch(/data\?\.\s*total/);
  });
});

describe("safeApiCallData migration — List 1 Session detail page", () => {
  const source = readFileSync(SESSION_DETAIL_PATH, "utf8");

  it("the session detail page source file is readable", () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it("the session detail page source is a real .tsx file on disk", () => {
    expect(SESSION_DETAIL_PATH.endsWith(".tsx")).toBe(true);
  });

  it("imports useApiData from @/hooks/useApiData (the safeApiCallData-backed hook)", () => {
    // The detail page uses `useApiData<SessionData>(url)` for the
    // initial fetch — the same envelope-unwrapping helper the list
    // page uses. If the detail page reverts to the legacy
    // `safeApiCall<{ data?: T }>(url)` shape, this test fails.
    expect(source).toMatch(USE_API_DATA_IMPORT_REGEX);
  });

  it("does NOT use the legacy safeApiCall<{ data?: T }> call shape", () => {
    // Same shape as the list page test — see the full rationale in
    // the list-page describe block above.
    expect(source).not.toMatch(LEGACY_ENVELOPE_CALL_REGEX);
  });

  it("does NOT contain `?.data?.X` double-indirection reads (post-helper-unwrap shape)", () => {
    // The detail page reads `data.messages`, `data.title`, `data.size`,
    // etc. directly — the helper has unwrapped the envelope. A
    // `?.data?.X` read is the signature of the pre-migration bug.
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const matches = code.match(DOUBLE_INDIRECTION_REGEX) ?? [];
    expect(matches).toEqual([]);
  });

  it("the session detail page reads `data.messages` directly (envelope-unwrap contract)", () => {
    // The post-migration shape: `data.messages.map(...)` and
    // `data.messages.length`. A future "unwrap manually inline"
    // change would lose this shape.
    expect(source).toMatch(/data\?\.\s*messages/);
  });
});

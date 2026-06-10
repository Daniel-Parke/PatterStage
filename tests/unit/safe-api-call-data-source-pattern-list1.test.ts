/**
 * @jest-environment node
 *
 * Source-pattern test for the Hindsight memory browser
 * (`src/components/memory/HindsightBrowser.tsx`).
 *
 * **The pattern we want to pin: ALL envelope-typed reads of the
 * `/api/memory/hindsight` endpoint must go through `hindsightGet` from
 * `src/lib/hindsight-client.ts`.** The helper does the
 * `{ data: { ...inner } }` envelope unwrap once, in a single audited
 * place. The call site reads `await hindsightGet<T>(...)` and
 * dereferences `inner` directly — no double indirection, no inline
 * `safeApiCall<{ data?: { ... } }>` at the call site.
 *
 * **Why this matters.** The session 137 (List 1) "single-nesting"
 * refactor claimed `safeApiCall<T>` already unwraps the envelope.
 * **It does not** — `src/lib/api-fetch.ts:85-98` returns
 * `{ ok, data: <body> }` where `data` is the full envelope
 * `{ data: { x: ... } }`. Dropping the inner `data?:` from the type
 * (`safeApiCall<{ x?: T }>` + `result.data?.x`) produces `undefined`
 * for every `x` in production — silent at compile time.
 *
 * The `hindsightGet` helper sidesteps that trap by:
 *  1. Typing the safeApiCall as `safeApiCall<{ data?: T }>` (the
 *     envelope-typed form).
 *  2. Doing the unwrap explicitly inside the helper
 *     (`data?.data ?? null`), so the call site only ever sees `T | null`.
 *
 * **This test pins the contract that all HindsightBrowser fetch
 * calls go through that helper** — the file must NOT contain a
 * standalone `safeApiCall<{ data?: { ... } }>` call site (which would
 * re-introduce the double-indirection at the call site) or a
 * `.data?.data?.` read (which would mean the unwrap is being done
 * inline somewhere, leaking the envelope shape into business logic).
 *
 * Pre-flight recipe (run BEFORE any future "drop the double envelope"
 * migration in this file):
 *
 *   # 1. Confirm the helper DOES unwrap explicitly
 *   sed -n '47,60p' src/lib/hindsight-client.ts
 *   # Should show: return (data?.data ?? null) as T | null;
 *
 *   # 2. Confirm the endpoint returns the envelope
 *   curl -s 'http://127.0.0.1:42069/api/memory/hindsight?action=health' | head -c 200
 *   # Should show: {"data":{...}}  (envelope)
 *
 * If the helper's unwrap is removed (returns `data as T` instead of
 * `data?.data`), production breaks — this test will fail because
 * every Hindsight fetch will return `undefined` for the inner field.
 *
 * Sister test to:
 *   - `safe-api-call-data-source-pattern-list2.test.ts` (List 2 — Cron,
 *     Missions, Chat) — 8 hooks/components
 *   - `safe-api-call-data-source-pattern-list3.test.ts` (List 3 — useModelsPage
 *     hook, 1 file)
 *
 * @see src/lib/hindsight-client.ts — `hindsightGet` (the helper that owns the unwrap)
 * @see src/lib/api-fetch.ts — `safeApiCall` (the helper that does NOT unwrap)
 * @see src/components/memory/HindsightBrowser.tsx — the consumer
 */

import { readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const BROWSER_PATH = join(REPO_ROOT, "src", "components", "memory", "HindsightBrowser.tsx");
const HELPER_PATH = join(REPO_ROOT, "src", "lib", "hindsight-client.ts");

describe("safeApiCall envelope-typed migration — List 1 HindsightBrowser", () => {
  const source = readFileSync(BROWSER_PATH, "utf8");

  // The structural pattern we want to forbid at the call site:
  // `safeApiCall<{ data?: { ... } }>` (the old inline-envelope form)
  // and `.data?.data?.` reads. The WIP introduced `hindsightGet<T>`
  // which does the unwrap explicitly in the helper, so neither
  // pattern should appear in the browser file anymore.
  //
  // The previous test pinned these patterns as CORRECT because at
  // the time, the envelope-typed form was the only known-safe
  // approach. After the WIP, the new contract is: "use hindsightGet,
  // not inline safeApiCall with the envelope type". The patterns
  // being zero is now the desired state.
  const FORBIDDEN_INLINE_ENVELOPE_CALL = /safeApiCall<\s*\{\s*data\??:\s*\{/g;
  const FORBIDDEN_DOUBLE_INDIRECTION = /\.data\??\s*\?\s*\.data/g;

  it("the HindsightBrowser source file is readable", () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it("the HindsightBrowser source is a real .tsx file on disk", () => {
    const stat = statSync(BROWSER_PATH);
    expect(stat.isFile()).toBe(true);
    expect(BROWSER_PATH.endsWith(".tsx")).toBe(true);
  });

  it("hindsight-client.ts (the helper that owns the envelope unwrap) exists", () => {
    expect(existsSync(HELPER_PATH)).toBe(true);
    const helperSource = readFileSync(HELPER_PATH, "utf8");
    // The helper must use the envelope-typed form (safeApiCall<{ data?: T }>)
    // and then explicitly unwrap. If the unwrap is removed, every
    // Hindsight fetch in the browser returns `undefined` for the
    // inner field — this is the silent-break guard.
    expect(helperSource).toMatch(/safeApiCall<\s*\{\s*data\??:\s*T\s*\}>/);
    expect(helperSource).toMatch(/data\??\s*\.\s*data/);
  });

  it("the HindsightBrowser does NOT use inline safeApiCall<{ data?: { ... } }> at the call site", () => {
    // The browser should use `hindsightGet<T>(...)` for all envelope
    // reads. Inline `safeApiCall<{ data?: { ... } }>` at the call
    // site re-introduces the double-indirection problem.
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const matches = code.match(FORBIDDEN_INLINE_ENVELOPE_CALL) ?? [];
    expect(matches).toHaveLength(0);
  });

  it("the HindsightBrowser does NOT do .data?.data?. double-indirection reads", () => {
    // All envelope unwraps must happen inside `hindsightGet`. A
    // `.data?.data?.` read in the browser file means the unwrap is
    // being done inline somewhere, leaking the envelope shape into
    // business logic.
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const matches = code.match(FORBIDDEN_DOUBLE_INDIRECTION) ?? [];
    expect(matches).toHaveLength(0);
  });

  it("the HindsightBrowser imports hindsightGet and uses it for the Hindsight surface", () => {
    // Belt-and-suspenders: the helper should actually be used. A
    // browser file that doesn't import hindsightGet is broken
    // (either it has no Hindsight reads, or it's reaching for the
    // raw API directly without the unwrap helper).
    expect(source).toMatch(/import\s*\{[^}]*\bhindsightGet\b[^}]*\}\s*from\s*["']@\/lib\/hindsight-client["']/);
    expect(source).toMatch(/\bhindsightGet\s*</);
  });
});

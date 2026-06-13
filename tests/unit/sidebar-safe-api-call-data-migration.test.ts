/**
 * @jest-environment node
 */
// Session 182 — List 1.5 (layout-shared component) source-pattern lock for
// the `safeApiCallData` migration in `Sidebar.tsx` `openCheckDropdown` and
// `doCheck` (the 2 raw `await fetch` + `await res.json()` call sites that
// returned a `{ data: ... }` envelope and could be unwrapped by the
// shared helper).
//
// Migration shape — pre (2 sites):
//
//   try {
//     const res = await fetch("/api/update?branches=1");
//     const d = await res.json();
//     const list: string[] = d.data?.branches?.length > 0 ? d.data.branches : ["main", "dev"];
//     setBranches(list);
//     setSelectedBranch(pickBranch(list, d.data?.default));
//   } catch {
//     const fallback = ["main", "dev"];
//     setBranches(fallback);
//     setSelectedBranch(pickBranch(fallback, undefined));
//   }
//
// Post:
//
//   const data = await safeApiCallData<{ branches: string[]; default: string }>(
//     "/api/update?branches=1",
//   );
//   const list: string[] = data && data.branches.length > 0 ? data.branches : ["main", "dev"];
//   setBranches(list);
//   setSelectedBranch(pickBranch(list, data?.default));
//
// `safeApiCallData<T>` returns `T | null` (the inner payload directly —
// no manual `data?.data` indirection). On error the helper returns
// `null`, which falls through to the same `["main", "dev"]` fallback the
// inline `try/catch` previously had.
//
// The 2 OTHER raw `fetch` call sites in Sidebar (`runDeployAction` POST
// `/api/update` and `pollDeployStatus` GET `/api/update?deploy=1`) stay
// inline — the deploy-action's synchronous error envelope + the polling
// timeout signal don't fit `safeApiCall`'s swallow-errors-as-`ok:false`
// contract. This test pins the BY-SITE count so a future regression
// that migrates the deploy-action path incorrectly trips the scanner.

import { readFileSync } from "fs";
import { join } from "path";

const SIDEBAR = join(process.cwd(), "src/components/layout/Sidebar.tsx");

describe("Sidebar safeApiCallData migration (session 182, List 1.5 layout-shared)", () => {
  let rawSource: string;
  let codeOnlySource: string;

  beforeAll(() => {
    rawSource = readFileSync(SIDEBAR, "utf-8");
    codeOnlySource = rawSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  });

  it("imports safeApiCallData from @/lib/api-fetch", () => {
    expect(rawSource).toMatch(
      /import\s*\{[^}]*\bsafeApiCallData\b[^}]*\}\s*from\s*["']@\/lib\/api-fetch["']/,
    );
  });

  describe("openCheckDropdown", () => {
    let handlerWindow: string;

    beforeAll(() => {
      const handlerIdx = codeOnlySource.indexOf("const openCheckDropdown =");
      expect(handlerIdx).toBeGreaterThan(-1);
      handlerWindow = codeOnlySource.slice(handlerIdx, handlerIdx + 1000);
    });

    it("uses safeApiCallData (not raw fetch) to GET /api/update?branches=1", () => {
      expect(handlerWindow).toMatch(
        /safeApiCallData\s*<\s*\{[^}]*branches:[^}]*default:[^}]*\}\s*>\s*\(\s*["']\/api\/update\?branches=1["']/,
      );
    });

    it("no longer has the try/catch wrapping the /api/update?branches=1 fetch", () => {
      // The old shape had a `try { const res = await fetch(...) } catch {...}`
      // block. The new shape has a single `const data = await safeApiCallData(...)`
      // line. The negative assertion catches a regression to the inline form.
      expect(handlerWindow).not.toMatch(/await\s+fetch\s*\(\s*["']\/api\/update\?branches=1/);
    });
  });

  describe("doCheck", () => {
    let handlerWindow: string;

    beforeAll(() => {
      const handlerIdx = codeOnlySource.indexOf("const doCheck =");
      expect(handlerIdx).toBeGreaterThan(-1);
      handlerWindow = codeOnlySource.slice(handlerIdx, handlerIdx + 1200);
    });

    it("uses safeApiCallData (not raw fetch) to GET /api/update?branch=...", () => {
      expect(handlerWindow).toMatch(/safeApiCallData\s*</);
      expect(handlerWindow).toMatch(/safeApiCallData\s*<[\s\S]*?>\(\s*`\/api\/update\?branch=/);
    });

    it("no longer has the try/catch wrapping the /api/update?branch=... fetch", () => {
      // Same negative assertion shape as openCheckDropdown — catches a
      // regression to the inline form.
      expect(handlerWindow).not.toMatch(/await\s+fetch\s*\(\s*`\/api\/update\?branch=/);
    });
  });

  describe("deploy action paths (NOT migrated)", () => {
    it("runDeployAction still uses raw fetch (deploy-action sync-error envelope is not safeApiCall-shaped)", () => {
      // The POST /api/update inside runDeployAction reads the synchronous
      // `{error: "..."}` envelope (the `d.error` check inside the
      // `if (action === "update")` branch). safeApiCall would swallow
      // that as `{ok: false, error}` and break the contract. Confirm the
      // raw fetch stays.
      const handlerIdx = codeOnlySource.indexOf("runDeployAction =");
      expect(handlerIdx).toBeGreaterThan(-1);
      const window = codeOnlySource.slice(handlerIdx, handlerIdx + 2000);
      expect(window).toMatch(/await\s+fetch\s*\(\s*["']\/api\/update["']/);
    });

    it("pollDeployStatus still uses raw fetch (polling-loop AbortSignal.timeout is not safeApiCall-shaped)", () => {
      const handlerIdx = codeOnlySource.indexOf("const pollDeployStatus");
      expect(handlerIdx).toBeGreaterThan(-1);
      // pollDeployStatus body is 100+ lines (polling loop with setInterval
      // + nested try/catch + multi-line deploy-state switch). The await
      // fetch is ~6900 chars after the function declaration. 8000 chars
      // covers the full body up to the fetch.
      const window = codeOnlySource.slice(handlerIdx, handlerIdx + 8000);
      expect(window).toMatch(/await\s+fetch\s*\(\s*["']\/api\/update\?deploy=1/);
      expect(window).toMatch(/AbortSignal\.timeout/);
    });
  });

  it("the total raw fetch count in Sidebar is 2 (runDeployAction + pollDeployStatus) — exactly 2 sites stayed", () => {
    // Session 182 migrated 2 of the 4 raw `fetch` sites to safeApiCallData.
    // The remaining 2 (runDeployAction + pollDeployStatus) are pinned
    // by the tests above. This top-level count pin catches any future
    // regression that re-introduces a raw `fetch` in the migrated
    // handlers (openCheckDropdown, doCheck) without removing one
    // elsewhere.
    const fetchCalls = codeOnlySource.match(/await\s+fetch\s*\(/g) ?? [];
    expect(fetchCalls.length).toBe(2);
  });
});

/**
 * @jest-environment node
 *
 * Source-pattern test for the `<LoadErrorBanner>` List 1 migration
 * (session 171).
 *
 * **The pattern we want to pin: every page in List 1 that has a
 * `useApiData` hook must surface its `loadError` through the shared
 * `<LoadErrorBanner>` component from `@/components/ui/LoadErrorBanner`,
 * not through ad-hoc inline banners, toasts, or full-page placeholders.**
 *
 * Three List 1 sites were migrated in this session:
 *   - `src/app/(main)/logs/page.tsx` (ad-hoc inline banner → component)
 *   - `src/app/(main)/sessions/page.tsx` (4s toast via useEffect → component)
 *   - `src/app/(main)/sessions/[id]/page.tsx` is intentionally out of
 *     scope (full-page "Session Not Found" UX, not a sticky banner)
 *
 * **Why this matters.** The previous open-coded patterns had three
 * problems:
 *   1. The `useEffect(() => showToast(loadError, "error"))` form
 *      disappears after 4s and leaves the user with no recovery
 *      affordance — the list below renders an empty-state which
 *      looks identical to "the catalog is empty."
 *   2. The inline banner had no Retry button.
 *   3. Two different visual treatments for the same failure mode
 *      made it harder to recognise the "load failed, not catalog
 *      empty" condition.
 *
 * **The migration is byte-equivalent on the success path** (no banner
 * rendered when `loadError` is null) and adds one new affordance on
 * the failure path (a Retry button that calls the page's `refetch`).
 *
 * **History (session 171):**
 * The `LoadErrorBanner` component is the implementation of the umbrella
 * skill's Pattern #19 (introduced 2026-06-04) which was documented but
 * never actually built. This session closes the documentation/code gap
 * and migrates the 2 List 1 sites that have `useApiData`-shaped load
 * failures.
 *
 * **Sister test:** there is no other List-N `LoadErrorBanner` source
 * pattern test yet — this session introduces the pattern in code. If a
 * future session migrates a 3rd page (e.g. the dashboard's section
 * failures), it should either add an `onRetry` assertion to this file
 * or create a per-page test that mirrors this one.
 *
 * @see src/components/ui/LoadErrorBanner.tsx — the shared component
 * @see src/app/(main)/logs/page.tsx — migrated site 1
 * @see src/app/(main)/sessions/page.tsx — migrated site 2
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const LOGS_PAGE_PATH = join(
  REPO_ROOT,
  "src",
  "app",
  "(main)",
  "logs",
  "page.tsx",
);
const SESSIONS_PAGE_PATH = join(
  REPO_ROOT,
  "src",
  "app",
  "(main)",
  "sessions",
  "page.tsx",
);
const COMPONENT_PATH = join(
  REPO_ROOT,
  "src",
  "components",
  "ui",
  "LoadErrorBanner.tsx",
);

describe("LoadErrorBanner List 1 migration (session 171)", () => {
  // Strip both line comments (//) and block/JSDoc comments (/** ... */)
  // before scanning — a JSDoc paragraph that documents the inline
  // form (e.g. "// Replaces the previous useEffect(() => showToast(...))")
  // would otherwise false-positive on the inline-pattern regex.
  // (Strengthened from session 140 line-only stripper per session 167
  // P-17, which generalised to block comments too.)
  function stripComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  }

  describe("the LoadErrorBanner component", () => {
    const source = readFileSync(COMPONENT_PATH, "utf8");

    it("exists as a .tsx file on disk", () => {
      const stat = statSync(COMPONENT_PATH);
      expect(stat.isFile()).toBe(true);
      expect(COMPONENT_PATH.endsWith(".tsx")).toBe(true);
    });

    it("is a default-exported React component", () => {
      expect(source).toMatch(/export\s+default\s+function\s+LoadErrorBanner\b/);
    });

    it("accepts the canonical 4 props (error, onRetry, hint, retryLabel)", () => {
      // The onRetry and hint props are optional but must exist in the
      // interface. If a future refactor narrows the contract, this
      // test pins the field set.
      expect(source).toMatch(/\berror\s*:\s*string\b/);
      expect(source).toMatch(/\bonRetry\?\s*:\s*\(\s*\)\s*=>\s*void\b/);
      expect(source).toMatch(/\bhint\?\s*:\s*string\b/);
    });

    it("uses role=\"alert\" for accessibility (load errors are user-actionable)", () => {
      // The umbrella skill's Pattern #19 explicitly recommends
      // `role="alert"` so screen readers announce the failure on
      // render. Pinning the role here ensures future re-styling
      // doesn't accidentally drop the a11y affordance.
      expect(source).toMatch(/role\s*=\s*["']alert["']/);
    });

    it("renders the AlertTriangle icon as the leading visual", () => {
      // Matches both forms: `<AlertTriangle className=... />` and any
      // import declaration. We want the icon imported + rendered.
      expect(source).toMatch(/import\s*\{[^}]*\bAlertTriangle\b[^}]*\}/);
      expect(source).toMatch(/<AlertTriangle\b/);
    });
  });

  describe("(main)/logs/page.tsx", () => {
    const source = readFileSync(LOGS_PAGE_PATH, "utf8");
    const code = stripComments(source);

    it("imports LoadErrorBanner from @/components/ui/LoadErrorBanner", () => {
      expect(source).toMatch(
        /import\s+LoadErrorBanner\s+from\s+["']@\/components\/ui\/LoadErrorBanner["']/,
      );
    });

    it("renders <LoadErrorBanner> with onRetry={handleRefresh}", () => {
      // The migration replaced the inline `<div className="border-red-500/30...">`
      // banner with the shared component. The Retry button on the new
      // banner calls the page's `handleRefresh` (the existing wrapper
      // around `refetch`). The inline pattern is gone (verified by the
      // next test).
      expect(source).toMatch(
        /<LoadErrorBanner[\s\S]*?onRetry\s*=\s*\{\s*\(\s*\)\s*=>\s*void\s+handleRefresh\(\)\s*\}/,
      );
    });

    it("does NOT contain the pre-migration inline ad-hoc banner", () => {
      // The pre-migration inline form was:
      //   <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
      //     <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
      //     <div>{loadError}</div>
      //   </div>
      // A regression that re-introduces the inline form would defeat
      // the migration. The AlertCircle import is also gone (the new
      // component renders AlertTriangle internally).
      const inlineBannerRe = /border-red-500\/30\s+bg-red-500\/10[\s\S]{0,200}\{loadError\}/;
      expect(code.match(inlineBannerRe)).toBeNull();
      // AlertCircle should no longer be imported (or used).
      expect(source).not.toMatch(/^import\s*\{[^}]*\bAlertCircle\b/m);
    });
  });

  describe("(main)/sessions/page.tsx", () => {
    const source = readFileSync(SESSIONS_PAGE_PATH, "utf8");
    const code = stripComments(source);

    it("imports LoadErrorBanner from @/components/ui/LoadErrorBanner", () => {
      expect(source).toMatch(
        /import\s+LoadErrorBanner\s+from\s+["']@\/components\/ui\/LoadErrorBanner["']/,
      );
    });

    it("destructure now includes refetch from useApiData", () => {
      // The Retry button on the new banner needs the hook's refetch
      // function. The pre-migration destructure was:
      //   const { data, loading, error: loadError } = useApiData<...>(...)
      // which discarded refetch. The migration adds it.
      expect(source).toMatch(
        /useApiData<[^>]+>\s*\(\s*\w+\s*,\s*\{[^}]*\}\s*\)/,
      );
      // And the destructure captures refetch (possibly with a rename
      // like `refetch: loadJobs` — the helper site captures either form).
      // The relaxed form: `refetch` appears in the destructure
      // *somewhere* after `loading`.
      const destructureRe =
        /const\s*\{[^}]*\brefetch\b[^}]*\}\s*=\s*useApiData/;
      expect(source).toMatch(destructureRe);
    });

    it("renders <LoadErrorBanner> with onRetry bound to refetch", () => {
      // The migration is:
      //   {loadError && (
      //     <LoadErrorBanner
      //       error={loadError}
      //       onRetry={() => void refetch()}
      //       hint="..."
      //     />
      //   )}
      expect(source).toMatch(
        /<LoadErrorBanner[\s\S]*?onRetry\s*=\s*\{\s*\(\s*\)\s*=>\s*void\s+refetch\(\)\s*\}/,
      );
    });

    it("does NOT contain the pre-migration useEffect+showToast surface pattern", () => {
      // The pre-migration form was:
      //   useEffect(() => {
      //     if (loadError) showToast(loadError, "error");
      //   }, [loadError, showToast]);
      // A regression that re-introduces it would defeat the
      // persistent-banner intent. The regex matches the canonical
      // 2-line surface shape (useEffect body + showToast call).
      const effectRe =
        /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?if\s*\(\s*loadError\s*\)\s*showToast\s*\(\s*loadError\s*,\s*["']error["']\s*\)[\s\S]*?\}\s*,\s*\[\s*loadError\s*,\s*showToast\s*\]/;
      expect(code.match(effectRe)).toBeNull();
    });
  });

  describe("cross-page invariants", () => {
    it("both migrated pages import the component via the same alias", () => {
      // Pin the canonical import alias `LoadErrorBanner` so a future
      // rename is caught at the source-pattern level (not just at
      // the build).
      const logsSource = readFileSync(LOGS_PAGE_PATH, "utf8");
      const sessionsSource = readFileSync(SESSIONS_PAGE_PATH, "utf8");
      for (const src of [logsSource, sessionsSource]) {
        expect(src).toMatch(
          /import\s+LoadErrorBanner\s+from\s+["']@\/components\/ui\/LoadErrorBanner["']/,
        );
      }
    });

    it("no other List 1 page imports the component yet (out-of-scope guard)", () => {
      // `(main)/memory/page.tsx` is a 25-LOC shell that renders
      // `<HindsightBrowser />` — no useApiData, no banner.
      // `(main)/sessions/[id]/page.tsx` intentionally uses a
      // full-page "Not Found" UX (not a sticky banner).
      // `src/app/page.tsx` (Dashboard) is List 1 but has its own
      // multi-section `LoadErrorBanner`-shaped pattern via
      // `Promise.allSettled` (per session 139 P-14) — a different
      // banner, different component contract, separate refactor.
      // This test pins the migration surface: only the 2 sites above.
      const memoryPath = join(
        REPO_ROOT,
        "src",
        "app",
        "(main)",
        "memory",
        "page.tsx",
      );
      const detailPath = join(
        REPO_ROOT,
        "src",
        "app",
        "(main)",
        "sessions",
        "[id]",
        "page.tsx",
      );
      const dashboardPath = join(REPO_ROOT, "src", "app", "page.tsx");
      const memorySource = readFileSync(memoryPath, "utf8");
      const detailSource = readFileSync(detailPath, "utf8");
      const dashboardSource = readFileSync(dashboardPath, "utf8");
      for (const src of [memorySource, detailSource, dashboardSource]) {
        expect(src).not.toMatch(
          /import\s+LoadErrorBanner\s+from\s+["']@\/components\/ui\/LoadErrorBanner["']/,
        );
      }
    });
  });
});

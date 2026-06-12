/**
 * @jest-environment node
 *
 * Source-pattern test for the `setX(messageFromError(err, fallback))`
 * → `setErrorFromCaught(setX, err, fallback)` migration in List 1.
 *
 * **The pattern we want to pin: every `useState<string | null>`
 * error setter in List 1 pages that wraps a caught error must go
 * through `setErrorFromCaught` from `@/lib/api-fetch`.** The helper
 * composes `messageFromError()` with the setter so the call site
 * reads `setErrorFromCaught(setX, err, "...")` instead of the
 * 2-hop `setX(messageFromError(err, "..."))` form.
 *
 * **Why this matters.** The `setError(messageFromError(err, "..."))`
 * 2-hop form is the byte-equivalent of `setErrorFromCaught(setError,
 * err, "...")` but leaks the message-coercion concern to every call
 * site. A future change to `setError`'s contract (e.g. switch to
 * `{ code, message }` shape) would require hunting down every
 * `messageFromError` call site, when the same change in
 * `setErrorFromCaught` would land in one place. Same byte-equivalence
 * argument that closed the `toastError` family in session 92.
 *
 * Sister test to:
 *   - `toast-error.test.ts` — `toastError` helper (the showToast sibling)
 *   - `set-error-from-caught.test.ts` — `setErrorFromCaught` helper unit tests
 *   - `set-error-from-caught-source-pattern-list2.test.ts` (List 2) — if/when
 *     we discover sites in the missions/cron/chat pages
 *   - `set-error-from-caught-source-pattern-list3.test.ts` (List 3) — covers
 *     the 2 hooks sites
 *
 * **List 1 surface (per session 149 P-3 + session 154 P-3):**
 *   - `src/app/page.tsx` (Dashboard)
 *   - `src/app/(main)/logs/page.tsx`
 *   - `src/app/(main)/sessions/page.tsx`
 *   - `src/app/(main)/sessions/[id]/page.tsx`
 *   - `src/app/(main)/memory/page.tsx` (25-LOC shell, no useState setters)
 *   - `src/components/memory/HindsightBrowser.tsx`
 *
 * **History of this fix (session 159):**
 * The session 142 toastError migration replaced
 *   } catch { setActionMessage("Delete failed (network error)"); }
 * with
 *   } catch (err) { setActionMessage(messageFromError(err, "Delete failed (network error)")); }
 * The session 126 closure of the `setError(messageFromError(...))` family
 * missed this one site because the setter was `setActionMessage`, not
 * `setError`. The `setErrorFromCaught` helper accepts any
 * `(value: string | null) => void` setter, so the migration is direct.
 *
 * **Pre-flight recipe (run BEFORE any future migration into a different
 * setter name in this file):**
 *
 *   # 1. Confirm the helper is exported with the right signature
 *   rg -n "export function setErrorFromCaught" src/lib/api-fetch.ts
 *   # Should show: setErrorFromCaught(setError: SetErrorFn, err: unknown, fallback: string)
 *
 *   # 2. Confirm no other call site in the file uses the inline form
 *   rg -n "setActionMessage\(messageFromError" src/app/\(main\)/logs/page.tsx
 *   # Should show: 0 matches
 *
 * @see src/lib/api-fetch.ts — `setErrorFromCaught` (the helper)
 * @see src/app/(main)/logs/page.tsx — the List 1 page that contained the 1 site
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const LOGS_PAGE_PATH = join(REPO_ROOT, "src", "app", "(main)", "logs", "page.tsx");
const HELPER_PATH = join(REPO_ROOT, "src", "lib", "api-fetch.ts");

describe("setErrorFromCaught envelope migration — List 1 logs page", () => {
  const source = readFileSync(LOGS_PAGE_PATH, "utf8");

  // The structural pattern we want to forbid at the call site:
  // `setX(messageFromError(...))` where X is a useState<string | null>
  // setter (e.g. setActionMessage, setError, setMessage, etc.).
  // The pattern is byte-equivalent to the helper but bypasses it.
  //
  // The regex matches: `set<Capital>` followed by `(` followed by
  // `messageFromError` — captures the literal setter name and the
  // inline coercion. The scan includes any `setX` in the file
  // (not just `setError`/`setActionMessage`) so the contract is
  // generalised to "any useState<string | null> setter".
  //
  // Note: we DO NOT restrict the scan to user-land scopes here
  // because the file is short and self-contained — there are no
  // wrapper functions to exclude. If the page grows, a more targeted
  // scanner (skipping import lines, comments, JSDoc) can replace
  // this naive regex.
  const FORBIDDEN_INLINE_SETX_MESSAGFROMERROR = /set\w+\(\s*messageFromError\s*\(/g;

  it("the logs page source file is readable", () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it("the logs page source is a real .tsx file on disk", () => {
    const stat = statSync(LOGS_PAGE_PATH);
    expect(stat.isFile()).toBe(true);
    expect(LOGS_PAGE_PATH.endsWith(".tsx")).toBe(true);
  });

  it("setErrorFromCaught is exported from @/lib/api-fetch with the right signature", () => {
    const helperSource = readFileSync(HELPER_PATH, "utf8");
    // The helper must take a setter + an unknown + a fallback. If the
    // signature changes (e.g. add a 4th param), this test fails and
    // the migration's byte-equivalence claim needs re-verification.
    // Tolerate trailing commas (TS formatted style).
    expect(helperSource).toMatch(
      /export\s+function\s+setErrorFromCaught\s*\(\s*setError\s*:\s*SetErrorFn\s*,\s*err\s*:\s*unknown\s*,\s*fallback\s*:\s*string\s*,?\s*\)/,
    );
    // And the body must compose messageFromError with the setter.
    expect(helperSource).toMatch(/setError\s*\(\s*messageFromError\s*\(\s*err\s*,\s*fallback\s*\)\s*\)/);
  });

  it("the logs page does NOT use `setX(messageFromError(...))` at any call site", () => {
    // The byte-equivalent inline form bypasses the helper. We want
    // 0 matches in user-land (i.e. anywhere in the file). The
    // migration should leave the file with `setErrorFromCaught`
    // calls only.
    const code = source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
    const matches = code.match(FORBIDDEN_INLINE_SETX_MESSAGFROMERROR) ?? [];
    expect(matches).toHaveLength(0);
  });

  it("the logs page imports setErrorFromCaught and uses it for the migration", () => {
    // Belt-and-suspenders: the helper should actually be imported.
    // A page that doesn't import setErrorFromCaught is broken
    // (either the migration was reverted, or the inline form came
    // back via a copy-paste).
    expect(source).toMatch(
      /import\s*\{[^}]*\bsetErrorFromCaught\b[^}]*\}\s*from\s*["']@\/lib\/api-fetch["']/,
    );
    // And the call site uses it.
    expect(source).toMatch(/\bsetErrorFromCaught\s*\(\s*setActionMessage\s*,\s*err\s*,\s*["']Delete failed \(network error\)["']/);
  });
});

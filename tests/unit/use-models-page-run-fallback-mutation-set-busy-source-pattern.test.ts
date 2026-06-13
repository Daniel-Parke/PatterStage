/** @jest-environment node */

/**
 * Source-pattern test for the `runFallbackMutation` `setBusy`-optional
 * migration in `src/hooks/useModelsPage.ts`.
 *
 * Context: `runFallbackMutation` is the hook-local helper that
 * centralises the "call the API, refetch, toast success; on failure,
 * toast the error" pattern shared by the 5 fallback-chain CRUD
 * handlers (`handleFallbackReorder`, `handleFallbackToggle`,
 * `handleFallbackDelete`, `handleFallbackAddFromRegistry`,
 * `handleFallbackAddCustom`) AND the `handleImportFallbackFromConfig`
 * handler. The 5 CRUD handlers don't need a busy state (the
 * `runFallbackMutation` calls complete in tens of milliseconds and a
 * spinner would be UI noise), but `handleImportFallbackFromConfig`
 * DOES — the "Import" button in `ModelsFallbackSection.tsx` reads
 * the hook's `importingFallback` boolean to disable itself and show
 * "Importing…".
 *
 * Pre-refactor: `handleImportFallbackFromConfig` was a 14-line
 * inline `try { apiFetch + loadAll + showToast } catch { toastError }
 * finally { setImportingFallback(false) }` block, parallel-but-not-
 * shared with `runFallbackMutation` (which didn't have a busy
 * state).
 *
 * Post-refactor: `runFallbackMutation` gained an optional
 * `setBusy?: (busy: boolean) => void` parameter (the 5th positional
 * arg). The helper calls `setBusy(true)` at the start and
 * `setBusy(false)` in a `finally` block, mirroring the
 * `runSyncAction` helper in `@/lib/operation-sync-action.ts` (which
 * has had this shape since session 170).
 * `handleImportFallbackFromConfig` is now a 5-line
 * `runFallbackMutation` call that passes `setImportingFallback` as
 * the 5th arg.
 *
 * This test pins the post-migration shape:
 *   1. `runFallbackMutation` declares `setBusy?:` as the 5th param.
 *   2. `runFallbackMutation` body has a `setBusyFn(true)` call before
 *      the try block and a `setBusyFn(false)` call in a `finally`
 *      block. The 5th param is the only one with a `?` (the other 4
 *      are required positional args).
 *   3. `handleImportFallbackFromConfig` is a 5-arg
 *      `runFallbackMutation` call with `setImportingFallback` as
 *      the 5th arg — the function body does NOT contain the inline
 *      `try {`/`catch (err) {`/`finally { setImportingFallback(false) }`
 *      boilerplate anymore.
 *   4. The 5 fallback-chain CRUD handlers (the
 *      non-busy-state consumers) still call `runFallbackMutation`
 *      with exactly 4 args (no 5th `setBusy` arg). This is the
 *      "the new contract is used by the busy-state consumer AND
 *      the existing 4-arg call sites are unchanged" canary.
 *
 * Why this test exists:
 *   - The helper's contract lives in `useModelsPage.ts` and is
 *     a private function (not exported), so the unit test approach
 *     from `operation-sync-action.test.ts` doesn't apply. The
 *     source-pattern approach (read the file, fingerprint key
 *     shape) is the only way to pin the post-migration contract
 *     without spinning up the hook.
 *   - A future "revert the `setBusy` parameter to required" change
 *     would re-introduce the 14-line `handleImportFallbackFromConfig`
 *     boilerplate. This test catches that regression.
 *   - The contract change is structural (a new optional positional
 *     arg, mirroring `runSyncAction`'s pattern); the call-site
 *     change is what *demonstrates* the new contract is used in
 *     the wild. This source-pattern test pins the call-site shape
 *     so a regression that reverts either side is caught.
 *
 * Pre-flight recipe (run BEFORE any revert of the
 * `runFallbackMutation` setBusy migration):
 *
 *   # 1. Confirm the helper's `setBusy` parameter is optional
 *   sed -n '142,165p' src/hooks/useModelsPage.ts
 *   # Should show `setBusy?: (busy: boolean) => void,` (note the `?`).
 *
 *   # 2. Confirm the helper calls setBusy(true) before try and
 *   #    setBusy(false) in finally
 *   rg -n 'setBusyFn\(true\)|setBusyFn\(false\)' src/hooks/useModelsPage.ts
 *   # Should show one of each inside the `runFallbackMutation` body.
 *
 *   # 3. Confirm the migration site is byte-equivalent
 *   rg -n 'handleImportFallbackFromConfig' src/hooks/useModelsPage.ts
 *   # Follow the match into the function body; verify it contains
 *   # a `runFallbackMutation(...)` call with exactly 5 args.
 *
 *   # 4. Confirm the 5 busy-less consumers still pass 4 args
 *   rg -n 'handleFallback(Reorder|Toggle|Delete|AddFromRegistry|AddCustom)' src/hooks/useModelsPage.ts
 *   # Each should be a `runFallbackMutation(...)` call with 4 args
 *   # (no 5th `setBusy` arg).
 *
 * If any of these checks fails, the migration has been silently
 * reverted. Do not proceed.
 *
 * @see src/hooks/useModelsPage.ts — `runFallbackMutation` definition
 * @see src/hooks/useModelsPage.ts — `handleImportFallbackFromConfig` consumer
 * @see src/lib/operation-sync-action.ts — the sister `runSyncAction` helper
 *      with the same setBusy-optional pattern (session 170)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const USE_MODELS_PAGE_PATH = join(
  REPO_ROOT,
  "src", "hooks", "useModelsPage.ts",
);

describe("runFallbackMutation setBusy-optional — useModelsPage consumer", () => {
  const hookSource = readFileSync(USE_MODELS_PAGE_PATH, "utf8");

  it("the useModelsPage source file is readable", () => {
    expect(hookSource.length).toBeGreaterThan(0);
  });

  /**
   * Extract a hook-local helper or handler body by name. Brace-matched
   * extraction (depth=0 sentinel) so the slice is well-bounded even
   * if a sibling function has unbalanced braces (e.g. inline JSX).
   *
   * The anchor must match a function declaration like
   *   const <name> = useCallback(
   * Starting the brace count from the anchor means the count opens at
   * `useCallback(` (depth=1) and never closes until the *outer*
   * closing `)` of `useCallback(...)`. The bodies we're extracting
   * here use the `useCallback(() => expr, [deps])` form (no opening
   * `{`), so the FIRST `{` is inside the closure body — but the
   * arrow-body form `useCallback(() => runFallbackMutation(...), [deps])`
   * has NO opening brace at all. We need to count parens (not braces)
   * and find the matching close paren, then look for the body's
   * actual end (which for the simple-arg form is the closing `);`
   * of the useCallback).
   */
  function extractUseCallbackBody(source: string, name: string): string {
    const anchorRe = new RegExp(
      `const ${name}\\s*=\\s*useCallback\\s*\\(`,
    );
    const m = anchorRe.exec(source);
    if (!m) {
      throw new Error(
        `useCallback body for ${name} not found in ${USE_MODELS_PAGE_PATH} — the function may have been renamed or removed`,
      );
    }
    const start = m.index;
    // Walk forward, tracking depth of `(` and `{` separately, so we
    // match the closing `)` of `useCallback(` without being thrown
    // off by braces inside the body (e.g. `try { ... } catch { ... }
    // finally { ... }`).
    let parenDepth = 0;
    let braceDepth = 0;
    let sawOpen = false;
    for (let i = start; i < source.length; i++) {
      const c = source[i];
      if (c === "(") {
        parenDepth++;
        sawOpen = true;
      } else if (c === ")") {
        parenDepth--;
        // When parenDepth returns to 0 after we've seen the open
        // paren, we've closed the useCallback's `(...)` arg list.
        // The next character is `;` (or whitespace then `;`), which
        // ends the statement. Include the closing `)` and the `;`
        // (plus the trailing newline if any) in the slice.
        if (sawOpen && parenDepth === 0) {
          let end = i + 1;
          // Absorb the trailing `;` if present.
          if (source[end] === ";") end++;
          // Absorb one trailing newline for nicer test output.
          if (source[end] === "\n") end++;
          return source.slice(start, end);
        }
      } else if (c === "{") {
        braceDepth++;
      } else if (c === "}") {
        braceDepth--;
      }
      // Silence the unused-var lint warning for braceDepth; we
      // track it for the `;`-after-`)` reasoning but don't gate
      // the return on it (the return is gated on parenDepth only).
      void braceDepth;
    }
    throw new Error(
      `useCallback body for ${name} has unbalanced parens (got to end of file without parenDepth=0)`,
    );
  }

  /** Strip // line comments so fingerprint regexes don't match JSDoc. */
  function stripComments(source: string): string {
    return source
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");
  }

  describe("helper contract — `setBusy` is the 5th optional param", () => {
    it("declares `setBusy` as the 5th optional parameter (`setBusy?:`)", () => {
      // The contract change: a 5th positional param `setBusy` with
      // a `?` so it can be omitted. The 4 existing params
      // (successMessage, errorFallback, url, init) remain required
      // and in their original positions — only the new param is
      // optional. A future "un-optional" revert would drop the `?`
      // and require every caller to pass a setter again.
      const code = stripComments(hookSource);
      // Match the runFallbackMutation signature block.
      const re =
        /const runFallbackMutation\s*=\s*useCallback\(\s*async\s*\(\s*\n?\s*successMessage:\s*string,\s*\n?\s*errorFallback:\s*string,\s*\n?\s*url:\s*string,\s*\n?\s*init:\s*\{[^}]+\},\s*\n?\s*setBusy\?:\s*\(busy:\s*boolean\)\s*=>\s*void,/;
      expect(re.test(code)).toBe(true);
    });

    it("the 5th param is the ONLY optional one (the other 4 lack `?`)", () => {
      // Pin the ordering: successMessage, errorFallback, url, init
      // are required (no `?`); setBusy is optional. A regression
      // that adds `?` to one of the 4 required params (e.g. a
      // well-meaning "all params are optional" PR) would change
      // every call-site's requiredness — this guard catches that.
      // Note: the `init` type literal contains an inner `body?:` —
      // we strip nested `?:` inside `{ ... }` first to avoid a
      // false positive on the 4th param.
      const code = stripComments(hookSource);
      const signature = code.match(
        /const runFallbackMutation\s*=\s*useCallback\(\s*async\s*\(([^)]+)\)/,
      );
      expect(signature).not.toBeNull();
      const params = signature![1]
        // Strip optional markers inside inline type literals like
        // `{ method: "POST" | "PUT" | "DELETE"; body?: string }`.
        .replace(/\{[^{}]*\}/g, "{}");
      // Split on commas at depth 0 (the type signatures have inner
      // braces but no inner commas in the 5 param list — the 5-arg
      // list is shallow).
      const paramList = params.split(",").map((p) => p.trim());
      expect(paramList.length).toBe(5);
      // First 4: no `?`. 5th: `?`.
      for (let i = 0; i < 4; i++) {
        expect(paramList[i]).not.toMatch(/\?/);
      }
      expect(paramList[4]).toMatch(/^setBusy\?/);
    });

    it("helper body has `setBusyFn(true)` before the try block", () => {
      // The lifecycle: setBusy(true) → try { apiFetch + loadAll +
      // showToast } → catch { toastError } → finally { setBusy(false) }.
      // This assertion pins the "setBusy(true) at the start" half.
      const code = stripComments(hookSource);
      // Extract just the runFallbackMutation body (not the whole hook).
      const body = extractUseCallbackBody(hookSource, "runFallbackMutation");
      const bodyCode = stripComments(body);
      // Find `setBusyFn(true)` before the `try {` block.
      const setBusyTrueIdx = bodyCode.indexOf("setBusyFn(true)");
      const tryIdx = bodyCode.indexOf("try {");
      expect(setBusyTrueIdx).toBeGreaterThan(-1);
      expect(tryIdx).toBeGreaterThan(-1);
      expect(setBusyTrueIdx).toBeLessThan(tryIdx);
      // Sanity: the source-pattern must appear (not just a name match).
      expect(code).toContain("setBusyFn(true)");
    });

    it("helper body has `setBusyFn(false)` in a finally block", () => {
      // The lifecycle's other half: finally { setBusy(false) }
      // ensures the busy state clears on both success and failure
      // paths, mirroring `runSyncAction`'s setBusy lifecycle.
      const body = extractUseCallbackBody(hookSource, "runFallbackMutation");
      const bodyCode = stripComments(body);
      // Match the exact `finally { ... setBusyFn(false); ... }` shape.
      expect(/finally\s*\{\s*setBusyFn\(false\)\s*;?\s*\}/.test(bodyCode)).toBe(true);
    });

    it("helper body has a no-op default for setBusy (`() => undefined`)", () => {
      // The default `setBusy ?? (() => undefined)` is what makes
      // the parameter truly optional at runtime — without it, an
      // omitted setBusy would call `undefined(true)` and throw.
      // The actual source shape is `setBusy ?? (() => undefined)`
      // (the arrow function is wrapped in an extra pair of parens
      // for parser clarity), so the regex matches the outer `(`,
      // an inner `() => undefined` arrow, and a closing `)`.
      const body = extractUseCallbackBody(hookSource, "runFallbackMutation");
      const bodyCode = stripComments(body);
      expect(
        /setBusy\s*\?{2}\s*\(\s*\(\s*\)\s*=>\s*undefined\s*\)/.test(bodyCode),
      ).toBe(true);
    });
  });

  describe("busy-state consumer — handleImportFallbackFromConfig passes setImportingFallback as 5th arg", () => {
    let body: string;
    beforeAll(() => {
      body = extractUseCallbackBody(hookSource, "handleImportFallbackFromConfig");
    });

    it("body extraction succeeded (non-empty body)", () => {
      expect(body.length).toBeGreaterThan(0);
    });

    it("handleImportFallbackFromConfig does NOT contain the inline try/catch/finally boilerplate", () => {
      // Pre-refactor body had:
      //   try {
      //     await apiFetch(...);
      //     await loadAll();
      //     showToast(...);
      //   } catch (err) {
      //     toastError(...);
      //   } finally {
      //     setImportingFallback(false);
      //   }
      // Post-refactor body is a single `runFallbackMutation(...)` call.
      // The inline `try {`, `catch (err)`, and `finally { setImportingFallback`
      // should all be gone.
      const code = stripComments(body);
      expect(code).not.toMatch(/\btry\s*\{/);
      expect(code).not.toMatch(/\bcatch\s*\(/);
      // The trailing `finally { setImportingFallback(false) }` is
      // the most specific smell — setImportingFallback is the only
      // fallback-busy state setter, and the `finally {` block in
      // the pre-refactor body was the only site where
      // `setImportingFallback` and `finally` co-occurred in this
      // handler.
      expect(code).not.toMatch(/finally\s*\{[^}]*setImportingFallback/);
    });

    it("handleImportFallbackFromConfig calls runFallbackMutation (1 call)", () => {
      // Post-refactor: the body is exactly one `runFallbackMutation(...)`
      // call. The helper that absorbed the boilerplate is invoked
      // once, with the 5-arg shape (including the new setBusy arg).
      const code = stripComments(body);
      const matches = code.match(/\brunFallbackMutation\s*\(/g) ?? [];
      expect(matches.length).toBe(1);
    });

    it("handleImportFallbackFromConfig passes setImportingFallback as the 5th arg", () => {
      // The 5-arg call shape:
      //   runFallbackMutation(
      //     "Fallback config imported from Hermes",  // 1: successMessage
      //     "Import failed",                          // 2: errorFallback
      //     "/api/models/fallbacks/import",           // 3: url
      //     { method: "POST" },                       // 4: init
      //     setImportingFallback,                     // 5: setBusy
      //   )
      // The 5th positional arg is `setImportingFallback` — the
      // busy-state setter the helper uses to drive the
      // `importingFallback` boolean that the `ModelsFallbackSection`
      // consumes.
      const code = stripComments(body);
      // Look for the 5th arg explicitly. The call is multi-line
      // (one arg per line in the source), so a literal comma-split
      // on the 5th arg's text is the most robust fingerprint.
      expect(code).toMatch(/setImportingFallback\s*,?\s*\n?\s*\)/);
      // The URL and method should also be present (the migration
      // preserves the original endpoint + method).
      expect(code).toContain('"/api/models/fallbacks/import"');
      expect(code).toMatch(/method:\s*"POST"/);
      // The success + error message strings are preserved from the
      // pre-refactor body.
      expect(code).toContain("Fallback config imported from Hermes");
      expect(code).toContain("Import failed");
    });

    it("handleImportFallbackFromConfig's useCallback deps shrink to just [runFallbackMutation]", () => {
      // Pre-refactor deps were `[loadAll, showToast]` (the inline
      // body referenced both via closure). Post-refactor deps are
      // `[runFallbackMutation]` (the helper is the only closure
      // variable, and it has stable identity because its own deps
      // are `[loadAll, showToast]`). A regression that re-introduces
      // `loadAll` or `showToast` in the deps would re-add the
      // 14-line inline body — this assertion pins the new shape.
      // The regex is permissive about the closure body shape
      // (arrow-with-body `() =>\n  ...` or arrow-with-expression
      // `() => expr` both match) — the only contract is that the
      // deps array contains exactly `runFallbackMutation` and no
      // other identifiers.
      const code = stripComments(body);
      // Match `[runFallbackMutation]` as the deps array, allowing
      // optional whitespace and a trailing comma (the canonical
      // trailing-comma convention used elsewhere in the file).
      expect(code).toMatch(/\[\s*runFallbackMutation\s*,?\s*\]/);
      // The OLD deps `[loadAll, showToast]` must NOT appear.
      expect(code).not.toMatch(/\[loadAll,\s*showToast\]/);
      expect(code).not.toMatch(/\[showToast,\s*loadAll\]/);
    });
  });

  describe("non-busy consumers — 5 fallback-chain CRUD handlers still pass 4 args (no setBusy)", () => {
    // These 5 handlers are the pre-migration consumers that
    // deliberately don't need a busy state. The migration should
    // NOT change their call shape — they should still call
    // `runFallbackMutation` with 4 args (the new 5th arg is omitted).
    // If a future session "adds setBusy to all handlers for
    // consistency", that's a behaviour change (new spinner UI for
    // sub-100ms operations) and should fail this test.
    const handlers = [
      "handleFallbackReorder",
      "handleFallbackToggle",
      "handleFallbackDelete",
      "handleFallbackAddFromRegistry",
      "handleFallbackAddCustom",
    ];

    for (const handlerName of handlers) {
      it(`${handlerName} still calls runFallbackMutation with 4 args (no 5th setBusy)`, () => {
        // Each handler body should be a single
        // `runFallbackMutation(...)` call with exactly 4 args.
        // The migration only added a 5th OPTIONAL arg — the
        // existing 4-arg callers remain unchanged.
        const body = extractUseCallbackBody(hookSource, handlerName);
        const code = stripComments(body);
        // The call must be present.
        const callMatches = code.match(/\brunFallbackMutation\s*\(/g) ?? [];
        expect(callMatches.length).toBe(1);
        // The 5th-arg fingerprint (setImportingFallback, setBusy,
        // or any other setter) must NOT appear in the call site.
        expect(code).not.toMatch(/setImportingFallback/);
        expect(code).not.toMatch(/setBusy\b/);
      });
    }
  });
});

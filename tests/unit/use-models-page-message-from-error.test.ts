/**
 * @jest-environment node
 *
 * Source-pattern test for the session-103 useModelsPage messageFromError
 * migration. The original code had:
 *   const msg = toError(err).message || String(err);
 * which is byte-equivalent to:
 *   const msg = messageFromError(err, String(err));
 *
 * The verbose form was the last remaining `toError` call site in
 * the codebase outside `api-fetch.ts` itself (per the session 90/91
 * migration carryover). This test locks the canonical form so a
 * future "tidy up the error helpers" PR can't accidentally:
 *   - re-introduce the verbose `toError(err).message || String(err)`
 *   - drop the `toError` import usage check (the import was
 *     removed because the verbose form is the only consumer)
 *   - regress to the inline `err instanceof Error ? err.message`
 *     form (different from `toError`, which is `instanceof Error
 *     ? err : new Error(String(err))` — slightly different
 *     semantics for non-Error throws)
 *
 * Why source-pattern instead of rendering the hook:
 *   - useModelsPage is a 559-line hook with 30+ useState calls,
 *     17 useCallback hooks, and 4 useMemo hooks. Rendering it
 *     requires mocking the entire /api/* surface — overkill for
 *     a 1-line error-unwrap.
 *   - The "messageFromError(err, String(err))" form is the
 *     byte-level contract.
 *
 * What this test does NOT lock:
 *   - The exact fallback text (currently `String(err)`)
 *   - The console.warn message text
 *   - The other 4 `messageFromError` call sites in the file
 *     (lines 176, 254, etc.) — those are tested in their own
 *     use-cases
 *
 * If the hook is restructured (e.g. the import-from-Hermes
 * flow is moved to a separate `useHermesImport` hook), the
 * file path and shape-string assertions will need to be
 * updated — the test's failure will then force the refactor
 * author to consciously decide whether the new shape preserves
 * the messageFromError usage.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const HOOK_PATH = path.resolve(
  __dirname,
  "../../src/hooks/useModelsPage.ts",
);

describe("useModelsPage messageFromError migration (session 103)", () => {
  const source = fs.readFileSync(HOOK_PATH, "utf8");

  it("uses messageFromError for the model auto-import catch (not the verbose toError form)", () => {
    // The session-103 migration target: the auto-import
    // `.catch((err) => { ... })` block must use
    // `messageFromError(err, String(err))`, not the verbose
    // `toError(err).message || String(err)`.
    expect(source).toMatch(
      /apiFetch\(\s*["']\/api\/models\/import["'][\s\S]*?\.catch\(\s*\(err\)\s*=>\s*\{[\s\S]*?messageFromError\(\s*err\s*,\s*String\(\s*err\s*\)\s*\)[\s\S]*?\}\s*\)/,
    );
  });

  it("does not contain the verbose toError(err).message form anywhere", () => {
    // The verbose form `toError(err).message` must NOT appear
    // in the file (it was the only remaining `toError` call
    // site after the session 90/91 carryover).
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(codeOnly).not.toMatch(/toError\(\s*err\s*\)\.message/);
  });

  it("does not import toError from @/lib/api-fetch", () => {
    // The `toError` import was removed from the import block
    // because the verbose form was the only consumer. A
    // regression that re-introduces the verbose form would
    // also need to re-add the import — this test catches
    // both at once.
    const importBlock = source.match(
      /import\s*\{[\s\S]*?\}\s*from\s*["']@\/lib\/api-fetch["']/,
    );
    expect(importBlock).not.toBeNull();
    expect(importBlock![0]).not.toMatch(/\btoError\b/);
  });

  it("still imports messageFromError (the helper form replaces the verbose form)", () => {
    // The canonical replacement. If a future PR drops
    // messageFromError from the imports (because no consumer
    // uses it), this test fails — forcing a check that the
    // helper is still wired up.
    const importBlock = source.match(
      /import\s*\{[\s\S]*?\}\s*from\s*["']@\/lib\/api-fetch["']/,
    );
    expect(importBlock).not.toBeNull();
    expect(importBlock![0]).toMatch(/\bmessageFromError\b/);
  });
});

/**
 * @jest-environment node
 */
// Session 204 — List 1 (Dashboard, Sessions, Memory, Logs) —
// `loadHindsightList` helper extraction in
// `src/lib/hindsight-client.ts` + 2-site migration in
// `HindsightBrowser.tsx` (loadDirectives + loadModels).
//
// The 2 inline `loadDirectives` + `loadModels` `useCallback`s in
// HindsightBrowser.tsx had the EXACT same 5-line shape:
//
//   setLoading(true);
//   const inner = await hindsightGet<...>(action);
//   setLoading(false);
//   if (inner?.error) {
//     showToast(inner.error, "error");
//     setItems([]);
//     return;
//   }
//   setItems(inner?.[key] || []);
//
// Post-session, the body is a single `loadHindsightList<TItem>(...)`
// call with the same args (action, setBusy, key, setItems, showToast).
// The helper body matches the pre-form byte-for-byte (same 5-line
// composition, no try/catch wrapper, no transformation of the error
// or items array).
//
// Source-pattern assertions:
//   (a) `loadHindsightList` is imported from `@/lib/hindsight-client`
//   (b) `loadDirectives` and `loadModels` are declared as
//       `useCallback(async () => { await loadHindsightList<...>(...); }, [showToast])`
//       (a 1-line body, deps = [showToast])
//   (c) both `loadDirectives` and `loadModels` call `loadHindsightList`
//       EXACTLY once (the `await loadHindsightList<...>(...)` form
//       appears once per handler)
//   (d) NO `setLoadingDirectives(true)` / `setLoadingModels(true)` /
//       `setLoadingDirectives(false)` / `setLoadingModels(false)` in
//       either handler (the busy toggle moved into the helper)
//   (e) NO `if (inner?.error)` in either handler (the error-toast
//       ladder moved into the helper)
//   (f) the `loadDirectives` handler passes `"directives"` as both
//       the action and the key (the canonical 2-arg form)
//   (g) the `loadModels` handler passes `"mental-models"` as the
//       action and `"models"` as the key (the canonical
//       action-vs-key split)
//   (h) NO `hindsightGet<{ directives?: ... }>` or
//       `hindsightGet<{ models?: ... }>` calls in the file (those
//       specific envelope types belonged to the inline pre-form;
//       the helper uses `Record<string, unknown>` internally and
//       returns the typed items via the `setItems` setter)

import { readFileSync } from "fs";
import { join } from "path";

const HINDSIGHT_BROWSER = join(
  process.cwd(),
  "src/components/memory/HindsightBrowser.tsx",
);

const HANDLERS = ["loadDirectives", "loadModels"] as const;

describe("HindsightBrowser loadHindsightList migration (session 204, List 1)", () => {
  let rawSource: string;
  let codeOnlySource: string;

  beforeAll(() => {
    rawSource = readFileSync(HINDSIGHT_BROWSER, "utf-8");
    // Strip block + line comments so the negative assertions don't
    // false-positive on JSDoc that mentions the old pattern (e.g.
    // the helper's JSDoc references the pre-form shape for
    // documentation purposes).
    codeOnlySource = rawSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  });

  it("imports loadHindsightList from @/lib/hindsight-client", () => {
    expect(rawSource).toMatch(
      /import\s*\{[^}]*\bhindsightGet\b[^}]*\bloadHindsightList\b[^}]*\}\s*from\s*["']@\/lib\/hindsight-client["']/,
    );
  });

  it.each(HANDLERS)(
    "%s is a useCallback with the loadHindsightList body",
    (handlerName) => {
      const handlerIdx = codeOnlySource.indexOf(`const ${handlerName} =`);
      expect(handlerIdx).toBeGreaterThan(-1);
      // Slice the handler body — bounded by the next `const <name> =`
      // declaration (the next handler in the file). The
      // `loadHindsightList` call must be the only non-trivial
      // statement in the body.
      const afterStart = codeOnlySource.slice(handlerIdx);
      const nextConstMatch = afterStart.slice(40).match(/\n  const \w+ =/);
      const bodyEnd = nextConstMatch
        ? handlerIdx + 40 + (nextConstMatch.index ?? 0)
        : codeOnlySource.length;
      const window = codeOnlySource.slice(handlerIdx, bodyEnd);
      // The body should be a single `await loadHindsightList<...>(...)`
      // call followed by a `}, [showToast]);` close.
      expect(window).toMatch(
        new RegExp(
          `const\\s+${handlerName}\\s*=\\s*useCallback\\s*\\(\\s*async\\s*\\(\\s*\\)\\s*=>\\s*\\{[^}]*await\\s+loadHindsightList`,
        ),
      );
      // The deps array should be exactly `[showToast]`.
      expect(window).toMatch(/\},\s*\[showToast\]\)/);
    },
  );

  it.each(HANDLERS)(
    "%s calls loadHindsightList EXACTLY once",
    (handlerName) => {
      const handlerIdx = codeOnlySource.indexOf(`const ${handlerName} =`);
      expect(handlerIdx).toBeGreaterThan(-1);
      const afterStart = codeOnlySource.slice(handlerIdx);
      const nextConstMatch = afterStart.slice(40).match(/\n  const \w+ =/);
      const bodyEnd = nextConstMatch
        ? handlerIdx + 40 + (nextConstMatch.index ?? 0)
        : codeOnlySource.length;
      const window = codeOnlySource.slice(handlerIdx, bodyEnd);
      const callCount = (
        window.match(/await\s+loadHindsightList\s*</g) || []
      ).length;
      expect(callCount).toBe(1);
    },
  );

  it.each(HANDLERS)(
    "%s no longer toggles the busy state inline",
    (handlerName) => {
      // The pre-form had `setLoadingDirectives(true)` /
      // `setLoadingModels(true)` and the matching
      // `setLoadingDirectives(false)` / `setLoadingModels(false)`.
      // Both pairs moved into the helper. A regression that
      // re-introduces an inline busy toggle trips this assertion.
      const handlerIdx = codeOnlySource.indexOf(`const ${handlerName} =`);
      expect(handlerIdx).toBeGreaterThan(-1);
      const afterStart = codeOnlySource.slice(handlerIdx);
      const nextConstMatch = afterStart.slice(40).match(/\n  const \w+ =/);
      const bodyEnd = nextConstMatch
        ? handlerIdx + 40 + (nextConstMatch.index ?? 0)
        : codeOnlySource.length;
      const window = codeOnlySource.slice(handlerIdx, bodyEnd);
      const busySetter = handlerName === "loadDirectives"
        ? "setLoadingDirectives"
        : "setLoadingModels";
      expect(window).not.toMatch(new RegExp(`\\b${busySetter}\\s*\\(`));
    },
  );

  it.each(HANDLERS)(
    "%s no longer has the inline `if (inner?.error)` ladder",
    (handlerName) => {
      // The pre-form had `if (inner?.error) { showToast; setX([]); return; }`
      // inline. The error-toast ladder moved into the helper. A
      // regression that re-introduces it trips this assertion.
      const handlerIdx = codeOnlySource.indexOf(`const ${handlerName} =`);
      expect(handlerIdx).toBeGreaterThan(-1);
      const afterStart = codeOnlySource.slice(handlerIdx);
      const nextConstMatch = afterStart.slice(40).match(/\n  const \w+ =/);
      const bodyEnd = nextConstMatch
        ? handlerIdx + 40 + (nextConstMatch.index ?? 0)
        : codeOnlySource.length;
      const window = codeOnlySource.slice(handlerIdx, bodyEnd);
      expect(window).not.toMatch(/if\s*\(\s*inner\?\.\s*error\s*\)/);
    },
  );

  it("loadDirectives passes 'directives' as both the action and the key", () => {
    const handlerIdx = codeOnlySource.indexOf("const loadDirectives =");
    expect(handlerIdx).toBeGreaterThan(-1);
    const afterStart = codeOnlySource.slice(handlerIdx);
    const nextConstMatch = afterStart.slice(40).match(/\n  const \w+ =/);
    const bodyEnd = nextConstMatch
      ? handlerIdx + 40 + (nextConstMatch.index ?? 0)
      : codeOnlySource.length;
    const window = codeOnlySource.slice(handlerIdx, bodyEnd);
    // Canonical 2-arg form: action = "directives", key = "directives"
    expect(window).toMatch(
      /loadHindsightList<Directive>\s*\(\s*[\s\S]*?["']directives["']\s*,\s*setLoadingDirectives\s*,\s*["']directives["']/,
    );
  });

  it("loadModels passes 'mental-models' as the action and 'models' as the key", () => {
    const handlerIdx = codeOnlySource.indexOf("const loadModels =");
    expect(handlerIdx).toBeGreaterThan(-1);
    const afterStart = codeOnlySource.slice(handlerIdx);
    const nextConstMatch = afterStart.slice(40).match(/\n  const \w+ =/);
    const bodyEnd = nextConstMatch
      ? handlerIdx + 40 + (nextConstMatch.index ?? 0)
      : codeOnlySource.length;
    const window = codeOnlySource.slice(handlerIdx, bodyEnd);
    // Canonical action-vs-key split: action = "mental-models", key = "models"
    expect(window).toMatch(
      /loadHindsightList<MentalModel>\s*\(\s*[\s\S]*?["']mental-models["']\s*,\s*setLoadingModels\s*,\s*["']models["']/,
    );
  });

  it("the file no longer uses the inline envelope-typed hindsightGet forms for directives/models", () => {
    // The pre-form had:
    //   const inner = await hindsightGet<{ directives?: Directive[]; error?: string }>("directives");
    //   const inner = await hindsightGet<{ models?: MentalModel[]; error?: string }>("mental-models");
    // The migration replaces both with `loadHindsightList` calls.
    // A regression that re-introduces either inline form trips this
    // assertion.
    expect(codeOnlySource).not.toMatch(
      /hindsightGet<\{\s*directives\s*\?:\s*Directive\[\][^}]*\}>/,
    );
    expect(codeOnlySource).not.toMatch(
      /hindsightGet<\{\s*models\s*\?:\s*MentalModel\[\][^}]*\}>/,
    );
  });
});

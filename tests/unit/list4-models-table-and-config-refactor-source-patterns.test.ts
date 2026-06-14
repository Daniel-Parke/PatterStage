/**
 * Source-pattern test for 3 List 4 refactors carried over from
 * session 210 (F.6 partial-execution carryover mode):
 *
 *   1. `ModelsTableSection.tsx` — per-row `TASK_TYPES.filter(...)` →
 *      precomputed `Map<modelId, TaskType[]>` (the useMemo + Map.get
 *      refactor dropped per-render work from O(12N) to O(12 + N)).
 *
 *   2. `useModelsPage.ts` + `models/page.tsx` — wrapper-shim
 *      close-callback pitfall (P-210-8) fix. The pre-refactor page
 *      had a `useCallback(() => setEditingFallbackEntry(null), [])`
 *      wrapper with a misleading "useState setters are stable"
 *      eslint-disable — but `setEditingFallbackEntry` was a function
 *      literal in the hook's return object (recreated every render),
 *      NOT a useState dispatch. The post-refactor hook exposes a
 *      stable `useCallback` `closeEditingFallbackEntry` that the
 *      page uses directly with no wrapper and no eslint-disable.
 *
 *   3. `config/[section]/page.tsx` — `fileKeyForFilePath` called
 *      twice in separate callbacks (loadConfig + handleSave) →
 *      single `useMemo` at the top of the component derives `fileKey`
 *      once per `sectionDef.filePath` change.
 *
 * The 3 refactors share a "lift out of callback, into the top of
 * the component" theme — a callback-local recomputation that fires
 * per-render is hoisted to a top-of-component `useMemo` so the
 * value is computed once per dependency change, not once per
 * callback invocation.
 *
 * The test is positive (asserts the new helper is present) + negative
 * (asserts the old inline form is gone) for each refactor surface.
 * The "presence + absence" pairing is the load-bearing regression
 * guard — a future re-introduction of the inline form would only
 * fire on the negative assertion, not the positive one.
 */
import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");

const readSource = (relPath: string): string =>
  readFileSync(join(REPO_ROOT, relPath), "utf8");

describe("List 4 source-pattern refactors (session 210 F.6 carryover closure)", () => {
  describe("Refactor 1: ModelsTableSection useMemo + Map.get (perf)", () => {
    const file = "src/components/models/ModelsTableSection.tsx";

    it("imports useMemo (positive)", () => {
      const src = readSource(file);
      expect(src).toMatch(/import\s*\{\s*useMemo\s*\}\s*from\s*["']react["']/);
    });

    it("computes defaultedSlotsByModelId with a useMemo (positive)", () => {
      const src = readSource(file);
      // The useMemo body walks TASK_TYPES once, building a
      // Map<modelId, TaskType[]>. The variable name is the contract
      // — both call sites + JSDoc reference it.
      expect(src).toMatch(
        /const\s+defaultedSlotsByModelId\s*=\s*useMemo\(\s*\(\)\s*=>\s*\{[\s\S]*?new\s+Map<string,\s*TaskType\[\]>/,
      );
    });

    it("uses Map.get for per-row badge lookup (positive)", () => {
      const src = readSource(file);
      // The pre-refactor form computed badges per-row with
      // `TASK_TYPES.filter(slot => defaults[slot] === m.id)`. The
      // post-refactor form reads from the memoized map with
      // `defaultedSlotsByModelId.get(m.id) ?? []`.
      expect(src).toMatch(/defaultedSlotsByModelId\.get\(\s*m\.id\s*\)\s*\?\?\s*\[\]/);
    });

    it("does NOT inline TASK_TYPES.filter inside the per-row map (negative)", () => {
      const src = readSource(file);
      // The pre-refactor form was:
      //   {models.map((m) => {
      //     const badges = TASK_TYPES.filter((slot) => defaults[slot] === m.id);
      //     return <ModelRow ... badges={badges} ... />;
      //   })}
      // The post-refactor form has the filter computation lifted
      // into the useMemo. A regression would re-introduce the
      // filter inside the .map callback. Assert the inline
      // TASK_TYPES.filter call is gone.
      expect(src).not.toMatch(/TASK_TYPES\.filter\(\s*\(\s*slot\s*\)\s*=>/);
    });
  });

  describe("Refactor 2: wrapper-shim close-callback hoist (P-210-8)", () => {
    const hookFile = "src/hooks/useModelsPage.ts";
    const pageFile = "src/app/config/models/page.tsx";

    it("useModelsPage defines setEditingFallbackEntry as a useCallback (positive)", () => {
      const src = readSource(hookFile);
      // The pre-refactor form was a function literal in the return
      // object. The post-refactor form is a useCallback at the top
      // of the hook body, with the wrapper's body in closure scope.
      expect(src).toMatch(
        /const\s+setEditingFallbackEntry\s*=\s*useCallback\(\s*\(\s*entry\s*:\s*FallbackChainEntry\s*\|\s*null\s*\)\s*=>/,
      );
    });

    it("useModelsPage defines closeEditingFallbackEntryCallback as a useCallback (positive)", () => {
      const src = readSource(hookFile);
      // The new stable close-callback that the page uses directly.
      // It calls setEditingFallbackEntry(null) — the canonical
      // "dismiss" form. The deps list setEditingFallbackEntry so
      // the reference is fresh.
      expect(src).toMatch(
        /const\s+closeEditingFallbackEntryCallback\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setEditingFallbackEntry\(\s*null\s*\),\s*\[setEditingFallbackEntry\]/,
      );
    });

    it("useModelsPage returns closeEditingFallbackEntry in the surface (positive)", () => {
      const src = readSource(hookFile);
      // The hook exposes the new close-callback in its return object.
      // The exact key in the return is `closeEditingFallbackEntry`
      // (the page's destructure picks it up as that name).
      expect(src).toMatch(
        /closeEditingFallbackEntry:\s*closeEditingFallbackEntryCallback/,
      );
    });

    it("models page destructures closeEditingFallbackEntry from useModelsPage (positive)", () => {
      const src = readSource(pageFile);
      // The page picks up the new stable close-callback directly
      // from the hook. The destructure line is the contract — a
      // regression that removes it would force the page to fall
      // back to the pre-refactor `useCallback` wrapper.
      expect(src).toMatch(/closeEditingFallbackEntry\s*,/);
    });

    it("models page does NOT define a page-level closeFallbackModal useCallback (negative)", () => {
      const src = readSource(pageFile);
      // The pre-refactor form was:
      //   const closeFallbackModal = useCallback(() => setEditingFallbackEntry(null), []);
      // The post-refactor form deletes this wrapper entirely
      // (uses the hook's stable closeEditingFallbackEntry instead).
      // Assert the local wrapper is gone — the page should not
      // re-introduce the wrapper-shim pitfall.
      expect(src).not.toMatch(/const\s+closeFallbackModal\s*=\s*useCallback/);
    });

    it("models page does NOT have the misleading 'useState setters are stable' annotation tied to the fallback shim (negative)", () => {
      const src = readSource(pageFile);
      // The pre-refactor page had 3 close-callbacks all with the
      // same eslint-disable annotation: `openAddModel`,
      // `closeModelEditor`, `closeFallbackModal`. The
      // `closeFallbackModal` one was the misleading one (the
      // function being called was a wrapper, not a useState
      // dispatch). Post-refactor, only 2 of the 3 annotations
      // remain (`openAddModel` + `closeModelEditor` — both wrap
      // vanilla useState dispatches). The 3rd annotation is
      // GONE because the close-callback moved into the hook.
      // Count the remaining annotations to confirm the count
      // dropped from 3 to 2.
      const matches = src.match(
        /eslint-disable-next-line react-hooks\/exhaustive-deps -- useState setters are stable/g,
      );
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(2);
    });
  });

  describe("Refactor 3: config/[section] fileKey useMemo (perf)", () => {
    const file = "src/app/config/[section]/page.tsx";

    it("declares fileKey as a useMemo at the top of the component (positive)", () => {
      const src = readSource(file);
      // The useMemo derives fileKey from sectionDef.filePath via
      // the pure fileKeyForFilePath helper. The shape is
      // `useMemo(() => sectionDef?.filePath ? fileKeyForFilePath(...) : null, [sectionDef?.filePath])`.
      expect(src).toMatch(
        /const\s+fileKey\s*=\s*useMemo\(\s*\(\s*\)\s*=>\s*\(\s*sectionDef\?\.filePath\s*\?\s*fileKeyForFilePath\(\s*sectionDef\.filePath\s*\)\s*:\s*null\s*\)\s*,\s*\[sectionDef\?\.filePath\]/,
      );
    });

    it("loadConfig uses the memoized fileKey (positive)", () => {
      const src = readSource(file);
      // The pre-refactor form called `fileKeyForFilePath(sectionDef.filePath)`
      // inside loadConfig. The post-refactor form uses the
      // memoized `fileKey` directly.
      // Find the loadConfig callback body and assert it does NOT
      // re-call fileKeyForFilePath.
      const loadConfigMatch = src.match(
        /const\s+loadConfig\s*=\s*useCallback\(async\s*\(signal\?:\s*AbortSignal\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[fileKey/,
      );
      expect(loadConfigMatch).not.toBeNull();
      const body = loadConfigMatch?.[1] ?? "";
      expect(body).not.toMatch(/fileKeyForFilePath\(/);
    });

    it("handleSave uses the memoized fileKey (positive)", () => {
      const src = readSource(file);
      // The pre-refactor form called `fileKeyForFilePath(sectionDef.filePath)`
      // inside handleSave. The post-refactor form uses the
      // memoized `fileKey` directly.
      const handleSaveMatch = src.match(
        /const\s+handleSave\s*=\s*useCallback\(async\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[sectionDef,\s*isFileSection,\s*fileKey/,
      );
      expect(handleSaveMatch).not.toBeNull();
      const body = handleSaveMatch?.[1] ?? "";
      expect(body).not.toMatch(/fileKeyForFilePath\(/);
    });

    it("does NOT have inline fileKeyForFilePath call sites (negative)", () => {
      const src = readSource(file);
      // The pre-refactor form had 2 inline calls inside the
      // callback bodies (loadConfig + handleSave). The
      // post-refactor form has 1 call site (inside the useMemo).
      // We strip block + line comments first because the JSDoc
      // (P-208-2 sister pattern) above the useMemo documents
      // the pre-refactor call sites by their exact form
      // (`fileKeyForFilePath(sectionDef.filePath)`); a bare
      // count would match the JSDoc and inflate the expected
      // count to 2.
      const stripComments = (text: string): string =>
        text
          .replace(/\/\*[\s\S]*?\*\//g, "/* */") // block comments
          .replace(/^\s*\/\/.*$/gm, ""); // line comments
      const stripped = stripComments(src);
      const matches = stripped.match(/fileKeyForFilePath\(/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(1);
    });
  });
});

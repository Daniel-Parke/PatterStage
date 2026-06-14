/**
 * Source-pattern test for 3 List 4 refactors carried over from
 * session 210 (F.6 partial-execution carryover mode):
 *
 *   1. `ModelsTableSection.tsx` — per-row `TASK_TYPES.filter(...)` →
 *      precomputed `Map<modelId, TaskType[]>` (the useMemo + Map.get
 *      refactor dropped per-render work from O(12N) to O(12 + N)).
 *
 *   2. `useModelsPage.ts` + `models/page.tsx` — stable
 *      close-callback for the fallback-edit modal. The hook
 *      exposes `setEditingFallbackEntry` as a function-literal
 *      close-modal shim (`setFallbackEdit({ entry, url, saving })`
 *      with `entry: null` to dismiss). The page wraps it in a
 *      local `useCallback` `closeFallbackModal` (sister to
 *      `openAddModel` + `closeModelEditor`) and passes that to
 *      `<ModelsFallbackSection onCloseFallbackModal={...}>`.
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

  describe("Refactor 2: stable close-callback for fallback-edit modal", () => {
    const hookFile = "src/hooks/useModelsPage.ts";
    const pageFile = "src/app/config/models/page.tsx";

    it("useModelsPage exposes setEditingFallbackEntry as a close-modal shim (positive)", () => {
      const src = readSource(hookFile);
      // The shim forwards to `setFallbackEdit({ entry, url, saving })`
      // with `entry` (which can be null to dismiss). Sister to the
      // `setEditingFallbackUrl` partial-update shim — both wrap
      // `setFallbackEdit` to keep the ModelsFallbackSection props
      // contract byte-equivalent to the pre-consolidation form.
      expect(src).toMatch(
        /setEditingFallbackEntry:\s*\(entry:\s*FallbackChainEntry\s*\|\s*null\)\s*=>\s*setFallbackEdit\(\{\s*entry,\s*url:\s*entry\?\.overrideBaseUrl\s*\|\|\s*[\"']{2},\s*saving:\s*false\s*\}\)/,
      );
    });

    it("models page destructures setEditingFallbackEntry from useModelsPage (positive)", () => {
      const src = readSource(pageFile);
      // The page picks up the shim from the hook. The destructure line
      // is the contract — a regression that removes it would force
      // the page to fall back to the pre-consolidation form.
      expect(src).toMatch(/setEditingFallbackEntry\s*,/);
    });

    it("models page declares closeFallbackModal as a useCallback that calls setEditingFallbackEntry(null) (positive)", () => {
      const src = readSource(pageFile);
      // The page wraps the shim in a stable useCallback. Sister to
      // `openAddModel` + `closeModelEditor` (same useState-setter
      // stability rationale). The `<ModelsFallbackSection
      // onCloseFallbackModal={...}>` binding at line 184 is the
      // only call site today.
      expect(src).toMatch(
        /const\s+closeFallbackModal\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*setEditingFallbackEntry\(\s*null\s*\)\s*,\s*\[\s*\]\s*\)/,
      );
    });

    it("models page does NOT have a closeEditingFallbackEntryCallback export from the hook (negative)", () => {
      const src = readSource(pageFile);
      // The pre-merge (session 210 F.6 carryover closure) form had
      // the hook expose `closeEditingFallbackEntry` and the page
      // destructure it directly. The post-merge form has the page
      // own the close-callback (`closeFallbackModal`) and the hook
      // expose just the shim (`setEditingFallbackEntry`). Assert
      // the page-side destructure of the hook's stable
      // close-callback is gone.
      expect(src).not.toMatch(/closeEditingFallbackEntry\s*,/);
    });

    it("useModelsPage does NOT define a closeEditingFallbackEntryCallback wrapper (negative)", () => {
      const src = readSource(hookFile);
      // The pre-merge form had the hook own both the shim AND a
      // stable useCallback wrapper around it. The post-merge form
      // has the hook own only the shim — the page wraps it
      // locally. Assert the hook-level wrapper is gone.
      expect(src).not.toMatch(/const\s+closeEditingFallbackEntryCallback\s*=\s*useCallback/);
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

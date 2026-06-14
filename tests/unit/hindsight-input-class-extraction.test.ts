/**
 * @jest-environment node
 *
 * Source-pattern test for the `HINDSIGHT_TEXT_INPUT_CLASS` and
 * `HINDSIGHT_TEXTAREA_CLASS` constants in
 * `src/components/memory/hindsight/utils.ts` (new exports) +
 * the `src/components/memory/hindsight/Modals.tsx` 6-input +
 * 3-textarea migration.
 *
 * Session 213 List 1 refactor — extracted 2 tailwind className
 * constants that were inlined byte-identically at 9 sites in
 * `Modals.tsx`:
 *
 *   - `HINDSIGHT_TEXT_INPUT_CLASS`  — 6 sites (memory tags,
 *     directive name, directive priority, directive tags,
 *     model name, model tags). All used the byte-identical
 *     className
 *     `w-full bg-dark-800 border border-white/10 rounded-lg
 *      px-3 py-2 text-sm text-white/80 focus:border-pink-500/50
 *      focus:outline-none`.
 *
 *   - `HINDSIGHT_TEXTAREA_CLASS`  — 3 sites (memory content
 *     `h-32`, directive content `h-28`, model source-query
 *     `h-28`). All used the same tail of the className
 *     (the `bg-dark-800 ... resize-none focus:border-pink-500/50
 *     focus:outline-none` portion); each site added its own
 *     `w-full h-N` height prefix.
 *
 * Migration intent: collapse the duplicate tailwind className
 * strings into 2 named constants so a future visual tweak (focus
 * ring colour, padding, border colour) lands in one place per
 * constant instead of 6 (or 3). The visual output is byte-
 * equivalent — tailwind's JIT compiler scans the source for
 * class names, finds them all (now centralised in `utils.ts`
 * instead of scattered through `Modals.tsx`), and emits the
 * same CSS.
 *
 * Why source-pattern instead of rendering the modals:
 *   - The Modals.tsx file has 3 modals × 5 form fields each,
 *     driven by parent state in `HindsightBrowser.tsx`. Rendering
 *     any one modal requires mocking `useToast`, the full
 *     form-state machinery, and the parent component's
 *     `runMutation` / `hindsightMutate` call shape. The harness
 *     would dwarf the invariant being tested.
 *   - The "use the constant, not the inline string" shape is a
 *     byte-level contract: `Modals.tsx` literally references
 *     `HINDSIGHT_TEXT_INPUT_CLASS` / `HINDSIGHT_TEXTAREA_CLASS`
 *     in each `<input>` / `<textarea>` className. If a future PR
 *     re-inlines any of the 9 strings, this test fails.
 *
 * What this test locks:
 *   1. The 2 new exports exist in `utils.ts` with the
 *      byte-identical className strings
 *   2. `Modals.tsx` imports both constants from `./utils`
 *   3. All 6 text-input sites use `HINDSIGHT_TEXT_INPUT_CLASS`
 *      (no inline `w-full bg-dark-800 ... px-3 py-2` strings
 *      remain)
 *   4. All 3 textarea sites compose `HINDSIGHT_TEXTAREA_CLASS`
 *      with their height prefix (no inline `bg-dark-800 ... p-3
 *      resize-none` strings remain)
 *   5. The 2 anti-migration guards: the `<label>` elements still
 *      have the `text-white/50 mb-1` class (those weren't part
 *      of the migration); the `<Modal>` + `<Button>` shell stays
 *      unchanged
 *
 * If a future PR re-introduces an inline className string at any
 * of the 9 sites, this test fails.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const UTILS_PATH = path.resolve(
  __dirname,
  "../../src/components/memory/hindsight/utils.ts",
);
const MODALS_PATH = path.resolve(
  __dirname,
  "../../src/components/memory/hindsight/Modals.tsx",
);

const EXPECTED_TEXT_INPUT_CLASS =
  "w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-pink-500/50 focus:outline-none";
const EXPECTED_TEXTAREA_CLASS =
  "bg-dark-800 border border-white/10 rounded-lg p-3 text-sm text-white/80 resize-none focus:border-pink-500/50 focus:outline-none";

describe("HINDSIGHT_TEXT_INPUT_CLASS / HINDSIGHT_TEXTAREA_CLASS extraction (List 1 Hindsight modals)", () => {
  const utilsSource = fs.readFileSync(UTILS_PATH, "utf8");
  const modalsSource = fs.readFileSync(MODALS_PATH, "utf8");

  describe("utils.ts — constants are exported with the expected strings", () => {
    it("exports HINDSIGHT_TEXT_INPUT_CLASS", () => {
      expect(utilsSource).toMatch(
        /export const HINDSIGHT_TEXT_INPUT_CLASS\s*=\s*["']/,
      );
    });

    it("exports HINDSIGHT_TEXTAREA_CLASS", () => {
      expect(utilsSource).toMatch(
        /export const HINDSIGHT_TEXTAREA_CLASS\s*=\s*["']/,
      );
    });

    it("HINDSIGHT_TEXT_INPUT_CLASS value is the byte-identical pre-extraction string", () => {
      // Capture the constant's value via regex (greedy to end of
      // quoted string, allowing either single or double quotes).
      const match = utilsSource.match(
        /HINDSIGHT_TEXT_INPUT_CLASS\s*=\s*["']([^"']+)["']/,
      );
      expect(match).not.toBeNull();
      expect(match?.[1]).toBe(EXPECTED_TEXT_INPUT_CLASS);
    });

    it("HINDSIGHT_TEXTAREA_CLASS value is the byte-identical pre-extraction string", () => {
      const match = utilsSource.match(
        /HINDSIGHT_TEXTAREA_CLASS\s*=\s*["']([^"']+)["']/,
      );
      expect(match).not.toBeNull();
      expect(match?.[1]).toBe(EXPECTED_TEXTAREA_CLASS);
    });
  });

  describe("Modals.tsx — imports both constants from ./utils", () => {
    it("imports HINDSIGHT_TEXT_INPUT_CLASS and HINDSIGHT_TEXTAREA_CLASS from ./utils", () => {
      expect(modalsSource).toMatch(
        /import\s*\{\s*HINDSIGHT_TEXT_INPUT_CLASS\s*,\s*HINDSIGHT_TEXTAREA_CLASS\s*\}\s*from\s*["']\.\/utils["']/,
      );
    });
  });

  describe("Modals.tsx — all 6 text input sites use the constant (no inline form)", () => {
    it("contains 6 `className={HINDSIGHT_TEXT_INPUT_CLASS}` references", () => {
      const matches = modalsSource.match(
        /className=\{HINDSIGHT_TEXT_INPUT_CLASS\}/g,
      );
      // 6 sites: memory tags, directive name, directive priority,
      // directive tags, model name, model tags.
      expect(matches?.length ?? 0).toBe(6);
    });

    it("contains ZERO inline `w-full bg-dark-800 ... px-3 py-2` text-input strings", () => {
      // After extraction, no `<input>` should carry the full
      // pre-extraction className inline. The constant IS that
      // string, so checking the inline form is the same as
      // checking the constant — but the inline form must NOT
      // appear in Modals.tsx (it's only in utils.ts).
      // We grep Modals.tsx specifically.
      expect(modalsSource).not.toMatch(
        /className=["']w-full bg-dark-800 border border-white\/10 rounded-lg px-3 py-2/,
      );
    });
  });

  describe("Modals.tsx — all 3 textarea sites compose the constant (no inline form)", () => {
    it("contains 3 `${HINDSIGHT_TEXTAREA_CLASS}` template-literal references", () => {
      const matches = modalsSource.match(
        /\$\{HINDSIGHT_TEXTAREA_CLASS\}/g,
      );
      // 3 sites: memory content (h-32), directive content (h-28),
      // model source-query (h-28).
      expect(matches?.length ?? 0).toBe(3);
    });

    it("contains ZERO inline `bg-dark-800 border border-white/10 rounded-lg p-3 text-sm ... resize-none` textarea strings", () => {
      // Same logic as the text-input test — the inline form
      // (without the height prefix) must NOT appear in Modals.tsx
      // after extraction.
      expect(modalsSource).not.toMatch(
        /className=["'](?:\S+\s+)*bg-dark-800 border border-white\/10 rounded-lg p-3 text-sm text-white\/80 resize-none/,
      );
    });
  });

  describe("Modals.tsx — anti-migration guards (the unchanged shell stays unchanged)", () => {
    it("`<label>` elements still use `text-white/50 mb-1` (NOT part of the migration)", () => {
      // The `<label>` was always a separate concern from the
      // input/textarea className. Lock the post-extraction label
      // class so a future "tidy up labels too" change is
      // intentional, not accidental.
      expect(modalsSource).toMatch(/text-white\/50 mb-1/);
    });

    it("`<Modal>` + `<Button>` shell stays unchanged (Modal still has size=\"md\", Button still has variant=primary color=pink)", () => {
      // Sanity: the shell is what users see; we don't want a
      // refactor to have drifted it. Spot-check 2 markers.
      expect(modalsSource).toMatch(/size="md"/);
      expect(modalsSource).toMatch(/variant="primary" color="pink"/);
    });
  });
});

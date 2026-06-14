/**
 * @jest-environment node
 *
 * Source-pattern test for the `RowEditButton` + `RowDeleteButton`
 * shared components in
 * `src/components/memory/hindsight/RowActionButtons.tsx` (new file)
 * + the 2+2=4 inline-button migration in
 * `src/components/memory/hindsight/DirectivesTab.tsx` +
 * `src/components/memory/hindsight/MentalModelsTab.tsx`.
 *
 * Session 213 List 1 refactor — extracted 2 icon-button
 * components from the Hindsight tab row-action groups.
 *
 * The pre-extraction inline form was byte-identical at both
 * call sites:
 *
 *   - Edit button (DirectivesTab line 90-96 pre-refactor,
 *     MentalModelsTab line 95-101 pre-refactor):
 *
 *     ```tsx
 *     <button
 *       onClick={() => onEdit(X)}
 *       className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
 *       title="Edit"
 *     >
 *       <Pencil className="w-4 h-4" />
 *     </button>
 *     ```
 *
 *   - Delete button (DirectivesTab line 104-110 pre-refactor,
 *     MentalModelsTab line 110-116 pre-refactor):
 *
 *     ```tsx
 *     <button
 *       onClick={() => onDelete(X.id)}
 *       className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
 *       title="Delete"
 *     >
 *       <Trash2 className="w-4 h-4" />
 *     </button>
 *     ```
 *
 * Migration intent: collapse the duplicate 7-line `<button>`
 * blocks into 2 single-tag shared components. The visual output
 * is byte-equivalent — `RowEditButton` renders the exact same
 * `<button>` JSX with the exact same className; `RowDeleteButton`
 * renders the exact same `<button>` JSX with the exact same
 * className. The only structural change is the JSX swap
 * `<button onClick=...>...</button>` →
 * `<RowEditButton onClick={...} />` (same 1-arg callback).
 *
 * The middle button in the action group (Toggle in DirectivesTab,
 * Refresh in MentalModelsTab) is intentionally NOT extracted:
 *
 *   - Different onClick signature (`onToggle(d)` vs
 *     `onRefreshModel(m.id)`)
 *   - Different icon (`ToggleRight`/`ToggleLeft` vs `Zap`)
 *   - Different title ("Deactivate"/"Activate" vs
 *     "Refresh (re-run reflect)")
 *   - Different `disabled` semantics (Toggle: never disabled;
 *     Refresh: disabled + `animate-pulse` when
 *     `refreshingModelId === m.id`)
 *
 * Forcing the middle button into a shared component would
 * require a 5-prop API surface with 2 of the 5 props no-op at
 * one of the 2 sites. The middle button stays inline.
 *
 * Why source-pattern instead of rendering the tabs:
 *   - Both tabs are driven by `HindsightBrowser.tsx` state. The
 *     tabs themselves are pure presentational components but
 *     their action buttons receive `onEdit` / `onDelete`
 *     callbacks from the parent. Rendering the tab requires
 *     mocking the parent or the prop surface — the harness
 *     would dwarf the invariant being tested.
 *   - The "use the shared component, not the inline `<button>`"
 *     shape is a byte-level contract: the tabs literally call
 *     `<RowEditButton onClick={...} />` and
 *     `<RowDeleteButton onClick={...} />` instead of inlining
 *     the 7-line `<button>` blocks. If a future PR re-inlines
 *     either button at either site, this test fails.
 *
 * What this test locks:
 *   1. The shared `RowActionButtons` component file exists
 *      with both `RowEditButton` and `RowDeleteButton` exports
 *   2. Both tabs import both shared components from
 *      `./RowActionButtons`
 *   3. Both inline Edit `<button>` blocks are GONE in both tabs
 *      (replaced by `<RowEditButton onClick={...} />` calls)
 *   4. Both inline Delete `<button>` blocks are GONE in both tabs
 *      (replaced by `<RowDeleteButton onClick={...} />` calls)
 *   5. Both tabs' middle (Toggle / Refresh) buttons stay inline
 *      (different shape, anti-migration guard)
 *   6. Both tabs no longer import `Pencil` or `Trash2` from
 *      `lucide-react` (the icons now live in the shared
 *      component's internal import)
 *
 * If a future PR re-introduces an inline Edit/Delete button at
 * either of the 2 sites, this test fails.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const ROW_BUTTONS_PATH = path.resolve(
  __dirname,
  "../../src/components/memory/hindsight/RowActionButtons.tsx",
);
const DIRECTIVES_TAB_PATH = path.resolve(
  __dirname,
  "../../src/components/memory/hindsight/DirectivesTab.tsx",
);
const MENTAL_MODELS_TAB_PATH = path.resolve(
  __dirname,
  "../../src/components/memory/hindsight/MentalModelsTab.tsx",
);

describe("RowEditButton / RowDeleteButton extraction (List 1 Hindsight tab row actions)", () => {
  const rowButtonsSource = fs.readFileSync(ROW_BUTTONS_PATH, "utf8");
  const directivesSource = fs.readFileSync(DIRECTIVES_TAB_PATH, "utf8");
  const mentalModelsSource = fs.readFileSync(MENTAL_MODELS_TAB_PATH, "utf8");

  describe("RowActionButtons.tsx — shared component file exists with both exports", () => {
    it("exports `RowEditButton` as a named export", () => {
      expect(rowButtonsSource).toMatch(
        /export\s+function\s+RowEditButton\b/,
      );
    });

    it("exports `RowDeleteButton` as a named export", () => {
      expect(rowButtonsSource).toMatch(
        /export\s+function\s+RowDeleteButton\b/,
      );
    });

    it("RowEditButton renders a `<button>` with the byte-identical pre-extraction className", () => {
      // Pre-extraction Edit button className:
      //   "p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
      expect(rowButtonsSource).toMatch(
        /className="p-1\.5 rounded-lg hover:bg-white\/5 text-white\/40 hover:text-white\/70 transition-colors"/,
      );
    });

    it("RowEditButton uses the `Pencil` icon from `lucide-react`", () => {
      // The icon now lives in the shared component, not the
      // call site. Spot-check both the import and the usage.
      expect(rowButtonsSource).toMatch(
        /import\s*\{[^}]*\bPencil\b[^}]*\}\s*from\s*["']lucide-react["']/,
      );
      expect(rowButtonsSource).toMatch(/<Pencil\s+className="w-4 h-4"/);
    });

    it("RowEditButton renders `title=\"Edit\"` (matches the pre-extraction accessibility label)", () => {
      expect(rowButtonsSource).toMatch(/title="Edit"/);
    });

    it("RowDeleteButton renders a `<button>` with the byte-identical pre-extraction className", () => {
      // Pre-extraction Delete button className:
      //   "p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
      expect(rowButtonsSource).toMatch(
        /className="p-1\.5 rounded-lg hover:bg-red-500\/10 text-white\/40 hover:text-red-400 transition-colors"/,
      );
    });

    it("RowDeleteButton uses the `Trash2` icon from `lucide-react`", () => {
      expect(rowButtonsSource).toMatch(
        /import\s*\{[^}]*\bTrash2\b[^}]*\}\s*from\s*["']lucide-react["']/,
      );
      expect(rowButtonsSource).toMatch(/<Trash2\s+className="w-4 h-4"/);
    });

    it("RowDeleteButton renders `title=\"Delete\"` (matches the pre-extraction accessibility label)", () => {
      expect(rowButtonsSource).toMatch(/title="Delete"/);
    });
  });

  describe("DirectivesTab.tsx — imports the shared components and uses them at both sites", () => {
    it("imports both RowEditButton and RowDeleteButton from ./RowActionButtons", () => {
      expect(directivesSource).toMatch(
        /import\s*\{\s*RowEditButton\s*,\s*RowDeleteButton\s*\}\s*from\s*["']\.\/RowActionButtons["']/,
      );
    });

    it("uses `<RowEditButton onClick={() => onEdit(d)} />` at the per-row Edit site", () => {
      expect(directivesSource).toMatch(
        /<RowEditButton\s+onClick=\{\(\)\s*=>\s*onEdit\(d\)\s*\}\s*\/>/,
      );
    });

    it("uses `<RowDeleteButton onClick={() => onDelete(d.id)} />` at the per-row Delete site", () => {
      expect(directivesSource).toMatch(
        /<RowDeleteButton\s+onClick=\{\(\)\s*=>\s*onDelete\(d\.id\)\s*\}\s*\/>/,
      );
    });

    it("does NOT contain an inline Edit `<button>` with `title=\"Edit\"` (pre-extraction form is gone)", () => {
      // Anti-migration: the inline form was a 7-line `<button>`
      // with `title="Edit"` and a `<Pencil>` icon child. The
      // post-extraction form is a single `<RowEditButton />`
      // tag. If a future PR re-inlines the Edit button, this
      // test catches it.
      // The string we grep for is the unique-by-Edit-button
      // substring that ONLY appears in the inline form.
      const inlineEditPattern =
        /<button\s+[^>]*onClick=\{\(\)\s*=>\s*onEdit\(d\)\s*\}[^>]*title="Edit"/;
      expect(directivesSource).not.toMatch(inlineEditPattern);
    });

    it("does NOT contain an inline Delete `<button>` with `title=\"Delete\"` (pre-extraction form is gone)", () => {
      const inlineDeletePattern =
        /<button\s+[^>]*onClick=\{\(\)\s*=>\s*onDelete\(d\.id\)\s*\}[^>]*title="Delete"/;
      expect(directivesSource).not.toMatch(inlineDeletePattern);
    });

    it("does NOT import `Pencil` or `Trash2` from `lucide-react` (icons moved to the shared component)", () => {
      // The pre-extraction import was
      //   import { FileText, Plus, Pencil, ToggleRight, ToggleLeft, Trash2, RefreshCw } from "lucide-react";
      // The post-extraction import is
      //   import { FileText, Plus, ToggleRight, ToggleLeft, RefreshCw } from "lucide-react";
      // (Pencil and Trash2 removed — they live in RowActionButtons now.)
      // We grep the lucide-react import line for Pencil/Trash2
      // specifically.
      const lucideImportMatch = directivesSource.match(
        /import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/,
      );
      expect(lucideImportMatch).not.toBeNull();
      const lucideNames = lucideImportMatch?.[1] ?? "";
      expect(lucideNames).not.toMatch(/\bPencil\b/);
      expect(lucideNames).not.toMatch(/\bTrash2\b/);
    });

    it("middle Toggle button stays inline (anti-migration guard: different shape, not a duplicate)", () => {
      // The Toggle button has its own icon (ToggleRight/ToggleLeft),
      // its own title ("Deactivate" / "Activate"), and its own
      // onClick signature (`onToggle(d)`). It should NOT be
      // migrated to a shared component. The pattern we lock is
      // the inline `<button>` with the per-row Toggle onClick
      // + a JSX-expression `title` (the conditional
      // `d.is_active ? "Deactivate" : "Activate"`). The title
      // attribute is a JSX expression, not a string literal, so
      // the regex allows `title={...}` in addition to
      // `title="..."`.
      const toggleButtonPattern =
        /<button\s+[^>]*onClick=\{\(\)\s*=>\s*onToggle\(d\)\s*\}[^>]*title=\{d\.is_active\s*\?\s*["']Deactivate["']\s*:\s*["']Activate["']\s*\}/;
      expect(directivesSource).toMatch(toggleButtonPattern);
    });
  });

  describe("MentalModelsTab.tsx — imports the shared components and uses them at both sites", () => {
    it("imports both RowEditButton and RowDeleteButton from ./RowActionButtons", () => {
      expect(mentalModelsSource).toMatch(
        /import\s*\{\s*RowEditButton\s*,\s*RowDeleteButton\s*\}\s*from\s*["']\.\/RowActionButtons["']/,
      );
    });

    it("uses `<RowEditButton onClick={() => onEdit(m)} />` at the per-row Edit site", () => {
      expect(mentalModelsSource).toMatch(
        /<RowEditButton\s+onClick=\{\(\)\s*=>\s*onEdit\(m\)\s*\}\s*\/>/,
      );
    });

    it("uses `<RowDeleteButton onClick={() => onDelete(m.id)} />` at the per-row Delete site", () => {
      expect(mentalModelsSource).toMatch(
        /<RowDeleteButton\s+onClick=\{\(\)\s*=>\s*onDelete\(m\.id\)\s*\}\s*\/>/,
      );
    });

    it("does NOT contain an inline Edit `<button>` with `title=\"Edit\"` (pre-extraction form is gone)", () => {
      const inlineEditPattern =
        /<button\s+[^>]*onClick=\{\(\)\s*=>\s*onEdit\(m\)\s*\}[^>]*title="Edit"/;
      expect(mentalModelsSource).not.toMatch(inlineEditPattern);
    });

    it("does NOT contain an inline Delete `<button>` with `title=\"Delete\"` (pre-extraction form is gone)", () => {
      const inlineDeletePattern =
        /<button\s+[^>]*onClick=\{\(\)\s*=>\s*onDelete\(m\.id\)\s*\}[^>]*title="Delete"/;
      expect(mentalModelsSource).not.toMatch(inlineDeletePattern);
    });

    it("does NOT import `Pencil` or `Trash2` from `lucide-react` (icons moved to the shared component)", () => {
      const lucideImportMatch = mentalModelsSource.match(
        /import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/,
      );
      expect(lucideImportMatch).not.toBeNull();
      const lucideNames = lucideImportMatch?.[1] ?? "";
      expect(lucideNames).not.toMatch(/\bPencil\b/);
      expect(lucideNames).not.toMatch(/\bTrash2\b/);
    });

    it("middle Refresh button stays inline (anti-migration guard: different shape, not a duplicate)", () => {
      // The Refresh button has the `Zap` icon, the
      // `disabled={refreshingModelId === m.id}` lifecycle, the
      // `animate-pulse` class, and the `onRefreshModel(m.id)`
      // onClick. It should NOT be migrated to a shared
      // component. Lock the inline `<button>` with the Refresh
      // onClick + title.
      const refreshButtonPattern =
        /<button\s+[^>]*onClick=\{\(\)\s*=>\s*onRefreshModel\(m\.id\)\s*\}[^>]*title="Refresh \(re-run reflect\)"/;
      expect(mentalModelsSource).toMatch(refreshButtonPattern);
    });
  });
});

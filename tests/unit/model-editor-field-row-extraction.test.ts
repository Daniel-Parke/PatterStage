/** @jest-environment jsdom */

// Source-pattern test for the session 217 (List 4) `FieldRow` component
// extraction from `src/components/models/ModelEditor.tsx`. Pins the
// post-extraction shape:
//
// 1. NEW file `src/components/models/FieldRow.tsx` exists with the
//    canonical `({ label, children, description? })` prop signature
//    and the canonical JSX shell (space-y-1.5 wrapper + label class
//    + optional description paragraph).
// 2. ModelEditor imports `FieldRow` from `@/components/models/FieldRow`.
// 3. All 7 inline `<div className="space-y-1.5">...</div>` wrappers
//    in ModelEditor are GONE — replaced by 7 `<FieldRow ...>` bindings.
// 4. All 7 inline `<label className="text-sm font-medium text-white/70">`
//    bindings in ModelEditor are GONE — moved into the FieldRow component.
// 5. All 3 inline `<p className="text-xs text-white/30 font-mono">`
//    description paragraphs in ModelEditor are GONE — moved into the
//    FieldRow `description` prop.
// 6. The error banner and "New credential" panel header stay inline
//    (anti-migration guards: different visual shape).
// 7. The two-row `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">`
//    layout wrappers stay inline (FieldRow is a single-column wrapper).
//
// Anti-migration guards:
//   - The error banner at the top of the modal (icon + colored
//     container) is a different visual shape — stays inline.
//   - The "New credential" uppercase tracking-widest caption is a
//     different visual shape — stays inline.
//   - The grid layout wrappers (`grid-cols-1 sm:grid-cols-2 gap-4`)
//     are LAYOUT, not single-field wrappers — stay inline.
//   - The Provider `<select>` retains its `${inputFieldClasses("purple")}
//     appearance-none cursor-pointer` composition at the call site
//     (the `appearance-none cursor-pointer` is variant-specific).

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const EDITOR_PATH = join(
  process.cwd(),
  "src/components/models/ModelEditor.tsx",
);
const COMPONENT_PATH = join(
  process.cwd(),
  "src/components/models/FieldRow.tsx",
);

function readSource(path: string): string {
  return readFileSync(path, "utf-8");
}

describe("FieldRow component extraction (List 4 session 217)", () => {
  describe("new component file", () => {
    it("exists at src/components/models/FieldRow.tsx", () => {
      expect(existsSync(COMPONENT_PATH)).toBe(true);
    });

    it("imports ReactNode type from 'react'", () => {
      const source = readSource(COMPONENT_PATH);
      expect(source).toMatch(
        /import\s+type\s*\{\s*ReactNode\s*\}\s+from\s+["']react["']/,
      );
    });

    it("exports a default function with the canonical (label, children, description?) prop signature", () => {
      const source = readSource(COMPONENT_PATH);
      // Allow optional trailing comma after `description` (ESLint default
      // comma-dangle: "always-multiline" requires it; the canonical
      // destructuring writes description, \n }: FieldRowProps).
      expect(source).toMatch(
        /export\s+default\s+function\s+FieldRow\s*\(\s*\{\s*label\s*,\s*children\s*,\s*description\s*,?\s*\}\s*:\s*FieldRowProps\s*\)/,
      );
    });

    it("renders the canonical space-y-1.5 wrapper with the label className", () => {
      const source = readSource(COMPONENT_PATH);
      expect(source).toMatch(/<div\s+className=["']space-y-1\.5["']>/);
      expect(source).toMatch(
        /<label\s+className=["']text-sm font-medium text-white\/70["']>/,
      );
    });

    it("renders the optional description paragraph with the canonical mono caption className", () => {
      const source = readSource(COMPONENT_PATH);
      // Match the description block: `{description && (<p className=...>...</p>)}`
      expect(source).toMatch(
        /\{description\s*&&\s*\(\s*<p\s+className=["']text-xs text-white\/30 font-mono["']>/,
      );
    });
  });

  describe("ModelEditor migration", () => {
    it("imports the new FieldRow component", () => {
      const source = readSource(EDITOR_PATH);
      expect(source).toMatch(
        /import\s+FieldRow\s+from\s+["']@\/components\/models\/FieldRow["']/,
      );
    });

    it("has no inline `space-y-1.5` label wrappers (all 7 sites migrated)", () => {
      const source = readSource(EDITOR_PATH);
      // Pre-session: 7 `<div className="space-y-1.5">` wrappers
      // (Name, Provider, Model ID, Base URL, Context Length,
      // Credential Label, API Key).
      // Post-session: 0.
      const matches = source.match(/<div\s+className=["']space-y-1\.5["']>/g);
      expect(matches).toBeNull();
    });

    it("has no inline `text-sm font-medium text-white/70` label bindings (all 7 sites migrated)", () => {
      const source = readSource(EDITOR_PATH);
      // Pre-session: 7 inline labels (one per field).
      // Post-session: 0 (the label is owned by FieldRow).
      const matches = source.match(
        /<label\s+className=["']text-sm font-medium text-white\/70["']>/g,
      );
      expect(matches).toBeNull();
    });

    it("has no inline `text-xs text-white/30 font-mono` description paragraphs (all 3 descriptions migrated)", () => {
      const source = readSource(EDITOR_PATH);
      // Pre-session: 3 description paragraphs (Name, API Key, plus
      // 2 inline-marker `<span>`s that share the class).
      // Post-session: the 3 paragraph-level descriptions are gone
      // (they become `description=` props). The 2 inline-marker
      // `<span>`s on Base URL + Context Length labels RETAIN the
      // className (they're now passed via FieldRow's `label: ReactNode`
      // prop as JSX fragments).
      const paragraphMatches = source.match(
        /<p\s+className=["']text-xs text-white\/30 font-mono["']>/g,
      );
      expect(paragraphMatches).toBeNull();
    });

    it("renders 7 `<FieldRow>` bindings (one per migrated form field)", () => {
      const source = readSource(EDITOR_PATH);
      // Pre-session: 0. Post-session: 7 (Name, Provider, Model ID,
      // Base URL, Context Length, Credential Label, API Key).
      const openTags = source.match(/<FieldRow\b/g);
      const closeTags = source.match(/<\/FieldRow>/g);
      expect(openTags).not.toBeNull();
      expect(closeTags).not.toBeNull();
      expect(openTags!.length).toBe(7);
      expect(closeTags!.length).toBe(7);
    });

    it("preserves the Provider `<select>`'s `appearance-none cursor-pointer` at the call site (variant-specific, not moved into FieldRow)", () => {
      const source = readSource(EDITOR_PATH);
      // The Provider select still composes `appearance-none cursor-pointer`
      // onto `inputFieldClasses("purple")` at the call site. This is
      // variant-specific styling that does NOT belong in the wrapper.
      expect(source).toMatch(
        /\$\{inputFieldClasses\(["']purple["']\)\}\s+appearance-none cursor-pointer/,
      );
    });

    it("preserves the two-row grid layout wrappers (FieldRow is a single-column wrapper)", () => {
      const source = readSource(EDITOR_PATH);
      // The `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">`
      // wrappers around the Provider/Model ID pair and the Base URL/
      // Context Length pair stay inline — FieldRow is a single-field
      // wrapper, not a multi-column layout.
      const gridMatches = source.match(
        /<div\s+className=["']grid grid-cols-1 sm:grid-cols-2 gap-4["']>/g,
      );
      expect(gridMatches).not.toBeNull();
      expect(gridMatches!.length).toBe(2);
    });

    it("preserves the error banner inline (different visual shape: icon + colored container)", () => {
      const source = readSource(EDITOR_PATH);
      // The error banner at the top of the modal is a different
      // visual shape (red icon + bg-red-500/10 + border + px-3 py-2)
      // and stays inline.
      expect(source).toMatch(/role=["']alert["']/);
      expect(source).toMatch(
        /<AlertCircle\s+className=["']w-4 h-4 flex-shrink-0["']\s*\/>/,
      );
    });

    it("preserves the 'New credential' uppercase tracking-widest caption inline (different visual shape)", () => {
      const source = readSource(EDITOR_PATH);
      // The "New credential" panel header is a different visual
      // shape (uppercase + tracking-widest + neon-purple tint) and
      // stays inline.
      expect(source).toMatch(
        /uppercase\s+tracking-widest/,
      );
    });
  });
});

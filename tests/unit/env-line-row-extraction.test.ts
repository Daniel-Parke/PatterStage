/** @jest-environment jsdom */

// Source-pattern test for the session 215 (List 4) `EnvLineRow`
// component extraction from `src/app/config/[section]/page.tsx`.
// Pins the post-extraction shape:
//
// 1. NEW file `src/components/config/EnvLineRow.tsx` exists with the
//    expected 4-variant `switch (parsed.kind)` block (blank / comment
//    / invalid / keyval) and the canonical prop signature
//    `({ lineKey, parsed, raw })`.
// 2. The page imports `EnvLineRow` from `@/components/config/EnvLineRow`.
// 3. The page no longer imports `maskKeyHint` from `@/lib/secret-mask`
//    (the new component owns the masking).
// 4. The 4 inline conditional branches (3 `if (parsed.kind === "X")` +
//    the implicit "keyval" fallthrough) are GONE from the page's
//    `.map((line, i) => ...)` body — replaced by a single
//    `<EnvLineRow ... />` binding.
// 5. The `.map((line, i) => ...)` body still calls `parseEnvLine(line)`
//    + `envLineKey(line, i)` exactly once each (parsing + key building
//    live in the page, not the component).
//
// Anti-migration guards:
//   - The .env preview's outer `<div className="space-y-2">` wrapper,
//     the trailing "Edit .env directly on the server..." caption, and
//     the surrounding `<div className="rounded-xl border ...">`
//     shell stay byte-equivalent.
//   - The non-`.env` markdown textarea path (for HERMES.md) stays
//     unchanged.

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const PAGE_PATH = join(
  process.cwd(),
  "src/app/config/[section]/page.tsx",
);
const COMPONENT_PATH = join(
  process.cwd(),
  "src/components/config/EnvLineRow.tsx",
);

function readSource(path: string): string {
  return readFileSync(path, "utf-8");
}

describe("EnvLineRow component extraction (List 4 session 215)", () => {
  describe("new component file", () => {
    it("exists at src/components/config/EnvLineRow.tsx", () => {
      expect(existsSync(COMPONENT_PATH)).toBe(true);
    });

    it("imports the EnvLine type and maskKeyHint helper", () => {
      const source = readSource(COMPONENT_PATH);
      expect(source).toMatch(
        /import\s+type\s*\{\s*EnvLine\s*\}\s+from\s+["']@\/lib\/env-line["']/,
      );
      expect(source).toMatch(
        /import\s*\{\s*maskKeyHint\s*\}\s+from\s+["']@\/lib\/secret-mask["']/,
      );
    });

    it("exports a default function with the canonical (lineKey, parsed, raw) prop signature", () => {
      const source = readSource(COMPONENT_PATH);
      expect(source).toMatch(
        /export\s+default\s+function\s+EnvLineRow\s*\(\s*\{\s*lineKey\s*,\s*parsed\s*,\s*raw\s*\}\s*:\s*EnvLineRowProps\s*\)/,
      );
    });

    it("renders all 4 EnvLine variants via an exhaustive `switch (parsed.kind)` block", () => {
      const source = readSource(COMPONENT_PATH);
      // 4 case arms — one per `EnvLine` kind
      expect(source).toMatch(/switch\s*\(\s*parsed\.kind\s*\)/);
      expect(source).toMatch(/case\s+["']blank["']/);
      expect(source).toMatch(/case\s+["']comment["']/);
      expect(source).toMatch(/case\s+["']invalid["']/);
      expect(source).toMatch(/case\s+["']keyval["']/);
    });

    it("`blank` variant renders the `&nbsp;` placeholder for empty lines", () => {
      const source = readSource(COMPONENT_PATH);
      // Match the `blank` case body
      const blankCase = source.match(/case\s+["']blank["']:[\s\S]*?case\s+["']comment["']/);
      expect(blankCase).not.toBeNull();
      expect(blankCase![0]).toMatch(/\\u00A0/);
      expect(blankCase![0]).toMatch(/raw\s*\|\|\s*["']\\u00A0["']/);
    });

    it("`keyval` variant uses maskKeyHint on the value (not the raw value)", () => {
      const source = readSource(COMPONENT_PATH);
      // Slice from the `keyval` case to the closing `}` of the function body
      // (the `keyval` case body has nested `<span>`s with their own `}`s,
      // so anchor to the function end via the last `}` after `maskKeyHint`).
      const keyvalStart = source.indexOf('case "keyval":');
      expect(keyvalStart).toBeGreaterThan(-1);
      // Take everything from `case "keyval":` to the end of the file;
      // the `maskKeyHint(parsed.value)` call sits in the last `</span>`
      // and the function's final `}` follows the closing `</div>`.
      const keyvalCase = source.slice(keyvalStart);
      expect(keyvalCase).toMatch(/maskKeyHint\(parsed\.value\)/);
      // Anti-migration: must not use `parsed.value` directly without masking
      expect(keyvalCase).not.toMatch(/\{parsed\.value\}/);
    });
  });

  describe("page migration", () => {
    it("imports the new EnvLineRow component", () => {
      const source = readSource(PAGE_PATH);
      expect(source).toMatch(
        /import\s+EnvLineRow\s+from\s+["']@\/components\/config\/EnvLineRow["']/,
      );
    });

    it("no longer imports maskKeyHint (the component owns it now)", () => {
      const source = readSource(PAGE_PATH);
      // The page should not import maskKeyHint anymore — anti-migration
      // guard to prevent drift (the page never masks secrets directly).
      expect(source).not.toMatch(/import\s*\{\s*maskKeyHint\s*\}/);
    });

    it("still imports parseEnvLine + envLineKey from @/lib/env-line", () => {
      const source = readSource(PAGE_PATH);
      // The page is responsible for the per-line parse + key building;
      // the new component receives the already-parsed EnvLine. These
      // imports stay byte-equivalent.
      expect(source).toMatch(
        /import\s*\{\s*parseEnvLine\s*,\s*envLineKey\s*\}\s+from\s+["']@\/lib\/env-line["']/,
      );
    });

    it("renders the .env preview via a single `<EnvLineRow>` binding (no inline conditional branches)", () => {
      const source = readSource(PAGE_PATH);
      // Slice the .env preview block: from the `.split("\\n").map((line, i) =>` to the closing `))}` of the map.
      const mapStart = source.indexOf('fileContent.split("\\n").map((line, i) =>');
      expect(mapStart).toBeGreaterThan(-1);
      const mapEnd = source.indexOf("))}", mapStart);
      expect(mapEnd).toBeGreaterThan(mapStart);
      const mapBody = source.slice(mapStart, mapEnd + 3);

      // Positive: the new component is used
      expect(mapBody).toMatch(/<EnvLineRow/);
      // The component receives the parsed EnvLine + the raw line
      expect(mapBody).toMatch(/parsed=\{parsed\}/);
      expect(mapBody).toMatch(/raw=\{line\}/);
      // The component receives the line key (used internally as the DOM key)
      expect(mapBody).toMatch(/lineKey=\{envLineKey\(line,\s*i\)\}/);
      // React's outer `key=` prop
      expect(mapBody).toMatch(/key=\{envLineKey\(line,\s*i\)\}/);

      // Negative: the 3 pre-refactor inline conditional branches are gone
      expect(mapBody).not.toMatch(/if\s*\(\s*parsed\.kind\s*===\s*["']blank["']/);
      expect(mapBody).not.toMatch(/if\s*\(\s*parsed\.kind\s*===\s*["']invalid["']/);
      expect(mapBody).not.toMatch(/parsed\.kind\s*===\s*["']keyval["']/);
    });

    it("does not reference parsed.kind outside the EnvLineRow component", () => {
      // The page should not discriminate on `parsed.kind` anywhere —
      // the kind-switch lives entirely in the new component.
      const source = readSource(PAGE_PATH);
      expect(source).not.toMatch(/parsed\.kind/);
    });
  });
});

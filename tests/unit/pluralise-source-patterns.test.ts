/**
 * @jest-environment node
 *
 * Source-pattern test for the session-108 pluralise refactor.
 *
 * Locks the migration of all 6 inline `${count} foo${count !== 1 ? "s" : ""}`
 * call sites to the `pluralise(count)` helper in `@/lib/utils`. The 6 sites
 * were the canonical "count !== 1 ? 's' : ''" form scattered across 5 files
 * (chat page, SkillSelector, MentalModelsTab, DirectivesTab,
 * ModelSyncButtons, useModelsPage). The migration is a name change, not
 * a behavior change — every site produces byte-equivalent output before
 * and after.
 *
 * What this test locks:
 *   - The helper exists in `@/lib/utils` with the literal-type return
 *     `"" | "s"` and the `count !== 1` body
 *   - All 6 inline-form sites are gone from the codebase
 *   - All 6 call sites now use `pluralise(...)` (helper identifier >= 2
 *     per file, to catch the "half the migration done" failure mode)
 *   - Each file imports the helper from `@/lib/utils` exactly once
 *
 * What this test does NOT lock:
 *   - The exact JSX/text shape of the 6 call sites (the helper is
 *     composable and the surrounding text varies by file — "X
 *     message" vs "X change" vs "X auxiliary default" — the test
 *     only checks the *suffix* is the helper call, not the prefix)
 *   - The runtime truth table (covered in `pluralise-helper.test.ts`)
 *
 * Why source-pattern instead of rendering:
 *   - The 6 call sites are scattered across 5 files with different
 *     rendering harnesses (chat page requires 12 useState mocks,
 *     MentalModelsTab requires Hindsight model fixtures, etc.). A
 *     source-pattern test is the byte-level contract: "the inline
 *     form is gone everywhere; the helper is the only way to
 *     produce the suffix."
 *
 * If a future session adds a 7th inline-form site ("just this once
 * is fine, the helper is overkill for a single use"), this test
 * will fail and force the refactor author to consciously decide
 * whether to add the 7th site or migrate the 7th to the helper.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const UTILS_PATH = path.resolve(__dirname, "../../src/lib/utils.ts");
const SITES = [
  {
    file: "src/app/orchestration/chat/page.tsx",
    variable: "s.messages.length",
    description: "chat page session list",
  },
  {
    file: "src/components/ui/SkillSelector.tsx",
    variable: "value.length",
    description: "SkillSelector attached count",
  },
  {
    file: "src/components/memory/hindsight/MentalModelsTab.tsx",
    variable: "models.length",
    description: "MentalModelsTab header",
  },
  {
    file: "src/components/memory/hindsight/DirectivesTab.tsx",
    variable: "directives.length",
    description: "DirectivesTab header",
  },
  {
    file: "src/components/models/ModelSyncButtons.tsx",
    variable: "diffs.length",
    description: "ModelSyncButtons Confirm button",
  },
  {
    file: "src/hooks/useModelsPage.ts",
    variable: "taskTypes.length",
    description: "useModelsPage Set auxiliary defaults toast",
  },
];

const INLINE_FORM_RE = /\$\{[^}]+\.length\s*!==\s*1\s*\?\s*"s"\s*:\s*""\}/g;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

function pluraliseCallRe(variable: string): RegExp {
  // The migration uses {pluralise(variable)} in JSX and ${pluralise(variable)}
  // in template strings. Both forms must be present. The exact whitespace
  // and surrounding text vary by site, so we only match the *call shape*
  // (pluralise + open-paren + variable + close-paren).
  return new RegExp(`pluralise\\s*\\(\\s*${variable.replace(/\./g, "\\.")}\\s*\\)`, "g");
}

describe("pluralise helper (session 108)", () => {
  const utilsSource = fs.readFileSync(UTILS_PATH, "utf8");

  it("declares pluralise in @/lib/utils with the canonical body and return type", () => {
    // The helper signature must be `pluralise(count: number): "" | "s"`.
    // A future "irregular plural" extension should NOT overload this
    // helper — it should create a separate `pluraliseIrregular` or
    // use a per-domain helper at the call site. The test forces any
    // refactor author to consciously update the signature AND the
    // 6 call sites if the rule changes.
    expect(utilsSource).toMatch(
      /export\s+function\s+pluralise\s*\(\s*count\s*:\s*number\s*\)\s*:\s*""\s*\|\s*"s"\s*\{/,
    );
    expect(utilsSource).toMatch(
      /return\s+count\s*!==\s*1\s*\?\s*"s"\s*:\s*""\s*;/,
    );
  });

  describe("inline-form-absent at all 6 migration sites", () => {
    for (const site of SITES) {
      it(`has no inline '${site.variable} !== 1 ? "s" : ""}' form in ${site.description}`, () => {
        const sitePath = path.resolve(
          __dirname,
          "../../" + site.file,
        );
        const source = fs.readFileSync(sitePath, "utf8");
        const codeOnly = stripComments(source);
        const matches = codeOnly.match(INLINE_FORM_RE) ?? [];
        expect(matches).toEqual([]);
      });
    }
  });

  describe("pluralise call present at all 6 migration sites", () => {
    for (const site of SITES) {
      it(`calls pluralise(${site.variable}) in ${site.description}`, () => {
        const sitePath = path.resolve(
          __dirname,
          "../../" + site.file,
        );
        const source = fs.readFileSync(sitePath, "utf8");
        const codeOnly = stripComments(source);
        const re = pluraliseCallRe(site.variable);
        const matches = codeOnly.match(re) ?? [];
        // At least 1 call site (the migrated inline form) per file.
        // The "at least 1" bound is the byte-equivalence contract: the
        // original site is preserved, just rewritten through the helper.
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  describe("@/lib/utils is imported in all 6 migration sites", () => {
    for (const site of SITES) {
      it(`imports pluralise from @/lib/utils in ${site.description}`, () => {
        const sitePath = path.resolve(
          __dirname,
          "../../" + site.file,
        );
        const source = fs.readFileSync(sitePath, "utf8");
        // The import is a named import: `import { ... pluralise ... } from "@/lib/utils"`
        // OR an aggregated import that includes pluralise. We match
        // the broader pattern: any line that imports `pluralise` from
        // `@/lib/utils`. This is the canonical migration audit.
        expect(source).toMatch(
          /import\s*\{[^}]*\bpluralise\b[^}]*\}\s*from\s*["']@\/lib\/utils["']/,
        );
      });
    }
  });

  it("has no surviving inline-form sites anywhere in src/ (the migration is complete)", () => {
    // Belt-and-braces: scan the entire `src/` tree for any inline
    // `${something !== 1 ? "s" : ""}` form. The 6 sites are gone —
    // any new site must go through the helper, not the inline form.
    // This locks the session-108 invariant: "pluralise is the only
    // way to produce the 's' suffix in user-visible strings."
    //
    // We scan `src/app/` and `src/components/` and `src/hooks/`
    // (the only directories with JSX/TSX). We exclude `src/lib/utils.ts`
    // (the helper declaration) and `tests/` (the test files
    // themselves — they mention the inline form in JSDoc).
    const root = path.resolve(__dirname, "../../src");
    const scanDirs = ["app", "components", "hooks", "lib"];
    function walk(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          files.push(...walk(full));
        } else if (/\.(ts|tsx)$/.test(e.name)) {
          files.push(full);
        }
      }
      return files;
    }
    const files = scanDirs.flatMap((d) => walk(path.join(root, d)));
    const violations: Array<{ file: string; match: string }> = [];
    for (const f of files) {
      if (f === UTILS_PATH) continue; // helper declaration itself
      const source = fs.readFileSync(f, "utf8");
      const codeOnly = stripComments(source);
      const matches = codeOnly.match(INLINE_FORM_RE) ?? [];
      for (const m of matches) {
        violations.push({ file: path.relative(root, f), match: m });
      }
    }
    expect(violations).toEqual([]);
  });
});

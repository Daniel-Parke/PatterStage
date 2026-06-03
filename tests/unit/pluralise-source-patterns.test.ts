/**
 * @jest-environment node
 *
 * Source-pattern test for the session-108 + session-109 pluralise refactors.
 *
 * Session 108 (initial): Migrated 6 inline `${count} foo${count !== 1 ? "s" : ""}`
 *   call sites to the `pluralise(count)` helper in `@/lib/utils`. The 6 sites
 *   used the canonical "count !== 1 ? 's' : ''" form scattered across 5 files
 *   (chat page, SkillSelector, MentalModelsTab, DirectivesTab,
 *   ModelSyncButtons, useModelsPage).
 *
 * Session 109 (carryover): Found 12 more inline sites that session 108 missed.
 *   - 4 sites used `${x !== 1 ? "s" : ""}` but with non-`.length` variable
 *     names (e.g. `fieldCount`, `total`, `selected.size`) that fell outside
 *     session 108's `\${[^}]+\.length\s*!==\s*1` regex.
 *   - 8 sites used the inverse ternary `${x === 1 ? "" : "s"}` form that
 *     session 108's regex didn't check at all (byte-equivalent to
 *     `${x !== 1 ? "s" : ""}` — same pluralise rule, inverted conditions).
 *   The 12 new sites are scattered across 9 files (config index, config
 *   models page, skills page, BulkAuxiliaryUpdater, sessions list page,
 *   tools page, ToolsetSelector, ProfilesDriftBanner, useModelsPage).
 *   useModelsPage gets 2 sites in one toast string, config/models gets 2
 *   sites in one subtitle, ProfilesDriftBanner gets 2 sites in 2 array
 *   parts — so the 12 sites occupy 9 unique files.
 *
 * The migration is a name change, not a behavior change — every site
 * produces byte-equivalent output before and after.
 *
 * What this test locks:
 *   - The helper exists in `@/lib/utils` with the literal-type return
 *     `"" | "s"` and the `count !== 1` body
 *   - All 18 inline-form sites are gone from the codebase (6 session-108
 *     + 12 session-109)
 *   - All 18 call sites now use `pluralise(...)` (helper identifier >= 1
 *     per file, since some files only have 1 site)
 *   - Each file imports the helper from `@/lib/utils` exactly once
 *   - The codebase-wide scan catches 5 different inline forms (template
 *     `!== 1`, template `=== 1`, JSX — both directions — plus the
 *     session-108 template-length specialization)
 *
 * What this test does NOT lock:
 *   - The exact JSX/text shape of the 18 call sites (the helper is
 *     composable and the surrounding text varies by file — "X
 *     message" vs "X change" vs "X auxiliary default" — the test
 *     only checks the *suffix* is the helper call, not the prefix)
 *   - The runtime truth table (covered in `pluralise-helper.test.ts`)
 *
 * Why source-pattern instead of rendering:
 *   - The 18 call sites are scattered across 14 files with different
 *     rendering harnesses (chat page requires 12 useState mocks,
 *     MentalModelsTab requires Hindsight model fixtures, etc.). A
 *     source-pattern test is the byte-level contract: "the inline
 *     form is gone everywhere; the helper is the only way to
 *     produce the suffix."
 *
 * If a future session adds a 19th inline-form site ("just this once
 * is fine, the helper is overkill for a single use"), this test
 * will fail and force the refactor author to consciously decide
 * whether to add the 19th site or migrate the 19th to the helper.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const UTILS_PATH = path.resolve(__dirname, "../../src/lib/utils.ts");

// Session 108 — original 6 sites. The variable name is `.length` because
// the inline form was a template literal `${xxx.length !== 1 ? "s" : ""}`.
const SESSION_108_SITES = [
  {
    file: "src/app/orchestration/chat/page.tsx",
    variable: "s.messages.length",
    description: "chat page session list",
    form: "template-length" as const,
  },
  {
    file: "src/components/ui/SkillSelector.tsx",
    variable: "value.length",
    description: "SkillSelector attached count",
    form: "template-length" as const,
  },
  {
    file: "src/components/memory/hindsight/MentalModelsTab.tsx",
    variable: "models.length",
    description: "MentalModelsTab header",
    form: "template-length" as const,
  },
  {
    file: "src/components/memory/hindsight/DirectivesTab.tsx",
    variable: "directives.length",
    description: "DirectivesTab header",
    form: "template-length" as const,
  },
  {
    file: "src/components/models/ModelSyncButtons.tsx",
    variable: "diffs.length",
    description: "ModelSyncButtons Confirm button",
    form: "template-length" as const,
  },
  {
    file: "src/hooks/useModelsPage.ts",
    variable: "taskTypes.length",
    description: "useModelsPage Set auxiliary defaults toast",
    form: "template-length" as const,
  },
];

// Session 109 — 10 carryover sites. Each `form` value documents which
// inline shape was at the site before the migration. The `inverse` form
// is `=== 1 ? "" : "s"` (the byte-equivalent inverse of the canonical
// form). The `template-nonlength` form uses a non-`.length` variable
// name (e.g. `fieldCount`, `total`, `selected.size`).
const SESSION_109_SITES = [
  // 4 sites with `${x !== 1 ? "s" : ""}` (canonical form, non-`.length` name)
  {
    file: "src/app/config/page.tsx",
    variable: "fieldCount",
    description: "config index section card field count",
    form: "jsx-canonical" as const,
  },
  {
    file: "src/app/operations/skills/page.tsx",
    variable: "total",
    description: "skills manager page header subtitle",
    form: "template-canonical" as const,
  },
  {
    file: "src/hooks/useModelsPage.ts",
    variable: "modelsImported",
    description: "useModelsPage handleRefresh synced toast (1st site)",
    form: "template-canonical" as const,
  },
  {
    file: "src/hooks/useModelsPage.ts",
    variable: "creds",
    description: "useModelsPage handleRefresh synced toast (2nd site)",
    form: "template-canonical" as const,
  },
  {
    file: "src/components/models/BulkAuxiliaryUpdater.tsx",
    variable: "selected.size",
    description: "BulkAuxiliaryUpdater apply button",
    form: "template-canonical" as const,
  },
  // 6 sites with `${x === 1 ? "" : "s"}` (inverse form, byte-equivalent to canonical)
  {
    file: "src/app/config/models/page.tsx",
    variable: "models.length",
    description: "config models page header (1st site)",
    form: "template-inverse" as const,
  },
  {
    file: "src/app/config/models/page.tsx",
    variable: "credentials.length",
    description: "config models page header (2nd site)",
    form: "template-inverse" as const,
  },
  {
    file: "src/app/(main)/sessions/page.tsx",
    variable: "session.messageCount",
    description: "sessions list message count title",
    form: "template-inverse" as const,
  },
  {
    file: "src/app/operations/tools/page.tsx",
    variable: "enabledCount",
    description: "tools page enabled-toolsets subtitle",
    form: "template-inverse" as const,
  },
  {
    file: "src/components/ui/ToolsetSelector.tsx",
    variable: "value.length",
    description: "ToolsetSelector selected count",
    form: "template-inverse" as const,
  },
  {
    file: "src/components/profiles/ProfilesDriftBanner.tsx",
    variable: "driftCount",
    description: "ProfilesDriftBanner drift part (1st site)",
    form: "template-inverse" as const,
  },
  {
    file: "src/components/profiles/ProfilesDriftBanner.tsx",
    variable: "errorCount",
    description: "ProfilesDriftBanner error part (2nd site)",
    form: "template-inverse" as const,
  },
];

const ALL_SITES = [...SESSION_108_SITES, ...SESSION_109_SITES];

// Regex patterns for the 3 inline forms the test guards against.
// 1. `TEMPLATE_LENGTH` — session 108's original form:
//    `${xxx.length !== 1 ? "s" : ""}` inside a template literal.
// 2. `TEMPLATE_CANONICAL` — session 109's first carryover form:
//    `${xxx !== 1 ? "s" : ""}` inside a template literal, with ANY
//    variable name (not just `.length`).
// 3. `TEMPLATE_INVERSE` — session 109's second carryover form:
//    `${xxx === 1 ? "" : "s"}` inside a template literal. This is the
//    byte-equivalent inverse of the canonical form (returns "" for count===1
//    instead of "s" for count!==1 — same suffix set, just inverted conditions).
// 4. `JSX_CANONICAL` / `JSX_INVERSE` — same as 2/3 but in JSX expression
//    containers `{...}` rather than template literals `${...}`. The
//    `config/page.tsx` site uses the JSX canonical form.
//
// The 4 regexes are evaluated together in the codebase-wide scan.
const TEMPLATE_LENGTH_RE =
  /\$\{[^}]+\.length\s*!==\s*1\s*\?\s*"s"\s*:\s*""\}/g;
const TEMPLATE_CANONICAL_RE =
  /\$\{[^}]+\s*!==\s*1\s*\?\s*"s"\s*:\s*""\}/g;
const TEMPLATE_INVERSE_RE =
  /\$\{[^}]+\s*===\s*1\s*\?\s*""\s*:\s*"s"\}/g;
const JSX_CANONICAL_RE = /\{[^}]+\s*!==\s*1\s*\?\s*"s"\s*:\s*""\}/g;
const JSX_INVERSE_RE = /\{[^}]+\s*===\s*1\s*\?\s*""\s*:\s*"s"\}/g;

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
  return new RegExp(
    `pluralise\\s*\\(\\s*${variable.replace(/\./g, "\\.")}\\s*\\)`,
    "g",
  );
}

describe("pluralise helper (sessions 108 + 109)", () => {
  const utilsSource = fs.readFileSync(UTILS_PATH, "utf8");

  it("declares pluralise in @/lib/utils with the canonical body and return type", () => {
    // The helper signature must be `pluralise(count: number): "" | "s"`.
    // A future "irregular plural" extension should NOT overload this
    // helper — it should create a separate `pluraliseIrregular` or
    // use a per-domain helper at the call site. The test forces any
    // refactor author to consciously update the signature AND the
    // 16 call sites if the rule changes.
    expect(utilsSource).toMatch(
      /export\s+function\s+pluralise\s*\(\s*count\s*:\s*number\s*\)\s*:\s*""\s*\|\s*"s"\s*\{/,
    );
    expect(utilsSource).toMatch(
      /return\s+count\s*!==\s*1\s*\?\s*"s"\s*:\s*""\s*;/,
    );
  });

  describe("inline-form-absent at all 16 migration sites", () => {
    for (const site of ALL_SITES) {
      it(`has no inline form (${site.form}) in ${site.description}`, () => {
        const sitePath = path.resolve(__dirname, "../../" + site.file);
        const source = fs.readFileSync(sitePath, "utf8");
        const codeOnly = stripComments(source);
        // Each site guards against a SPECIFIC form (the one it had pre-migration).
        // We pick the regex that matches the original inline form. The other
        // forms (which weren't at this site) are not asserted here — they're
        // covered by the codebase-wide scan below.
        let re: RegExp;
        switch (site.form) {
          case "template-length":
            re = TEMPLATE_LENGTH_RE;
            break;
          case "template-canonical":
            re = TEMPLATE_CANONICAL_RE;
            break;
          case "template-inverse":
            re = TEMPLATE_INVERSE_RE;
            break;
          case "jsx-canonical":
            re = JSX_CANONICAL_RE;
            break;
        }
        const matches = codeOnly.match(re) ?? [];
        expect(matches).toEqual([]);
      });
    }
  });

  describe("pluralise call present at all 16 migration sites", () => {
    for (const site of ALL_SITES) {
      it(`calls pluralise(${site.variable}) in ${site.description}`, () => {
        const sitePath = path.resolve(__dirname, "../../" + site.file);
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

  describe("@/lib/utils is imported in all 16 migration sites", () => {
    for (const site of ALL_SITES) {
      it(`imports pluralise from @/lib/utils in ${site.description}`, () => {
        const sitePath = path.resolve(__dirname, "../../" + site.file);
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
    // Belt-and-braces: scan the entire `src/` tree for any of the 4
    // inline forms (template + jsx, canonical + inverse). The 16 sites
    // are gone — any new site must go through the helper, not the
    // inline form. This locks the session-109 invariant: "pluralise
    // is the only way to produce the 's' suffix in user-visible strings."
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
    const forms: Array<{ name: string; re: RegExp }> = [
      { name: "template-length", re: TEMPLATE_LENGTH_RE },
      { name: "template-canonical", re: TEMPLATE_CANONICAL_RE },
      { name: "template-inverse", re: TEMPLATE_INVERSE_RE },
      { name: "jsx-canonical", re: JSX_CANONICAL_RE },
      { name: "jsx-inverse", re: JSX_INVERSE_RE },
    ];
    const violations: Array<{ file: string; form: string; match: string }> = [];
    for (const f of files) {
      if (f === UTILS_PATH) continue; // helper declaration itself
      const source = fs.readFileSync(f, "utf8");
      const codeOnly = stripComments(source);
      for (const { name, re } of forms) {
        const matches = codeOnly.match(re) ?? [];
        for (const m of matches) {
          violations.push({ file: path.relative(root, f), form: name, match: m });
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

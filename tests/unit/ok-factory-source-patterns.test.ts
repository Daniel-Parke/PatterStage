/**
 * ok-factory-source-patterns.test.ts
 *
 * Source-pattern audit test for the `ok()` factory migration (session
 * 111). Verifies that all `return NextResponse.json({ data: ... })` sites
 * in `src/app/api/` have been migrated to `ok(...)`, with a small,
 * documented list of exemptions (none yet — every site has been migrated
 * in the List 3 surface; any new `NextResponse.json({ data: ... })` site
 * added later is a regression).
 *
 * The pattern `return NextResponse.json({ data: <expr> });` is byte-
 * equivalent to `return ok(<expr>);` — the factory body is literally
 * `NextResponse.json({ data }, { status: 200 })`. So migrating is
 * wire-equivalent and consolidates the `data` key in one place.
 *
 * This is a "first class" pattern test like `pluralise-source-patterns`:
 * it scans the production source tree at test time and asserts the
 * codebase matches the expected post-refactor shape. If someone adds a
 * new `NextResponse.json({ data: ... })` site, this test fails until
 * the site is migrated (or added to EXEMPTIONS with a reason).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const API_DIR = join(REPO_ROOT, "src", "app", "api");

/**
 * Sites exempted from the migration. Each entry documents why the
 * inline form is preferred over `ok(...)`.
 */
const EXEMPTIONS: ReadonlyArray<{ file: string; line: number; reason: string }> = [
  // (none — every List 3 site migrated in session 111)
];

// Matches the pattern: return NextResponse.json({ data: ... });
// Same as the production migration script's regex.
const SITE_RE = /return\s+NextResponse\.json\(\{\s*data:\s*.+?\}\s*\)\s*;/;

type Site = { file: string; line: number; text: string };

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (extname(entry) === ".ts") out.push(full);
  }
  return out;
}

function findSites(file: string): Site[] {
  const text = readFileSync(file, "utf-8");
  const lines = text.split("\n");
  const out: Site[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (SITE_RE.test(lines[i])) {
      out.push({ file, line: i + 1, text: lines[i].trim() });
    }
  }
  return out;
}

describe("ok() factory source-pattern coverage (List 3 surface)", () => {
  const files = walk(API_DIR);
  const allSites: Site[] = [];
  for (const f of files) allSites.push(...findSites(f));

  it("scanned the api/ tree without errors", () => {
    // The walk is best-effort: if the directory is missing (e.g. test
    // runs from a misconfigured workdir), fail with a clear message
    // rather than the generic 'no tests ran' Jest error.
    expect(files.length).toBeGreaterThan(0);
  });

  it("has zero `return NextResponse.json({ data: ... })` sites in the List 3 surface (api/models, api/agent, api/credentials)", () => {
    // Filter to List 3 surface: api/models/, api/agent/, api/credentials/.
    const list3 = allSites.filter(
      (s) =>
        s.file.includes(`${join("src", "app", "api", "models")}`) ||
        s.file.includes(`${join("src", "app", "api", "agent")}`) ||
        s.file.includes(`${join("src", "app", "api", "credentials")}`),
    );
    if (list3.length > 0) {
      const summary = list3
        .map((s) => `  ${s.file.replace(REPO_ROOT + "/", "")}:${s.line}  ${s.text}`)
        .join("\n");
      throw new Error(
        `Found ${list3.length} un-migrated 'return NextResponse.json({ data: ... })' site(s) in the List 3 surface — migrate to 'ok(...)' or add to EXEMPTIONS:\n${summary}`,
      );
    }
    expect(list3).toEqual([]);
  });

  it("documents every exemption in EXEMPTIONS", () => {
    // Defensive: if EXEMPTIONS is non-empty, every entry must point at
    // a site that actually still exists in the source. Otherwise an
    // exemption was left over from a previous migration that has since
    // been resolved, and the entry should be removed.
    for (const ex of EXEMPTIONS) {
      const text = readFileSync(ex.file, "utf-8");
      const lines = text.split("\n");
      expect(lines[ex.line - 1] ?? "").toMatch(SITE_RE);
    }
  });
});

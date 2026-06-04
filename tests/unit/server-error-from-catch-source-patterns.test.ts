/**
 * serverErrorFromCatch source-pattern coverage (List 1 surface)
 *
 * Source-pattern audit test for the `serverErrorFromCatch()` migration.
 * Verifies that all
 *
 *   } catch (error) {
 *     logApiError("GET /api/<route>", "<context>", error);
 *     return serverError("<static message>");
 *   }
 *
 * sites in the List 1 API surface have been migrated to
 * `serverErrorFromCatch("GET /api/<route>", "<context>", error, "<static message>")`.
 *
 * This is the sister test to `ok-factory-source-patterns.test.ts`. The
 * scanner uses a balanced-paren walker for `logApiError(...)` to handle
 * multi-arg calls and a regex for `return serverError(STATIC_LITERAL)` —
 * the canonical inline form is always a single-line static-literal call,
 * and the scanner intentionally does NOT match dynamic-message sites
 * (template literals, string concatenation, error.message propagation).
 * Those are exempt per the dynamic-message rule (see below) and are
 * NOT in scope for the `serverErrorFromCatch` migration.
 *
 * **Scope:** List 1 (api/sessions, api/memory, api/logs) + api/monitor.
 * The api/monitor route is on the same surface because it backs the
 * dashboard's inline monitor widget (per session 124 P-3's cross-list
 * `serverError(STATIC_LITERAL)` audit). The api/memory surface has zero
 * static-literal sites (all are dynamic-message and exempt). The
 *   `api/sessions/[id]/route.ts` originally had a 2-line `logApiError +
 *   return serverError(\`Failed to read session "${sanitizedId}"\`)` pair
 *   at line 255-256; the message is a template-literal-with-variable-
 *   interpolation, NOT a static-literal `serverError(STATIC)` form, so
 *   the scanner never matched it. The site was migrated to
 *   `serverErrorFromCatch(...)` in session 129 (the variable session ID
 *   stays in the message — only the composition is collapsed). The
 *   dynamic-message rule (session 98 P-4) still excludes template-
 *   literal messages from this scanner, so the migration is
 *   belt-and-suspenders rather than a scanner-enforced invariant.
 *
 * Session 125 history (the first session to add this test):
 *   - The List 1 surface had 5 static-literal `serverError(STATIC)`
 *     sites: 2 in `api/sessions/route.ts`, 2 in `api/logs/route.ts`,
 *     1 in `api/monitor/route.ts`. All 5 were migrated in this session.
 *   - This test pins the post-migration zero-tolerance rule. Any
 *     future static-literal site added to the List 1 surface will
 *     fail this test until it's migrated to `serverErrorFromCatch`.
 *
 * Session 127 history (List 3 surface added):
 *   - The List 3 surface had 6 static-literal `serverError(STATIC)`
 *     sites: 1 in `api/skills/route.ts`, 2 in
 *     `api/skills/[name]/route.ts`, 1 in
 *     `api/skills/[name]/toggle/route.ts`, 1 in
 *     `api/skills/[...path]/route.ts`, 1 in `api/tools/route.ts`.
 *     All 6 were migrated in this session.
 *   - A new `has zero … in the List 3 surface (api/skills, api/tools)`
 *     assertion was added. Future static-literal sites added to
 *     api/skills/* or api/tools/* will fail the test until migrated.
 *   - The `api/models/*` routes were already on `serverErrorFromCatch`
 *     from earlier sessions. `api/agent/files/[key]` was also already
 *     migrated. The `api/skills/[name]/route.ts:104` site uses a
 *     dynamic message (`push.error ?? "Push failed"`) and is exempt
 *     per the dynamic-message rule (the scanner never matches
 *     dynamic-message sites).
 */

import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join, extname } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const API_DIR = join(REPO_ROOT, "src", "app", "api");

/**
 * Files exempted from the migration. Each entry's path uses a
 * repo-relative path. The exemption is file-scoped (not line-scoped)
 * because the scanner only matches static-literal `serverError(...)`
 * calls — dynamic-message sites are never matched, so we don't need
 * to enumerate them here. If a future site in an EXEMPTIONS file
 * uses a static-literal message, that site would be a real candidate
 * and the test would fail.
 *
 * The exemption mechanism: every site the scanner finds in an
 * EXEMPTIONS file is filtered out before the zero-tolerance assertion.
 * This is the same shape as the `ok-factory-source-patterns.test.ts`
 * exemption filter, just keyed on file (not line) for simplicity.
 */
const EXEMPTIONS: ReadonlyArray<{ file: string; reason: string }> = [
  // No files currently exempt from the List 1 zero-tolerance rule.
  // All 5 static-literal sites in the List 1 surface were migrated
  // in session 125. Future sessions that add a static-literal site
  // to an EXEMPTIONS file must document the reason here.
];

/**
 * A site is the 2-line pattern:
 *
 *   } catch (<err>) {
 *     logApiError(<route>, <context>, <err>);
 *     return serverError(<static message>);
 *   }
 *
 * The scanner uses a balanced-paren walker for `logApiError(...)` to
 * handle multi-arg calls (e.g. `logApiError("GET /api/x", \`reading ${name}\`, error)`)
 * and a single-line regex for `return serverError(STATIC_LITERAL);` —
 * the canonical inline form is always a single-line static-literal
 * call. The scanner intentionally does NOT match dynamic-message
 * sites (template literals, string concatenation, error.message
 * propagation) — those are out of scope for the `serverErrorFromCatch`
 * migration per session 98 P-4 and session 124 P-3.
 */
type Site = { file: string; line: number; text: string };

function findSites(file: string): Site[] {
  const text = readFileSync(file, "utf-8");
  const out: Site[] = [];

  // Scan for `logApiError(...)` calls followed (within 2 lines) by
  // `return serverError(STATIC_LITERAL);`. The 2-line window matches
  // the canonical catch-block shape; longer windows would catch false
  // positives (e.g. logApiError in one catch block, serverError in
  // another).
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const logMatch = /^(\s*)logApiError\(/.exec(line);
    if (!logMatch) continue;
    // Walk the rest of the line + subsequent lines to find a balanced
    // `logApiError(...)` call. The walk uses paren counting to handle
    // multi-line args.
    const startPos = logMatch[0].length;
    let depth = 1;
    let endLine = i;
    for (let l = i; l < lines.length && depth > 0; l++) {
      const start = l === i ? startPos : 0;
      const rest = lines[l].slice(start);
      for (let c = 0; c < rest.length; c++) {
        if (rest[c] === "(") depth++;
        else if (rest[c] === ")") {
          depth--;
          if (depth === 0) {
            endLine = l;
            break;
          }
        }
      }
      if (depth === 0) break;
    }
    if (depth !== 0) continue; // unterminated — skip
    // Now look for `return serverError(STATIC_LITERAL);` within the
    // next 2 lines (endLine+1 or endLine+2). The inline form is the
    // canonical shape, so a 2-line window is enough.
    for (let j = endLine + 1; j <= Math.min(endLine + 2, lines.length - 1); j++) {
      const next = lines[j];
      const serverErrorMatch = /^(\s*)return\s+serverError\(\s*"([^"]+)"\s*\);?\s*$/.exec(next);
      if (serverErrorMatch) {
        out.push({
          file,
          line: j + 1, // 1-indexed for human consumption
          text: next.trim(),
        });
        break;
      }
    }
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (extname(entry) === ".ts") out.push(full);
  }
  return out;
}

describe("serverErrorFromCatch source-pattern coverage (List 1 + List 3 surfaces)", () => {
  const files = walk(API_DIR);
  const allSites: Site[] = [];
  for (const f of files) allSites.push(...findSites(f));

  it("scanned the api/ tree without errors", () => {
    // The walk is best-effort: if the directory is missing (e.g. test
    // runs from a misconfigured workdir), fail with a clear message
    // rather than the generic 'no tests ran' Jest error.
    expect(files.length).toBeGreaterThan(0);
  });

  it("has zero `logApiError + return serverError(STATIC)` sites in the List 1 surface (api/sessions, api/memory, api/logs, api/monitor)", () => {
    // Filter to List 1 surface. The List 1 surface backs the
    // Dashboard, Sessions, Memory, and Logs pages (per the
    // session-125 sweep). api/monitor is included because it backs
    // the dashboard's inline monitor widget. The api/memory surface
    // has zero static-literal sites (all are dynamic-message and
    // exempt). The api/sessions/[id]/route.ts dynamic-message site
    // is exempt per the dynamic-message rule.
    const list1 = allSites.filter(
      (s) =>
        s.file.includes(`${join("src", "app", "api", "sessions")}`) ||
        s.file.includes(`${join("src", "app", "api", "memory")}`) ||
        s.file.includes(`${join("src", "app", "api", "logs")}`) ||
        s.file.includes(`${join("src", "app", "api", "monitor")}`),
    );
    // EXEMPTIONS already enumerates the known exempt files in the
    // List 1 surface. Filter those out before asserting zero.
    // The `s.file` from the scanner is absolute; EXEMPTIONS uses
    // repo-relative paths, so we match on the suffix.
    const exemptedFiles = new Set(EXEMPTIONS.map((e) => e.file));
    const live = list1.filter((s) => !exemptedFiles.has(s.file.replace(REPO_ROOT + "/", "")));
    if (live.length > 0) {
      const summary = live
        .map((s) => `  ${s.file.replace(REPO_ROOT + "/", "")}:${s.line}  ${s.text}`)
        .join("\n");
      throw new Error(
        `Found ${live.length} un-migrated 'logApiError + return serverError(STATIC)' site(s) in the List 1 surface — migrate to 'serverErrorFromCatch(...)' or add to EXEMPTIONS:\n${summary}`,
      );
    }
    expect(live).toEqual([]);
  });

  it("has zero `logApiError + return serverError(STATIC)` sites in the List 3 surface (api/skills, api/tools)", () => {
    // Filter to List 3 surface. The List 3 surface backs the
    // Models, Agents, Skills, Tools, and Personalities pages (per the
    // session-127 sweep). api/skills and api/tools were the only
    // List 3 files with static-literal `serverError(STATIC)` sites
    // — 6 sites total: 1 in api/skills/route.ts, 2 in
    // api/skills/[name]/route.ts, 1 in api/skills/[name]/toggle/route.ts,
    // 1 in api/skills/[...path]/route.ts, 1 in api/tools/route.ts.
    // The api/skills/[name]/route.ts:104 site uses a dynamic message
    // (`push.error ?? "Push failed"`) and is exempt per the
    // dynamic-message rule. The api/models/* routes already use
    // `serverErrorFromCatch` (the helper was adopted during the
    // List 4 sweep). api/agent/files/[key] was also migrated in an
    // earlier session.
    const list3 = allSites.filter(
      (s) =>
        s.file.includes(`${join("src", "app", "api", "skills")}`) ||
        s.file.includes(`${join("src", "app", "api", "tools")}`),
    );
    // EXEMPTIONS already enumerates the known exempt files in the
    // List 3 surface. Filter those out before asserting zero.
    // The `s.file` from the scanner is absolute; EXEMPTIONS uses
    // repo-relative paths, so we match on the suffix.
    const exemptedFiles = new Set(EXEMPTIONS.map((e) => e.file));
    const live = list3.filter((s) => !exemptedFiles.has(s.file.replace(REPO_ROOT + "/", "")));
    if (live.length > 0) {
      const summary = live
        .map((s) => `  ${s.file.replace(REPO_ROOT + "/", "")}:${s.line}  ${s.text}`)
        .join("\n");
      throw new Error(
        `Found ${live.length} un-migrated 'logApiError + return serverError(STATIC)' site(s) in the List 3 surface — migrate to 'serverErrorFromCatch(...)' or add to EXEMPTIONS:\n${summary}`,
      );
    }
    expect(live).toEqual([]);
  });

  it("documents every exemption in EXEMPTIONS", () => {
    // Defensive: if EXEMPTIONS is non-empty, every entry's file must
    // still contain a `logApiError + return serverError(STATIC)` site
    // (i.e. a real candidate that the scanner matches). If the
    // exemption is stale (the site was migrated or removed), the
    // entry should be removed.
    // EXEMPTIONS uses repo-relative paths; resolve them against
    // REPO_ROOT so `findSites` (which expects absolute paths) can
    // read the file.
    for (const ex of EXEMPTIONS) {
      const absFile = join(REPO_ROOT, ex.file);
      const sites = findSites(absFile);
      if (sites.length === 0) {
        throw new Error(
          `Exemption stale: ${ex.file} no longer contains a 'logApiError + return serverError(STATIC)' site. Remove the entry.`,
        );
      }
    }
  });

  // ── Scanner self-tests ──────────────────────────────────────────
  // The scanner must correctly identify the 2-line catch-block pattern
  // and not match other shapes. If the scanner is later changed, these
  // tests catch regressions.
  describe("scanner form coverage", () => {
    function countSitesForFixture(fixture: string): number {
      // Write the fixture to a temp file and run the scanner on it.
      // The scanner reads files by path, so we need a real path.
      const tmpPath = join("/tmp", `scanner-fixture-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`);
      writeFileSync(tmpPath, fixture, "utf-8");
      try {
        return findSites(tmpPath).length;
      } finally {
        unlinkSync(tmpPath);
      }
    }

    it("catches the canonical 2-line catch-block (Form 1)", () => {
      const fixture = `
        import { logApiError } from "@/lib/api-logger";
        import { serverError } from "@/lib/api-response";
        export async function GET() {
          try {
            return new Response("ok");
          } catch (error) {
            logApiError("GET /api/x", "reading x", error);
            return serverError("Failed to read x");
          }
        }
      `;
      expect(countSitesForFixture(fixture)).toBe(1);
    });

    it("does NOT capture logApiError without a following serverError", () => {
      // A `logApiError` followed by a `return badRequest(...)` is
      // NOT a candidate for `serverErrorFromCatch` — the helper is
      // specifically the `logApiError + serverError` pair.
      const fixture = `
        import { logApiError } from "@/lib/api-logger";
        import { badRequest } from "@/lib/api-response";
        export async function GET() {
          try {
            return new Response("ok");
          } catch (error) {
            logApiError("GET /api/x", "reading x", error);
            return badRequest("invalid input");
          }
        }
      `;
      expect(countSitesForFixture(fixture)).toBe(0);
    });

    it("does NOT capture serverError without a preceding logApiError", () => {
      // A bare `return serverError(...)` without the `logApiError`
      // partner is a different shape — out of scope for the
      // `serverErrorFromCatch` migration.
      const fixture = `
        import { serverError } from "@/lib/api-response";
        export async function GET() {
          if (Math.random() < 0) {
            return serverError("Failed");
          }
          return new Response("ok");
        }
      `;
      expect(countSitesForFixture(fixture)).toBe(0);
    });

    it("does NOT capture dynamic-message serverError (template literal)", () => {
      // Dynamic messages are exempt per the dynamic-message rule.
      // The scanner's regex requires a static string literal, so
      // template literals are correctly skipped.
      const fixture = `
        import { logApiError } from "@/lib/api-logger";
        import { serverError } from "@/lib/api-response";
        export async function GET() {
          try {
            return new Response("ok");
          } catch (error) {
            logApiError("GET /api/x", "reading x", error);
            return serverError(\`Failed to read x: \${error.message}\`);
          }
        }
      `;
      expect(countSitesForFixture(fixture)).toBe(0);
    });
  });
});

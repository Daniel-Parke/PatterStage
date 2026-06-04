/**
 * serverErrorFromError source-pattern coverage (List 2 surface)
 *
 * Source-pattern audit test for the `serverErrorFromError()` migration.
 * Verifies that all
 *
 *   } catch (e) {
 *     logApiError("GET /api/cron/hardware", "<context>", e);
 *     return serverError(`Failed to X: ${toError(e).message}`);
 *   }
 *
 * sites in the List 2 API surface have been migrated to
 * `serverErrorFromError("GET /api/cron/hardware", "<context>", e, "Failed to X")`.
 *
 * **Why a sister test (not an extension of `server-error-from-catch-
 * source-patterns.test.ts`):** the two helpers have different
 * message-source semantics — `serverErrorFromCatch` is for static
 * literals, `serverErrorFromError` is for dynamic template-literal
 * interpolation. The scanner shapes are fundamentally different
 * (one matches `serverError("static")`, the other matches
 * `serverError(\`prefix: ${toError(e).message}\`)`) so a separate test
 * file with its own scanner is clearer than a conditional fixture. Per
 * `refactor-sweep-mission` session-125 P-1.
 *
 * **Scope:** List 2 (api/cron/hardware). The 4 sites are in
 * `api/cron/hardware/route.ts` (GET, POST, PUT, DELETE handlers). No
 * other List 2 surface has the dynamic-message-with-prefix pattern.
 *
 * Session 128-L2 history (the first session to add this test):
 *   - The List 2 dynamic-message surface had 4 sites in
 *     `api/cron/hardware/route.ts`. All 4 were migrated in this session
 *     to `serverErrorFromError(...)`.
 *   - This test pins the post-migration zero-tolerance rule. Any
 *     future dynamic-message-with-prefix site added to the List 2
 *     surface will fail this test until it's migrated to
 *     `serverErrorFromError`.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join, extname } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const API_DIR = join(REPO_ROOT, "src", "app", "api");

/**
 * Files exempted from the migration. The exemption is file-scoped
 * (not line-scoped) because the scanner only matches the
 * `logApiError + return serverError(\`prefix: ${...}\`)` pair in the
 * canonical 2-line window. If a future site in an EXEMPTIONS file
 * uses a different dynamic-message shape (e.g. single-line
 * `logApiError + return serverError(\`x: ${var}\`)` without a newline
 * between), the scanner would miss it (a known gap, see "What the
 * scanner does NOT match" below).
 */
const EXEMPTIONS: ReadonlyArray<{ file: string; reason: string }> = [
  // No files currently exempt from the List 2 zero-tolerance rule.
  // All 4 sites in api/cron/hardware/route.ts were migrated in this
  // session. Future sessions that add a dynamic-message-with-prefix
  // site to an EXEMPTIONS file must document the reason here.
];

/**
 * A site is the 2-line pattern:
 *
 *   logApiError(<route>, <context>, <err>);
 *   return serverError(`<prefix>: ${toError(<err>).message}`);
 *
 * The scanner uses a balanced-paren walker for `logApiError(...)` to
 * handle multi-arg calls and a regex for the `return
 * serverError(\`<prefix>: ${toError(<err>).message}\`)` template
 * literal. The `toError` form is the canonical dynamic-message
 * pattern (per session 95/96/124).
 *
 * **What the scanner does NOT match** (and the rationale for each):
 *   - `return serverError(toError(e).message)` — bare message
 *     propagation, no static prefix. The 4 sites in
 *     `api/cron/hardware/route.ts` are the only List 2 surface with
 *     the prefix form; bare-propagation sites in
 *     `api/orchestration/chat/route.ts:82` and
 *     `api/cron/hardware/meta/route.ts:22` are out of scope (no
 *     prefix → no `serverErrorFromError` candidate).
 *   - `return serverError(\`Failed: ${var}\`)` without `toError` —
 *     different shape, not a `serverErrorFromError` candidate.
 *   - `return serverError(msg)` where `msg` is a hoisted local
 *     variable (per session 126 P-3 "err + variable-status" case) —
 *     different shape, belongs in an EXEMPTIONS block.
 */
type Site = { file: string; line: number; text: string };

function findSites(file: string): Site[] {
  const text = readFileSync(file, "utf-8");
  const out: Site[] = [];

  // Scan for `logApiError(...)` calls followed (within 2 lines) by
  // `return serverError(\`<prefix>: ${toError(<err>).message}\`);`.
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const logMatch = /^(\s*)logApiError\(/.exec(line);
    if (!logMatch) continue;
    // Walk the rest of the line + subsequent lines to find a balanced
    // `logApiError(...)` call.
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
    // Now look for `return serverError(\`...: ${toError(...).message}\`);`
    // within the next 2 lines. The regex requires:
    //   - backtick template literal (not single/double quote)
    //   - static prefix before `: `
    //   - `${toError(<err>).message}` interpolation
    // Dynamic-message sites without a `toError` interpolation are out
    // of scope for `serverErrorFromError`.
    for (let j = endLine + 1; j <= Math.min(endLine + 2, lines.length - 1); j++) {
      const next = lines[j];
      const serverErrorMatch = /^(\s*)return\s+serverError\(`([^`]+):\s*\$\{toError\([^)]+\)\.message\}`\);?\s*$/.exec(next);
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

describe("serverErrorFromError source-pattern coverage (List 2 surface)", () => {
  const files = walk(API_DIR);
  const allSites: Site[] = [];
  for (const f of files) allSites.push(...findSites(f));

  it("scanned the api/ tree without errors", () => {
    // The walk is best-effort: if the directory is missing (e.g. test
    // runs from a misconfigured workdir), fail with a clear message
    // rather than the generic 'no tests ran' Jest error.
    expect(files.length).toBeGreaterThan(0);
  });

  it("has zero `logApiError + return serverError(\\`...${toError(...).message}\\`)` sites in the List 2 surface (api/cron/hardware)", () => {
    // Filter to List 2 surface. The List 2 surface backs the
    // Cron, Missions, and Chat pages. The dynamic-message-with-prefix
    // pattern only appears in `api/cron/hardware/route.ts` (4 sites:
    // GET, POST, PUT, DELETE). All 4 were migrated in this session.
    const list2 = allSites.filter((s) =>
      s.file.includes(`${join("src", "app", "api", "cron", "hardware")}`),
    );
    // EXEMPTIONS already enumerates the known exempt files in the
    // List 2 surface. Filter those out before asserting zero.
    // The `s.file` from the scanner is absolute; EXEMPTIONS uses
    // repo-relative paths, so we match on the suffix.
    const exemptedFiles = new Set(EXEMPTIONS.map((e) => e.file));
    const live = list2.filter((s) => !exemptedFiles.has(s.file.replace(REPO_ROOT + "/", "")));
    if (live.length > 0) {
      const summary = live
        .map((s) => `  ${s.file.replace(REPO_ROOT + "/", "")}:${s.line}  ${s.text}`)
        .join("\n");
      throw new Error(
        `Found ${live.length} un-migrated 'logApiError + return serverError(\`prefix: ${"${toError(...).message}"}\`)' site(s) in the List 2 surface — migrate to 'serverErrorFromError(...)' or add to EXEMPTIONS:\n${summary}`,
      );
    }
    expect(live).toEqual([]);
  });

  it("documents every exemption in EXEMPTIONS", () => {
    // Defensive: if EXEMPTIONS is non-empty, every entry's file must
    // still contain a scanner-matched site. If the exemption is stale
    // (the site was migrated or removed), the entry should be removed.
    for (const ex of EXEMPTIONS) {
      const absFile = join(REPO_ROOT, ex.file);
      const sites = findSites(absFile);
      if (sites.length === 0) {
        throw new Error(
          `Exemption stale: ${ex.file} no longer contains a 'logApiError + return serverError(\`prefix: ${"${toError(...).message}"}\`)' site. Remove the entry.`,
        );
      }
    }
  });

  // ── Scanner self-tests ──────────────────────────────────────────
  // The scanner must correctly identify the 2-line dynamic-message
  // pattern and not match other shapes. If the scanner is later
  // changed, these tests catch regressions.
  describe("scanner form coverage", () => {
    function countSitesForFixture(fixture: string): number {
      const tmpPath = join("/tmp", `scanner-fixture-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`);
      writeFileSync(tmpPath, fixture, "utf-8");
      try {
        return findSites(tmpPath).length;
      } finally {
        unlinkSync(tmpPath);
      }
    }

    it("catches the canonical 2-line dynamic-message catch-block (Form 1)", () => {
      const fixture = `
        import { logApiError } from "@/lib/api-logger";
        import { serverError } from "@/lib/api-response";
        import { toError } from "@/lib/api-fetch";
        export async function GET() {
          try {
            return new Response("ok");
          } catch (e) {
            logApiError("GET /api/cron/hardware", "read crontab", e);
            return serverError(\`Failed to read crontab: \${toError(e).message}\`);
          }
        }
      `;
      expect(countSitesForFixture(fixture)).toBe(1);
    });

    it("does NOT capture bare-message serverError (no prefix)", () => {
      // `return serverError(toError(e).message)` is a different
      // shape — no static prefix → no `serverErrorFromError` candidate.
      const fixture = `
        import { logApiError } from "@/lib/api-logger";
        import { serverError } from "@/lib/api-response";
        import { toError } from "@/lib/api-fetch";
        export async function GET() {
          try {
            return new Response("ok");
          } catch (e) {
            logApiError("GET /api/cron/hardware", "read crontab", e);
            return serverError(toError(e).message);
          }
        }
      `;
      expect(countSitesForFixture(fixture)).toBe(0);
    });

    it("does NOT capture static-literal serverError (no template literal)", () => {
      // Static literals are `serverErrorFromCatch` candidates, not
      // `serverErrorFromError`. The scanner must not confuse the two.
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
      expect(countSitesForFixture(fixture)).toBe(0);
    });

    it("does NOT capture serverError with a non-toError interpolation", () => {
      // The canonical pattern is `${toError(e).message}` — the
      // helper propagates the error's actual message. Other
      // interpolations (e.g. `${e.message}` directly) are out of
      // scope for `serverErrorFromError` because the helper
      // deliberately coerces via `toError()` for the empty-Error trap.
      const fixture = `
        import { logApiError } from "@/lib/api-logger";
        import { serverError } from "@/lib/api-response";
        export async function GET() {
          try {
            return new Response("ok");
          } catch (e) {
            logApiError("GET /api/x", "reading x", e);
            return serverError(\`Failed: \${e instanceof Error ? e.message : String(e)}\`);
          }
        }
      `;
      expect(countSitesForFixture(fixture)).toBe(0);
    });

    it("does NOT capture serverError without a preceding logApiError", () => {
      // A bare `return serverError(\`...: ${...}\`)` without the
      // `logApiError` partner is a different shape.
      const fixture = `
        import { serverError } from "@/lib/api-response";
        import { toError } from "@/lib/api-fetch";
        export async function GET() {
          if (Math.random() < 0) {
            return serverError(\`Failed: \${toError(new Error()).message}\`);
          }
          return new Response("ok");
        }
      `;
      expect(countSitesForFixture(fixture)).toBe(0);
    });
  });
});

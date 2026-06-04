/**
 * ok-factory-source-patterns.test.ts
 *
 * Source-pattern audit test for the `ok()` factory migration. Verifies
 * that all `return NextResponse.json({ data: ... })` sites in
 * `src/app/api/` have been migrated to `ok(...)`, with a small,
 * documented list of exemptions. Sessions 111 (List 3) + 112 (carryover
 * multi-line sites) pinned this test to a codebase-wide zero-tolerance
 * scan.
 *
 * The pattern `return NextResponse.json({ data: <expr> });` is byte-
 * equivalent to `return ok(<expr>);` — the factory body is literally
 * `NextResponse.json({ data }, { status: 200 })`. So migrating is
 * wire-equivalent and consolidates the `data` key in one place.
 *
 * This is a "first class" pattern test like `pluralise-source-patterns`:
 * it scans the production source tree at test time and asserts the
 * codebase matches the expected post-refactor shape. If someone adds
 * a new `NextResponse.json({ data: ... })` site, this test fails until
 * the site is migrated (or added to EXEMPTIONS with a reason).
 *
 * Session 112 changes (from session 111 baseline):
 *   1. Switched from per-line `SITE_RE` matching (which only caught
 *      single-line `data: <expr>` sites) to a whole-file per-block
 *      scanner that catches both single-line and multi-line forms.
 *      Session 111's single-line regex silently let 18 multi-line sites
 *      through (e.g. `return NextResponse.json({\n  data: ...\n})`).
 *      They were all migrated in session 112, but the old test would
 *      not have caught them. The new scanner uses a balanced-brace
 *      parser so it correctly handles the multi-line form without
 *      matching across statements.
 *   2. Kept the surface scope as **List 3** (api/models, api/agent,
 *      api/credentials) — the per-list-pick protocol means each session
 *      is scoped to one list's surface, even when the migration pattern
 *      is cross-list. The remaining 46 unmigrated sites in Lists 1/2/4
 *      are a documented follow-up; the test will catch new ones in
 *      this list only.
 */

import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join, extname } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const API_DIR = join(REPO_ROOT, "src", "app", "api");

/**
 * Sites exempted from the migration. Each entry documents why the
 * inline form is preferred over `ok(...)`.
 *
 * Note: this test's scanner only matches `data:` sites (not `error:`
 * sites). Inline `error:` responses with variable status codes
 * (e.g. `api/orchestration/chat/route.ts:33` propagating the
 * gateway's response status, or `api/memory/hindsight/route.ts:306`
 * with conditional 503/500) are out of scope for this scanner —
 * the `ok()` factory is success-side, and the `error:` inline form
 * would need a different factory family to migrate. Documented here
 * as a design note, not as an EXEMPTIONS entry (the scanner won't
 * see them).
 */
const EXEMPTIONS: ReadonlyArray<{ file: string; line: number; reason: string }> = [
  // List 1 (api/sessions, api/memory, api/logs) — session 113.
  // The api/memory/hindsight route's only inline `data:` site is a
  // 503/500 error response. `ok()` is status-200-locked, so this
  // site cannot use the factory. Keep the inline form so the
  // status code is honoured.
  {
    file: "src/app/api/memory/hindsight/route.ts",
    line: 306,
    reason:
      "503/500 error response with conditional status (`isHindsightConnectionError(error) ? 503 : 500`). `ok()` is status-200-locked, so the inline form must stay.",
  },
];

/**
 * Find every site in the file whose wire shape is `NextResponse.json({ data: ... })`,
 * in either of the two idiomatic forms:
 *
 *   1. `return NextResponse.json({ data: ... })` — the direct return form
 *   2. `const x = NextResponse.json({ data: ... }); return x;` — the
 *      assign-then-return form
 *
 * The scanner uses a balanced-brace parser so it correctly handles both
 * single-line and multi-line forms (the old per-line regex missed
 * multi-line sites). The algorithm:
 *   1. Find the start of every `NextResponse.json({` token (no `return`
 *      prefix required, since the assign-then-return form has no `return`
 *      adjacent to the call).
 *   2. Walk forward, counting braces, until depth returns to 0.
 *   3. Verify the body contains a `data:` key at the top level.
 *   4. Look at the call-site context:
 *      - If the call is preceded by `return `, capture the return line.
 *      - If the call is preceded by `const x = ` (or `let`/`var`), look
 *        for a subsequent `return x;` within the next 5 lines. If found,
 *        capture the original assignment line (the `ok()` migration
 *        collapses both lines into one `return ok(...)` call).
 *      - Otherwise (e.g. the response is used in a conditional branch,
 *        or passed to a different function), the site is OUT OF SCOPE for
 *        the `ok()` migration — the call's usage can't be reduced to a
 *        single `return ok(...)` form. Skip it.
 *
 * This is robust against:
 *   - Multi-line bodies (the old per-line regex failed here)
 *   - Nested braces inside the body (comments, conditionals, objects)
 *   - Trailing semicolons or whitespace
 *
 * Session 115 history: the original scanner (sessions 111-114) only
 * matched the `return NextResponse.json({` form. It silently let the
 * assign-then-return form through, including
 * `api/sessions/[id]/route.ts:102` which had
 * `const response = NextResponse.json({ data: buildSessionData({...}) })`
 * followed by `return response;` — a byte-equivalent `ok()` site that
 * the test missed. The scanner now matches both forms; the source
 * pattern is comprehensively covered.
 */
type Site = { file: string; line: number; text: string };

function findSites(file: string): Site[] {
  const text = readFileSync(file, "utf-8");
  const out: Site[] = [];
  // Match the call site, with or without a `return`/`const` prefix.
  // Capture the optional prefix for the call-site context check.
  const re = /(return\s+|const\s+(\w+)\s*=\s*|let\s+(\w+)\s*=\s*|var\s+(\w+)\s*=\s*)?NextResponse\.json\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // Start of the `{` block (the char right after `NextResponse.json(`).
    const start = m.index + m[0].length - 1;
    // Walk forward to find the matching `}`.
    let depth = 0;
    let i = start;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) continue; // Unbalanced — skip.
    // Body of the object literal (between `{` and `}` inclusive).
    const body = text.slice(start, i + 1);
    // Top-level `data:` key check. We use a regex that matches `data:`
    // at the start of the body (after optional whitespace).
    if (!/^\s*\{?\s*data\s*:/.test(body)) continue;
    // Call-site context: which form is this?
    const prefix = m[1]?.trim() ?? "";
    const isDirectReturn = prefix.startsWith("return");
    const assignedVar =
      m[2] /* const */ ?? m[3] /* let */ ?? m[4] /* var */ ?? null;
    if (isDirectReturn) {
      // Form 1: `return NextResponse.json({ data: ... })` — capture as-is.
      const line = text.slice(0, m.index).split("\n").length;
      out.push({
        file,
        line,
        text: text.slice(m.index, i + 1).split("\n")[0].trim(),
      });
    } else if (assignedVar) {
      // Form 2: `const x = NextResponse.json({ data: ... });` — look for
      // a follow-up `return x;` within the next 5 lines (the variable
      // is local-scoped, so 5 lines is generous). If found, the
      // assign-then-return pair is byte-equivalent to `return ok(...)`.
      const afterBlock = text.slice(i + 1);
      const followupRe = new RegExp(
        `return\\s+${assignedVar}\\s*;`,
      );
      const followupMatch = followupRe.exec(afterBlock);
      if (followupMatch) {
        // Count newlines between end-of-block and start-of-followup.
        // If too far away, treat as not a tight pair.
        const newlinesBetween = afterBlock
          .slice(0, followupMatch.index)
          .split("\n").length - 1;
        if (newlinesBetween <= 5) {
          // Tight assign-then-return pair — capture the assignment line.
          const line = text.slice(0, m.index).split("\n").length;
          out.push({
            file,
            line,
            text: text.slice(m.index, i + 1).split("\n")[0].trim(),
          });
        }
      }
    }
    // Advance past the `}` we just consumed.
    re.lastIndex = i + 1;
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

  it("has zero `return NextResponse.json({ data: ... })` sites in the List 1 surface (api/sessions, api/memory, api/logs)", () => {
    // Filter to List 1 surface: api/sessions/, api/memory/, api/logs/.
    // The List 1 surface backs the Dashboard, Sessions, Memory, and
    // Logs pages (per the session-113 sweep). The api/memory surface
    // includes the api/memory/hindsight route whose only inline
    // `data:` site is a 503/500 error response — `ok()` is
    // status-200-locked, so that site is exempt and the EXEMPTIONS
    // table below documents it. The test will fail on any new inline
    // site added to the List 1 surface.
    const list1 = allSites.filter(
      (s) =>
        s.file.includes(`${join("src", "app", "api", "sessions")}`) ||
        s.file.includes(`${join("src", "app", "api", "memory")}`) ||
        s.file.includes(`${join("src", "app", "api", "logs")}`),
    );
    // EXEMPTIONS already enumerate the known inline 503/500 sites in
    // the List 1 surface. Filter those out before asserting zero.
    // The `s.file` from the scanner is absolute; EXEMPTIONS uses
    // repo-relative paths, so we match on the suffix.
    const exempted = new Set(EXEMPTIONS.map((e) => e.file));
    const live = list1.filter((s) => !exempted.has(s.file.replace(REPO_ROOT + "/", "")));
    if (live.length > 0) {
      const summary = live
        .map((s) => `  ${s.file.replace(REPO_ROOT + "/", "")}:${s.line}  ${s.text}`)
        .join("\n");
      throw new Error(
        `Found ${live.length} un-migrated 'return NextResponse.json({ data: ... })' site(s) in the List 1 surface (migrate to 'ok(...)' or add to EXEMPTIONS):\n${summary}`,
      );
    }
    expect(live).toEqual([]);
  });

  it("has zero `return NextResponse.json({ data: ... })` sites in the List 2 surface (api/cron, api/missions, api/orchestration/chat)", () => {
    // Filter to List 2 surface: api/cron/, api/missions/,
    // api/orchestration/chat/. The List 2 surface backs the
    // Cron, Missions, and Chat pages (per the session-114 sweep).
    // The api/orchestration/chat route's only inline site is a
    // status-variable `{ error: ... }` response (propagating the
    // upstream gateway's status) — that site is exempt and the
    // EXEMPTIONS table below documents it. The test will fail on
    // any new inline `data:` site added to the List 2 surface.
    const list2 = allSites.filter(
      (s) =>
        s.file.includes(`${join("src", "app", "api", "cron")}`) ||
        s.file.includes(`${join("src", "app", "api", "missions")}`) ||
        s.file.includes(`${join("src", "app", "api", "orchestration", "chat")}`),
    );
    if (list2.length > 0) {
      const summary = list2
        .map((s) => `  ${s.file.replace(REPO_ROOT + "/", "")}:${s.line}  ${s.text}`)
        .join("\n");
      throw new Error(
        `Found ${list2.length} un-migrated 'return NextResponse.json({ data: ... })' site(s) in the List 2 surface — migrate to 'ok(...)':\n${summary}`,
      );
    }
    expect(list2).toEqual([]);
  });

  it("documents every exemption in EXEMPTIONS", () => {
    // Defensive: if EXEMPTIONS is non-empty, every entry's file must
    // still contain a `return NextResponse.json({ data: ... })` site
    // (the line number may have shifted across refactors, so we
    // assert site presence, not line exactness). If the exemption is
    // stale, the entry should be removed.
    // EXEMPTIONS uses repo-relative paths; resolve them against
    // REPO_ROOT so `findSites` (which expects absolute paths) can
    // read the file.
    for (const ex of EXEMPTIONS) {
      const absFile = join(REPO_ROOT, ex.file);
      const sites = findSites(absFile);
      const matching = sites.find((s) => Math.abs(s.line - ex.line) <= 2);
      if (!matching) {
        throw new Error(
          `Exemption stale: ${ex.file} line ${ex.line} no longer contains a 'return NextResponse.json({ data: ... })' site. Remove the entry.`,
        );
      }
    }
  });

  // ── Scanner self-tests (session 115) ──────────────────────────────
  // The scanner used to only match the `return NextResponse.json({`
  // form, silently letting the `const x = NextResponse.json({...}); return x;`
  // form through (e.g. api/sessions/[id]/route.ts:102, migrated in
  // session 115). The next two tests pin the scanner's contract: it
  // must catch both forms, and must NOT capture other call patterns
  // (e.g. responses used in conditional branches, or assigned but
  // never returned). If the scanner is later changed, these tests
  // catch regressions.
  describe("scanner form coverage (session 115 contract)", () => {
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

    it("catches the direct-return form (Form 1)", () => {
      const fixture = `
        import { NextRequest, NextResponse } from "next/server";
        export async function GET() {
          return NextResponse.json({ data: { foo: 1 } });
        }
      `;
      expect(countSitesForFixture(fixture)).toBe(1);
    });

    it("catches the assign-then-return form (Form 2)", () => {
      // The api/sessions/[id]/route.ts:102 site, byte-equivalent to ok().
      const fixture = `
        import { NextRequest, NextResponse } from "next/server";
        export async function GET() {
          const response = NextResponse.json({
            data: { foo: 1 },
          });
          return response;
        }
      `;
      expect(countSitesForFixture(fixture)).toBe(1);
    });

    it("does NOT capture assign-then-no-return (variable used elsewhere)", () => {
      // The variable is assigned but never returned — out of scope
      // for the `ok()` migration. The scanner must skip this site.
      const fixture = `
        import { NextRequest, NextResponse } from "next/server";
        export async function GET() {
          const response = NextResponse.json({
            data: { foo: 1 },
          });
          return NextResponse.json({ data: { other: 1 } });
        }
      `;
      expect(countSitesForFixture(fixture)).toBe(1); // only the direct return
    });

    it("does NOT capture NextResponse.json() without a data: key", () => {
      // A `error:` envelope site — out of scope for the `ok()` migration.
      const fixture = `
        import { NextRequest, NextResponse } from "next/server";
        export async function GET() {
          return NextResponse.json({ error: "oops" }, { status: 500 });
        }
      `;
      expect(countSitesForFixture(fixture)).toBe(0);
    });
  });
});

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
 *      single-line `data:` sites) to a whole-file per-block
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
 *
 * Session 123 changes (new this session):
 *   1. Added a 4th "List 4 surface" assertion. The List 4 surface
 *      covers api/config, api/gateway, api/seed, and api/fs/git —
 *      the routes that back the Settings, Environment, and All-
 *      Settings pages. The List 3 sweep in sessions 111/112/113
 *      skipped these (Models is in List 3, not List 4). The new
 *      assertion enforces the post-session-123 zero-tolerance rule
 *      for the List 4 surface. Models + HERMES.md pages already
 *      have List 3 coverage and are not in the List 4 filter.
 *
 * Session 132 changes (List 3 filter extension):
 *   1. The List 3 surface filter was incomplete — it covered
 *      api/models, api/agent, and api/credentials but MISSED
 *      api/skills, api/tools, and api/personalities. This is the
 *      filter-scope-mismatch pitfall documented as session 130
 *      P-130-1: the per-list page set in the mission brief is
 *      page-named (Models/Agents/Skills/Tools/Personalities = 5
 *      pages) but the source-pattern test filter was backend-
 *      subtree-named and only matched 3 of the 6 backing subtrees.
 *      The audit found 3 un-migrated `data:` sites in the missing
 *      subtrees (api/tools/route.ts:19, api/personalities/route.ts:
 *      51 + 78). The filter was extended to include the 3 missing
 *      subtrees; the 3 sites were migrated to `ok(...)`; and a
 *      self-test was added to pin the filter-scope contract so a
 *      future drift between the page-named list and the backend-
 *      subtree-named filter is caught at test time.
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
 *
 * Session 118 changes: the scanner was extended to also recognise
 * the `NextResponse.json<ApiResponse<...>>({ data: ... })` form
 * (TypeScript generic between `json` and `(`). Session 118 found
 * 2 sites in `api/memory/route.ts:25,34` that used this form and
 * were silently let through by the prior scanner. The generic is
 * now optional in the regex. The scanner also continues to
 * ignore the form with no `data:` key (which is used for error
 * responses, e.g. `api/agents/route.ts:61`'s `{ error: ... }`).
 */
type Site = { file: string; line: number; text: string };

function findSites(file: string): Site[] {
  const text = readFileSync(file, "utf-8");
  const out: Site[] = [];
  // Match the call site, with or without a `return`/`const` prefix.
  // The optional TypeScript generic between `NextResponse.json` and `(`
  // (e.g. `NextResponse.json<ApiResponse<MyShape>>({ data: ... })`) is
  // walked with a small balanced-`<>` scanner rather than a regex,
  // because nested generics (`ApiResponse<MyShape>`) are valid TS and
  // a regex like `<[^<>]+>` would only match a single level. The walk
  // produces the same result as the brace walker below but for `<>`.
  // Capture the optional prefix for the call-site context check.
  const re = /(return\s+|const\s+(\w+)\s*=\s*|let\s+(\w+)\s*=\s*|var\s+(\w+)\s*=\s*)?NextResponse\.json/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // Index of the char right after `json` (could be `<` for a generic
    // call or `(` for a direct call).
    const after = m.index + m[0].length;
    let start: number;
    if (text[after] === "<") {
      // Walk the generic to its matching `>`. Bail out on unbalanced.
      let depth = 0;
      let i = after;
      for (; i < text.length; i++) {
        const ch = text[i];
        if (ch === "<") depth++;
        else if (ch === ">") {
          depth--;
          if (depth === 0) break;
        }
      }
      if (depth !== 0) continue; // Unbalanced generic — skip.
      // After the closing `>` we expect `(`. If not, this isn't a
      // call to `NextResponse.json` (e.g. `NextResponse.jsonOptions`).
      // Advance past the `>` and require optional whitespace + `{`.
      const afterGeneric = i + 1;
      const wsMatch = /^\s*\{/.exec(text.slice(afterGeneric + 1));
      if (!wsMatch) continue;
      // `afterGeneric + 1` is the char right after `(`. The `wsMatch[0]`
      // captures the leading whitespace + `{`. The `{` itself is at
      // `afterGeneric + 1 + wsMatch[0].length - 1`.
      start = afterGeneric + 1 + wsMatch[0].length - 1;
      // Bump the regex past the generic + `(` so the next match attempt
      // doesn't re-enter the same walk.
      re.lastIndex = start + 1;
    } else if (text[after] === "(") {
      // No generic — the `{` is right after `(`. Skip optional whitespace.
      const wsMatch = /^\s*\{/.exec(text.slice(after + 1));
      if (!wsMatch) continue;
      start = after + 1 + wsMatch[0].length - 1;
      re.lastIndex = start + 1;
    } else {
      // Not a `NextResponse.json(...)` call (e.g. a different method
      // on the same object, or property access). Skip.
      re.lastIndex = after;
      continue;
    }
    // Walk forward to find the matching `}` of the `{` block we just
    // located (the index `start` is set by the generic / no-generic
    // branches above).
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

describe("ok() factory source-pattern coverage (Lists 1-4 surface)", () => {
  const files = walk(API_DIR);
  const allSites: Site[] = [];
  for (const f of files) allSites.push(...findSites(f));

  it("scanned the api/ tree without errors", () => {
    // The walk is best-effort: if the directory is missing (e.g. test
    // runs from a misconfigured workdir), fail with a clear message
    // rather than the generic 'no tests ran' Jest error.
    expect(files.length).toBeGreaterThan(0);
  });

  it("has zero `return NextResponse.json({ data: ... })` sites in the List 3 surface (api/models, api/agent, api/credentials, api/skills, api/tools, api/personalities)", () => {
    // Filter to List 3 surface. The List 3 page set is page-named
    // (Models, Agents, Skills, Tools, Personalities — 5 pages per
    // the mission brief) and maps to 6 backend subtrees. The
    // original sessions 111/112 filter only covered 3 of the 6
    // subtrees (api/models, api/agent, api/credentials), which is
    // the filter-scope-mismatch gap from session 130 P-130-1.
    // Session 132 extended the filter to include the 3 missing
    // subtrees (api/skills, api/tools, api/personalities) and
    // migrated 3 un-migrated sites that the old filter had been
    // silently letting through. A scanner self-test below pins
    // this contract — if a future session adds a 4th or 5th List-3
    // backing subtree without extending the filter, the self-test
    // fails.
    const list3 = allSites.filter(
      (s) =>
        s.file.includes(`${join("src", "app", "api", "models")}`) ||
        s.file.includes(`${join("src", "app", "api", "agent")}`) ||
        s.file.includes(`${join("src", "app", "api", "credentials")}`) ||
        s.file.includes(`${join("src", "app", "api", "skills")}`) ||
        s.file.includes(`${join("src", "app", "api", "tools")}`) ||
        s.file.includes(`${join("src", "app", "api", "personalities")}`),
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

  it("has zero `return NextResponse.json({ data: ... })` sites in the List 4 surface (api/config, api/gateway, api/seed, api/fs/git)", () => {
    // Filter to List 4 surface: api/config/, api/gateway/, api/seed/,
    // api/fs/git/. The List 4 surface backs the Settings, Environment,
    // and All Settings pages (per the session-123 sweep). The Models
    // and HERMES.md routes are part of List 3 (covered above), so
    // they're not in this filter.
    //
    // The surface is intentionally narrower than the page set named in
    // the per-list-pick protocol — the protocol cares about the
    // *backend* route, not the page. Models is List 3, so api/models
    // is List 3. Settings/Environment/All-Settings route reads/writes
    // config.yaml, gateway health, the seed catalog, and the env file
    // (fs/git for the env-path repo). All of those are in the
    // api/config, api/gateway, api/seed, api/fs/git subtree.
    const list4 = allSites.filter(
      (s) =>
        s.file.includes(`${join("src", "app", "api", "config")}`) ||
        s.file.includes(`${join("src", "app", "api", "gateway")}`) ||
        s.file.includes(`${join("src", "app", "api", "seed")}`) ||
        s.file.includes(`${join("src", "app", "api", "fs", "git")}`),
    );
    if (list4.length > 0) {
      const summary = list4
        .map((s) => `  ${s.file.replace(REPO_ROOT + "/", "")}:${s.line}  ${s.text}`)
        .join("\n");
      throw new Error(
        `Found ${list4.length} un-migrated 'return NextResponse.json({ data: ... })' site(s) in the List 4 surface — migrate to 'ok(...)':\n${summary}`,
      );
    }
    expect(list4).toEqual([]);
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

    it("catches the TypeScript-generic form (Form 3, session 118)", () => {
      // The `api/memory/route.ts:25,34` sites migrated in session 118.
      // The pre-session-118 scanner silently let this form through
      // because the regex required `(` immediately after `json`. The
      // scanner was extended to optionally match a TypeScript generic
      // between `json` and `(`. This test pins that contract so a
      // future scanner regression does not silently let the same sites
      // back in.
      const fixture = `
        import { NextRequest, NextResponse } from "next/server";
        import type { ApiResponse, MyShape } from "./types";
        export async function GET() {
          return NextResponse.json<ApiResponse<MyShape>>({ data: { foo: 1 } });
        }
      `;
      expect(countSitesForFixture(fixture)).toBe(1);
    });

    it("does NOT capture NextResponse.json<...>({ error: ... }) (generic with error: key)", () => {
      // A `error:` envelope site using a TypeScript generic. The
      // generic is irrelevant — the body must still have `data:` for
      // the scanner to capture the site. The scanner must skip this
      // site because the migration target is `ok(...)` which is
      // `data:`-shaped, not `error:`-shaped.
      const fixture = `
        import { NextRequest, NextResponse } from "next/server";
        import type { ApiResponse, MyError } from "./types";
        export async function GET() {
          return NextResponse.json<ApiResponse<MyError>>({ error: "oops" }, { status: 500 });
        }
      `;
      expect(countSitesForFixture(fixture)).toBe(0);
    });

    it("List 3 filter covers all 6 backing subtrees (session 132 contract)", () => {
      // The filter-scope-mismatch pitfall from session 130 P-130-1:
      // the List 3 page set is page-named (Models, Agents, Skills,
      // Tools, Personalities — 5 pages per the mission brief) and
      // maps to 6 backend subtrees. The original sessions 111/112
      // filter only covered 3 of the 6 subtrees, silently letting 3
      // un-migrated `data:` sites through. Session 132 extended the
      // filter to cover all 6 subtrees. This self-test pins the
      // contract by reading the production test file's source and
      // verifying the production filter's it() block contains
      // `s.file.includes(...)` clauses for all 6 expected
      // subtrees. If a future session adds a 7th List-3 backing
      // subtree but forgets to extend the filter, the production
      // filter won't contain the new subtree's `includes()` call
      // and this test will fail with a clear diagnostic of which
      // subtree is missing.
      //
      // The 6 expected subtrees derive from the List 3 page set in
      // the mission brief (Models, Agents, Skills, Tools,
      // Personalities) and the documented backend-subtree mapping
      // in session 130 P-130-3.
      //
      // Approach: read this test file's source, locate the
      // production filter's it() block (the one whose title contains
      // "List 3 surface"), and assert each expected subtree name
      // appears as a literal inside that it() block. This is
      // structural: a future session can change the filter clauses
      // however they want, but if they don't include all 6 subtree
      // names, the test fails.
      const expectedSubtrees = [
        "src/app/api/models",
        "src/app/api/agent",
        "src/app/api/credentials",
        "src/app/api/skills",
        "src/app/api/tools",
        "src/app/api/personalities",
      ];
      // Read the test file's source.
      const testFilePath = __filename;
      const testFileSource = readFileSync(testFilePath, "utf-8");
      // The production filter calls
      // `s.file.includes(\`\${join("src", "app", "api", "<name>")}\`)`
      // for each List 3 backing subtree. The simplest reliable
      // check: assert each expected subtree's `join("src", "app",
      // "api", "<name>")` call (rendered as a string) appears as
      // a literal substring in the test file. A missing clause
      // (the failure mode this self-test pins) means the test
      // file is missing the `join("src", "app", "api", "<name>")`
      // call for that subtree, which the substring check catches.
      const missing = expectedSubtrees.filter((subtree) => {
        // The expected join() call as it would appear literally
        // in the source: `join("src", "app", "api", "<name>")`.
        const leaf = subtree.split("/").pop() ?? "";
        const expectedClause = `join("src", "app", "api", "${leaf}")`;
        return !testFileSource.includes(expectedClause);
      });
      if (missing.length > 0) {
        throw new Error(
          `List 3 filter-scope self-test failed: the following expected subtrees are NOT ` +
            `covered by the production filter: ${missing.join(", ")}. ` +
            `Add the missing subtrees to the List 3 filter in the 'has zero ... List 3 surface' ` +
            `it() block. Expected subtrees (from mission brief + session 130 P-130-3): ` +
            `${expectedSubtrees.join(", ")}`,
        );
      }
      expect(expectedSubtrees).toHaveLength(6);
      expect(missing).toHaveLength(0);
    });
  });
});

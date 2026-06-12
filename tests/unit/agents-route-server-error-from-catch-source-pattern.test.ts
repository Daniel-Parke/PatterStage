/**
 * @jest-environment node
 *
 * Source-pattern test for the `serverErrorFromCatch` migration in
 * `src/app/api/agents/route.ts`.
 *
 * **Session 172 carryover (the closed-130 holdover).** The
 * `/api/agents` route was the last surviving inline
 * `logApiError + return NextResponse.json({error}, {status:500})`
 * site in the List 3 (Models, Agents, Skills, Tools, Personalities)
 * surface. The 1-site migration replaces the 4-line catch block with
 * a single `serverErrorFromCatch(ROUTE, CONTEXT, ERR, MESSAGE)` call —
 * byte-equivalent to the inline form (same log line, same 500
 * response shape, only the `: <err-msg>` suffix concatenation is
 * dropped, per the factory's static-message contract).
 *
 * **Why a source-pattern test for a 1-site migration?** The umbrella
 * skill's `server-error-from-catch-source-patterns.test.ts` only
 * covers the `logApiError + return serverError(STATIC)` pair — the
 * `NextResponse.json({error}, {status:500})` form is a different
 * sibling pattern that the existing scanner does not match. The
 * session-172 doc explicitly recommended:
 *
 *   "Optionally add a source-pattern test
 *    (`tests/unit/agents-route-server-error-from-catch.test.ts`) that
 *    pins the post-migration shape: imports `serverErrorFromCatch`,
 *    does NOT import `NextResponse`, calls the factory with the exact
 *    4-arg shape."
 *
 * This file is that recommendation. The 4 assertions pin the
 * post-migration shape so that a future re-introduction of the inline
 * form (e.g. a copy-paste regression from `api/stories/route.ts` or
 * `api/templates/route.ts`, which still use the older shape) fails
 * the test instead of silently re-introducing the migration debt.
 *
 * **If a 2nd site appears in the List 3 surface**, promote this
 * per-file test into a per-surface scanner (the
 * `server-error-from-catch-source-patterns.test.ts` pattern) and
 * move the assertion from "the agents route uses the new shape" to
 * "no List 3 route uses the inline form". At 1 site, the per-file
 * test is the right granularity — a 1-site scanner with an
 * `EXEMPTIONS` array of zero entries would be over-engineered.
 *
 * @see src/app/api/agents/route.ts — the migrated site
 * @see src/lib/api-logger.ts — `serverErrorFromCatch` definition
 * @see tests/unit/server-error-from-catch-source-patterns.test.ts —
 *   the sister test that covers the `logApiError + return
 *   serverError(STATIC)` pair
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const AGENTS_ROUTE = join(REPO_ROOT, "src", "app", "api", "agents", "route.ts");

describe("agents/route.ts serverErrorFromCatch migration (session 172)", () => {
  // Strip line comments + block comments before scanning. The
  // post-migration file has a JSDoc-style migration note in the
  // catch block that literally mentions the old `NextResponse.json`
  // shape and the `: + String(err)` suffix — those are explanatory
  // text, not executable code, and would false-positive the
  // "does NOT contain" assertions. The scanner is intentionally
  // ignorant of the JSDoc-vs-code distinction; the test is
  // strengthened (not weakened) by this pre-filter because the
  // pattern occurrences inside comments have no runtime effect.
  const rawSource = readFileSync(AGENTS_ROUTE, "utf-8");
  const codeOnlySource = rawSource
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* ... */ block comments
    .replace(/\/\/.*$/gm, ""); // // ... line comments

  // Expose both: the comment-stripped form for "does NOT contain"
  // assertions, the raw form for "imports X" assertions (import
  // statements can never live in a comment).
  const source = rawSource;

  it("imports serverErrorFromCatch from @/lib/api-logger", () => {
    // The post-migration shape: the factory is the only API error
    // helper imported. The pre-migration shape had `logApiError` in
    // this slot (and `NextResponse` from `next/server`).
    expect(source).toMatch(
      /import\s*\{\s*serverErrorFromCatch\s*\}\s*from\s*["']@\/lib\/api-logger["']/,
    );
  });

  it("does NOT import logApiError (it was dropped with the inline form)", () => {
    // The factory encapsulates `logApiError + serverError(STATIC)`.
    // A direct `logApiError` import is a regression indicator — it
    // means someone copied the pre-migration shape and only swapped
    // the body, leaving the helper side-imported.
    expect(source).not.toMatch(/import\s*\{[^}]*\blogApiError\b[^}]*\}/);
  });

  it("does NOT import NextResponse from next/server (the inline form needed it)", () => {
    // The post-migration route uses only the `ok` factory for the
    // success path and `serverErrorFromCatch` for the error path —
    // neither needs `NextResponse` directly. A `NextResponse` import
    // is a regression indicator: the inline `NextResponse.json(...)`
    // call is what the factory replaced.
    expect(source).not.toMatch(/import\s*\{\s*NextResponse\s*\}\s*from\s*["']next\/server["']/);
  });

  it("calls serverErrorFromCatch with the canonical 4-arg shape", () => {
    // The factory is called as:
    //   return serverErrorFromCatch(ROUTE, CONTEXT, ERR, MESSAGE);
    // with no extra args. A 5-arg or 3-arg call would be a misuse
    // (the helper takes exactly 4 args). Multi-line + trailing-comma
    // forms are both allowed by TypeScript and must both pass.
    const callMatch = source.match(
      /return\s+serverErrorFromCatch\s*\(\s*([\s\S]*?)\s*\)/,
    );
    expect(callMatch).not.toBeNull();
    if (callMatch) {
      const args = callMatch[1];
      // Collapse whitespace + newlines so a multi-line call is
      // tokenized the same as a single-line call.
      const collapsedArgs = args.replace(/\s+/g, " ").trim();
      // Strip a trailing comma (TypeScript allows them in multi-arg
      // calls; the comma count must reflect the arg count, not the
      // syntactic comma count).
      const trimmedArgs = collapsedArgs.replace(/,\s*$/, "");
      const argList = trimmedArgs.split(",").map((a) => a.trim());
      // The 4-arg factory shape is exactly 4 entries: ROUTE, CONTEXT,
      // ERR, MESSAGE. A 3-arg or 5-arg call has a different length.
      expect(argList.length).toBe(4);
      // ROUTE: string literal
      expect(argList[0]).toMatch(/^["']/);
      // CONTEXT: string literal
      expect(argList[1]).toMatch(/^["']/);
      // ERR: not a string literal (it's a caught-error variable)
      expect(argList[2]).not.toMatch(/^["']/);
      // MESSAGE: string literal
      expect(argList[3]).toMatch(/^["']/);
    }
  });

  it("the catch block contains exactly one `return serverErrorFromCatch` call", () => {
    // Pin the call count — a 2-call catch block would be either a
    // refactor regression (someone re-introduced the inline form
    // alongside the factory) or a copy-paste duplication.
    const callCount = (source.match(/serverErrorFromCatch\s*\(/g) ?? []).length;
    expect(callCount).toBe(1);
  });

  it("does NOT contain an inline NextResponse.json({error}, {status:500}) call", () => {
    // The post-migration route has zero `NextResponse.json({error},
    // {status:500})` calls. The factory is the only path that
    // returns a 500-with-{error} body, and it does so via the
    // `serverError` helper (which is its own factory call, not a
    // `NextResponse.json` call).
    expect(codeOnlySource).not.toMatch(/NextResponse\.json\s*\(\s*\{\s*error/);
  });

  it("does NOT contain an inline 'Failed to query Hermes processes: ' concatenation", () => {
    // The pre-migration shape concatenated the err message onto the
    // static prefix with `: ${err}`. The factory's static-message
    // contract drops the concatenation; the err details go to the
    // `logApiError` side-channel instead. A re-introduction of the
    // `: + String(err)` suffix is a regression indicator.
    expect(codeOnlySource).not.toMatch(/Failed to query Hermes processes\s*:\s*["`]/);
  });
});

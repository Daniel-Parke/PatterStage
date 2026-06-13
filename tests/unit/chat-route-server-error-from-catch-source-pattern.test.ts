/**
 * @jest-environment node
 *
 * Source-pattern test for the `serverErrorFromCatch` migration in
 * `src/app/api/orchestration/chat/route.ts`.
 *
 * **Session 178 List 2 carryover (the chat-route site).** The chat
 * route was the last surviving inline
 * `logApiError + return serverError(toError(error).message)` shape in
 * the List 2 (Cron, Missions, Chat) surface. The session-172
 * closure of the same anti-pattern in `src/app/api/agents/route.ts`
 * did not extend to chat (chat was out of List 3 scope), so the
 * inline form persisted. Session 178 closed the carryover by
 * replacing the 2-line catch block with a single
 * `serverErrorFromCatch(ROUTE, CONTEXT, ERR, MESSAGE)` call —
 * byte-equivalent to the inline form (same log line, same 500
 * response shape, only the dynamic `toError(error).message` suffix
 * is replaced with the static "Failed to call gateway" string per
 * the factory's static-message contract).
 *
 * **Why a per-file source-pattern test (not per-surface).** Only 1
 * List 2 route (`/api/orchestration/chat`) used the inline form,
 * mirroring the session-172 situation in `agents/route.ts`. Per the
 * session-172 rationale ("If a 2nd site appears in the surface,
 * promote this per-file test into a per-surface scanner"), a
 * 1-site scanner with an `EXEMPTIONS` array of zero entries would
 * be over-engineered. The sister test
 * (`agents-route-server-error-from-catch-source-pattern.test.ts`)
 * is the structural template.
 *
 * **Pre-flight recipe (run BEFORE any future migration into a
 * different catch-block shape in this file):**
 *
 *   # 1. Confirm the factory is imported (positive regex)
 *   rg -n "import.*serverErrorFromCatch.*from.*@/lib/api-logger" \
 *     src/app/api/orchestration/chat/route.ts
 *   # Should show: 1 match
 *
 *   # 2. Confirm logApiError is gone (negative regex)
 *   rg -n "import.*logApiError.*from.*@/lib/api-logger" \
 *     src/app/api/orchestration/chat/route.ts
 *   # Should show: 0 matches
 *
 *   # 3. Confirm toError is no longer imported (the pre-migration
 *   #    form was `serverError(toError(error).message)`; post-
 *   #    migration, the helper composes both internally)
 *   rg -n "toError" src/app/api/orchestration/chat/route.ts
 *   # Should show: 0 matches
 *
 * @see src/app/api/orchestration/chat/route.ts — the migrated site
 * @see src/lib/api-logger.ts — `serverErrorFromCatch` definition
 * @see tests/unit/agents-route-server-error-from-catch-source-pattern.test.ts —
 *   the sister test (session 172) for the List 3 agents route
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const CHAT_ROUTE = join(REPO_ROOT, "src", "app", "api", "orchestration", "chat", "route.ts");

describe("chat/route.ts serverErrorFromCatch migration (session 178)", () => {
  const rawSource = readFileSync(CHAT_ROUTE, "utf-8");
  // Strip line comments + block comments before scanning. The
  // post-migration file has a JSDoc-style migration note on the
  // helper that mentions the old `logApiError` + `serverError(...)`
  // shape — those are explanatory text, not executable code, and
  // would false-positive the "does NOT contain" assertions. Same
  // JSDoc-vs-code pre-filter as the session-172 agents route test.
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
    // this slot (and `serverError` from `@/lib/api-response`, and
    // `toError` from `@/lib/api-fetch`).
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

  it("does NOT import serverError from @/lib/api-response (the factory replaces it)", () => {
    // The factory returns its own NextResponse, so the route
    // doesn't need `serverError` for the catch block. A
    // `serverError` import is a regression indicator: the inline
    // `return serverError(...)` call is what the factory replaced.
    expect(codeOnlySource).not.toMatch(
      /import\s*\{[^}]*\bserverError\b[^}]*\}\s*from\s*["']@\/lib\/api-response["']/,
    );
  });

  it("does NOT import toError from @/lib/api-fetch (the factory composes the message)", () => {
    // The pre-migration form was `serverError(toError(error).message)` —
    // a dynamic-message concat. The factory's static-message
    // contract replaces this with a literal "Failed to call gateway"
    // string. A `toError` import is a regression indicator: the
    // caller is doing the message-coercion work that the helper
    // already does.
    expect(codeOnlySource).not.toMatch(
      /import\s*\{[^}]*\btoError\b[^}]*\}\s*from\s*["']@\/lib\/api-fetch["']/,
    );
  });

  it("calls serverErrorFromCatch with the canonical 4-arg shape", () => {
    // The factory contract: (route, context, error, message).
    // A future change to the signature (e.g. add a 5th param) trips
    // this test and forces the byte-equivalence claim to be re-
    // verified. Multi-line tolerant + trailing-comma tolerant.
    const callMatch = codeOnlySource.match(
      /return\s+serverErrorFromCatch\s*\(\s*([\s\S]*?)\s*\)/,
    );
    expect(callMatch).not.toBeNull();
    if (callMatch) {
      // Strip the call down to its 4 args, collapse whitespace, drop
      // any trailing comma (TypeScript multi-arg trailing-comma
      // tolerance), then split on `,`. Same regex pattern as the
      // session-172 multi-arg call scanner — the
      // `[^)]+` form would stop at the first `)` in a multi-line
      // call, so we use `[\s\S]*?` (non-greedy on `)`).
      const collapsedArgs = callMatch[1].replace(/\s+/g, " ").trim();
      const trimmedArgs = collapsedArgs.replace(/,\s*$/, "");
      const argList = trimmedArgs.split(",").map((a) => a.trim());
      expect(argList.length).toBe(4);
      // Spot-check the 4 expected args (route prefix, context, error
      // identifier, fallback message).
      expect(argList[0]).toBe('"POST /api/orchestration/chat"');
      expect(argList[1]).toBe('"calling gateway"');
      expect(argList[2]).toBe("error");
      expect(argList[3]).toBe('"Failed to call gateway"');
    }
  });

  it("does NOT use the inline logApiError + serverError pair anywhere", () => {
    // Belt-and-suspenders: the canonical anti-pattern is the 2-line
    //   logApiError(ROUTE, CONTEXT, error);
    //   return serverError(toError(error).message);
    // pair. Either half re-introduced in isolation is also a
    // regression indicator. The regex matches both the `logApiError`
    // call line and the `return serverError(...)` line in either
    // order.
    expect(codeOnlySource).not.toMatch(/\blogApiError\s*\(/);
    // The `serverError` call shape is `serverError(toError(error).message)`
    // in the pre-migration form. After the migration, `serverError`
    // isn't even imported (negative-import assertion above), but
    // assert the call shape anyway for clarity.
    expect(codeOnlySource).not.toMatch(/return\s+serverError\s*\(\s*toError\s*\(\s*error\s*\)\s*\.\s*message\s*\)/);
  });
});

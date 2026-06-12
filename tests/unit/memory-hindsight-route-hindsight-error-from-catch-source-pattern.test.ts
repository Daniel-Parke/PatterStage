/**
 * Source-pattern test for the hindsightErrorFromCatch migration in
 * `src/app/api/memory/hindsight/route.ts` (session 186).
 *
 * Locks the shape of the 2 POST/DELETE catch blocks so a future
 * "revert to inline form" or "introduce a new inline form" PR
 * can't accidentally re-introduce the 2-line `logApiError +
 * hindsightErrorResponse` block that the helper was added to
 * collapse.
 *
 * The pre-refactor form was:
 *
 *   } catch (error) {
 *     logApiError("POST /api/memory/hindsight", "action", error);
 *     return hindsightErrorResponse(error);
 *   }
 *
 * The post-refactor form is:
 *
 *   } catch (error) {
 *     return hindsightErrorFromCatch("POST /api/memory/hindsight", "action", error);
 *   }
 *
 * The pre-existing GET catch block (line 305) is preserved unchanged
 * — it has a different response shape (uses `memories: []` and 503
 * for connection errors), so it stays inline. The source-pattern
 * test scopes the assertions to the POST + DELETE catch blocks
 * only.
 *
 * The test pins:
 *   1. `hindsightErrorFromCatch` is imported (positive)
 *   2. `hindsightErrorResponse` is NOT imported (negative — the
 *      POST/DELETE catch blocks no longer call it directly; the
 *      helper composes the call)
 *   3. Each POST + DELETE catch block ends with the canonical
 *      `return hindsightErrorFromCatch(ROUTE, CONTEXT, error);`
 *      1-line form (positive — locks the helper call shape)
 *   4. There is NO `logApiError("POST|DELETE /api/memory/hindsight", ...)`
 *      in the catch blocks (negative — the helper composes the log
 *      call, a future inline re-introduction would re-add the
 *      redundant log line)
 *   5. There is NO `return hindsightErrorResponse(error);` in the
 *      POST or DELETE catch blocks (negative — the helper composes
 *      the response, a future inline re-introduction would re-add
 *      the redundant response call)
 *
 * Why source-pattern instead of rendering the route:
 *   - The route is a 438-line Next.js API route with 3 handlers
 *     (GET/POST/DELETE), 12+ sub-handlers, and a switch statement
 *     with 7 cases. A render harness would dwarf the invariant.
 *   - The "hindsightErrorFromCatch is the only 500-catch helper
 *     for POST/DELETE" shape is the byte-level contract.
 *
 * The GET catch block (line 305) is intentionally NOT migrated —
 * the source-pattern test pins the POST + DELETE scopes via
 * `scopeFragment` so a future change to the GET branch doesn't
 * trip the assertion.
 *
 * If the helper is renamed or the file is restructured (e.g. the
 * POST/DELETE handlers are extracted into a sibling file), the
 * file path and shape-string assertions will need to be updated.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const FILE_PATH = join(REPO_ROOT, "src", "app", "api", "memory", "hindsight", "route.ts");

// Strip block + line comments so JSDoc-style prose notes
// (e.g. inline migration history) don't false-positive the
// negative assertions. Same pre-filter pattern as
// `set-error-from-caught-source-pattern-list1.test.ts`.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("memory/hindsight/route — hindsightErrorFromCatch (session 186)", () => {
  const rawSource = readFileSync(FILE_PATH, "utf-8");
  const code = stripComments(rawSource);

  it("imports hindsightErrorFromCatch from @/lib/hindsight-route-helpers (positive)", () => {
    // The combined helper must be imported. Accept either the
    // single-line form or the multi-line import-block form (the
    // helper sits alphabetically between `extractListItems` and
    // `MENTAL_MODEL_UPDATE_FIELDS`).
    expect(code).toMatch(
      /import\s*\{[\s\S]*?hindsightErrorFromCatch[\s\S]*?\}\s*from\s*["']@\/lib\/hindsight-route-helpers["']/,
    );
  });

  it("does NOT import hindsightErrorResponse directly (negative — helper composes the call)", () => {
    // The POST/DELETE catch blocks now go through
    // `hindsightErrorFromCatch`, which composes
    // `hindsightErrorResponse(error)` internally. A direct
    // import + call in the route's POST/DELETE catch blocks
    // would mean a future "add a direct call" PR snuck past
    // the migration. The GET handler is allowed to keep a
    // direct call (it has a different response shape), but the
    // import is now unused by the route's other 2 sites.
    //
    // Note: this assertion locks the "POST/DELETE never call
    // hindsightErrorResponse directly" invariant. The helper
    // file itself DOES still export hindsightErrorResponse
    // (it's the response-shape primitive the helper composes);
    // we only care about the route's imports.
    expect(code).not.toMatch(
      /import\s*\{[\s\S]*?hindsightErrorResponse[\s\S]*?\}\s*from\s*["']@\/lib\/hindsight-route-helpers["']/,
    );
  });

  it("POST catch block ends with `return hindsightErrorFromCatch(...)` (positive)", () => {
    // Scope to the POST catch block by anchoring on the
    // `} catch (error) {` form followed by the helper call.
    // The shape is `return hindsightErrorFromCatch("POST
    // /api/memory/hindsight", "action", error);` — 3 args,
    // ROUTE + CONTEXT + error, identical to the
    // `serverErrorFromCatch` sister helper's signature minus
    // the `message` arg (the hindsight envelope has no
    // user-facing prefix; the message comes from
    // `messageFromError` inside `hindsightErrorResponse`).
    const postScope = code.match(
      /\} catch \(error\) \{\s*return hindsightErrorFromCatch\(\s*"POST \/api\/memory\/hindsight",\s*"action",\s*error\s*\);/,
    );
    expect(postScope).not.toBeNull();
  });

  it("DELETE catch block ends with `return hindsightErrorFromCatch(...)` (positive)", () => {
    // Scope to the DELETE catch block: the `} catch (error) {`
    // anchor + the `hindsightErrorFromCatch` call with the
    // DELETE route + `delete` context. Shape:
    // `return hindsightErrorFromCatch("DELETE /api/memory/hindsight", "delete", error);`
    const deleteScope = code.match(
      /\} catch \(error\) \{\s*return hindsightErrorFromCatch\(\s*"DELETE \/api\/memory\/hindsight",\s*"delete",\s*error\s*\);/,
    );
    expect(deleteScope).not.toBeNull();
  });

  it("does NOT contain a bare `logApiError(\"POST /api/memory/hindsight\", ...) (negative)", () => {
    // The helper composes the `logApiError` call internally. A
    // future PR that re-adds the inline form (e.g. to log
    // additional context) would re-introduce the redundant
    // log line. The GET catch block is allowed to keep its
    // `logApiError("GET /api/memory/hindsight", ...)` call —
    // the test scopes the negative assertion to the POST
    // route only.
    const postCalls = code.match(
      /logApiError\(\s*["']POST \/api\/memory\/hindsight["']/g,
    );
    expect(postCalls).toBeNull();
  });

  it("does NOT contain a bare `logApiError(\"DELETE /api/memory/hindsight\", ...) (negative)", () => {
    const deleteCalls = code.match(
      /logApiError\(\s*["']DELETE \/api\/memory\/hindsight["']/g,
    );
    expect(deleteCalls).toBeNull();
  });

  it("does NOT contain a bare `return hindsightErrorResponse(error);` in the POST/DELETE catch blocks (negative)", () => {
    // The helper composes the `hindsightErrorResponse(error)`
    // call internally. The route's POST/DELETE catch blocks
    // should go through the helper only. A future PR that
    // re-adds the inline form would re-introduce the
    // redundant response call. The GET catch block is
    // allowed to keep its inline form (different response
    // shape), so we scope the negative to the POST + DELETE
    // catch blocks.
    //
    // We pin: there are 0 occurrences of
    // `} catch (error) { return hindsightErrorResponse(`
    // (the inline-form anchor) anywhere in the file. The
    // GET catch block uses a different inline form
    // (`return NextResponse.json({ data: {...}, ... }, {...})`)
    // so it doesn't false-positive this anchor.
    const inlineResponseInCatch = code.match(
      /\} catch \(error\) \{\s*return hindsightErrorResponse\(/,
    );
    expect(inlineResponseInCatch).toBeNull();
  });

  it("GET catch block still uses the inline `logApiError + NextResponse.json({...}, { status: 503|500 })` form (positive — intentional carryover)", () => {
    // The GET catch block is intentionally NOT migrated — it
    // has a different response shape (uses `memories: []` and
    // 503 for connection errors). The pre-existing inline
    // form is preserved. This assertion pins the carryover
    // shape so a future "migrate everything" PR doesn't
    // accidentally lose the GET-specific response shape.
    const getScope = code.match(
      /logApiError\(\s*["']GET \/api\/memory\/hindsight["'][\s\S]*?NextResponse\.json\(\s*\{\s*data:\s*\{\s*available:\s*false,[\s\S]*?memories:\s*\[\]/,
    );
    expect(getScope).not.toBeNull();
  });
});

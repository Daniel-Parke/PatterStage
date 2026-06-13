/**
 * @jest-environment node
 *
 * Source-pattern pin for the session 193 (List 4)
 * `existingFallbackKeys()` helper extraction in
 * `src/app/api/models/fallbacks/import/route.ts`.
 *
 * The pre-session source had the 3-line pattern
 *
 *   const existingChain = listFallbackChain();
 *   const existingKeys = new Set(
 *     existingChain.map((e) => fallbackKey(e.provider, e.modelIdString))
 *   );
 *
 * duplicated in two places in the same file: the GET branch
 * (preview) at line 43-46 and the POST branch (skip-already-
 * imported) at line 99-102. The post-session source extracts a
 * single helper `existingFallbackKeys()` that returns the same
 * Set and calls it from both branches.
 *
 * This test reads the route file as text and asserts the post-
 * migration shape:
 *  - helper declaration exists (1 occurrence)
 *  - 2 call sites (`existingFallbackKeys()` without `= listFallbackChain()`)
 *  - 0 inline `existingChain = listFallbackChain()` declarations
 *  - 0 inline `new Set(existingChain.map(` constructions
 *  - 0 inline `fallbackKey(e.provider, e.modelIdString)` outside
 *    the helper body
 *
 * If a future refactor re-inlines the 2 sites, this test fails.
 * The companion "byte-equivalence" coverage is provided by the
 * pre-existing `tests/unit/fallbacks-import-api.test.ts` (the
 * `mockListChain.mockReturnValue([])` line exercises the new
 * helper's call path through the `listFallbackChain` repository
 * mock; both POST and GET use the helper now).
 */
import { readFileSync } from "fs";
import { join } from "path";

describe("fallbacks/import/route.ts — existingFallbackKeys() helper extraction", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/api/models/fallbacks/import/route.ts"),
    "utf-8",
  );

  it("declares the existingFallbackKeys() helper (1 declaration)", () => {
    const matches = source.match(/function\s+existingFallbackKeys\s*\(/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("has a JSDoc block on the helper explaining the O(1) membership guarantee", () => {
    // The JSDoc must mention "O(1)" (the byte-equivalence claim
    // for membership) and the `(provider, modelId)` key shape
    // (so future readers know what the Set is keyed by). The
    // JSDoc block sits immediately above the function
    // declaration, so anchor the regex on the `*/` closing
    // followed by the `function` keyword.
    const helperBlockMatch = source.match(
      /\/\*\*[\s\S]*?\*\/\s*\n\s*function\s+existingFallbackKeys/,
    );
    expect(helperBlockMatch).not.toBeNull();
    const block = helperBlockMatch![0];
    expect(block).toMatch(/O\(1\)/);
    expect(block).toMatch(/provider/);
    expect(block).toMatch(/modelId/);
  });

  it("calls existingFallbackKeys() from the GET branch (preview)", () => {
    // Locate the GET handler and confirm it uses the helper, not
    // the inline form. The GET block is between the `export async
    // function GET(` declaration and the next `export async
    // function POST(` declaration.
    const getMatch = source.match(
      /export\s+async\s+function\s+GET[\s\S]*?(?=export\s+async\s+function\s+POST)/,
    );
    expect(getMatch).not.toBeNull();
    const getBlock = getMatch![0];
    expect(getBlock).toMatch(/existingFallbackKeys\s*\(\s*\)/);
  });

  it("calls existingFallbackKeys() from the POST branch (import)", () => {
    // Locate the POST handler and confirm it uses the helper.
    const postMatch = source.match(
      /export\s+async\s+function\s+POST[\s\S]*$/,
    );
    expect(postMatch).not.toBeNull();
    const postBlock = postMatch![0];
    expect(postBlock).toMatch(/existingFallbackKeys\s*\(\s*\)/);
  });

  it("has no inline `existingChain = listFallbackChain()` declaration", () => {
    // The pre-session source had this 2-line pattern at 2 sites.
    // Post-session, the only `existingChain` reference must be
    // inside the helper (which uses `listFallbackChain()` not
    // `existingChain`).
    const matches = source.match(/existingChain\s*=\s*listFallbackChain\s*\(\s*\)/g) ?? [];
    expect(matches).toHaveLength(0);
  });

  it("has no inline `new Set(existingChain.map(` construction", () => {
    // The pre-session source had this 3-line Set constructor at
    // 2 sites. Post-session, the only `new Set(...)` must be
    // inside the helper.
    const matches = source.match(/new\s+Set\s*\(\s*existingChain\.map\s*\(/g) ?? [];
    expect(matches).toHaveLength(0);
  });

  it("has no inline `fallbackKey(e.provider, e.modelIdString)` outside the helper", () => {
    // The pre-session source had this at 2 sites. Post-session,
    // the only such call must be inside the helper body.
    // Split the source at the helper declaration, then look for
    // the inline call form in the remainder.
    const helperStart = source.indexOf("function existingFallbackKeys");
    expect(helperStart).toBeGreaterThan(-1);
    // Find the end of the helper — the closing `}` of its body.
    // Walk forward from the opening `{` to the matching `}` by
    // counting braces (the helper has no nested braces).
    const openBrace = source.indexOf("{", helperStart);
    expect(openBrace).toBeGreaterThan(-1);
    const closeBrace = source.indexOf("}", openBrace);
    expect(closeBrace).toBeGreaterThan(-1);
    const afterHelper = source.slice(closeBrace + 1);
    const matches = afterHelper.match(
      /fallbackKey\s*\(\s*e\.provider\s*,\s*e\.modelIdString\s*\)/g,
    ) ?? [];
    expect(matches).toHaveLength(0);
  });
});

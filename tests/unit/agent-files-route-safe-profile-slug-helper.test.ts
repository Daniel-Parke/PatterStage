/**
 * @jest-environment node
 *
 * Source-pattern test for the session 194 (List 4) `safeProfileSlug`
 * helper extraction in `src/app/api/agent/files/[key]/route.ts`.
 *
 * **The pattern we want to pin: the route has a file-local
 * `safeProfileSlug(profileParam: string | null): string` helper
 * that wraps the 2-line
 * `const prof = resolveSafeProfileName(profile); const profileSlug = prof.ok ? prof.profile : "default"`
 * pattern, and the GET + PUT try-blocks call the helper instead of
 * duplicating the inline form.**
 *
 * **Why this matters.** The pre-session route had the 2-line pattern
 * duplicated in 2 places (GET line 136-137, PUT line 214-215), each
 * inside the try-block AFTER `resolveFilePath` had already validated
 * the input. The defensive `"default"` fallback is unreachable in
 * practice (the caller would have hit a 400 from the upstream
 * `resolveFilePath` error path), but it's preserved for safety. A
 * future PR that changes the fallback (e.g. to throw, or to return
 * a different default) needs to update BOTH sites — easy to forget.
 * The file-local helper centralises the contract.
 *
 * Per the refactor-patterns-194 reference: this is the canonical
 * "Rule of Two for in-file helper extraction" — 2 sites in the same
 * file → extract a file-local helper, NOT promote to a shared module
 * (3+ sites across files would be the threshold for that).
 *
 * @see src/app/api/agent/files/[key]/route.ts — the consumer file
 *   (2 call sites in GET + PUT try-blocks)
 * @see src/lib/path-security.ts — `resolveSafeProfileName` (the
 *   validation helper that `safeProfileSlug` wraps)
 * @see references/refactor-patterns-194-rule-of-two-in-file-set-map-extraction.md
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");

const routeSrc = readFileSync(
  join(REPO_ROOT, "src", "app", "api", "agent", "files", "[key]", "route.ts"),
  "utf8",
);

/**
 * Strip block comments (JSDoc) and line comments from source so a
 * future "document the helper" PR adding a JSDoc that references
 * the pre-refactor inline form doesn't false-positive the
 * negative-assertion regexes.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

describe("session 194 agent/files route — safeProfileSlug helper extraction", () => {
  const code = stripComments(routeSrc);

  it("the route source file is readable", () => {
    expect(routeSrc.length).toBeGreaterThan(0);
  });

  it("declares a file-local safeProfileSlug helper with the expected signature", () => {
    // The helper takes a nullable string and returns a string.
    // Pinned by regex so a future "rename to defaultProfileSlug" or
    // "narrow the param to non-null string" PR is a deliberate edit
    // (the test fails, the author updates the pin + the 2 call
    // sites in lockstep).
    expect(code).toMatch(
      /function\s+safeProfileSlug\s*\(\s*profileParam:\s*string\s*\|\s*null\s*\)\s*:\s*string\s*\{/,
    );
  });

  it("the helper body calls resolveSafeProfileName and applies the default fallback", () => {
    // The body is the 2-line pattern in literal form — verify the
    // helper actually delegates to `resolveSafeProfileName` (not
    // a reimplementation) and applies the `"default"` fallback.
    // The `prof.ok ? prof.profile : "default"` ternary is the
    // canonical shape; a future "throw on invalid" change would
    // need to update the test pin.
    expect(code).toMatch(/resolveSafeProfileName\s*\(\s*profileParam\s*\)/);
    expect(code).toMatch(/prof\.ok\s*\?\s*prof\.profile\s*:\s*["']default["']/);
  });

  it("the GET and PUT try-blocks each call safeProfileSlug exactly once", () => {
    // The 2 call sites are:
    //   - GET try-block (the "managed-file hit" check uses
    //     `profileSlug` to call `readManagedFileContent`)
    //   - PUT try-block (the "profile not found" guard uses
    //     `profileSlug` to call `getProfile`)
    // Count = 2 (one per handler) and exactly 0 inline
    // `prof = resolveSafeProfileName(profile); profileSlug = ...`
    // declarations remain in the try-blocks.
    const callSites = code.match(/safeProfileSlug\s*\(\s*profile\s*\)/g) ?? [];
    expect(callSites).toHaveLength(2);
  });

  it("no inline prof = resolveSafeProfileName + profileSlug ternary in the try-blocks", () => {
    // The pre-session form was:
    //   const prof = resolveSafeProfileName(profile);
    //   const profileSlug = prof.ok ? prof.profile : "default";
    // After session 194, the inline form is gone from the try-blocks.
    // The helper itself still uses the inline form (it's the body
    // of the helper), so we split the file at the helper
    // declaration and assert the inline form is absent from the
    // rest of the file.
    const helperIdx = code.indexOf("function safeProfileSlug");
    expect(helperIdx).toBeGreaterThan(-1);
    const afterHelper = code.slice(helperIdx);
    // The helper body itself contains the pattern — check that
    // it's ONLY in the helper body (the body is the only place
    // where the pattern should appear post-refactor).
    const inlineMatches =
      afterHelper.match(
        /const\s+prof\s*=\s*resolveSafeProfileName[\s\S]*?prof\.ok\s*\?\s*prof\.profile\s*:\s*["']default["']/g,
      ) ?? [];
    // The helper body has 1 match (its own body). Anything > 1 means
    // an inline declaration snuck back into a try-block.
    expect(inlineMatches).toHaveLength(1);
  });

  it("the resolveFilePath helper still uses resolveSafeProfileName (the validation path is preserved)", () => {
    // The route has TWO uses of resolveSafeProfileName: one inside
    // the `safeProfileSlug` helper (the wrapped call) and one
    // inside `resolveFilePath` (the error-returning call). The
    // latter is the "if invalid → return error" branch that the
    // GET/PUT handlers rely on for the 400 response. Pin that the
    // `resolveFilePath` usage is preserved so a future "inline the
    // helper everywhere" PR doesn't accidentally drop the
    // validation path.
    expect(code).toMatch(
      /function\s+resolveFilePath[\s\S]*?resolveSafeProfileName\s*\(\s*profileParam\s*\)/,
    );
  });

  it("the helper JSDoc explains the default-fallback rationale", () => {
    // Pin the discoverability of the design choice — the
    // "defensive fallback" rationale lives in the helper's JSDoc
    // so a future "trim the JSDoc" PR doesn't silently drop the
    // explanation. The JSDoc references `resolveFilePath` and the
    // unreachable-but-preserved defensive `"default"` branch.
    expect(routeSrc).toMatch(/resolveFilePath/);
    expect(routeSrc).toMatch(/defensive fallback/i);
  });
});

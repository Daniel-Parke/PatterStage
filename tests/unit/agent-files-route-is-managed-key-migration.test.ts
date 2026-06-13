/**
 * @jest-environment node
 *
 * Source-pattern test for the session 192 (List 4) `isManagedKey`
 * migration in `src/app/api/agent/files/[key]/route.ts`.
 *
 * **The pattern we want to pin: the route uses `isManagedKey(key)`
 * from `@/lib/agent-file-store`, NOT a redeclared local
 * `MANAGED_KEYS = new Set<string>([...])` literal.** The helper
 * is the single source of truth for "is this key one of the 6
 * managed files the store can read+write?", and the route no
 * longer needs to redeclare the literal — the security-sensitive
 * `env` exclusion lives in the helper's JSDoc and runtime check,
 * not in the route.
 *
 * **Why this matters.** The pre-session route had a 6-string
 * literal `MANAGED_KEYS` Set that duplicated the `ManagedFileKey`
 * union already declared in `src/lib/agent-file-store.ts:6-13`. A
 * future PR that adds a 7th member to the union (e.g. a new
 * behavior file) would need to update TWO places (the union +
 * the Set literal) — easy to forget. With the helper, the
 * route is locked to the helper, and the union is the single
 * source of truth.
 *
 * Sister test to:
 *  - `tests/unit/agent-file-store-is-managed-key.test.ts` —
 *    pins the helper's runtime contract (6 true cases, env+auth
 *    excluded, etc.)
 *
 * @see src/lib/agent-file-store.ts — `isManagedKey` (the helper that
 *   owns the runtime check + JSDoc explaining the env exclusion)
 * @see src/app/api/agent/files/[key]/route.ts — the consumer
 *   (3 call sites: GET branch, PUT pre-write check, PUT write branch)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");

const routeSrc = readFileSync(
  join(REPO_ROOT, "src", "app", "api", "agent", "files", "[key]", "route.ts"),
  "utf8",
);
const storeSrc = readFileSync(
  join(REPO_ROOT, "src", "lib", "agent-file-store.ts"),
  "utf8",
);

/** Strip block comments (JSDoc) and line comments from source. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

describe("session 192 agent/files route — isManagedKey migration", () => {
  const code = stripComments(routeSrc);

  it("the route source file is readable", () => {
    expect(routeSrc.length).toBeGreaterThan(0);
  });

  it("the route imports isManagedKey from @/lib/agent-file-store", () => {
    expect(code).toMatch(
      /import\s*\{[\s\S]*?isManagedKey[\s\S]*?\}\s*from\s*["']@\/lib\/agent-file-store["']/,
    );
  });

  it("the route no longer declares a local MANAGED_KEYS Set literal", () => {
    // The pre-session form was:
    //   const MANAGED_KEYS = new Set<string>(["soul", "agent", ...]);
    // After session 192, the literal is gone — the helper owns the
    // set. Strip comments so a future JSDoc that references the
    // pre-refactor form doesn't false-positive.
    expect(code).not.toMatch(/new\s+Set<string>\s*\(\s*\[\s*["']soul["']/);
  });

  it("the route no longer references the local MANAGED_KEYS identifier", () => {
    // The pre-session form was `MANAGED_KEYS.has(key)` at 3 call
    // sites. After session 192, every call site reads
    // `isManagedKey(key)` — the bare `MANAGED_KEYS` identifier
    // (not the .has() suffix) is gone from the file.
    expect(code).not.toMatch(/\bMANAGED_KEYS\b/);
  });

  it("the route has 3 isManagedKey(key) call sites", () => {
    // The 3 call sites are: GET branch (line ~139, "managed-file
    // hit" check), PUT pre-write check (line ~217, "profile not
    // found" early-return guard), and PUT write branch (line ~237,
    // "managed-file write" branch dispatch). All 3 must use the
    // helper — count = 3, not 0 (the migration is real) and not
    // 1 or 2 (no call site got missed).
    const callSites = code.match(/isManagedKey\(\s*key\s*\)/g) ?? [];
    expect(callSites).toHaveLength(3);
  });

  it("the helper exists in agent-file-store.ts and is exported", () => {
    // The helper declaration is the runtime check; if a future PR
    // deletes the helper, the route's import becomes a TS2305
    // error and this test catches the regression before runtime.
    const storeCode = stripComments(storeSrc);
    expect(storeCode).toMatch(
      /export\s+function\s+isManagedKey\s*\(\s*key:\s*string\s*\):\s*key\s+is\s+ManagedFileKey/,
    );
  });

  it("the helper documents the env exclusion in its JSDoc", () => {
    // The security-sensitive env exclusion is documented in the
    // helper's JSDoc (not just in the runtime check). The
    // JSDoc-stripped storeCode would hide this — pin the JSDoc
    // text directly so a future "trim the JSDoc" PR doesn't
    // accidentally drop the env-exclusion rationale.
    expect(storeSrc).toMatch(/security-sensitive excluded case/);
    expect(storeSrc).toMatch(/getBehaviorFiles\(\)/);
  });
});

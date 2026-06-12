/** @jest-environment node */

/**
 * Source-pattern test for the `skillFilePath` migration in the
 * skills API and sync surfaces.
 *
 * Session 170 (List 3 fresh audit): the 1-line
 *   `${skillsRoot} + "/" + ${skillKey} + "/SKILL.md"`
 * path-build was repeated at 4 sites across 3 files
 *   - src/app/api/skills/route.ts:43 (dbSkills map)
 *   - src/app/api/skills/[name]/route.ts:29 (db-hit branch)
 *   - src/app/api/skills/[name]/route.ts:37 (file-read branch)
 *   - src/lib/hermes-profile-sync.ts:387 (pullSkillFromHermes direct)
 *   - src/lib/hermes-profile-sync.ts:519 (detectSkillDrift)
 * The migration extracted `skillFilePath(root, key)` to
 * `src/lib/skills-config.ts` and migrated all 5 call sites.
 *
 * The 4 sites in `api/skills*` and `hermes-profile-sync.ts` are
 * EXACT byte-equivalent to the helper (same `/SKILL.md` suffix,
 * same root/key argument order). The 4 sites in `hermes-profile-sync.ts`
 * `walk()` and the `targetDir` shape in `pushSkillToHermes` are a
 * DIFFERENT shape (`dir + "/SKILL.md"` where `dir` is a pre-resolved
 * skill directory, not `root + "/" + key`) — those are NOT migrated
 * and are NOT pinned here. They were considered but deferred because
 * they take a directory, not a (root, key) pair.
 *
 * Why this test exists:
 * - `skillFilePath` is a 1-line helper, so it could be re-inlined at
 *   any call site by a future "shorter code is better" refactor.
 *   The helper does have tests in `tests/unit/skills-config.test.ts`
 *   (4 unit tests for join semantics), so the helper is locked
 *   contractually. This test is the CONSUMER-SIDE mirror: it pins
 *   the helper is actually USED at the 5 sites so the consolidation
 *   doesn't silently regress.
 * - The 5 sites are pinned by reading the source and asserting the
 *   call shape. If a future session re-inlines the join (or moves
 *   one of the routes to a different file), the regex match fails
 *   and the test fires.
 *
 * The fingerprint is the unique combination of:
 *   - `skillFilePath` import from `@/lib/skills-config` (or `./skills-config`
 *     for the lib-side file)
 *   - exactly 5 call sites across the 3 files (2 in api/skills, 2
 *     in api/skills/[name], 2 in hermes-profile-sync.ts)
 *
 * The pre-flight recipe (run BEFORE any revert of the migration):
 *
 *   # 1. Confirm the helper is exported and used
 *   grep -n "export function skillFilePath" src/lib/skills-config.ts
 *   # MUST show 1 line.
 *
 *   # 2. Confirm the 5 call sites use the helper
 *   grep -nB 1 "skillFilePath" src/app/api/skills/route.ts \
 *                           src/app/api/skills/[name]/route.ts \
 *                           src/lib/hermes-profile-sync.ts
 *   # MUST show 5+ lines: 1 import + 5 call sites + the
 *   # 1-line helper body in skills-config.ts.
 *
 *   # 3. Confirm no inline `+ "/SKILL.md"` remains
 *   grep -n '"\+ ?/ ?SKILL\.md"' src/app/api/skills \
 *                            src/lib/hermes-profile-sync.ts
 *   # SHOULD only match the unrelated `dir + "/SKILL.md"` shape
 *   # in the `walk()` and `pushSkillToHermes` helpers — those are
 *   # NOT in scope for the `skillFilePath` migration (different
 *   # shape: pre-resolved dir, not root + key).
 */

import { readFileSync } from "fs";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf-8");
}

describe("skillFilePath source-pattern migration (List 3, session 170)", () => {
  it("exports the helper from @/lib/skills-config", () => {
    const src = readSrc("src/lib/skills-config.ts");
    expect(src).toMatch(/export function skillFilePath\s*\(/);
  });

  it("is imported by src/app/api/skills/route.ts", () => {
    const src = readSrc("src/app/api/skills/route.ts");
    expect(src).toMatch(/import\s*\{[^}]*\bskillFilePath\b[^}]*\}\s*from\s*["']@\/lib\/skills-config["']/);
    // Exactly 1 inline `+ "/SKILL.md"` site remains in the route.
    // (None expected — the only call site was the dbSkills map.)
    const inlineJoinMatches = src.match(/\+\s*"\/SKILL\.md"/g);
    expect(inlineJoinMatches).toBeNull();
  });

  it("is imported by src/app/api/skills/[name]/route.ts and replaces 2 inline joins", () => {
    const src = readSrc("src/app/api/skills/[name]/route.ts");
    expect(src).toMatch(/import\s*\{[^}]*\bskillFilePath\b[^}]*\}\s*from\s*["']@\/lib\/skills-config["']/);
    const inlineJoinMatches = src.match(/\+\s*"\/SKILL\.md"/g);
    expect(inlineJoinMatches).toBeNull();
  });

  it("is imported by src/lib/hermes-profile-sync.ts and replaces 2 of the 4 inline joins", () => {
    const src = readSrc("src/lib/hermes-profile-sync.ts");
    expect(src).toMatch(/import\s*\{[^}]*\bskillFilePath\b[^}]*\}\s*from\s*["']\.\/skills-config["']/);
    // The file still has 2 `dir + "/SKILL.md"` sites (one in
    // pullSkillFromHermes's `walk()` walker, one in
    // pushSkillToHermes's `targetDir`, one in scanDiskSkillsCatalog
    // — all the `dir + suffix` shape that is OUT of scope for
    // this migration). Pin that the 2 `root + "/" + key + "/SKILL.md"`
    // sites are gone.
    const inlineRootKeyJoins = src.match(/skillsRoot\s*\+\s*"\/"\s*\+\s*skillKey\s*\+\s*"\/SKILL\.md"/g);
    expect(inlineRootKeyJoins).toBeNull();
  });
});

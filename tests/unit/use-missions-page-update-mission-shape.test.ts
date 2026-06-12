/**
 * @jest-environment node
 *
 * Source-pattern test pinning the `updateMission(id, updater)` helper
 * shape in `src/hooks/useMissionsPage.ts`.
 *
 * Why this test exists: the session 180 `updateSession(sessionId,
 * updater)` helper in the chat page generalised the `setSessions((prev)
 * => prev.map((s) => s.id === X ? { ...s, ...FIELD } : s))` pattern +
 * `updated_at` stamp. The missions-page equivalent (`updateMission`)
 * applies the same id-discriminator + setMissions((prev) => prev.map
 * ((m) => m.id === X ? updater(m) : m)) shape.
 *
 * The 2 callsites in `useMissionsPage.handleCancel` (the optimistic
 * status flip + the restoreMission closure) collapsed from 3-line
 * inline setMissions blocks to single-line `updateMission(id, ...)`
 * calls. This test pins:
 *   1. The `updateMission` identifier is defined in the file (positive).
 *   2. The 2 callsites use the canonical `(id, updater)` call shape
 *      (positive — both are in the `handleCancel` body).
 *   3. No remaining inline `setMissions((prev) =>` pattern with
 *      `m.id === ` discriminator (negative — the helper now owns
 *      the id-discriminator + setState((prev) => prev.map(...))
 *      shape, so a duplicated inline site is a regression).
 *
 * Pre-flight recipe for a future "drop the helper, inline the 2
 * callsites" PR: this test will fail with a positive `updateMission`
 * count of 0 + a positive `setMissions((prev) =>` count of 2 — the
 * tell that the helper was removed without migrating the 2 callsites
 * (or vice versa).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const FILE_PATH = join(REPO_ROOT, "src", "hooks", "useMissionsPage.ts");

// Strip block + line comments so a JSDoc-style migration note
// (the new helper's JSDoc has an inline `setMissions((prev) =>
// prev.map((m) => m.id === ID ? updater(m) : m))` reference) doesn't
// false-positive the negative assertion. Same pre-filter pattern as
// the session 172 / 178 / 181 tests.
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("useMissionsPage — updateMission helper shape", () => {
  const rawSource = readFileSync(FILE_PATH, "utf-8");
  const code = stripComments(rawSource);

  it("defines the updateMission helper (positive)", () => {
    // The `useCallback` definition. Match the `const updateMission =`
    // declaration so a future "rename to setMissionById" or similar
    // trip this test (the helper contract moves with the rename).
    const matches = code.match(/const\s+updateMission\s*=\s*useCallback/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(1);
  });

  it("calls updateMission with the canonical (id, updater) shape at 2 sites (positive)", () => {
    // Both callsites are inside `handleCancel` (the optimistic status
    // flip + the restoreMission closure body). A future 3rd
    // callsite — e.g. for "promote a draft mission's status
    // optimistically" — should also use the helper, so this test is
    // a per-callsite count.
    const matches = code.match(/updateMission\s*\(\s*id\s*,/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(2);
  });

  it("does NOT contain a remaining inline setMissions((prev) => prev.map((m) => m.id === ...) form (negative)", () => {
    // The pre-extraction inline form was:
    //   setMissions((prev) =>
    //     prev.map((m) =>
    //       m.id === id ? { ...m, ...FIELD } : m,
    //     ),
    //   );
    // The id-discriminator + setState((prev) => prev.map(...)) shape
    // is now owned by `updateMission`. A duplicated inline site is a
    // regression — would mean the 2 callsites were re-inlined without
    // a corresponding helper removal (or a 3rd inline site was added).
    const inlineMatches = code.match(
      /setMissions\(\s*\(prev\)\s*=>\s*prev\.map\(\s*\(m\)\s*=>\s*\n?\s*m\.id\s*===\s*/g,
    );
    expect(inlineMatches).toBeNull();
  });

  it("does NOT re-import useState in the helper definition (the helper composes existing setMissions)", () => {
    // Sanity check: the helper body is `setMissions((prev) => ...)`,
    // not a fresh `useState<MissionRow[]>(...)` declaration. A
    // future "make the helper self-contained with its own state" PR
    // would break the contract — the helper is a setter-pair wrapper
    // around the existing setMissions, not its own state owner.
    const updateMissionBlock = code.match(
      /const\s+updateMission\s*=\s*useCallback[\s\S]*?\n\s*\[/,
    );
    expect(updateMissionBlock).not.toBeNull();
    expect(updateMissionBlock?.[0]).not.toMatch(/useState\s*</);
    expect(updateMissionBlock?.[0]).toMatch(/setMissions\s*\(\s*\(prev\)/);
  });
});

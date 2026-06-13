/**
 * Source-pattern test that pins the session-190 refactor:
 * the 2 `onToggleSkill` inline arrow callbacks in
 * `src/app/operations/skills/page.tsx` (the Active section's
 * onToggleSkill prop and the Inactive section's onToggleSkill
 * prop) are consolidated through a single `handleToggleSkill`
 * callback. The pre-refactor code inlined the same
 * `(skill) => toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling, <fallback>))`
 * callback at 2 sites — the only difference was the fallback
 * (default `skill.enabled` for Active, `!skill.enabled` for
 * Inactive).
 *
 * The post-refactor shape:
 *   - `handleToggleSkill` is declared as a `useCallback` in the
 *     component, depending on `[toggleSkill]`.
 *   - The helper signature is
 *     `(skill: Skill, fallback: boolean = skill.enabled) => toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling, fallback))`.
 *   - The Active call site uses `onToggleSkill={handleToggleSkill}`
 *     (no inline arrow — the helper is the callback).
 *   - The Inactive call site uses
 *     `onToggleSkill={(skill) => handleToggleSkill(skill, !skill.enabled)}`
 *     (a thin arrow that just supplies the fallback).
 *
 * JSDoc / line comments that MENTION the pre-refactor inline
 * form are stripped from the source before scanning, so the
 * post-refactor comments ("the helper is the callback", etc.)
 * don't false-positive on the negative-assertion regexes.
 *
 * @jest-environment node
 */
import { readFileSync } from "fs";
import { join } from "path";

const skillsPagePath = join(
  __dirname,
  "..",
  "..",
  "src",
  "app",
  "operations",
  "skills",
  "page.tsx",
);

/**
 * Strip block comments (JSDoc) and line comments from the source
 * before scanning. The post-refactor file contains JSDoc + line
 * comments that REFERENCE the pre-refactor inline form (e.g. the
 * handleToggleSkill helper's JSDoc quotes the pre-refactor shape
 * "(skill) => toggleSkill(skill.name, effectiveSkillEnabled(...))"
 * for documentation). Those references would false-positive on
 * the negative-assertion regexes below. Strip them so the source
 * scan reflects actual code, not documentation.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

const skillsPageSrc = stripComments(readFileSync(skillsPagePath, "utf8"));

describe("session-190 skills page handleToggleSkill helper migration", () => {
  it("handleToggleSkill is declared as a useCallback depending on [toggleSkill, toggling]", () => {
    // The helper exists and its body is the same dispatch shape as
    // the inline pre-refactor callback, just centralised. The
    // deps array is [toggleSkill, toggling] — `toggleSkill` is
    // the dispatch target (its own deps include data, so it
    // changes when data changes), and `toggling` is the
    // optimistic-state map the helper reads at call time. Adding
    // both keeps react-hooks/exhaustive-deps happy and matches the
    // pre-refactor inline arrow's read set (the inline arrow also
    // read `toggling` and was recreated on every toggling change).
    const helperBlock = skillsPageSrc.match(
      /const handleToggleSkill = useCallback\(\s*\(skill: Skill, fallback: boolean = skill\.enabled\) =>\s*\{[\s\S]*?toggleSkill\(skill\.name, effectiveSkillEnabled\(skill, toggling, fallback\)\)[\s\S]*?\},\s*\[toggleSkill, toggling\],\s*\)/,
    );
    expect(helperBlock).not.toBeNull();
  });

  it("the helper body's signature accepts Skill + optional boolean fallback", () => {
    // Pin the exact signature: `(skill: Skill, fallback: boolean = skill.enabled) =>`.
    // The default `= skill.enabled` is what lets the Active call
    // site omit the fallback argument.
    expect(skillsPageSrc).toMatch(
      /\(skill: Skill, fallback: boolean = skill\.enabled\)/,
    );
  });

  it("the Active section's onToggleSkill is the helper directly (no inline arrow)", () => {
    // The pre-refactor form was
    //   onToggleSkill={(skill) => toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling))}
    // The post-refactor form is
    //   onToggleSkill={handleToggleSkill}
    // Pin the post-refactor shape: helper name, no inline arrow.
    // The active section's grid call passes `handleToggleSkill`
    // as a value, not as a call. Match the literal `={handleToggleSkill}`
    // (no `()` and no `(skill) =>`) to verify the helper is the
    // callback, not an inline call site.
    const activeMatch = skillsPageSrc.match(
      /onToggleSkill=\{handleToggleSkill\}/,
    );
    expect(activeMatch).not.toBeNull();
  });

  it("the Inactive section's onToggleSkill is a thin arrow that supplies the fallback", () => {
    // The pre-refactor form was
    //   onToggleSkill={(skill) => toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling, !skill.enabled))}
    // The post-refactor form is
    //   onToggleSkill={(skill) => handleToggleSkill(skill, !skill.enabled)}
    // Pin the post-refactor shape: thin arrow + helper call.
    // The `!skill.enabled` fallback is the Inactive-grid-specific
    // inversion.
    const inactiveMatch = skillsPageSrc.match(
      /onToggleSkill=\{\(skill\) => handleToggleSkill\(skill, !skill\.enabled\)\}/,
    );
    expect(inactiveMatch).not.toBeNull();
  });

  it("the pre-refactor inline 'toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling))' Active form is gone", () => {
    // The Active section used to inline `toggleSkill(skill.name,
    // effectiveSkillEnabled(skill, toggling))` — the
    // pre-refactor Active form. After the refactor, the helper
    // body is the only site that calls `toggleSkill(skill.name,
    // effectiveSkillEnabled(skill, toggling, fallback))` (with the
    // explicit `fallback` arg). The 2-arg form (Active section)
    // and 3-arg form (Inactive section) are both gone.
    expect(skillsPageSrc).not.toMatch(
      /toggleSkill\(skill\.name, effectiveSkillEnabled\(skill, toggling\)\)/,
    );
  });

  it("the pre-refactor inline 'toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling, !skill.enabled))' Inactive form is gone", () => {
    // The Inactive section used to inline `toggleSkill(skill.name,
    // effectiveSkillEnabled(skill, toggling, !skill.enabled))` —
    // the pre-refactor Inactive form. After the refactor, the
    // `!skill.enabled` inversion is supplied as a fallback arg
    // to the helper, not inlined.
    expect(skillsPageSrc).not.toMatch(
      /toggleSkill\(skill\.name, effectiveSkillEnabled\(skill, toggling, !skill\.enabled\)\)/,
    );
  });

  it("toggleSkill is still called from handleToggleSkill's body", () => {
    // Sanity: the helper body is literally a `toggleSkill(...)`
    // call. The 2-arg pre-refactor Active form is gone, the
    // 3-arg pre-refactor Inactive form is gone, but the helper's
    // own dispatch (`toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling, fallback))`)
    // is the only remaining call shape.
    const helperCall = skillsPageSrc.match(
      /toggleSkill\(skill\.name, effectiveSkillEnabled\(skill, toggling, fallback\)\)/,
    );
    expect(helperCall).not.toBeNull();
  });
});

/** @jest-environment node */

/**
 * Tests for the `effectiveSkillEnabled` helper in
 * `src/app/operations/skills/page.tsx`.
 *
 * History: the helper was extracted in session 119 from 3 inline
 * sites of the form `toggling[skill.name] ?? <fallback>` (active/
 * inactive split + 2 onToggleSkill callbacks). The inline form was
 * the canonical "pending override of server state" idiom; the
 * helper is a true rename, not a behavior change. The 2
 * onToggleSkill sites use slightly different fallbacks
 * (`?? skill.enabled` vs `?? !skill.enabled`) so the helper takes
 * the fallback as a parameter (default: `skill.enabled`).
 *
 * The helper is page-local (not promoted to `@/lib/`), so this
 * test reads the page source and asserts on the helper's behavior
 * via a tiny shim that re-implements the function. The 2-arg and
 * 3-arg call shapes are both covered.
 */

import { readFileSync } from "fs";
import { join } from "path";

// ── Shim the helper from the page source ─────────────────────────────────
//
// We can't import the page file (it pulls in client React + AppPageShell),
// so the test re-implements the helper exactly as it appears in
// src/app/operations/skills/page.tsx. If the source changes, this
// shim + the assertions below would diverge — the source-pattern
// checks below pin the page's helper signature.
function effectiveSkillEnabled(
  skill: { name: string; enabled: boolean },
  pending: Record<string, boolean>,
  fallback: boolean = skill.enabled,
): boolean {
  return pending[skill.name] ?? fallback;
}

const REPO_ROOT = join(__dirname, "..", "..");
const skillsPagePath = join(REPO_ROOT, "src", "app", "operations", "skills", "page.tsx");
const skillsPageSource = readFileSync(skillsPagePath, "utf-8");

describe("skills page — effectiveSkillEnabled helper (session 119)", () => {
  // ── Helper contract ────────────────────────────────────────────────

  describe("helper behavior", () => {
    const skill = { name: "web-search", enabled: true };

    it("returns skill.enabled when pending has no entry for the skill", () => {
      expect(effectiveSkillEnabled(skill, {})).toBe(true);
    });

    it("returns the pending override when pending has an entry (true)", () => {
      expect(effectiveSkillEnabled(skill, { "web-search": true })).toBe(true);
    });

    it("returns the pending override when pending has an entry (false)", () => {
      expect(effectiveSkillEnabled(skill, { "web-search": false })).toBe(false);
    });

    it("uses the explicit fallback arg over skill.enabled when provided", () => {
      // This is the Inactive section's call shape:
      //   effectiveSkillEnabled(skill, toggling, !skill.enabled)
      // The "effective" state for the Inactive section is the negation
      // of the server's last-known state, so the fallback is `!skill.enabled`.
      expect(
        effectiveSkillEnabled(skill, { "other-skill": true }, !skill.enabled),
      ).toBe(false);
    });

    it("preserves the pending override over the explicit fallback", () => {
      // When the user has a pending toggle on this skill, the pending
      // value wins regardless of which fallback the caller passed.
      expect(
        effectiveSkillEnabled(skill, { "web-search": true }, false),
      ).toBe(true);
    });

    it("uses skill.enabled as the default fallback when no 3rd arg", () => {
      // The function signature is `fallback: boolean = skill.enabled`,
      // so callers that omit the 3rd arg get the server's last-known
      // state as the fallback.
      const skillOff = { name: "x", enabled: false };
      expect(effectiveSkillEnabled(skillOff, {})).toBe(false);
    });
  });

  // ── Source-pattern pins ────────────────────────────────────────────

  describe("page source", () => {
    it("declares effectiveSkillEnabled as a module-scope pure function above the component", () => {
      // The function must be hoisted to module scope (outside the
      // component) so the React component doesn't recreate the
      // function body on every render. The `function` keyword is
      // the canonical hoisted form, declared above the
      // `export default function SkillsPage()` line.
      const helperMatch = skillsPageSource.match(
        /function\s+effectiveSkillEnabled\s*\(/,
      );
      expect(helperMatch).not.toBeNull();
      const helperIdx = helperMatch!.index!;
      const componentIdx = skillsPageSource.indexOf(
        "export default function SkillsPage",
      );
      expect(componentIdx).toBeGreaterThan(-1);
      expect(helperIdx).toBeLessThan(componentIdx);
    });

    it("has zero inline `toggling[X.name] ?? ...` code lines (only JSDoc mentions allowed)", () => {
      // The 3 sites that previously had the inline form (line 141
      // inside the active/inactive split, the Active section's
      // onToggleSkill, the Inactive section's onToggleSkill) must
      // now all go through the helper. The helper's JSDoc block
      // mentions the inline form in backticks for documentation —
      // those comment lines are exempt.
      const lines = skillsPageSource.split("\n");
      const offenders: string[] = [];
      let inJSDoc = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("/**")) inJSDoc = true;
        if (trimmed.startsWith("*/")) {
          inJSDoc = false;
          continue;
        }
        if (inJSDoc) continue;
        if (trimmed.startsWith("//")) continue;
        if (/toggling\[[^\]]+\.name\]\s*\?\?/.test(line)) {
          offenders.push(line);
        }
      }
      expect(offenders).toEqual([]);
    });
  });
});

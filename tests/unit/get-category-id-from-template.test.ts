/**
 * Unit tests for the `getCategoryIdFromTemplate` helper in
 * src/hooks/useMissionsPage.ts.
 *
 * The helper centralises the `(t as MissionTemplate & { categoryId?:
 * string }).categoryId ?? <fallback>` cast that was duplicated at 3
 * callsites in the hook (`applyTemplateToForm`, the `fetchData`
 * template-apply path, and `templateCategoryPills`). The 3 callsites
 * used 3 different fallbacks (`null`, `null`, `"general"`) so the
 * helper accepts the fallback as a 2nd parameter and defaults to
 * `null` (the most common case).
 *
 * The tests below lock the 4 contracts of the helper:
 *   1. Template WITH legacy `categoryId` → returns the id
 *   2. Template WITHOUT `categoryId` → returns the default `null`
 *   3. Template WITHOUT `categoryId`, explicit fallback → returns the
 *      explicit fallback (the `templateCategoryPills` use case with
 *      the `"general"` bucket name)
 *   4. Empty-string `categoryId` → returns the empty string (NOT
 *      the fallback — empty string is a valid value, not "missing")
 *
 * Contract 4 is the "?? fallback only fires on undefined/null"
 * discipline — the inline form used `??` (not `||`), and the helper
 * preserves that.
 */
import { getCategoryIdFromTemplate } from "@/lib/missions/mission-composer-utils";
import type { MissionTemplate } from "@/components/missions/TemplateModals";

function makeTemplate(overrides: Partial<MissionTemplate> = {}): MissionTemplate {
  return {
    id: "tpl-1",
    name: "Sample",
    icon: "Zap",
    color: "cyan",
    category: "general",
    profile: "default",
    description: "",
    instruction: "do the thing",
    context: "",
    goals: [],
    suggestedSkills: [],
    ...overrides,
  };
}

describe("getCategoryIdFromTemplate", () => {
  it("returns the legacy categoryId when the template carries one", () => {
    const t = makeTemplate();
    expect(getCategoryIdFromTemplate(t as MissionTemplate & { categoryId?: string })).toBeNull();
    const t2 = makeTemplate();
    (t2 as MissionTemplate & { categoryId?: string }).categoryId = "cat-42";
    expect(getCategoryIdFromTemplate(t2 as MissionTemplate & { categoryId?: string })).toBe("cat-42");
  });

  it("returns null by default when the template has no categoryId", () => {
    const t = makeTemplate();
    expect(getCategoryIdFromTemplate(t)).toBeNull();
  });

  it("returns the explicit fallback when categoryId is missing (templateCategoryPills use case)", () => {
    const t = makeTemplate();
    expect(getCategoryIdFromTemplate(t, "general")).toBe("general");
  });

  it("returns the empty string when categoryId is an empty string (?? not ||)", () => {
    const t = makeTemplate();
    (t as MissionTemplate & { categoryId?: string }).categoryId = "";
    // Empty string is a valid value, not a "missing" sentinel — the
    // helper uses `??` not `||`, so the empty string wins.
    expect(getCategoryIdFromTemplate(t, "general")).toBe("");
    expect(getCategoryIdFromTemplate(t)).toBe("");
  });

  it("returns null when categoryId is explicitly null and fallback is null", () => {
    const t = makeTemplate();
    (t as MissionTemplate & { categoryId?: string | null }).categoryId = null;
    // `null` IS a "missing" sentinel under `??`, so the fallback fires.
    expect(getCategoryIdFromTemplate(t, "general")).toBe("general");
    expect(getCategoryIdFromTemplate(t)).toBeNull();
  });

  it("falls back to null when categoryId is explicitly undefined", () => {
    const t = makeTemplate();
    (t as MissionTemplate & { categoryId?: string }).categoryId = undefined;
    expect(getCategoryIdFromTemplate(t, "general")).toBe("general");
  });
});

/**
 * Source-pattern test that pins the session-190 refactor:
 * the 3 sites in useMissionsPage.ts that read the legacy
 * `categoryId` field go through `getCategoryIdFromTemplate`,
 * and the redundant `(t as MissionTemplate & { isCustom?: boolean })`
 * cast at the handleSaveAsTemplate existingTemplate lookup is gone.
 *
 * Also pins that `handleEditTemplate` and the
 * `TemplateManagerModalProps.onEditTemplate` callback signature
 * no longer carry the redundant `isCustom?` / `instruction?` /
 * `context?` / `dispatchMode?` / `schedule?` intersection fields —
 * all 5 are already on the `MissionTemplate` interface itself.
 *
 * JSDoc / line comments that MENTION the pre-refactor cast are
 * stripped from the source before scanning, so the post-refactor
 * comments ("the cast was redundant", etc.) don't false-positive
 * on the negative-assertion regexes.
 *
 * @jest-environment node
 */
import { readFileSync } from "fs";
import { join } from "path";

const useMissionsPagePath = join(
  __dirname,
  "..",
  "..",
  "src",
  "hooks",
  "useMissionsPage.ts",
);
const templateModalsPath = join(
  __dirname,
  "..",
  "..",
  "src",
  "components",
  "missions",
  "TemplateModals.tsx",
);
/**
 * Strip block comments (JSDoc) and line comments from the source
 * before scanning. The post-refactor file contains JSDoc + line
 * comments that REFERENCE the pre-refactor cast shape
 * (e.g. "the prior `(t as MissionTemplate & { ... })` was
 * redundant") — those comments would false-positive on the
 * negative-assertion regexes below. Strip them so the source
 * scan reflects actual code, not documentation.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

const useMissionsPageSrc = stripComments(readFileSync(useMissionsPagePath, "utf8"));
const templateModalsSrc = stripComments(readFileSync(templateModalsPath, "utf8"));

describe("session-190 useMissionsPage categoryId helper migration", () => {
  it("getCategoryIdFromTemplate is imported (self-import in this file)", () => {
    // The helper is exported from the same file, so the in-file
    // references are the 3 callsites (applyTemplateToForm,
    // fetchData template-apply, templateCategoryPills).
    const callsites = useMissionsPageSrc.match(/getCategoryIdFromTemplate\(/g) ?? [];
    // 1 declaration + 3 callsites = 4
    expect(callsites.length).toBe(4);
  });

  it("no inline '(t as MissionTemplate & { categoryId?: string })' cast remains at callsites", () => {
    // The legacy cast was at 3 callsites; the helper now owns it.
    // The helper body itself contains the cast (line 57), so the
    // exact phrase is expected to appear EXACTLY ONCE in the file
    // (the helper declaration). Pin the count to 1, not 0 — the
    // helper body is the single source of truth, and the test
    // catches any new callsite that re-introduces the inline form.
    const occurrences = useMissionsPageSrc.match(
      /\(t as MissionTemplate & \{ categoryId\?: string \}\)/g,
    );
    expect(occurrences).not.toBeNull();
    expect(occurrences!.length).toBe(1);
  });

  it("the redundant '(t as MissionTemplate & { isCustom?: boolean })' cast is gone from handleSaveAsTemplate", () => {
    // The cast was redundant because `isCustom?: boolean` is
    // already declared on the `MissionTemplate` interface
    // (TemplateModals.tsx:67). The session-190 refactor dropped it
    // and reads `t.isCustom` directly. Pin the absence here.
    expect(useMissionsPageSrc).not.toMatch(
      /\(t as MissionTemplate & \{ isCustom\?: boolean \}\)/,
    );
  });

  it("handleEditTemplate accepts a plain MissionTemplate (no intersection)", () => {
    // The 5-field intersection `MissionTemplate & { isCustom?:
    // boolean; instruction?: string; context?: string;
    // dispatchMode?: string; schedule?: string; }` was redundant —
    // all 5 fields are already on the `MissionTemplate` interface.
    // Post-refactor: `handleEditTemplate` takes a plain
    // `MissionTemplate`. The intersection fields are not in the
    // file.
    const handleEditTemplateBlock = useMissionsPageSrc.match(
      /const handleEditTemplate = useCallback\(\s*\(([^{]*?)\)\s*=>\s*\{/,
    );
    expect(handleEditTemplateBlock).not.toBeNull();
    const paramText = handleEditTemplateBlock![1].trim();
    expect(paramText).toBe("t: MissionTemplate");
    // Sanity: the `isCustom?` / `instruction?` intersection shape
    // is not declared anywhere in useMissionsPage.ts.
    expect(useMissionsPageSrc).not.toMatch(
      /MissionTemplate & \{\s*isCustom\?: boolean;\s*instruction\?: string;\s*context\?: string;\s*dispatchMode\?: string;\s*schedule\?: string;\s*\}/,
    );
  });

  it("TemplateManagerModalProps.onEditTemplate accepts a plain MissionTemplate (no intersection)", () => {
    // Same redundant-intersection cleanup on the consumer side —
    // the `onEditTemplate` prop in TemplateModals.tsx:131 also had
    // the same 5-field intersection. Pin the post-refactor shape.
    const onEditTemplateBlock = templateModalsSrc.match(
      /onEditTemplate: \(([^{]*?)\) => void/,
    );
    expect(onEditTemplateBlock).not.toBeNull();
    const paramText = onEditTemplateBlock![1].trim();
    expect(paramText).toBe("t: MissionTemplate");
    expect(templateModalsSrc).not.toMatch(
      /MissionTemplate & \{\s*isCustom\?: boolean;\s*instruction\?: string;\s*context\?: string;\s*dispatchMode\?: string;\s*schedule\?: string;\s*\}/,
    );
  });

  it("templateCategoryPills uses the helper with the 'general' fallback", () => {
    // The 3rd call site reads with the "general" bucket fallback.
    // Pin the post-refactor shape — the inline cast is gone, the
    // helper name is present, the fallback is the bucket name.
    const useMemoBlock = useMissionsPageSrc.match(
      /const templateCategoryPills = useMemo\(\(\) => \{[\s\S]*?\n\s*\}, \[templates, categories\]\);/,
    );
    expect(useMemoBlock).not.toBeNull();
    const block = useMemoBlock![0];
    expect(block).toMatch(/getCategoryIdFromTemplate\(t, "general"\)/);
    expect(block).not.toMatch(/\(t as MissionTemplate & \{ categoryId\?: string \}\)/);
  });

  it("applyTemplateToForm uses the helper at the categoryId line", () => {
    // The 1st call site: applyTemplateToForm reads categoryId with
    // the `null` default (the helper's default). The `setNewCategoryId`
    // call inside applyTemplateToForm has the helper name.
    // Anchor on the call shape: `setNewCategoryId(\s*categoryIdOverride !== undefined`
    // — that's the only call site in the file.
    const applyBlock = useMissionsPageSrc.match(
      /setNewCategoryId\(\s*categoryIdOverride !== undefined[\s\S]*?getCategoryIdFromTemplate\(t\)[\s\S]*?\);/,
    );
    expect(applyBlock).not.toBeNull();
  });

  it("fetchData template-apply path uses the helper at the cid line", () => {
    // The 2nd call site: the `fetchData` template-apply path
    // computes `const cid = ...;` and passes it to
    // `applyTemplateToForm` and `rememberLastCategory`. The cast
    // is now a `getCategoryIdFromTemplate(t)` call (default null).
    const fetchDataBlock = useMissionsPageSrc.match(
      /if \(t\) \{\s*const cid = getCategoryIdFromTemplate\(t\);/,
    );
    expect(fetchDataBlock).not.toBeNull();
  });
});

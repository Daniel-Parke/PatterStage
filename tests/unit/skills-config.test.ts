/** @jest-environment node */

import {
  buildDisabledYamlLines,
  collectSkillDirectoryNames,
  computeEffectiveDisabledFromYaml,
  normalizeDisabledSkillKeys,
  parseSkillsDisabledFromYaml,
  skillFilePath,
} from "@/modules/hermes/lib/skills-config";

describe("parseSkillsDisabledFromYaml", () => {
  it("returns empty disabled lists when skills section has no disabled key", () => {
    const yaml = "version: 1\nskills:\n  other: true\n";
    const parsed = parseSkillsDisabledFromYaml(yaml);
    expect([...parsed.disabledNames]).toEqual([]);
  });

  it("returns empty disabled lists when there is no skills section", () => {
    const parsed = parseSkillsDisabledFromYaml("version: 1\n");
    expect([...parsed.disabledNames]).toEqual([]);
  });

  it("parses multiline disabled list", () => {
    const yaml = "skills:\n  disabled:\n    - foo\n    - bar\n";
    const parsed = parseSkillsDisabledFromYaml(yaml);
    expect(parsed.disabledNames.has("foo")).toBe(true);
    expect(parsed.disabledNames.has("bar")).toBe(true);
  });

  it("parses inline disabled and platform_disabled arrays", () => {
    const yaml = [
      "skills:",
      "  disabled: [a, b]",
      "  platform_disabled:",
      "    telegram: [c, d]",
    ].join("\n");
    const parsed = parseSkillsDisabledFromYaml(yaml);
    expect(parsed.disabledNames.has("a")).toBe(true);
    expect(parsed.disabledNames.has("b")).toBe(true);
    expect(parsed.platformDisabled.telegram.has("c")).toBe(true);
    expect(parsed.platformDisabled.telegram.has("d")).toBe(true);
  });
});

describe("buildDisabledYamlLines", () => {
  it("emits empty disabled list", () => {
    expect(buildDisabledYamlLines([])).toEqual(["  disabled: []"]);
  });

  it("emits platform_disabled", () => {
    expect(buildDisabledYamlLines(["a"], { cli: ["b"] })).toEqual([
      "  disabled:",
      "    - a",
      "  platform_disabled:",
      "    cli:",
      "      - b",
    ]);
  });
});

describe("collectSkillDirectoryNames", () => {
  it("returns an empty list for a missing skills root", () => {
    expect(collectSkillDirectoryNames("/nonexistent-skills-root")).toEqual([]);
  });
});

describe("normalizeDisabledSkillKeys", () => {
  const catalog = ["apple/apple-notes", "devops/hermes-infrastructure"];

  it("maps leaf name to full catalog path", () => {
    expect(normalizeDisabledSkillKeys(["apple-notes"], catalog)).toEqual([
      "apple/apple-notes",
    ]);
  });

  it("keeps full path when already canonical", () => {
    expect(normalizeDisabledSkillKeys(["devops/hermes-infrastructure"], catalog)).toEqual([
      "devops/hermes-infrastructure",
    ]);
  });
});

describe("computeEffectiveDisabledFromYaml", () => {
  const catalog = ["a/one", "a/two", "b/three"];

  it("treats skills.enabled as allowlist (installed minus enabled)", () => {
    const yaml = ["skills:", "  enabled:", "    - a/one"].join("\n");
    const disabled = computeEffectiveDisabledFromYaml(yaml, catalog);
    expect(disabled).toEqual(["a/two", "b/three"]);
  });

  it("merges explicit disabled with allowlist mode", () => {
    const yaml = ["skills:", "  enabled:", "    - a/one", "  disabled:", "    - b/three"].join(
      "\n",
    );
    const disabled = computeEffectiveDisabledFromYaml(yaml, catalog);
    expect(disabled.sort()).toEqual(["a/two", "b/three"]);
  });
});

describe("skillFilePath", () => {
  it("joins a leaf catalog key to the skills root", () => {
    expect(skillFilePath("/root/skills", "apple-notes")).toBe(
      "/root/skills/apple-notes/SKILL.md",
    );
  });

  it("joins a nested catalog key with forward slashes", () => {
    expect(skillFilePath("/root/skills", "apple/apple-notes")).toBe(
      "/root/skills/apple/apple-notes/SKILL.md",
    );
  });

  it("normalises Windows-style backslashes in the catalog key", () => {
    expect(skillFilePath("/root/skills", "apple\\apple-notes")).toBe(
      "/root/skills/apple/apple-notes/SKILL.md",
    );
  });

  it("preserves a trailing slash on the root", () => {
    expect(skillFilePath("/root/skills/", "apple-notes")).toBe(
      "/root/skills//apple-notes/SKILL.md",
    );
  });
});

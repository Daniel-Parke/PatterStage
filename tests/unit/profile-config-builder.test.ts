/** @jest-environment node */

import {
  buildConfigYaml,
  configYamlToColumnValues,
  disabledSkillsFromJson,
  parseConfigYaml,
  resolvePlatformToolsets,
} from "@/modules/hermes/lib/profile-config-builder";

describe("profile-config-builder", () => {
  it("round-trips disabled skills and toolsets", () => {
    const yaml = buildConfigYaml({
      personality: "technical",
      disabledSkills: ["creative/image-gen", "gaming/steam"],
      platformDisabledSkills: { telegram: ["devops/terminal"] },
      platformToolsets: { cli: ["terminal", "file"] },
      preservedSections: { agent: { max_turns: 40 } },
      extraYamlLines: ["version: 2"],
    });
    const parts = parseConfigYaml(yaml);
    expect(parts.personality).toBe("technical");
    expect(parts.disabledSkills).toEqual(["creative/image-gen", "gaming/steam"]);
    expect(parts.platformDisabledSkills.telegram).toEqual(["devops/terminal"]);
    expect(parts.platformToolsets.cli).toEqual(["terminal", "file"]);
    expect(parts.extraYamlLines).toContain("version: 2");
    expect(parts.preservedSections.agent).toMatchObject({ max_turns: 40 });

    const cols = configYamlToColumnValues(yaml);
    expect(disabledSkillsFromJson(cols.disabledSkillsJson)).toEqual([
      "creative/image-gen",
      "gaming/steam",
    ]);
  });

  it("preserves extra yaml when rebuilding config", () => {
    const input = [
      "version: 9",
      "agent:",
      "  personality: creative",
      "  max_turns: 30",
      "skills:",
      "  disabled:",
      "    - skill-a",
    ].join("\n");
    const parts = parseConfigYaml(input);
    const rebuilt = buildConfigYaml({
      personality: parts.personality,
      disabledSkills: parts.disabledSkills,
      platformDisabledSkills: parts.platformDisabledSkills,
      platformToolsets: parts.platformToolsets,
      preservedSections: parts.preservedSections,
      extraYamlLines: parts.extraYamlLines,
    });
    expect(rebuilt).toContain("version: 9");
    expect(rebuilt).toContain("max_turns: 30");
    expect(rebuilt).toContain("skill-a");
  });

  it("preserves model and auxiliary sections through parse/build", () => {
    const input = [
      "model:",
      "  default: deepseek/deepseek-v4-flash",
      "  provider: nous",
      "auxiliary:",
      "  vision:",
      "    model: gpt-4o",
      "skills:",
      "  disabled: []",
    ].join("\n");
    const parts = parseConfigYaml(input);
    expect(parts.preservedSections.model).toMatchObject({
      default: "deepseek/deepseek-v4-flash",
      provider: "nous",
    });
    const rebuilt = buildConfigYaml({
      personality: parts.personality,
      disabledSkills: parts.disabledSkills,
      platformDisabledSkills: parts.platformDisabledSkills,
      platformToolsets: parts.platformToolsets,
      preservedSections: parts.preservedSections,
      extraYamlLines: parts.extraYamlLines,
    });
    expect(rebuilt).toContain("default: deepseek/deepseek-v4-flash");
    expect(rebuilt).toContain("provider: nous");
    expect(rebuilt).toContain("vision:");
  });

  it("resolvePlatformToolsets prefers database json over yaml", () => {
    const yaml = buildConfigYaml({
      personality: "technical",
      disabledSkills: [],
      platformDisabledSkills: {},
      platformToolsets: { cli: ["terminal"] },
      preservedSections: {},
      extraYamlLines: [],
    });
    const resolved = resolvePlatformToolsets(
      JSON.stringify({ cli: ["hermes-cli"] }),
      yaml,
    );
    expect(resolved.source).toBe("database");
    expect(resolved.toolsets.cli).toEqual(["hermes-cli"]);
  });

  it("resolvePlatformToolsets falls back to config yaml when json empty", () => {
    const yaml = buildConfigYaml({
      personality: "technical",
      disabledSkills: [],
      platformDisabledSkills: {},
      platformToolsets: { discord: ["hermes-discord"] },
      preservedSections: {},
      extraYamlLines: [],
    });
    const resolved = resolvePlatformToolsets("{}", yaml);
    expect(resolved.source).toBe("config_yaml");
    expect(resolved.toolsets.discord).toEqual(["hermes-discord"]);
  });

  it("preserves memory and plugins sections through parse/build", () => {
    const input = [
      "memory:",
      "  provider: hindsight",
      "  memory_enabled: true",
      "plugins:",
      "  hindsight:",
      "    auto_retain: true",
      "    api_url: http://localhost:9177",
      "skills:",
      "  disabled: []",
    ].join("\n");
    const parts = parseConfigYaml(input);
    expect(parts.preservedSections.memory).toMatchObject({
      provider: "hindsight",
      memory_enabled: true,
    });
    expect(parts.preservedSections.plugins).toMatchObject({
      hindsight: { auto_retain: true, api_url: "http://localhost:9177" },
    });

    const rebuilt = buildConfigYaml({
      personality: parts.personality,
      disabledSkills: parts.disabledSkills,
      platformDisabledSkills: parts.platformDisabledSkills,
      platformToolsets: parts.platformToolsets,
      preservedSections: parts.preservedSections,
      extraYamlLines: parts.extraYamlLines,
    });
    expect(rebuilt).toContain("provider: hindsight");
    expect(rebuilt).toContain("plugins:");
    expect(rebuilt).toContain("auto_retain: true");
    expect(rebuilt).toContain("api_url: http://localhost:9177");
  });
});

describe("buildMissionPrompt toolsets", () => {
  it("includes recommended_toolsets when provided", async () => {
    const { buildMissionPrompt } = await import("@/lib/missions/build-mission-prompt");
    const prompt = buildMissionPrompt({
      instruction: "Run checks",
      toolsets: ["terminal", "file"],
    });
    expect(prompt).toContain("<recommended_toolsets>");
    expect(prompt).toContain("terminal");
  });
});

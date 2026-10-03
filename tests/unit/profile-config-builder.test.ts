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
      // was the raw-text half of the two-source rebuild whose double emission
      // corrupted config.yaml for months (T-0086).
      preservedSections: { agent: { max_turns: 40 }, version: 2 },
    });
    const parts = parseConfigYaml(yaml);
    expect(parts.personality).toBe("technical");
    expect(parts.disabledSkills).toEqual(["creative/image-gen", "gaming/steam"]);
    expect(parts.platformDisabledSkills.telegram).toEqual(["devops/terminal"]);
    expect(parts.platformToolsets.cli).toEqual(["terminal", "file"]);
    expect(parts.preservedSections.version).toBe(2);
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
    const rebuilt = buildConfigYaml(parts);
    expect(rebuilt).toContain("version: 9");
    expect(rebuilt).toContain("max_turns: 30");
    expect(rebuilt).toContain("skill-a");
    // The strengthened half (T-0086). The old assertions were satisfied by a
    // rebuild that emitted the agent block TWICE — the very corruption this
    // file exists to prevent — and reported personality "technical" for a
    // config that plainly says creative.
    expect(parts.personality).toBe("creative");
    expect(rebuilt.match(/^agent:/gm)).toHaveLength(1);
    expect(rebuilt.match(/personality:/g)).toHaveLength(1);
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

/** @jest-environment node */

import {
  expandUnifiedToAllPlatforms,
  mergeAdvancedOverrides,
  platformsDiffer,
  unionToolsetsFromPlatforms,
} from "@/modules/hermes/lib/toolset-unify";

describe("hermes-toolset-unify", () => {
  it("unionToolsetsFromPlatforms returns sorted unique ids", () => {
    const union = unionToolsetsFromPlatforms({
      cli: ["terminal", "file"],
      discord: ["file", "hermes-discord"],
    });
    expect(union).toEqual(["file", "hermes-discord", "terminal"]);
  });

  it("platformsDiffer detects mismatched platform lists", () => {
    const result = platformsDiffer({
      cli: ["terminal", "file"],
      discord: ["hermes-discord"],
    });
    expect(result.diverged).toBe(true);
    expect(result.platforms.length).toBeGreaterThan(0);
  });

  it("platformsDiffer is false when all platforms match", () => {
    const list = ["terminal", "file"];
    const result = platformsDiffer({
      cli: list,
      discord: list,
    });
    expect(result.diverged).toBe(false);
  });

  it("expandUnifiedToAllPlatforms fans out to every catalog platform", () => {
    const expanded = expandUnifiedToAllPlatforms(["terminal", "web"]);
    expect(Object.keys(expanded).sort()).toEqual(
      ["cli", "discord", "homeassistant", "signal", "slack", "telegram", "whatsapp"].sort(),
    );
    for (const list of Object.values(expanded)) {
      expect(list).toEqual(["terminal", "web"]);
    }
  });

  it("mergeAdvancedOverrides keeps per-platform overrides", () => {
    const merged = mergeAdvancedOverrides(["terminal", "file"], {
      discord: ["hermes-discord"],
    });
    expect(merged.cli).toEqual(["file", "terminal"]);
    expect(merged.discord).toEqual(["hermes-discord"]);
  });
});

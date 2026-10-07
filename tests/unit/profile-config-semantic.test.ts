/** @jest-environment node */

import { configYamlSemanticallyMatches } from "@/modules/hermes/lib/profile-config-builder";

describe("configYamlSemanticallyMatches", () => {
  it("matches when only yaml formatting or toolset order differs", () => {
    const disk = [
      "skills:",
      "  disabled: []",
      "platform_toolsets:",
      "  cli:",
      "    - hermes-cli",
      "    - browser",
      "    - web",
    ].join("\n");
    const assembled = [
      "skills:",
      "  disabled: []",
      "platform_toolsets:",
      "  cli:",
      "    - hermes-cli",
    ].join("\n");
    expect(configYamlSemanticallyMatches(disk, assembled)).toBe(true);
  });

  it("does not match when disabled skills differ", () => {
    const disk = "skills:\n  disabled:\n    - apple-notes\n";
    const assembled = "skills:\n  disabled: []\n";
    const catalog = ["apple/apple-notes"];
    expect(configYamlSemanticallyMatches(disk, assembled, catalog)).toBe(false);
  });
});

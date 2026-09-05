/** @jest-environment node */

import { normalizePlatformToolsets } from "@/modules/hermes/lib/toolset-normalize";

describe("normalizePlatformToolsets", () => {
  it("dedupes entries per platform", () => {
    const result = normalizePlatformToolsets({
      cli: ["browser", "browser", "clarify", "clarify"],
    });
    expect(result.cli).toEqual(["browser", "clarify"]);
  });

  it("collapses granular toolsets when hermes-cli is present", () => {
    const result = normalizePlatformToolsets({
      cli: ["hermes-cli", "browser", "clarify", "code_execution", "cronjob"],
    });
    expect(result.cli).toEqual(["hermes-cli"]);
  });

  it("keeps granular toolsets not subsumed by hermes-cli", () => {
    const result = normalizePlatformToolsets({
      cli: ["hermes-cli", "rl"],
    });
    expect(result.cli).toEqual(["hermes-cli", "rl"]);
  });
});

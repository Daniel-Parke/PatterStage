/** @jest-environment node */

jest.mock("@/lib/models-repository", () => ({
  findModelByModelId: jest.fn(),
}));

import { findModelByModelId } from "@/lib/models-repository";
import { parseMissionBodyFields } from "@/lib/missions/mission-body";

const mockFindByModelId = findModelByModelId as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("parseMissionBodyFields", () => {
  it("returns undefined modelId and provider when neither is supplied", () => {
    const out = parseMissionBodyFields({ instruction: "do the thing" });
    expect(out.modelId).toBeUndefined();
    expect(out.provider).toBeUndefined();
    expect(mockFindByModelId).not.toHaveBeenCalled();
  });

  it("passes through a modelId that is in the registry", () => {
    mockFindByModelId.mockReturnValue({
      modelId: "anthropic/claude-sonnet-4",
      provider: "anthropic",
    });

    const out = parseMissionBodyFields({
      instruction: "do the thing",
      modelId: "anthropic/claude-sonnet-4",
    });

    expect(out.modelId).toBe("anthropic/claude-sonnet-4");
    expect(out.provider).toBeUndefined(); // provider is resolved at dispatch time
    expect(mockFindByModelId).toHaveBeenCalledWith("anthropic/claude-sonnet-4");
  });

  it("strips a modelId that is NOT in the registry, even when the caller supplied a provider", () => {
    // The killer case: the caller passed both `modelId` and `provider` for a
    // value that does not exist in the `models` table. Under the new policy
    // we must NOT persist that value — the registry is the only source of
    // truth. The mission will be dispatched with the agent default.
    mockFindByModelId.mockReturnValue(null);

    const out = parseMissionBodyFields({
      instruction: "do the thing",
      modelId: "deepseek/deepseek-v4-flash",
      provider: "nous",
    });

    expect(out.modelId).toBeUndefined();
    expect(out.provider).toBeUndefined();
    expect(mockFindByModelId).toHaveBeenCalledWith("deepseek/deepseek-v4-flash");
  });

  it("strips a modelId that is NOT in the registry when only modelId is supplied", () => {
    mockFindByModelId.mockReturnValue(null);

    const out = parseMissionBodyFields({
      instruction: "do the thing",
      modelId: "phantom/model",
    });

    expect(out.modelId).toBeUndefined();
    expect(out.provider).toBeUndefined();
  });

  it("trims whitespace from a supplied modelId before registry lookup", () => {
    mockFindByModelId.mockReturnValue({
      modelId: "anthropic/claude-sonnet-4",
      provider: "anthropic",
    });

    const out = parseMissionBodyFields({
      instruction: "do the thing",
      modelId: "  anthropic/claude-sonnet-4  ",
    });

    expect(out.modelId).toBe("anthropic/claude-sonnet-4");
    expect(mockFindByModelId).toHaveBeenCalledWith("anthropic/claude-sonnet-4");
  });

  it("preserves the rest of the body fields unchanged", () => {
    mockFindByModelId.mockReturnValue(null);

    const out = parseMissionBodyFields({
      name: "My Mission",
      instruction: "do the thing",
      context: "context",
      localDirs: ["/tmp/a"],
      references: ["ref-1"],
      skills: ["skill-1"],
      suggestedToolsets: ["web"],
      goals: ["g1", "g2"],
      modelId: "phantom/model",
      provider: "nous",
      profileName: "default",
      missionTimeMinutes: 30,
      timeoutMinutes: 60,
      schedule: "every 5m",
      categoryId: "cat-1",
      outputFormat: "json",
      constraints: "no breaking changes",
    });

    expect(out.name).toBe("My Mission");
    expect(out.instruction).toBe("do the thing");
    expect(out.context).toBe("context");
    expect(out.localDirs).toEqual(["/tmp/a"]);
    expect(out.references).toEqual(["ref-1"]);
    expect(out.skills).toEqual(["skill-1"]);
    expect(out.suggestedToolsets).toEqual(["web"]);
    expect(out.goals).toEqual(["g1", "g2"]);
    expect(out.modelId).toBeUndefined();
    expect(out.provider).toBeUndefined();
    expect(out.profileName).toBe("default");
    expect(out.missionTimeMinutes).toBe(30);
    expect(out.timeoutMinutes).toBe(60);
    expect(out.schedule).toBe("every 5m");
    expect(out.categoryId).toBe("cat-1");
    expect(out.outputFormat).toBe("json");
    expect(out.constraints).toBe("no breaking changes");
  });
});

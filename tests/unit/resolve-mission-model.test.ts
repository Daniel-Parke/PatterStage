/** @jest-environment node */

jest.mock("@/lib/models-repository", () => ({
  findModelByModelId: jest.fn(),
  getDefaultModel: jest.fn(),
}));

jest.mock("@/lib/credentials-repository", () => ({
  getCredentialWithKey: jest.fn(),
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

import { findModelByModelId, getDefaultModel } from "@/lib/models-repository";
import { resolveMissionModel } from "@/lib/backends/hermes";

const mockFindByModelId = findModelByModelId as jest.Mock;
const mockGetDefault = getDefaultModel as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("resolveMissionModel", () => {
  // The Control Hub models registry is the SINGLE SOURCE OF TRUTH for which
  // model any mission can run on. No mission — regardless of who supplies the
  // modelId — is permitted to run a model that is not present in the `models`
  // table. This blocks "deepseek/deepseek-v4-flash"-style foreign values that
  // historically slipped through when both `modelId` AND `provider` were set
  // (the previous early-return trusted the supplied string verbatim).

  it("uses registry row when both modelId and provider are set and the modelId is in the registry", async () => {
    mockFindByModelId.mockReturnValue({
      modelId: "anthropic/claude-sonnet-4",
      provider: "anthropic",
      credentialsId: null,
    });

    const result = await resolveMissionModel({
      modelId: "anthropic/claude-sonnet-4",
      provider: "anthropic",
    });

    expect(mockFindByModelId).toHaveBeenCalledWith("anthropic/claude-sonnet-4");
    expect(result).toEqual({
      modelId: "anthropic/claude-sonnet-4",
      provider: "anthropic",
      apiKey: null,
    });
    expect(mockGetDefault).not.toHaveBeenCalled();
  });

  it("ignores a foreign modelId (not in the registry) and falls back to the agent default", async () => {
    // The caller supplied a value that is NOT in the models table. This used
    // to be passed straight through to the hermes chat argv because the
    // early-return path trusted both populated fields. Under the new policy,
    // we MUST consult the registry first, and the default wins.
    mockFindByModelId.mockReturnValue(null);
    mockGetDefault.mockReturnValue({
      modelId: "default/model",
      provider: "default-provider",
      credentialsId: null,
    });

    const result = await resolveMissionModel({
      modelId: "deepseek/deepseek-v4-flash",
      provider: "nous",
    });

    expect(mockFindByModelId).toHaveBeenCalledWith("deepseek/deepseek-v4-flash");
    expect(mockGetDefault).toHaveBeenCalledWith("agent");
    expect(result).toEqual({
      modelId: "default/model",
      provider: "default-provider",
      apiKey: null,
    });
  });

  it("ignores a foreign modelId even when only modelId is set (no provider)", async () => {
    mockFindByModelId.mockReturnValue(null);
    mockGetDefault.mockReturnValue({
      modelId: "default/model",
      provider: "default-provider",
      credentialsId: null,
    });

    const result = await resolveMissionModel({
      modelId: "phantom/model-not-in-registry",
    });

    expect(mockFindByModelId).toHaveBeenCalledWith("phantom/model-not-in-registry");
    expect(mockGetDefault).toHaveBeenCalledWith("agent");
    expect(result.modelId).toBe("default/model");
  });

  it("resolves provider from registry when only modelId is set and the modelId is in the registry", async () => {
    mockFindByModelId.mockReturnValue({
      modelId: "anthropic/claude-sonnet-4",
      provider: "anthropic",
      credentialsId: null,
    });

    const result = await resolveMissionModel({
      modelId: "anthropic/claude-sonnet-4",
    });

    expect(mockFindByModelId).toHaveBeenCalledWith("anthropic/claude-sonnet-4");
    expect(result).toEqual({
      modelId: "anthropic/claude-sonnet-4",
      provider: "anthropic",
      apiKey: null,
    });
    expect(mockGetDefault).not.toHaveBeenCalled();
  });

  it("falls back to agent default when no inputs are supplied", async () => {
    mockGetDefault.mockReturnValue({
      modelId: "default/model",
      provider: "default-provider",
      credentialsId: null,
    });

    const result = await resolveMissionModel({});

    expect(mockGetDefault).toHaveBeenCalledWith("agent");
    expect(result.modelId).toBe("default/model");
    expect(result.provider).toBe("default-provider");
  });

  it("returns empty resolution when no inputs and no agent default exist", async () => {
    mockGetDefault.mockReturnValue(null);

    const result = await resolveMissionModel({});

    expect(result).toEqual({ modelId: "", provider: "", apiKey: null });
  });
});

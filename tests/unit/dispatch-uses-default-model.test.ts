/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * PR 7 — dispatchMission falls back to the registry's `agent` default
 * when the caller doesn't pin a model/provider.
 *
 * Updated for bash-script spawn: hermes command is embedded in a temp
 * script written to /tmp/hermes_mission_<id>.sh. We verify the flags
 * by reading the actual script content from the filesystem.
 */

import { existsSync, rmSync, readFileSync } from "fs";

const spawnCalls: Array<{ cmd: string; args: readonly string[]; scriptContent?: string }> = [];

jest.mock("child_process", () => ({
  spawn: jest.fn((cmd: string, args: readonly string[]) => {
    // Read script content if this is bash calling our script
    let scriptContent: string | undefined;
    if (cmd === "bash" && args[0] && typeof args[0] === "string" && args[0].includes("hermes_mission_")) {
      try {
        scriptContent = readFileSync(args[0], "utf-8");
      } catch {
        // script may not be readable in all test environments
      }
    }
    spawnCalls.push({ cmd, args, scriptContent });
    return { pid: 424242, unref: jest.fn(), on: jest.fn() };
  }),
}));

jest.mock("@/lib/paths", () => {
  const actualOs = jest.requireActual("os") as typeof import("os");
  const actualFs = jest.requireActual("fs") as typeof import("fs");
  const actualPath = jest.requireActual("path") as typeof import("path");
  const root = actualFs.mkdtempSync(actualPath.join(actualOs.tmpdir(), "ch-disp-default-"));
  return {
    PATHS: { missions: actualPath.join(root, "missions") },
    CH_DATA_DIR: root,
    __TEST_TMP_ROOT__: root,
  };
});

jest.mock("@/lib/hermes-agent-runtime", () => ({
  getActiveHermesPaths: jest.fn(() => ({ profiles: "/tmp/hermes-test/profiles" })),
  getAgentLlmEndpoints: jest.fn(() => ({ gatewayBase: "http://localhost:8080" })),
}));

jest.mock("@/lib/llm", () => ({ callLLM: jest.fn() }));

jest.mock("@/lib/models-repository", () => {
  const getDefaultModel = jest.fn();
  const findModelByModelId = jest.fn();
  return {
    getDefaultModel,
    findModelByModelId,
    __getDefaultModel: getDefaultModel,
    __findModelByModelId: findModelByModelId,
    getModelWithKey: jest.fn(),
  };
});

jest.mock("@/lib/credentials-repository", () => ({
  getCredentialWithKey: jest.fn(),
}));

afterAll(() => {
  const paths = require("@/lib/paths") as { __TEST_TMP_ROOT__?: string };
  const root = paths.__TEST_TMP_ROOT__;
  if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  spawnCalls.length = 0;
  const repo = require("@/lib/models-repository") as {
    __getDefaultModel: jest.Mock;
    __findModelByModelId: jest.Mock;
  };
  repo.__getDefaultModel.mockReset();
  repo.__findModelByModelId.mockReset();
});

/** Extract the hermes command line from the bash script body */
function getHermesLine(spawnCall: (typeof spawnCalls)[0]): string | null {
  if (!spawnCall.scriptContent) return null;
  const lines = spawnCall.scriptContent.split("\n");
  return lines.find((l) => l.includes("hermes")) ?? null;
}

describe("dispatchMission — registry default fallback", () => {
  it("uses registered agent default when caller omits modelId", async () => {
    const repo = require("@/lib/models-repository") as { __getDefaultModel: jest.Mock };
    repo.__getDefaultModel.mockReturnValue({
      id: "model-default",
      modelId: "anthropic/claude-opus-4",
      provider: "anthropic",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as any;
    const backend = new HermesAgentBackend();
    await backend.dispatchMission({ name: "no model", prompt: "do" });

    expect(repo.__getDefaultModel).toHaveBeenCalledWith("agent");
    const hermesLine = getHermesLine(spawnCalls[0]);
    expect(hermesLine).toContain("--model anthropic/claude-opus-4");
    expect(hermesLine).toContain("--provider anthropic");
  });

  it("explicit modelId wins over the registered default when the modelId is in the registry", async () => {
    // The registry is the SINGLE SOURCE OF TRUTH. An explicit caller-supplied
    // modelId only wins when it exists in the `models` table; otherwise the
    // call falls through to the agent default. This test pins the "in the
    // registry" path (the old test pinned the foreign-value path, which is
    // the bug this fix closes).
    const repo = require("@/lib/models-repository") as {
      __getDefaultModel: jest.Mock;
      __findModelByModelId: jest.Mock;
    };
    repo.__getDefaultModel.mockReturnValue({
      id: "model-default",
      modelId: "anthropic/claude-opus-4",
      provider: "anthropic",
    });
    repo.__findModelByModelId.mockReturnValue({
      id: "model-openai",
      modelId: "openai/gpt-5.5-medium",
      provider: "openai",
      credentialsId: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as any;
    const backend = new HermesAgentBackend();
    await backend.dispatchMission({
      name: "explicit",
      prompt: "do",
      modelId: "openai/gpt-5.5-medium",
      provider: "openai",
    });

    const hermesLine = getHermesLine(spawnCalls[0]);
    expect(hermesLine).toContain("--model openai/gpt-5.5-medium");
    expect(hermesLine).toContain("--provider openai");
    expect(hermesLine).not.toContain("anthropic/claude-opus-4");
    // The default lookup only happens when the modelId is missing or not in
    // the registry; here the supplied modelId IS in the registry, so the
    // default branch is not taken.
    expect(repo.__getDefaultModel).not.toHaveBeenCalled();
  });

  it("ignores a foreign modelId (not in the registry) and falls back to the agent default", async () => {
    // The bug this test pins: pre-fix, an explicit `modelId` AND `provider`
    // (even one not in the registry) was passed straight through to the
    // hermes chat argv. Post-fix, the registry is consulted first; a foreign
    // value is rejected and the call falls through to the agent default.
    const repo = require("@/lib/models-repository") as {
      __getDefaultModel: jest.Mock;
      __findModelByModelId: jest.Mock;
    };
    repo.__getDefaultModel.mockReturnValue({
      id: "model-default",
      modelId: "anthropic/claude-opus-4",
      provider: "anthropic",
    });
    repo.__findModelByModelId.mockReturnValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as any;
    const backend = new HermesAgentBackend();
    await backend.dispatchMission({
      name: "foreign",
      prompt: "do",
      modelId: "deepseek/deepseek-v4-flash",
      provider: "nous",
    });

    expect(repo.__findModelByModelId).toHaveBeenCalledWith(
      "deepseek/deepseek-v4-flash",
    );
    expect(repo.__getDefaultModel).toHaveBeenCalledWith("agent");
    const hermesLine = getHermesLine(spawnCalls[0]);
    expect(hermesLine).toContain("--model anthropic/claude-opus-4");
    expect(hermesLine).toContain("--provider anthropic");
    expect(hermesLine).not.toContain("deepseek");
  });

  it("omits --model/--provider when no default is registered", async () => {
    const repo = require("@/lib/models-repository") as { __getDefaultModel: jest.Mock };
    repo.__getDefaultModel.mockReturnValue(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as any;
    const backend = new HermesAgentBackend();
    await backend.dispatchMission({ name: "no default", prompt: "do" });

    const hermesLine = getHermesLine(spawnCalls[0]);
    expect(hermesLine).not.toContain("--model");
    expect(hermesLine).not.toContain("--provider");
    expect(hermesLine).toContain("hermes chat");
  });

  it("uses agent default when caller omits modelId and provider", async () => {
    const repo = require("@/lib/models-repository") as { __getDefaultModel: jest.Mock };
    repo.__getDefaultModel.mockReturnValue({
      id: "model-default",
      modelId: "anthropic/claude-opus-4",
      provider: "anthropic",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as any;
    const backend = new HermesAgentBackend();
    await backend.dispatchMission({
      name: "partial",
      prompt: "do",
    });

    const hermesLine = getHermesLine(spawnCalls[0]);
    expect(hermesLine).toContain("--model anthropic/claude-opus-4");
    expect(hermesLine).toContain("--provider anthropic");
  });

  it("resolves provider from registry when caller sets modelId only", async () => {
    const repo = require("@/lib/models-repository") as {
      __getDefaultModel: jest.Mock;
      __findModelByModelId: jest.Mock;
    };
    repo.__findModelByModelId.mockReturnValue({
      id: "reg-openai",
      modelId: "openai/gpt-5.5-medium",
      provider: "openai",
      credentialsId: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as any;
    const backend = new HermesAgentBackend();
    await backend.dispatchMission({
      name: "model only",
      prompt: "do",
      modelId: "openai/gpt-5.5-medium",
    });

    expect(repo.__findModelByModelId).toHaveBeenCalledWith("openai/gpt-5.5-medium");
    expect(repo.__getDefaultModel).not.toHaveBeenCalled();
    const hermesLine = getHermesLine(spawnCalls[0]);
    expect(hermesLine).toContain("--model openai/gpt-5.5-medium");
    expect(hermesLine).toContain("--provider openai");
  });
});

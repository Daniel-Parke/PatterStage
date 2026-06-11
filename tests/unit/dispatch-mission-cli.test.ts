/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * Tests the HermesAgentBackend.dispatchMission CLI invocation.
 * The hermes command is written to a temp script at /tmp/hermes_mission_<id>.sh
 * and spawned as `bash <scriptPath>`. The hermes argv and CH_MISSION_PROMPT
 * env var are verified by reading the actual script content.
 */

import { writeFileSync, existsSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { buildHermesChatArgv } from "@/lib/backends/hermes";

// Capture spawn calls without actually starting subprocesses.
const spawnCalls: Array<{ cmd: string; args: readonly string[]; opts: Record<string, unknown>; scriptContent?: string }> = [];

jest.mock("child_process", () => ({
  spawn: jest.fn((cmd: string, args: readonly string[], opts: Record<string, unknown>) => {
    let scriptContent: string | undefined;
    if (cmd === "bash" && args[0] && typeof args[0] === "string" && args[0].includes("hermes_mission_")) {
      try { scriptContent = readFileSync(args[0], "utf-8"); } catch { /* ignore */ }
    }
    spawnCalls.push({ cmd, args, opts, scriptContent });
    return { pid: 424242, unref: jest.fn(), on: jest.fn() };
  }),
}));

jest.mock("@/lib/paths", () => {
  const actualOs = jest.requireActual("os") as typeof import("os");
  const actualFs = jest.requireActual("fs") as typeof import("fs");
  const actualPath = jest.requireActual("path") as typeof import("path");
  const root = actualFs.mkdtempSync(actualPath.join(actualOs.tmpdir(), "ch-dispatch-"));
  return {
    PATHS: { missions: actualPath.join(root, "missions") },
    CH_DATA_DIR: root,
    __TEST_TMP_ROOT__: root,
  };
});

jest.mock("@/lib/hermes-profile-paths", () => ({
  resolveProfileHermesHome: jest.fn((profile: string) =>
    profile === "default" ? "/tmp/hermes-test" : `/tmp/hermes-test/profiles/${profile}`
  ),
}));

jest.mock("@/lib/hermes-agent-runtime", () => ({
  getActiveHermesPaths: jest.fn(() => ({
    root: "/tmp/hermes-test",
    profiles: "/tmp/hermes-test/profiles",
  })),
  getAgentLlmEndpoints: jest.fn(() => ({ gatewayBase: "http://localhost:8080" })),
}));

jest.mock("@/lib/llm", () => ({
  callLLM: jest.fn(),
}));

const mockFindModelByModelId = jest.fn();
const mockGetDefaultModel = jest.fn();
jest.mock("@/lib/models-repository", () => ({
  findModelByModelId: (...args: unknown[]) => mockFindModelByModelId(...args),
  getDefaultModel: (...args: unknown[]) => mockGetDefaultModel(...args),
  getModelWithKey: jest.fn(),
}));

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
  mockFindModelByModelId.mockReset();
  mockGetDefaultModel.mockReset();
  // Default behaviour for this suite: a caller-supplied modelId is in the
  // registry (the prior test pinned the foreign-value path, which is the
  // bug this fix closes). Tests that exercise the foreign-value branch
  // override this.
  mockFindModelByModelId.mockImplementation((modelId: string) => ({
    id: `model-${modelId}`,
    modelId,
    provider: "anthropic",
    credentialsId: null,
  }));
  mockGetDefaultModel.mockReturnValue(null);
});

describe("buildHermesChatArgv", () => {
  it("includes only required flags when no model/provider/profile", () => {
    const argv = buildHermesChatArgv({ source: "control-hub-mission" });
    expect(argv).toEqual([
      "chat",
      "--quiet",
      "--source",
      "control-hub-mission",
      "--pass-session-id",
    ]);
  });

  it("places --profile before chat subcommand (Hermes pre-parse flag)", () => {
    const argv = buildHermesChatArgv({
      profileName: "engineering",
      source: "control-hub-mission",
    });
    expect(argv[0]).toBe("--profile");
    expect(argv[1]).toBe("engineering");
    expect(argv[2]).toBe("chat");
  });

  it("appends --model and --provider after chat subcommand", () => {
    const argv = buildHermesChatArgv({
      profileName: "qa",
      modelId: "anthropic/claude-sonnet-4",
      provider: "anthropic",
      source: "control-hub-mission",
    });
    expect(argv).toEqual([
      "--profile",
      "qa",
      "chat",
      "--model",
      "anthropic/claude-sonnet-4",
      "--provider",
      "anthropic",
      "--quiet",
      "--source",
      "control-hub-mission",
      "--pass-session-id",
    ]);
  });

  it("omits --model when modelId is empty/blank", () => {
    const argv = buildHermesChatArgv({ modelId: "   ", source: "control-hub-mission" });
    expect(argv).not.toContain("--model");
  });

  it("omits --provider when provider is empty/blank", () => {
    const argv = buildHermesChatArgv({ provider: "", source: "control-hub-mission" });
    expect(argv).not.toContain("--provider");
  });
});

describe("HermesAgentBackend.dispatchMission + spawnDispatchedMission", () => {
  // Phase 2b of the mission-orphan-recovery refactor split
  // dispatchMission into two phases:
  //   1. dispatchMission() — writes the on-disk mission.json
  //   2. spawnDispatchedMission() — forks the bash script
  //
  // These tests exercise BOTH phases in sequence (the same
  // pattern dispatchMissionNow uses in production) so we still
  // verify the full CLI invocation path. Tests that want to
  // exercise only one phase live in their own describe blocks
  // below.
  it("spawns bash with script path and CH_MISSION_PROMPT env", async () => {
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as {
      HermesAgentBackend: new () => {
        dispatchMission: (input: {
          name: string;
          prompt: string;
          profileName?: string;
          modelId?: string;
          provider?: string;
        }) => Promise<{ id: string; name: string; status: string }>;
        spawnDispatchedMission: (missionId: string) => Promise<void>;
      };
    };
    const backend = new HermesAgentBackend();

    const mission = await backend.dispatchMission({
      name: "Test mission",
      prompt: "do the thing",
      profileName: "engineering",
      modelId: "anthropic/claude-sonnet-4",
      provider: "anthropic",
    });
    // Phase 1 alone does NOT spawn — verify that contract
    expect(spawnCalls).toHaveLength(0);

    // Phase 2 forks the bash script
    await backend.spawnDispatchedMission(mission.id);

    expect(spawnCalls).toHaveLength(1);
    const call = spawnCalls[0];
    expect(call.cmd).toBe("bash");
    // args[0] is the script path, not -c
    expect(call.args[0]).toMatch(/hermes_mission_.+\.sh$/);
    expect(call.scriptContent).toContain("hermes");
    expect(call.scriptContent).toContain("--profile engineering");
    expect(call.scriptContent).toContain("chat");
    expect(call.scriptContent).toContain("--model anthropic/claude-sonnet-4");
    expect(call.scriptContent).toContain("--provider anthropic");
    expect(call.scriptContent).toContain("--quiet");
    expect(call.scriptContent).toContain("--source control-hub-mission");
    expect(call.scriptContent).toContain("--pass-session-id");
    expect(call.scriptContent).toContain('-q "$CH_MISSION_PROMPT"');
    expect(call.scriptContent).toContain(".status.json");
    expect(call.scriptContent).toContain(`"successful"`);
    expect(call.scriptContent).toContain(`"failed"`);
    // The new EXIT trap must also be installed in the script
    expect(call.scriptContent).toContain("trap ");
    expect(call.scriptContent).toContain("EXIT");

    const env = (call.opts.env as Record<string, string>) ?? {};
    expect(env.HERMES_HOME).toBe("/tmp/hermes-test/profiles/engineering");
    expect(env.CH_MISSION_PROMPT).toBe("do the thing");
    expect(env.CH_MISSION_ID).toBe(mission.id);
    expect(call.opts.detached).toBe(true);
    expect(call.opts.stdio).toBe("ignore");

    const { PATHS } = require("@/lib/paths") as { PATHS: { missions: string } };
    const pidPath = join(PATHS.missions, `${mission.id}.pid.json`);
    expect(existsSync(pidPath)).toBe(true);
    const pidData = JSON.parse(readFileSync(pidPath, "utf-8")) as { pid: number };
    expect(pidData.pid).toBe(424242);
  });

  it("dispatches without --model/--provider when not supplied", async () => {
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as {
      HermesAgentBackend: new () => {
        dispatchMission: (input: {
          name: string;
          prompt: string;
        }) => Promise<{ id: string; name: string; status: string }>;
        spawnDispatchedMission: (missionId: string) => Promise<void>;
      };
    };
    const backend = new HermesAgentBackend();

    const mission = await backend.dispatchMission({
      name: "Bare mission",
      prompt: "go",
    });
    // No spawn yet
    expect(spawnCalls).toHaveLength(0);

    await backend.spawnDispatchedMission(mission.id);

    expect(spawnCalls).toHaveLength(1);
    expect(spawnCalls[0].scriptContent).not.toContain("--model");
    expect(spawnCalls[0].scriptContent).not.toContain("--provider");
    expect(spawnCalls[0].scriptContent).toContain("hermes chat");
    const env = (spawnCalls[0].opts.env as Record<string, string>) ?? {};
    expect(env.HERMES_HOME).toBe("/tmp/hermes-test");
  });

  it("returns a mission record with status='dispatched'", async () => {
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as {
      HermesAgentBackend: new () => {
        dispatchMission: (input: {
          name: string;
          prompt: string;
        }) => Promise<{ id: string; name: string; status: string }>;
      };
    };
    const backend = new HermesAgentBackend();

    const mission = await backend.dispatchMission({
      name: "Mission record check",
      prompt: "task",
    });

    expect(mission.status).toBe("dispatched");
    expect(mission.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(mission.name).toBe("Mission record check");
  });

  it("spawnDispatchedMission throws if the on-disk mission file is missing", async () => {
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as {
      HermesAgentBackend: new () => {
        spawnDispatchedMission: (missionId: string) => Promise<void>;
      };
    };
    const backend = new HermesAgentBackend();

    // No dispatchMission first — the on-disk file is missing
    await expect(
      backend.spawnDispatchedMission("00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow(/no on-disk mission file/i);
    // No spawn happened
    expect(spawnCalls).toHaveLength(0);
  });
});

describe("HermesAgentBackend.getMissionStatus reads callback file", () => {
  it("returns 'successful' when status.json reports successful", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as any;
    const { PATHS } = require("@/lib/paths") as { PATHS: { missions: string } };
    const backend = new HermesAgentBackend();

    require("fs").mkdirSync(PATHS.missions, { recursive: true });
    const id = "11111111-1111-1111-1111-111111111111";
    writeFileSync(
      join(PATHS.missions, `${id}.status.json`),
      JSON.stringify({ status: "successful", exit_code: 0 })
    );

    expect(await backend.getMissionStatus(id)).toBe("successful");
  });

  it("returns 'failed' when status.json reports failed", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as any;
    const { PATHS } = require("@/lib/paths") as { PATHS: { missions: string } };
    const backend = new HermesAgentBackend();

    const id = "22222222-2222-2222-2222-222222222222";
    writeFileSync(
      join(PATHS.missions, `${id}.status.json`),
      JSON.stringify({ status: "failed", exit_code: 1, error: "hermes chat exited 1" })
    );

    expect(await backend.getMissionStatus(id)).toBe("failed");
  });

  it("returns 'dispatched' when only mission record exists (no callback yet)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as any;
    const { PATHS } = require("@/lib/paths") as { PATHS: { missions: string } };
    const backend = new HermesAgentBackend();

    const id = "33333333-3333-3333-3333-333333333333";
    writeFileSync(
      join(PATHS.missions, `${id}.json`),
      JSON.stringify({ id, status: "dispatched" })
    );

    expect(await backend.getMissionStatus(id)).toBe("dispatched");
  });

  it("returns 'queued' when nothing on disk", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as any;
    const backend = new HermesAgentBackend();

    expect(await backend.getMissionStatus("nonexistent-id")).toBe("queued");
  });

  it("ignores invalid status values in callback file", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as any;
    const { PATHS } = require("@/lib/paths") as { PATHS: { missions: string } };
    const backend = new HermesAgentBackend();

    const id = "44444444-4444-4444-4444-444444444444";
    writeFileSync(
      join(PATHS.missions, `${id}.status.json`),
      JSON.stringify({ status: "garbage" })
    );

    // Falls through to "queued" since no mission record either.
    expect(await backend.getMissionStatus(id)).toBe("queued");
  });
});

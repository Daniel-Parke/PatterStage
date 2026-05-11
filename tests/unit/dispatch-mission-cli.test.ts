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
    return { unref: jest.fn(), on: jest.fn() };
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

jest.mock("@/lib/hermes-agent-runtime", () => ({
  getActiveHermesPaths: jest.fn(() => ({ profiles: "/tmp/hermes-test/profiles" })),
  getAgentLlmEndpoints: jest.fn(() => ({ gatewayBase: "http://localhost:8080" })),
}));

jest.mock("@/lib/llm", () => ({
  callLLM: jest.fn(),
}));

afterAll(() => {
  const paths = require("@/lib/paths") as { __TEST_TMP_ROOT__?: string };
  const root = paths.__TEST_TMP_ROOT__;
  if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  spawnCalls.length = 0;
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

describe("HermesAgentBackend.dispatchMission spawn", () => {
  it("spawns bash with script path and CH_MISSION_PROMPT env", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as any;
    const backend = new HermesAgentBackend();

    const mission = await backend.dispatchMission({
      name: "Test mission",
      prompt: "do the thing",
      profileName: "engineering",
      modelId: "anthropic/claude-sonnet-4",
      provider: "anthropic",
    });

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

    const env = (call.opts.env as Record<string, string>) ?? {};
    expect(env.CH_MISSION_PROMPT).toBe("do the thing");
    expect(env.CH_MISSION_ID).toBe(mission.id);
    expect(call.opts.detached).toBe(true);
    expect(call.opts.stdio).toBe("ignore");
  });

  it("dispatches without --model/--provider when not supplied", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as any;
    const backend = new HermesAgentBackend();

    await backend.dispatchMission({
      name: "Bare mission",
      prompt: "go",
    });

    expect(spawnCalls).toHaveLength(1);
    expect(spawnCalls[0].scriptContent).not.toContain("--model");
    expect(spawnCalls[0].scriptContent).not.toContain("--provider");
    expect(spawnCalls[0].scriptContent).toContain("hermes chat");
  });

  it("returns a mission record with status='dispatched'", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { HermesAgentBackend } = require("@/lib/backends/hermes") as any;
    const backend = new HermesAgentBackend();

    const mission = await backend.dispatchMission({
      name: "Mission record check",
      prompt: "task",
    });

    expect(mission.status).toBe("dispatched");
    expect(mission.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(mission.name).toBe("Mission record check");
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

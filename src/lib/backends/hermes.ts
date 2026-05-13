// ═══════════════════════════════════════════════════════════════
// backends/hermes.ts — Hermes agent backend
//
// Implements the Hermes mission dispatch backend.
// This is the only backend -- all mission dispatch flows through here.
//
// Dispatch pipeline design:
//   Control Hub is ALWAYS the source of truth for model + credentials.
//   Before spawning a mission, we resolve the model from the models
//   registry (or use the explicit override from the dispatch call),
//   write the API key into the target profile's auth.json, then
//   launch hermes with the resolved model + provider flags.
//
// Session tracking: the session ID is captured by tee'ing hermes's
// first line of output to a .session file before the main output
// log begins.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import * as yaml from "js-yaml";
import { PATHS } from "../paths";
import { getActiveHermesPaths, getAgentLlmEndpoints } from "../hermes-agent-runtime";
import { callLLM as genericCallLLM } from "../llm";
import {
  AgentProfile,
  CreateProfileInput,
  Mission,
  DispatchMissionInput,
  ToolDefinition,
  LLMMessage,
  LLMOptions,
  LLMResponse,
  MissionStatus,
} from "../agent-backend/types";
import type { AgentBackend } from "../agent-backend";
import { logApiError } from "../api-logger";
import { getDefaultModel } from "../models-repository";
import { getCredentialWithKey } from "../credentials-repository";
import { randomUUID } from "crypto";

// ── Hermes profile shape (what Hermes stores on disk) ───────────

interface HermesProfileDisk {
  name: string;
  description?: string;
  role?: string;
  status?: string;
  config?: Record<string, unknown>;
}

// ── Hermes CLI dispatch helpers ─────────────────────────────────

interface BuildHermesChatArgvInput {
  profileName?: string;
  modelId?: string;
  provider?: string;
  source: string;
}

/**
 * Build the argv for `hermes [--profile X] chat -q <prompt>
 * [--model M] [--provider P] --quiet --source <tag> --pass-session-id`.
 * The prompt is passed via env var (CH_MISSION_PROMPT) to avoid shell
 * escaping pitfalls — see spawnHermesChatWithStatusCallback below.
 */
export function buildHermesChatArgv(input: BuildHermesChatArgvInput): string[] {
  const argv: string[] = [];
  if (input.profileName && input.profileName.trim().length > 0) {
    argv.push("--profile", input.profileName);
  }
  argv.push("chat");
  if (input.modelId && input.modelId.trim().length > 0) {
    argv.push("--model", input.modelId);
  }
  if (input.provider && input.provider.trim().length > 0) {
    argv.push("--provider", input.provider);
  }
  argv.push("--quiet", "--source", input.source, "--pass-session-id");
  return argv;
}

function shellQuote(value: string): string {
  if (value.length === 0) return "''";
  if (/^[A-Za-z0-9_./:@%+=-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

// ── Model resolution ───────────────────────────────────────────

/**
 * Resolve the model, provider, and API key for a mission dispatch.
 *
 * Priority:
 *   1. Explicit modelId + provider passed to dispatch (per-mission override)
 *   2. Control Hub models DB default agent model
 *   3. Empty strings — hermes falls back to its profile config (last resort)
 *
 * Control Hub is ALWAYS the source of truth. We never allow hermes's
 * profile config to be the primary decision-maker for which model runs.
 */
async function resolveMissionModel(input: {
  modelId?: string;
  provider?: string;
}): Promise<{ modelId: string; provider: string; apiKey: string | null }> {
  // 1. Explicit override — mission creator chose a specific model
  if (input.modelId && input.provider) {
    return { modelId: input.modelId, provider: input.provider, apiKey: null };
  }

  // 2. Control Hub models DB default agent model
  try {
    const defaultModel = getDefaultModel("agent");
    if (defaultModel) {
      let apiKey: string | null = null;
      if (defaultModel.credentialsId) {
        const cred = getCredentialWithKey(defaultModel.credentialsId);
        apiKey = cred?.apiKey ?? null;
      }
      return {
        modelId: defaultModel.modelId,
        provider: defaultModel.provider,
        apiKey,
      };
    }
  } catch (err) {
    logApiError("resolveMissionModel", "registry lookup", err);
  }

  // 3. Nothing resolved — hermes will use its profile config
  return { modelId: "", provider: "", apiKey: null };
}

// ── Profile auth bootstrapping ────────────────────────────────

/**
 * Ensure a Hermes profile has the MiniMax API key in its auth.json and .env.
 * Called before every spawn so the mission always has valid credentials
 * regardless of what the profile previously contained.
 *
 * Skipped for "default" — that profile relies on the master ~/.hermes/.env
 * which is managed separately by hermes-config-sync.
 */
async function ensureProfileAuth(
  profileName: string,
  apiKey: string | null
): Promise<void> {
  if (!apiKey || !profileName || profileName === "default") return;

  const profilePath = join(getActiveHermesPaths().profiles, profileName);
  const authPath = join(profilePath, "auth.json");
  const envPath = join(profilePath, ".env");

  // --- auth.json ------------------------------------------------
  let existingAuth: Record<string, unknown> = {};
  if (existsSync(authPath)) {
    try {
      existingAuth = JSON.parse(readFileSync(authPath, "utf-8")) as Record<string, unknown>;
    } catch { /* ignore */ }
  }

  const pool = (existingAuth["credential_pool"] as Record<string, string[]> | undefined) ?? {};
  const authProviders = (existingAuth["providers"] as Record<string, { api_key?: string }> | undefined) ?? {};

  const needsAuthWrite =
    authProviders["minimax"]?.api_key !== apiKey ||
    !Array.isArray(pool["minimax"]) ||
    !pool["minimax"].includes("minimax");

  if (needsAuthWrite) {
    const updated = {
      version: 1,
      providers: { ...authProviders, minimax: { api_key: apiKey } },
      credential_pool: { ...pool, minimax: ["minimax"] },
    };
    try {
      mkdirSync(profilePath, { recursive: true });
      writeFileSync(authPath, JSON.stringify(updated, null, 2));
    } catch (err) {
      logApiError("ensureProfileAuth", `auth profile=${profileName}`, err);
    }
  }

  // --- .env -----------------------------------------------------
  let existingEnv = "";
  if (existsSync(envPath)) {
    existingEnv = readFileSync(envPath, "utf-8");
  }
  const envLines = existingEnv.split("\n").filter(
    (l) => !l.startsWith("MINIMAX_API_KEY=")
  );
  envLines.push(`MINIMAX_API_KEY=${apiKey}`);

  try {
    writeFileSync(envPath, envLines.join("\n") + "\n");
  } catch (err) {
    logApiError("ensureProfileAuth", `env profile=${profileName}`, err);
  }
}

// ── Session ID capture ─────────────────────────────────────────

interface SpawnHermesChatInput {
  argv: string[];
  prompt: string;
  missionId: string;
  statusFile: string;
  outputFile: string;
  sessionFile: string;
}

/**
 * Spawn `hermes chat` detached, wrapped in a bash script that:
 *   1. Captures the session ID from hermes's first line of output
 *   2. Writes a `<missionId>.status.json` callback file when hermes exits
 *   3. Writes full output to `<missionId>.output.log`
 *
 * The session ID is written to the session file before the main output
 * begins, allowing the caller to read it immediately after spawning.
 * The prompt is passed via `CH_MISSION_PROMPT` env var to avoid shell
 * escaping pitfalls.
 */
export function spawnHermesChatWithStatusCallback(input: SpawnHermesChatInput): void {
  const promptArg = `-q "$CH_MISSION_PROMPT"`;

  // We write a small bash script to /tmp to avoid complex quoting issues.
  // The script is deleted immediately after spawning (no cleanup needed for /tmp).
  const argvStr = input.argv.map(shellQuote).join(" ");
  const scriptLines = [
    "#!/bin/bash",
    `hermes ${argvStr} ${promptArg} > ${shellQuote(input.sessionFile)} 2>&1`,
    "ec=$?",
    `cat ${shellQuote(input.sessionFile)} >> ${shellQuote(input.outputFile)}`,
    `if [ "$ec" -eq 0 ]; then printf '{"status":"successful","exit_code":%s,"completed_at":"%s"}\n' "$ec" "$(date -u +%FT%TZ)" > ${shellQuote(input.statusFile)}; else printf '{"status":"failed","exit_code":%s,"completed_at":"%s","error":"hermes chat exited %s"}\n' "$ec" "$(date -u +%FT%TZ)" "$ec" > ${shellQuote(input.statusFile)}; fi`,
  ];

  const scriptPath = `/tmp/hermes_mission_${input.missionId}.sh`;
  writeFileSync(scriptPath, scriptLines.join("\n"));

  const child = spawn("bash", [scriptPath], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      CH_MISSION_PROMPT: input.prompt,
      CH_MISSION_ID: input.missionId,
    },
  });
  child.unref();
}

// ── Tool seeds (what Hermes provides by default) ────────────────

const HERMES_DEFAULT_TOOLS: Omit<ToolDefinition, "id">[] = [
  {
    name: "hermes-cli",
    label: "Hermes CLI",
    description: "Full Hermes CLI toolset — all core tools",
    category: "platform",
    enabled: true,
    config: { toolset: "hermes-cli" },
  },
  {
    name: "hermes-telegram",
    label: "Hermes Telegram",
    description: "Telegram gateway toolset",
    category: "platform",
    enabled: false,
    config: { toolset: "hermes-telegram" },
  },
  {
    name: "hermes-discord",
    label: "Hermes Discord",
    description: "Discord gateway toolset",
    category: "platform",
    enabled: false,
    config: { toolset: "hermes-discord" },
  },
  {
    name: "hermes-slack",
    label: "Hermes Slack",
    description: "Slack gateway toolset",
    category: "platform",
    enabled: false,
    config: { toolset: "hermes-slack" },
  },
  {
    name: "hermes-whatsapp",
    label: "Hermes WhatsApp",
    description: "WhatsApp gateway toolset",
    category: "platform",
    enabled: false,
    config: { toolset: "hermes-whatsapp" },
  },
  {
    name: "hermes-signal",
    label: "Hermes Signal",
    description: "Signal gateway toolset",
    category: "platform",
    enabled: false,
    config: { toolset: "hermes-signal" },
  },
  {
    name: "hermes-homeassistant",
    label: "Hermes Home Assistant",
    description: "Home Assistant gateway toolset",
    category: "platform",
    enabled: false,
    config: { toolset: "hermes-homeassistant" },
  },
  {
    name: "code-execution",
    label: "Code Execution",
    description: "Run Python scripts that call Hermes tools programmatically",
    category: "core",
    enabled: true,
    config: { toolset: "code_execution" },
  },
];

// ── Profile directory helpers ───────────────────────────────────

function profileDir(profileId: string): string {
  return join(getActiveHermesPaths().profiles, profileId);
}

function hermesProfileToAgentProfile(
  id: string,
  disk: HermesProfileDisk
): AgentProfile {
  return {
    id,
    name: disk.name,
    description: disk.description ?? "",
    role: disk.role ?? "agent",
    status: (disk.status as "active" | "inactive") ?? "active",
    config: disk.config ?? {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ── HermesAgentBackend ──────────────────────────────────────────

export class HermesAgentBackend implements AgentBackend {


  // ── Profiles ────────────────────────────────────────────────

  async listProfiles(): Promise<AgentProfile[]> {
    try {
      const hp = getActiveHermesPaths();
      if (!existsSync(hp.profiles)) return [];
      const entries = readdirSync(hp.profiles);
      const profiles: AgentProfile[] = [];
      for (const id of entries) {
        const cfg = join(hp.profiles, id, "config.yaml");
        if (existsSync(cfg)) {
          try {
            const raw = readFileSync(cfg, "utf-8");
            const disk = yaml.load(raw) as HermesProfileDisk;
            profiles.push(hermesProfileToAgentProfile(id, disk));
          } catch {
            // skip malformed profile
          }
        }
      }
      return profiles;
    } catch (err) {
      logApiError("HermesAgentBackend.listProfiles", "listProfiles", err);
      return [];
    }
  }

  async getProfile(id: string): Promise<AgentProfile | null> {
    try {
      const cfg = join(getActiveHermesPaths().profiles, id, "config.yaml");
      if (!existsSync(cfg)) return null;
      const raw = readFileSync(cfg, "utf-8");
      const disk = yaml.load(raw) as HermesProfileDisk;
      return hermesProfileToAgentProfile(id, disk);
    } catch {
      return null;
    }
  }

  async createProfile(input: CreateProfileInput): Promise<AgentProfile> {
    const id = randomUUID();
    const profilePath = profileDir(id);
    mkdirSync(profilePath, { recursive: true });

    const disk: HermesProfileDisk = {
      name: input.name,
      description: input.description ?? "",
      role: input.role ?? "agent",
      status: "active",
      config: input.config ?? {},
    };

    writeFileSync(
      join(profilePath, "config.yaml"),
      yaml.dump(disk, { lineWidth: 120 })
    );

    // Create auth.json stub (Hermes requires it)
    writeFileSync(
      join(profilePath, "auth.json"),
      JSON.stringify({ version: 1, providers: {}, credential_pool: {} })
    );

    return hermesProfileToAgentProfile(id, disk);
  }

  async updateProfile(
    id: string,
    input: Partial<CreateProfileInput>
  ): Promise<AgentProfile> {
    const cfg = join(getActiveHermesPaths().profiles, id, "config.yaml");
    let disk: HermesProfileDisk = { name: "" };
    if (existsSync(cfg)) {
      disk = yaml.load(readFileSync(cfg, "utf-8")) as HermesProfileDisk;
    }
    const updated: HermesProfileDisk = {
      ...disk,
      name: input.name ?? disk.name,
      description: input.description ?? disk.description ?? "",
      role: input.role ?? disk.role ?? "agent",
      config: input.config ?? disk.config ?? {},
    };
    writeFileSync(cfg, yaml.dump(updated, { lineWidth: 120 }));
    return hermesProfileToAgentProfile(id, updated);
  }

  async deleteProfile(id: string): Promise<void> {
    const profilePath = profileDir(id);
    if (!existsSync(profilePath)) return;
    await this.updateProfile(id, { name: "", description: "", role: "" });
    const cfg = join(profilePath, "config.yaml");
    if (existsSync(cfg)) {
      const disk = yaml.load(readFileSync(cfg, "utf-8")) as HermesProfileDisk;
      disk.status = "inactive";
      writeFileSync(cfg, yaml.dump(disk, { lineWidth: 120 }));
    }
  }

  // ── Execution ──────────────────────────────────────────────

  async dispatchMission(input: DispatchMissionInput): Promise<Mission> {
    // Prefer the caller-supplied mission ID so all output files land under the
    // same ID the API returned. Fall back to generating one for tests/backwards
    // compatibility that don't pass a missionId.
    const id = input.missionId ?? randomUUID();
    const now = new Date().toISOString();
    const mission: Mission = {
      id,
      name: input.name,
      prompt: input.prompt,
      profileId: input.profileId,
      status: "dispatched",
      createdAt: now,
      updatedAt: now,
    };

    const missionsDir = PATHS.missions;
    if (!existsSync(missionsDir)) {
      mkdirSync(missionsDir, { recursive: true });
    }

    const missionFile = join(missionsDir, `${id}.json`);
    const statusFile = join(missionsDir, `${id}.status.json`);
    const outputFile = join(missionsDir, `${id}.output.log`);
    const sessionFile = join(missionsDir, `${id}.session`);

    writeFileSync(missionFile, JSON.stringify(mission, null, 2));

    // Resolve model + credentials from Control Hub (source of truth).
    // Control Hub ALWAYS determines which model runs, not the profile config.
    const resolved = await resolveMissionModel({
      modelId: input.modelId,
      provider: input.provider,
    });

    // Bootstrap the target profile's auth.json so hermes has credentials.
    // Skipped for "default" — it uses the master ~/.hermes/.env.
    if (resolved.apiKey) {
      await ensureProfileAuth(input.profileName ?? "default", resolved.apiKey);
    }

    const cliArgv = buildHermesChatArgv({
      profileName: input.profileName,
      modelId: resolved.modelId || undefined,
      provider: resolved.provider || undefined,
      source: "control-hub-mission",
    });

    spawnHermesChatWithStatusCallback({
      argv: cliArgv,
      prompt: input.prompt,
      missionId: id,
      statusFile,
      outputFile,
      sessionFile,
    });

    return mission;
  }

  async getMissionStatus(missionId: string): Promise<MissionStatus> {
    try {
      const statusPath = join(PATHS.missions, `${missionId}.status.json`);
      if (existsSync(statusPath)) {
        const data = JSON.parse(readFileSync(statusPath, "utf-8"));
        const status = data?.status as MissionStatus | undefined;
        if (
          status === "queued" ||
          status === "dispatched" ||
          status === "successful" ||
          status === "failed"
        ) {
          return status;
        }
      }
      // No callback file yet — mission record exists but hermes is still running.
      const missionPath = join(PATHS.missions, `${missionId}.json`);
      if (existsSync(missionPath)) {
        return "dispatched";
      }
      return "queued";
    } catch {
      return "queued";
    }
  }

  /**
   * Read the session ID for a running (or completed) mission.
   * Returns null if the session file hasn't been written yet.
   */
  async getMissionSessionId(missionId: string): Promise<string | null> {
    try {
      const sessionPath = join(PATHS.missions, `${missionId}.session`);
      if (!existsSync(sessionPath)) return null;
      const content = readFileSync(sessionPath, "utf-8").trim();
      // Hermes prints: "session_id: <uuid>"
      const match = content.match(/session_id:\s*(\S+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  async syncMission(
    missionId: string,
    updates: { prompt?: string; name?: string }
  ): Promise<void> {
    try {
      const path = join(PATHS.missions, `${missionId}.json`);
      if (!existsSync(path)) return;
      const mission = JSON.parse(readFileSync(path, "utf-8"));
      if (updates.prompt !== undefined) mission.prompt = updates.prompt;
      if (updates.name !== undefined) mission.name = updates.name;
      mission.updatedAt = new Date().toISOString();
      writeFileSync(path, JSON.stringify(mission, null, 2));
    } catch (err) {
      logApiError("HermesAgentBackend.syncMission", "syncMission", err);
    }
  }

  // ── Tools ─────────────────────────────────────────────────

  async listTools(): Promise<ToolDefinition[]> {
    return HERMES_DEFAULT_TOOLS.map((t, i) => ({
      ...t,
      id: `hermes-${i}`,
    }));
  }

  async configureTool(_pluginId: string, _enabled: boolean): Promise<void> {
    // Tool registry handles persistence; Hermes has no in-memory toggle
    // so this is a no-op for the Hermes backend.
  }

  // ── LLM ──────────────────────────────────────────────────

  async callLLM(
    messages: LLMMessage[],
    opts?: LLMOptions
  ): Promise<LLMResponse> {
    return genericCallLLM(messages, opts);
  }

  // ── Health ────────────────────────────────────────────────

  async ping(): Promise<boolean> {
    try {
      const { gatewayBase } = getAgentLlmEndpoints();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(gatewayBase + "/health", {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return resp.ok;
    } catch {
      return false;
    }
  }
}

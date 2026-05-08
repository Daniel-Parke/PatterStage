// ═══════════════════════════════════════════════════════════════
// backends/hermes.ts — Hermes agent backend
//
// Implements AgentBackend for the Hermes agent.
// All Hermes-specific coupling lives here — the rest of Control Hub
// is agnostic to whether this or any other backend is running.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { spawn } from "child_process";
import * as yaml from "js-yaml";
import { AGENT_HOME, PATHS, getDefaultModelConfig } from "../paths";
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
import { randomUUID } from "crypto";

// ── Hermes profile shape (what Hermes stores on disk) ───────────

interface HermesProfileDisk {
  name: string;
  description?: string;
  role?: string;
  status?: string;
  config?: Record<string, unknown>;
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
  return join(PATHS.agentProfiles, profileId);
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
  readonly name = "Hermes";
  readonly id = "hermes";

  // ── Profiles ────────────────────────────────────────────────

  async listProfiles(): Promise<AgentProfile[]> {
    try {
      if (!existsSync(PATHS.agentProfiles)) return [];
      const entries = readdirSync(PATHS.agentProfiles);
      const profiles: AgentProfile[] = [];
      for (const id of entries) {
        const cfg = join(PATHS.agentProfiles, id, "config.yaml");
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
      const cfg = join(PATHS.agentProfiles, id, "config.yaml");
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
      JSON.stringify({})
    );

    return hermesProfileToAgentProfile(id, disk);
  }

  async updateProfile(
    id: string,
    input: Partial<CreateProfileInput>
  ): Promise<AgentProfile> {
    const cfg = join(PATHS.agentProfiles, id, "config.yaml");
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
    // Hermes profiles shouldn't be hard-deleted; mark inactive instead
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
    const id = randomUUID();
    const now = new Date().toISOString();
    const mission: Mission = {
      id,
      name: input.name,
      prompt: input.prompt,
      profileId: input.profileId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    // Persist mission JSON to CH data dir (Hermes will pick it up from there)
    const missionsDir = PATHS.missions;
    if (!existsSync(missionsDir)) {
      mkdirSync(missionsDir, { recursive: true });
    }
    writeFileSync(
      join(missionsDir, `${id}.json`),
      JSON.stringify(mission, null, 2)
    );

    // Spawn hermes run-mission in background
    const args = [
      "run-mission",
      "--id", id,
      "--name", input.name,
      "--prompt", input.prompt,
    ];
    if (input.profileId) {
      args.push("--profile", input.profileId);
    }

    const child = spawn("hermes", args, {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return mission;
  }

  async getMissionStatus(missionId: string): Promise<MissionStatus> {
    try {
      const path = join(PATHS.missions, `${missionId}.json`);
      if (!existsSync(path)) return "pending";
      const mission = JSON.parse(readFileSync(path, "utf-8"));
      return (mission.status as MissionStatus) ?? "pending";
    } catch {
      return "pending";
    }
  }

  // ── Tools ─────────────────────────────────────────────────

  async listTools(): Promise<ToolDefinition[]> {
    return HERMES_DEFAULT_TOOLS.map((t, i) => ({
      ...t,
      id: `hermes-${i}`,
    }));
  }

  async configureTool(pluginId: string, enabled: boolean): Promise<void> {
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch("http://127.0.0.1:8642/health", {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return resp.ok;
    } catch {
      return false;
    }
  }
}

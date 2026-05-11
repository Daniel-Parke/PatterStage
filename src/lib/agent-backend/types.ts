// ═══════════════════════════════════════════════════════════════
// agent-backend/types.ts — Shared types for all agent backends
// ═══════════════════════════════════════════════════════════════

import type { LocalDirEntry } from "@/types/hermes";

// ── Agent Profile ──────────────────────────────────────────────

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  role: string;
  status: "active" | "inactive";
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProfileInput {
  name: string;
  description?: string;
  role?: string;
  config?: Record<string, unknown>;
}

// ── Mission ────────────────────────────────────────────────────
//
// Status enum is canonical from the V1 mission JSON schema. The legacy
// "pending|running|completed|failed|cancelled" enum was deleted in PR 1
// of the user-models-registry rollout — all mission consumers must use
// the four-state V1 enum below.

export type MissionStatus = "queued" | "dispatched" | "successful" | "failed";

export interface Mission {
  id: string;
  name: string;
  prompt: string;
  profileId?: string;
  status: MissionStatus;
  result?: string;
  error?: string;
  sessionId?: string;
  createdAt: string;
  updatedAt: string;
  localDirs?: LocalDirEntry[];
  references?: string[];
  skills?: string[];
  goals?: string[];
}

export interface DispatchMissionInput {
  /** Pre-created mission ID from Control Hub DB. If omitted, dispatchMission
   *  generates its own (legacy behaviour — prefer passing the ID so all files
   *  land under the same ID that the API returns to the caller). */
  missionId?: string;
  name: string;
  prompt: string;
  profileId?: string;
  /** Hermes profile name (passed to `hermes --profile <name>`). */
  profileName?: string;
  /** Concrete model id, e.g. `anthropic/claude-sonnet-4`. */
  modelId?: string;
  /**
   * Inference provider for the chosen model. Must match Hermes CLI
   * `--provider` choices (see src/lib/hermes-providers.ts once PR 3 lands).
   */
  provider?: string;
}

// ── Tool Definition ─────────────────────────────────────────────

export interface ToolDefinition {
  id: string;
  name: string;
  label: string;
  description: string;
  category: "core" | "platform" | "custom" | "mcp";
  enabled: boolean;
  config: Record<string, unknown>;
}

// ── LLM ───────────────────────────────────────────────────────

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ── Session / Log ───────────────────────────────────────────────

export interface AgentSession {
  id: string;
  profile: string;
  startedAt: string;
  endedAt?: string;
  outcome?: string;
  summary?: string;
}

export interface LogEntry {
  timestamp: string;
  source: "agent" | "gateway" | "errors";
  level: "INFO" | "WARN" | "ERROR";
  message: string;
}

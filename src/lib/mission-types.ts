// ═══════════════════════════════════════════════════════════════
// mission-types.ts — shared mission + agent domain types
//
// Relocated from the deleted agent-backend/ folder (which was shaped around
// the old bash dispatch backend). These are framework-agnostic domain types
// used across the mission repository, API, and orchestration layers.
// ═══════════════════════════════════════════════════════════════

import type { LocalDirEntry } from "@/types/hermes";

// ── Mission ────────────────────────────────────────────────────
//
// Status enum is canonical from the V1 mission JSON schema (four states).

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
  suggestedToolsets?: string[];
  goals?: string[];
  modelId?: string;
  provider?: string;
  profileName?: string;
  missionTimeMinutes?: number;
  timeoutMinutes?: number;
  schedule?: string;
  /** ID of the linked cron job (legacy recurring path; superseded by schedules). */
  cronJobId?: string;
  categoryId?: string | null;
  outputFormat?: string;
  constraints?: string;
  /** True when dispatchMode=queue and waiting for the queue worker; false for save drafts. */
  queuedForRun?: boolean;
}

// ── Tool / LLM / Session domain types ──────────────────────────

export interface ToolDefinition {
  id: string;
  name: string;
  label: string;
  description: string;
  category: "core" | "platform" | "custom" | "mcp";
  enabled: boolean;
  config: Record<string, unknown>;
}

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

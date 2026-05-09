// ═══════════════════════════════════════════════════════════════
// agent-backend/types.ts — Shared types for all agent backends
// ═══════════════════════════════════════════════════════════════

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

export type MissionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

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
  localDirs?: string[];
  references?: string[];
  skills?: string[];
  goals?: string[];
}

export interface DispatchMissionInput {
  name: string;
  prompt: string;
  profileId?: string;
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

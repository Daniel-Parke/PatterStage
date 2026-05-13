// ═══════════════════════════════════════════════════════════════
// agent-backend/index.ts — Hermes mission dispatch contract
// ═══════════════════════════════════════════════════════════════

import type {
  AgentProfile,
  CreateProfileInput,
  Mission,
  DispatchMissionInput,
  ToolDefinition,
  LLMMessage,
  LLMOptions,
  LLMResponse,
  MissionStatus,
} from "./types";

// ── The contract ────────────────────────────────────────────────

export interface AgentBackend {

  // ── Profiles ────────────────────────────────────────────────

  listProfiles(): Promise<AgentProfile[]>;
  getProfile(id: string): Promise<AgentProfile | null>;
  createProfile(input: CreateProfileInput): Promise<AgentProfile>;
  updateProfile(id: string, input: Partial<CreateProfileInput>): Promise<AgentProfile>;
  deleteProfile(id: string): Promise<void>;

  // ── Execution ──────────────────────────────────────────────

  /**
   * Dispatch a mission. Returns the created mission record.
   * The backend decides how to run it (CLI, HTTP, etc.).
   */
  dispatchMission(input: DispatchMissionInput): Promise<Mission>;

  /**
   * Poll the current status of a running mission.
   */
  getMissionStatus(missionId: string): Promise<MissionStatus>;

  /**
   * Read the Hermes session ID for a completed (or running) mission.
   * Returns null if the session file hasn't been written yet.
   */
  getMissionSessionId(missionId: string): Promise<string | null>;

  /**
   * Sync an updated mission prompt to the on-disk mission manifest.
   * Call this after a mission's prompt is updated so the next cron run
   * picks up the new prompt.
   */
  syncMission(missionId: string, updates: { prompt?: string; name?: string }): Promise<void>;

  // ── Tools ─────────────────────────────────────────────────

  /**
   * List all available tools in this Hermes install.
   * Tools with category "mcp" are MCP servers.
   */
  listTools(): Promise<ToolDefinition[]>;

  /**
   * Enable or disable a tool plugin.
   */
  configureTool(pluginId: string, enabled: boolean): Promise<void>;

  // ── LLM ──────────────────────────────────────────────────

  callLLM(
    messages: LLMMessage[],
    opts?: LLMOptions
  ): Promise<LLMResponse>;

  // ── Health ────────────────────────────────────────────────

  ping(): Promise<boolean>;
}

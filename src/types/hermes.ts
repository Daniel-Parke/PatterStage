// ═══════════════════════════════════════════════════════════════
// Control Hub — Hermes Data Types
// ═══════════════════════════════════════════════════════════════

// ── API Response Envelope ──────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
  };
}

// ── Dashboard ─────────────────────────────────────────────────

export interface SystemStatus {
  soulFile: boolean;
  configFile: boolean;
  skillsCount: number;
  sessionsCount: number;
  memorySize: string;
  timestamp: string;
}

export interface FileData {
  content: string;
  name: string;
  description: string;
  exists: boolean;
  size: number;
}

// ── Skills ─────────────────────────────────────────────────────

export interface Skill {
  name: string;
  category: string;
  path: string;
  description: string;
  size: number;
  lastModified: string;
}

export interface SkillsData {
  skills: Skill[];
  categories: Record<string, Skill[]>;
  total: number;
  categoryCount: number;
}

// ── Sessions ───────────────────────────────────────────────────

export interface Session {
  id: string;
  filename: string;
  title: string;
  size: number;
  created: string;
  modified: string;
  messageCount: number;
  model: string;
  source: string;
}

export interface SessionsData {
  sessions: Session[];
  total: number;
}

// ── Memory ─────────────────────────────────────────────────────

export type MemoryProviderType = "holographic" | "hindsight" | "none";

export interface MemoryFact {
  id: number;
  content: string;
  category: string;
  tags: string;
  trust: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryBank {
  bank_name: string;
  fact_count: number;
  updated_at: string;
}

export interface MemoryData {
  facts: MemoryFact[];
  total: number;
  dbSize: number;
  available: boolean;
  provider: MemoryProviderType;
  error?: string;
  message?: string;
  entities?: number;
  banks?: MemoryBank[];
}

// ── Agent Profiles ────────────────────────────────────────────

export interface ProfileFile {
  key: string;
  name: string;
  path: string;
  exists: boolean;
  size: number;
  lastModified: string | null;
}

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  personality: string;
  isDefault: boolean;
  isBundled: boolean;
  skillsCount: number;
  toolsCount: number;
  files: ProfileFile[];
}

export interface ProfilesData {
  profiles: AgentProfile[];
}

// ── Config Sections ────────────────────────────────────────────

export interface AgentConfig {
  max_turns: number;
  reasoning_effort: string;
  tool_use_enforcement: string;
  verbose: boolean;
  gateway_timeout: number;
  personalities: Record<string, string>;
}

export interface ModelConfig {
  default: string;
  provider: string;
  base_url: string;
  api_key: string;
  context_length: number;
}

export interface DisplayConfig {
  skin: string;
  show_cost: boolean;
  show_reasoning: boolean;
  streaming: boolean;
  tool_progress: boolean;
  compact: boolean;
  personality: string;
  tool_preview_length: number;
}

export interface MemoryConfig {
  memory_enabled: boolean;
  provider: string;
  memory_char_limit: number;
  user_char_limit: number;
  nudge_interval: number;
  user_profile_enabled: boolean;
  flush_min_turns: number;
}

export interface TerminalConfig {
  backend: string;
  timeout: number;
  persistent_shell: boolean;
  docker_image: string;
  container_cpu: number;
  container_memory: number;
  container_disk: number;
}

export interface CompressionConfig {
  enabled: boolean;
  threshold: number;
  target_ratio: number;
  protect_last_n: number;
}

export interface SecurityConfig {
  tirith_enabled: boolean;
  tirith_fail_open: boolean;
  redact_secrets: boolean;
  website_blocklist: {
    domains: string[];
    enabled: boolean;
  };
}

export interface TTSConfig {
  provider: string;
  edge: { voice: string };
  elevenlabs: { voice_id: string };
  openai: { voice: string };
}

export interface STTConfig {
  enabled: boolean;
  provider: string;
  model: string;
  local: { model: string };
}

export interface DelegationConfig {
  model: string;
  provider: string;
  max_iterations: number;
  default_toolsets: string[];
}

export interface CronConfig {
  wrap_response: boolean;
}

export interface CheckpointsConfig {
  enabled: boolean;
  max_snapshots: number;
}

export interface FullConfig {
  _config_version: number;
  agent: AgentConfig;
  model: ModelConfig;
  display: DisplayConfig;
  memory: MemoryConfig;
  terminal: TerminalConfig;
  compression: CompressionConfig;
  security: SecurityConfig;
  tts: TTSConfig;
  stt: STTConfig;
  delegation: DelegationConfig;
  cron: CronConfig;
  checkpoints: CheckpointsConfig;
  approvals: { mode: string; timeout: number };
  [key: string]: unknown;
}

// ── Config Section Definition (for UI rendering) ──────────────

export interface ConfigFieldDef {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "select" | "textarea";
  options?: string[];
  description?: string;
  min?: number;
  max?: number;
}

export interface ConfigSectionDef {
  key: string;
  label: string;
  icon: string;
  color: AccentColor;
  fields: ConfigFieldDef[];
}

// ── Accent Color ───────────────────────────────────────────────

export type AccentColor =
  | "cyan"
  | "purple"
  | "pink"
  | "green"
  | "orange"
  | "red"
  | "blue"
  | "yellow";

// ── Credentials ───────────────────────────────────────────────

export interface Mission {
  id: string;
  name: string;
  prompt: string;
  profileId?: string;
  profileName?: string;
  status: string;
  result?: string;
  sessionId?: string;
  localDirs?: LocalDirEntry[];
  references?: string[];
  skills?: string[];
  goals?: string[];
  modelId?: string;
  provider?: string;
  model?: string;
  missionTimeMinutes?: number;
  timeoutMinutes?: number;
  schedule?: string;
  cronJobId?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Local Directory Entry (shared by missions, templates) ─────

export interface LocalDirEntry {
  path: string;
  branch: string | null;
}

// ── Credentials ───────────────────────────────────────────────

export interface Credential {
  id: string;
  name: string;
  provider?: string;
  keyLastFour?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Fallback Chain ────────────────────────────────────────────

export interface FallbackChainEntry {
  id: string;
  modelId: string | null;
  modelName: string;
  provider: string;
  modelIdString: string;
  position: number;
  enabled: boolean;
  overrideBaseUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FallbackConfig {
  restorePrimaryOnFallback: boolean;
  fallbackNotification: boolean;
  apiMaxRetries: number;
}

// ── System Cron ────────────────────────────────────────────

export interface SystemCronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  command: string;
  logFile?: string;
}

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



// ── System Status ──────────────────────────────────────────────

export interface SystemStatus {

  soulFile: boolean;

  configFile: boolean;

  skillsCount: number;

  sessionsCount: number;

  memorySize: string;

  timestamp: string;

}



// ── File Editor ────────────────────────────────────────────────

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

  id: string;

  label: string;

  description: string;

  icon: string;

  color: string;

  fields: ConfigFieldDef[];

}



// ── Missions ───────────────────────────────────────────────────

export interface MissionTemplate {

  id: string;

  name: string;

  icon: string;

  color: AccentColor;

  category: string;

  profile: string;

  description: string;

  prompt: string;

  goals: string[];

  suggestedSkills: string[];

  defaultModel: string;

  timeoutMinutes: number;

  isCustom?: boolean;

}



export type MissionStatus = "queued" | "dispatched" | "successful" | "failed";

export type DispatchMode = "save" | "now" | "cron";



/** Working directory with optional git branch hint (prompt-only). */
export interface LocalDirEntry {

  path: string;

  branch?: string | null;

}



export interface Mission {

  id: string;

  name: string;

  prompt: string;

  goals: string[];

  skills: string[];

  localDirs?: LocalDirEntry[];

  references?: string[];

  model: string;

  profile: string;

  missionTimeMinutes: number;

  timeoutMinutes: number;

  schedule: string;

  templateId: string | null;

  status: MissionStatus;

  dispatchMode: DispatchMode;

  createdAt: string;

  updatedAt: string;

  results: string | null;

  duration: number | null;

  error: string | null;

  cronJobId?: string;

  cronJob?: {

    state: string;

    enabled: boolean;

    lastRun: string | null;

    lastStatus: string | null;

    schedule?: string;

  };

}



// ── Operations (multi-step sequences; execution via Hermes cron/delegation) ──

export type OperationStepStatus =

  | "pending"

  | "running"

  | "done"

  | "failed"

  | "skipped";



export interface OperationStep {

  id: string;

  title: string;

  missionTemplateId?: string;

  profile?: string;

  model?: string;

  notes?: string;

  status: OperationStepStatus;

  missionId?: string;

  cronJobId?: string;

  error?: string | null;

  updatedAt: string;

}



export type OperationRunStatus =

  | "draft"

  | "active"

  | "paused"

  | "completed"

  | "failed";



/** How the operator advances work — Hermes still runs jobs; CH only tracks intent. */

export type OperationRunnerContract =

  | "manual_advance"

  | "dispatch_mission_per_step";



export interface OperationRecord {

  id: string;

  name: string;

  description: string;

  steps: OperationStep[];

  currentStepIndex: number;

  status: OperationRunStatus;

  /** Declared execution pattern (default manual advance). */

  runnerContract?: OperationRunnerContract;

  createdAt: string;

  updatedAt: string;

}



// ── Task lists (ordered recurring sequences; coordinator design in PLATFORM_VISION) ──



export interface TaskListStep {

  id: string;

  title: string;

  schedule: string;

  missionTemplateId?: string;

  prompt?: string;

  profile?: string;

  model?: string;

}



export interface TaskListRecord {

  id: string;

  name: string;

  description: string;

  steps: TaskListStep[];

  /** Optional Hermes cron job id when using a single coordinator job. */

  coordinatorJobId?: string | null;

  coordinatorNotes?: string;

  createdAt: string;

  updatedAt: string;

}



// ── Workspace registry (extra repos under allowlisted roots) ──



export interface WorkspaceEntry {

  id: string;

  label: string;

  path: string;

  gitRemote?: string;

  createdAt: string;

  updatedAt: string;

}



export interface WorkspaceRegistry {

  workspaces: WorkspaceEntry[];

  updatedAt: string;

}



// ── Package bundles (export/import JSON) ──



export interface PackageBundle {

  id: string;

  name: string;

  version: string;

  createdAt: string;

  missionTemplateIds: string[];

  taskListIds: string[];

  profileNames: string[];

  notes?: string;

}



// ═══════════════════════════════════════════════════════════════
// Kanban — Multi-Agent Coordination Kanban Layer
// ═══════════════════════════════════════════════════════════════

// ── Team ───────────────────────────────────────────────────────
export interface TeamMember {
  profileId: string;
  role: "leader" | "specialist" | "reviewer" | "observer";
  joinedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  leaderProfileId: string;
  members: TeamMember[];
  boardIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Kanban Card Status ─────────────────────────────────────────
export type KanbanCardStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "review"
  | "done"
  | "blocked";

// ── Kanban Column ──────────────────────────────────────────────
export interface KanbanColumn {
  id: string;
  boardId?: string;
  title: string;
  color: AccentColor;
  position: number;
  wipLimit: number | null;
  cardIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

// ── Kanban Card ────────────────────────────────────────────────
export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  columnId: string;
  boardId: string;
  position: number;
  status: KanbanCardStatus;
  assigneeProfileId: string | null;
  goalIndices: number[];
  missionIds: string[];
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Kanban Board ───────────────────────────────────────────────
export interface KanbanBoard {
  id: string;
  name: string;
  description: string;
  columnIds: string[];
  teamId: string;
  createdAt: string;
  updatedAt: string;
}

// ── Goal Session ─────────────────────────────────────────────
export type GoalLoopMode = "sequential" | "parallel";
export type GoalSessionStatus =
  | "active"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface GoalStep {
  index: number;
  goal: string;
  status: "pending" | "active" | "done" | "failed" | "skipped";
  missionId: string | null;
  assignedProfileId: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface GoalSession {
  id: string;
  boardId: string;
  cardId: string;
  goalLoopMode: GoalLoopMode;
  goals: string[];
  currentGoalIndex: number;
  steps: GoalStep[];
  status: GoalSessionStatus;
  coordinatorMissionId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Kanban Full Document ───────────────────────────────────────
export interface KanbanDocument {
  board: KanbanBoard;
  columns: Record<string, KanbanColumn>;
  cards: Record<string, KanbanCard>;
}

// ── API Response shapes ────────────────────────────────────────
export interface KanbanBoardsResponse {
  boards: KanbanBoard[];
}

export interface KanbanBoardResponse {
  board: KanbanBoard;
  columns: Record<string, KanbanColumn>;
  cards: Record<string, KanbanCard>;
}

export interface TeamsResponse {
  teams: Team[];
}

// ── UI Component Props ─────────────────────────────────────────
export type StatusLevel = "online" | "warning" | "error" | "idle";



export type AccentColor = "cyan" | "purple" | "green" | "pink" | "orange";



export interface NavItem {

  icon: string;

  label: string;

  href: string;

  color: AccentColor;

}

export type FrameworkId = "universal" | string;

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

export interface FrameworkDefaults {
    agent: string | null;
    hindsight: string | null;
    compression: string | null;
    vision: string | null;
    web_extract: string | null;
    session_search: string | null;
    title_generation: string | null;
    skills_hub: string | null;
    mcp: string | null;
    triage_specifier: string | null;
    approval: string | null;
    delegation: string | null;
}


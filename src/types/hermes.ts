// ═══════════════════════════════════════════════════════════════
// PatterStage — Hermes Data Types
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

export interface SessionBrief {
  id: string;
  modified: string;
  size: number;
}

export interface MonitorData {
  sessions: {
    total: number;
    recent: SessionBrief[];
  };
  gateway: {
    platforms: Record<string, boolean>;
    connectedCount: number;
  };
  memory: {
    factCount: number;
    dbSize: string;
    provider: string;
  };
  errors: Array<{
    source: string;
    message: string;
    timestamp: string;
    severity: string;
  }>;
  system: {
    uptime: string;
    configPresent: boolean;
    soulPresent: boolean;
  };
  sync: {
    lastRun: string | null;
    allSuccessful: boolean;
    sourceStatuses: Record<string, string>;
  };
}

export interface HermesProcess {
  id: string;
  type: "cron" | "gateway" | "manual" | "subagent";
  name: string;
  status: "running" | "idle";
  startedAt: string | null;
  lastActivity: string | null;
  model: string;
  pid: number | null;
  turns: number;
}

export interface MissionBrief {
  id: string;
  name: string;
  status: string;
  dispatchMode: string;
  createdAt: string;
  queuedForRun?: boolean;
  cronJobId?: string;
  cronJob?: { state: string; enabled: boolean; lastRun: string | null; lastStatus: string | null };
  latestSession?: { id: string; modified: string } | null;
}

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
  enabled: boolean;
  size: number;
  lastModified: string;
}

export interface SkillsData {
  skills: Skill[];
  categories: Record<string, Skill[]>;
  total: number;
  categoryCount: number;
  profile: string;
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
  /** Filesystem / CLI slug (lowercase). Same as `id` for named profiles; `default` for Bob. */
  id: string;
  /** Display label in UI (may differ from slug casing). */
  name: string;
  description: string;
  personality: string;
  isDefault: boolean;
  isBundled: boolean;
  skillsCount: number;
  toolsCount: number;
  files: ProfileFile[];
  syncStatus?: "synced" | "drift" | "error";
  syncedAt?: string | null;
  syncError?: string | null;
}

export interface ProfilesData {
  profiles: AgentProfile[];
}

// ── Mission ─────────────────────────────────────────────────

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
  suggestedToolsets?: string[];
  goals?: string[];
  modelId?: string;
  provider?: string;
  model?: string;
  missionTimeMinutes?: number;
  timeoutMinutes?: number;
  schedule?: string;
  cronJobId?: string;
  categoryId?: string | null;
  outputFormat?: string;
  constraints?: string;
  queuedForRun?: boolean;
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

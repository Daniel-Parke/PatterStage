// ═══════════════════════════════════════════════════════════════
// types/console.ts — PatterStage's own console types
//
// Renamed from types/hermes.ts, which was the most misleading filename in the
// repo: it had 60 importers and its exports are PatterStage's HTTP envelope
// (ApiResponse), its domain records (Mission, AgentProfile, Skill), and its
// design tokens (AccentColor). None of that is Hermes. The old name made a grep
// for "hermes" in core return 60 false positives and made the
// framework-agnostic claim look far more broken than it was
// (org/decisions/ADR-0005-product-modules.md).
//
// One export IS framework-specific and stays deliberately: `HermesProcess`
// describes what ProcessSync observes in `ps aux`, so it is named after the
// thing it actually is. Visible coupling beats a neutral-sounding alias, the
// same rule ConfigSync established.
// ═══════════════════════════════════════════════════════════════

import type { SchedulerHealth } from "@/lib/orchestration/scheduler/health";

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
    /** Set when config.yaml is present but fails to parse (malformed YAML). */
    configYamlError?: string | null;
  };
  sync: {
    lastRun: string | null;
    allSuccessful: boolean;
    sourceStatuses: Record<string, string>;
    /**
     * The last failure message per source, for the sources that have one.
     *
     * `sourceStatuses` flattens a source to "ok" / "error" / "pending", which
     * is enough to draw a red cross and nothing else. SyncScheduler has kept
     * the actual message all along and /api/sync has served it, but the
     * dashboard reads THIS route, so the reason was thrown away one call
     * short of the screen (T-0034).
     *
     * A healthy source contributes no key. An empty string is not "no error",
     * and a panel that renders every key draws an empty reason box for every
     * source that is fine.
     */
    sourceErrors: Record<string, string>;
  };
  /**
   * The background scheduler's cross-process lease + heartbeat. This is the
   * loop that fires due schedules and reconciles dispatched runs, so a stale
   * heartbeat is the reason a schedule did not fire and a run never resolved.
   */
  scheduler: SchedulerHealth;
  /** The active agent framework (DB-owned registry). */
  framework?: {
    type: string;
    name: string;
    available: boolean;
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
  /** Category name -> how many skills are in it. Deliberately NOT the skill
   *  objects: `skills` above already carries every one of them, and serving
   *  them twice was 69,574 of this response's 137,534 bytes. The only
   *  consumer groups `skills` itself and reads these keys for its collapse
   *  state, so the counts are all it ever needed. */
  categories: Record<string, number>;
  total: number;
  categoryCount: number;
  profile: string;
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

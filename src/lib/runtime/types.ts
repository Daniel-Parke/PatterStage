// ═══════════════════════════════════════════════════════════════
// runtime/types.ts — Framework-agnostic agent runtime contract
//
// AgentRuntime is the single seam between PatterStage's orchestration core
// and whatever actually executes work (Hermes today; LangGraph/others later).
// It is modelled on async "run" semantics: submit a run, poll/stream its
// progress, stop it, resolve approvals. NOTHING Hermes-specific (CLI flags,
// ~/.hermes paths, jobs.json, bash/PID files) may appear in this file — those
// belong inside a concrete implementation (HermesRuntime).
//
// The Hermes implementation maps these to the Hermes API Server (:8642):
//   submitRun        -> POST   /v1/runs
//   getRun           -> GET    /v1/runs/{id}
//   streamRunEvents  -> GET    /v1/runs/{id}/events   (SSE)
//   stopRun          -> POST   /v1/runs/{id}/stop
//   resolveApproval  -> POST   /v1/runs/{id}/approval
//   health           -> GET    /health/detailed
//   capabilities     -> GET    /v1/capabilities
//   listModels       -> GET    /v1/models
//   listSkills       -> GET    /v1/skills
//   listToolsets     -> GET    /v1/toolsets
//   createSession    -> POST   /api/sessions
// ═══════════════════════════════════════════════════════════════

// ── Run lifecycle ────────────────────────────────────────────

/** Terminal + non-terminal run states (canonical across all backends). */
export type RunStatus = "started" | "completed" | "failed" | "cancelled";

/** Token accounting returned by a backend, normalised to camelCase. */
export interface RunUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** Input to submit a new run. */
export interface RunSubmit {
  /** The instruction/prompt text for this run (the mission's built prompt). */
  input: string;
  /**
   * PatterStage-owned run id. Used as the Idempotency-Key so a duplicated
   * submit (e.g. double scheduler tick) is coalesced backend-side.
   */
  idempotencyKey: string;
  /** Target agent profile; resolved to a concrete gateway endpoint. */
  profileName?: string;
  /** Optional transcript-scoped session id (X-Hermes-Session-Id). */
  sessionId?: string;
  /** Optional stable long-term-memory scope key (X-Hermes-Session-Key). */
  sessionKey?: string;
  /** Optional system-prompt overlay layered on top of the agent's own. */
  instructions?: string;
  /** Optional multi-turn continuation handle. */
  previousResponseId?: string;
  /**
   * Optional cancellation. Aborts the submit itself and, importantly, any 429
   * backoff the adapter is waiting out, so a cancelled caller stops immediately
   * rather than sitting out the remaining retry budget.
   */
  signal?: AbortSignal;
}

/** Returned immediately on submit, before the run completes. */
export interface RunHandle {
  /** Backend-assigned run id (e.g. Hermes `run_id`). */
  runId: string;
  status: RunStatus;
  /** Echoed session id when the backend allocates/returns one. */
  sessionId?: string;
}

/** Snapshot of a run's state from a poll. */
export interface RunResult {
  runId: string;
  status: RunStatus;
  sessionId?: string;
  /** Final assistant output text when terminal (may be empty until completed). */
  output?: string;
  usage?: RunUsage;
  /** Populated when status === "failed". */
  error?: string;
}

/**
 * A progress event from streamRunEvents(). Intentionally loose: SSE payloads
 * vary by backend. `type` carries the backend event name (e.g.
 * "response.output_text.delta"); `data` is the raw parsed JSON. UX-only —
 * the authoritative run state always comes from getRun() polling.
 */
export interface RunEvent {
  type: string;
  data: unknown;
}

/** Decision payload for a gated tool/approval request. */
export interface ApprovalDecision {
  approved: boolean;
  /** Optional reason recorded with the decision. */
  note?: string;
}

// ── Discovery / health ───────────────────────────────────────

export interface HealthReport {
  ok: boolean;
  /** Free-form extra detail from /health/detailed (active sessions, etc.). */
  detail?: Record<string, unknown>;
}

export interface Capabilities {
  /** Feature flags advertised by the backend (e.g. run_events_sse: true). */
  features: Record<string, boolean>;
  /** Raw capability document for surfaces that need more than features. */
  raw?: Record<string, unknown>;
}

export interface ModelInfo {
  id: string;
  /** Display label when the backend provides one (else falls back to id). */
  label?: string;
}

export interface SkillInfo {
  name: string;
  description?: string;
  category?: string;
}

export interface ToolsetInfo {
  name: string;
  tools: string[];
}

// ── Sessions ─────────────────────────────────────────────────

export interface SessionCreate {
  title?: string;
  source?: string;
}

export interface SessionInfo {
  id: string;
  title?: string;
  source?: string;
}

// ── The runtime contract ─────────────────────────────────────

/**
 * The one seam PatterStage orchestration depends on. A concrete backend
 * (HermesRuntime) implements every method over its transport. `profile`
 * selects which agent/persona endpoint to target (each Hermes profile is a
 * separate gateway process on its own port/key).
 */
export interface AgentRuntime {
  submitRun(input: RunSubmit): Promise<RunHandle>;
  getRun(runId: string, profile?: string): Promise<RunResult>;
  /**
   * `signal` lets the caller end the upstream stream: the SSE proxy route
   * aborts it when the browser goes away, so a run's event stream is not held
   * open on the backend until the run ends (T-0095, D127).
   */
  streamRunEvents(runId: string, profile?: string, signal?: AbortSignal): AsyncIterable<RunEvent>;
  stopRun(runId: string, profile?: string): Promise<void>;
  resolveApproval(
    runId: string,
    decision: ApprovalDecision,
    profile?: string,
  ): Promise<void>;
  health(profile?: string): Promise<HealthReport>;
  capabilities(profile?: string): Promise<Capabilities>;
  listModels(profile?: string): Promise<ModelInfo[]>;
  listSkills(profile?: string): Promise<SkillInfo[]>;
  listToolsets(profile?: string): Promise<ToolsetInfo[]>;
  createSession(input: SessionCreate, profile?: string): Promise<SessionInfo>;
}

/** Raised on a non-2xx response from the backend transport. */
export class RuntimeRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RuntimeRequestError";
  }
}

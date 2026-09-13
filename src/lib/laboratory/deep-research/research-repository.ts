// ═══════════════════════════════════════════════════════════════
// laboratory/deep-research/research-repository.ts — CRUD for research runs/steps
//
// Mirrors the benchmark runs/results persistence shape so the page can list
// runs and replay each run's steps. See 019_deep_research.sql.
// ═══════════════════════════════════════════════════════════════

import { getDb, uuid, now } from "@/lib/db";
import { parseStringArrayOrEmpty, parseJson } from "@/lib/db/parse-json";
import type { ResearchUsageTotal } from "./usage";
import type {
  ResearchGatherHealth,
  ResearchConfig,
  ResearchPreset,
  ResearchRun,
  ResearchStatus,
  ResearchStep,
  ResearchStepKind,
} from "./types";

interface RunRow {
  id: string;
  query: string;
  status: string;
  provider: string | null;
  model_id: string | null;
  config_json: string | null;
  report: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  // NULL means the usage was never recorded, which every run before migration
  // 034 genuinely is. It is NOT zero, and the spend console depends on the
  // difference (T-0030).
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  // Likewise NULL for every run before 036: unmeasured, not a clean gather.
  search_attempts: number | null;
  search_failures: number | null;
  visit_attempts: number | null;
  visit_failures: number | null;
}

interface StepRow {
  id: string;
  run_id: string;
  position: number;
  kind: string;
  input: string | null;
  output: string | null;
  sources_json: string | null;
  created_at: string;
}

function rowToRun(row: RunRow): ResearchRun {
  return {
    id: row.id,
    query: row.query,
    status: row.status as ResearchStatus,
    provider: row.provider,
    modelId: row.model_id,
    config: parseJson<ResearchConfig>(row.config_json),
    usage:
      row.prompt_tokens === null && row.completion_tokens === null
        ? null
        : {
            promptTokens: row.prompt_tokens ?? 0,
            completionTokens: row.completion_tokens ?? 0,
            totalTokens: row.total_tokens ?? (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0),
          },
    gather:
      row.search_attempts === null && row.visit_attempts === null
        ? null
        : {
            searchAttempts: row.search_attempts ?? 0,
            searchFailures: row.search_failures ?? 0,
            visitAttempts: row.visit_attempts ?? 0,
            visitFailures: row.visit_failures ?? 0,
          },
    report: row.report,
    error: row.error,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function rowToStep(row: StepRow): ResearchStep {
  return {
    id: row.id,
    runId: row.run_id,
    position: row.position,
    kind: row.kind as ResearchStepKind,
    input: row.input,
    output: row.output,
    sources: parseStringArrayOrEmpty(row.sources_json),
    createdAt: row.created_at,
  };
}

export function createResearchRun(input: {
  query: string;
  modelId?: string | null;
  config?: ResearchConfig | null;
  /** Set when a Composer "research" node spawned this run (links it back). */
  composerNodeRunId?: string | null;
}): ResearchRun {
  const id = uuid();
  getDb()
    .prepare(
      `INSERT INTO research_runs (id, query, status, model_id, provider, config_json, composer_node_run_id, created_at)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.query,
      input.modelId ?? null,
      input.config?.searchProvider ?? null,
      input.config ? JSON.stringify(input.config) : null,
      input.composerNodeRunId ?? null,
      now(),
    );
  return getResearchRun(id)!;
}

export function getResearchRun(id: string): ResearchRun | null {
  const row = getDb().prepare("SELECT * FROM research_runs WHERE id = ?").get(id) as RunRow | undefined;
  return row ? rowToRun(row) : null;
}

/** The latest research run spawned by a given Composer node-run (settle seam). */
export function getResearchRunByComposerNodeRunId(nodeRunId: string): ResearchRun | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM research_runs WHERE composer_node_run_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(nodeRunId) as RunRow | undefined;
  return row ? rowToRun(row) : null;
}

export function listResearchRuns(limit = 50): ResearchRun[] {
  const rows = getDb()
    .prepare("SELECT * FROM research_runs ORDER BY created_at DESC LIMIT ?")
    .all(Math.max(1, Math.floor(limit))) as RunRow[];
  return rows.map(rowToRun);
}

export interface UpdateResearchRunInput {
  status?: ResearchStatus;
  provider?: string | null;
  report?: string | null;
  error?: string | null;
  completedAt?: string | null;
  /** null persists as NULL: usage was never recorded, which is not zero. */
  usage?: ResearchUsageTotal | null;
  /** null persists as NULL: the gather was never measured, which is not clean. */
  gather?: ResearchGatherHealth | null;
}

/**
 * Stop a run the operator no longer wants.
 *
 * `cancelled` has been a legal ResearchStatus, a colour on the page and a member
 * of the SSE terminal set since the feature shipped, and nothing ever wrote it:
 * a Depth 8 run against a slow endpoint could only be waited out, spending the
 * whole time (T-0108, D98).
 *
 * The status filter is in the WHERE clause, not a read-then-write, so a run that
 * reached a terminal state one millisecond earlier cannot have its report
 * relabelled. Returns the row when it moved, null when it did not — including
 * for an id that is not a run at all.
 */
export function cancelResearchRun(id: string): ResearchRun | null {
  const res = getDb()
    .prepare(
      `UPDATE research_runs SET status = 'cancelled', error = ?, completed_at = ?
        WHERE id = ? AND status IN ('pending', 'running')`,
    )
    .run("Cancelled by the operator.", now(), id);
  return res.changes > 0 ? getResearchRun(id) : null;
}

export function updateResearchRun(id: string, input: UpdateResearchRunInput): ResearchRun | null {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (input.status !== undefined) { sets.push("status = ?"); vals.push(input.status); }
  if (input.provider !== undefined) { sets.push("provider = ?"); vals.push(input.provider); }
  if (input.report !== undefined) { sets.push("report = ?"); vals.push(input.report); }
  if (input.error !== undefined) { sets.push("error = ?"); vals.push(input.error); }
  if (input.completedAt !== undefined) { sets.push("completed_at = ?"); vals.push(input.completedAt); }
  if (input.usage !== undefined) {
    sets.push("prompt_tokens = ?", "completion_tokens = ?", "total_tokens = ?");
    vals.push(
      input.usage?.promptTokens ?? null,
      input.usage?.completionTokens ?? null,
      input.usage?.totalTokens ?? null,
    );
  }
  if (input.gather !== undefined) {
    sets.push("search_attempts = ?", "search_failures = ?", "visit_attempts = ?", "visit_failures = ?");
    vals.push(
      input.gather?.searchAttempts ?? null,
      input.gather?.searchFailures ?? null,
      input.gather?.visitAttempts ?? null,
      input.gather?.visitFailures ?? null,
    );
  }
  if (sets.length === 0) return getResearchRun(id);
  getDb().prepare(`UPDATE research_runs SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
  return getResearchRun(id);
}

/**
 * Watchdog: fail standalone research runs stuck in `running` past a deadline.
 * runResearchJob is fire-and-forget, so a process crash mid-research would
 * otherwise leave a row `running` forever (the page spinning indefinitely).
 * Each engine LLM call has its own fast-fail timeout, so a legitimate run can't
 * hang this long — anything older is interrupted. Returns the count failed.
 * (Composer-driven research nodes are capped separately by the engine.)
 */
export function failStuckResearchRuns(maxMinutes = 30): number {
  const cutoff = new Date(Date.now() - maxMinutes * 60_000).toISOString();
  const res = getDb()
    .prepare(
      `UPDATE research_runs SET status = 'failed', error = ?, completed_at = ?
       WHERE status = 'running' AND created_at < ?`,
    )
    .run("Research run was interrupted or exceeded the maximum runtime.", now(), cutoff);
  return res.changes;
}

export function insertResearchStep(input: {
  runId: string;
  position: number;
  kind: ResearchStepKind;
  input: string | null;
  output: string | null;
  sources: string[];
}): void {
  getDb()
    .prepare(
      `INSERT INTO research_steps (id, run_id, position, kind, input, output, sources_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      uuid(),
      input.runId,
      input.position,
      input.kind,
      input.input,
      input.output,
      input.sources.length ? JSON.stringify(input.sources) : null,
      now(),
    );
}

export function listResearchSteps(runId: string): ResearchStep[] {
  const rows = getDb()
    .prepare("SELECT * FROM research_steps WHERE run_id = ? ORDER BY position ASC")
    .all(runId) as StepRow[];
  return rows.map(rowToStep);
}

// ── Saved presets ───────────────────────────────────────────────

interface PresetRow {
  id: string;
  name: string;
  config_json: string;
  created_at: string;
}

function rowToPreset(row: PresetRow): ResearchPreset {
  return {
    id: row.id,
    name: row.name,
    config: parseJson<ResearchConfig>(row.config_json) ?? {},
    createdAt: row.created_at,
  };
}

export function listResearchPresets(): ResearchPreset[] {
  const rows = getDb()
    .prepare("SELECT * FROM research_presets ORDER BY created_at DESC")
    .all() as PresetRow[];
  return rows.map(rowToPreset);
}

export function createResearchPreset(name: string, config: ResearchConfig): ResearchPreset {
  const id = uuid();
  getDb()
    .prepare("INSERT INTO research_presets (id, name, config_json, created_at) VALUES (?, ?, ?, ?)")
    .run(id, name, JSON.stringify(config), now());
  return rowToPreset(
    getDb().prepare("SELECT * FROM research_presets WHERE id = ?").get(id) as PresetRow,
  );
}

export function deleteResearchPreset(id: string): void {
  getDb().prepare("DELETE FROM research_presets WHERE id = ?").run(id);
}

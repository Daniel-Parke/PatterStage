// ═══════════════════════════════════════════════════════════════
// benchmarks/benchmarks-repository.ts — CRUD for benchmark runs + results
//
// A `benchmark_runs` row tracks one suite execution against one target
// (an agent profile or a bare model) from pending → terminal. Each
// `benchmark_item_results` row is one (item, repeat) outcome. The executor
// (runner.ts) writes results as it goes and stamps the summary on completion;
// the API + rating layers read these back. Defensive parsing throughout so a
// partially-populated row never throws into a route.
// ═══════════════════════════════════════════════════════════════

import { db, inTransaction, now, uuid } from "@/lib/db";
import { parseJson, parseStringArray, parseBool } from "@/lib/db/parse-json";
import type {
  BenchmarkDomain,
  BenchmarkExecMode,
  BenchmarkItemResult,
  BenchmarkRun,
  BenchmarkRunConfig,
  BenchmarkRunStatus,
  BenchmarkSummary,
  BenchmarkTargetKind,
} from "./types";

// ── Row shapes ───────────────────────────────────────────────

interface RunRow {
  id: string;
  suite_key: string;
  suite_version: string;
  target_kind: string;
  target_ref: string;
  target_label: string | null;
  repeats: number;
  seed: string | null;
  status: string;
  pair_id: string | null;
  model_id: string | null;
  model_label: string | null;
  exec_mode: string | null;
  used_skills: number | null;
  used_tools: number | null;
  used_memory: number | null;
  config_json: string | null;
  summary_json: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ResultRow {
  id: string;
  benchmark_run_id: string;
  item_id: string;
  domain: string;
  repeat_index: number;
  input_run_id: string | null;
  raw_output: string | null;
  score: number | null;
  passed: number | null;
  grader: string | null;
  grader_detail_json: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  skills_used_json: string | null;
  tools_used_json: string | null;
  memory_used: number | null;
  created_at: string;
}

function rowToRun(row: RunRow | undefined): BenchmarkRun | null {
  if (!row) return null;
  return {
    id: row.id,
    suiteKey: row.suite_key,
    suiteVersion: row.suite_version,
    targetKind: row.target_kind as BenchmarkTargetKind,
    targetRef: row.target_ref,
    targetLabel: row.target_label,
    repeats: row.repeats,
    seed: row.seed,
    status: row.status as BenchmarkRunStatus,
    pairId: row.pair_id,
    modelId: row.model_id,
    modelLabel: row.model_label,
    execMode: (row.exec_mode as BenchmarkExecMode | null) ?? null,
    usedSkills: parseBool(row.used_skills),
    usedTools: parseBool(row.used_tools),
    usedMemory: parseBool(row.used_memory),
    config: parseJson<BenchmarkRunConfig>(row.config_json),
    summary: parseJson<BenchmarkSummary>(row.summary_json),
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToResult(row: ResultRow): BenchmarkItemResult {
  return {
    id: row.id,
    benchmarkRunId: row.benchmark_run_id,
    itemId: row.item_id,
    domain: row.domain as BenchmarkDomain,
    repeatIndex: row.repeat_index,
    inputRunId: row.input_run_id,
    rawOutput: row.raw_output,
    score: row.score,
    passed: row.passed === null ? null : row.passed === 1,
    grader: row.grader,
    graderDetail: parseJson<Record<string, unknown>>(row.grader_detail_json),
    latencyMs: row.latency_ms,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    costUsd: row.cost_usd,
    skillsUsed: parseStringArray(row.skills_used_json),
    toolsUsed: parseStringArray(row.tools_used_json),
    memoryUsed: parseBool(row.memory_used),
    createdAt: row.created_at,
  };
}

// ── Create ───────────────────────────────────────────────────

export interface CreateBenchmarkRunInput {
  suiteKey: string;
  suiteVersion: string;
  targetKind: BenchmarkTargetKind;
  targetRef: string;
  targetLabel?: string | null;
  repeats: number;
  seed?: string | null;
  pairId?: string | null;
  // (Agent + LLM) unit + augmentation
  modelId?: string | null;
  modelLabel?: string | null;
  execMode?: BenchmarkExecMode | null;
  usedSkills?: boolean | null;
  usedTools?: boolean | null;
  usedMemory?: boolean | null;
  config?: BenchmarkRunConfig | null;
}

export function createBenchmarkRun(input: CreateBenchmarkRunInput): BenchmarkRun {
  const id = uuid();
  const ts = now();
  const bit = (b: boolean | null | undefined): number | null =>
    b === null || b === undefined ? null : b ? 1 : 0;
  db()
    .prepare(
      `INSERT INTO benchmark_runs
         (id, suite_key, suite_version, target_kind, target_ref, target_label,
          repeats, seed, status, pair_id,
          model_id, model_label, exec_mode, used_skills, used_tools, used_memory, config_json,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.suiteKey,
      input.suiteVersion,
      input.targetKind,
      input.targetRef,
      input.targetLabel ?? null,
      input.repeats,
      input.seed ?? null,
      input.pairId ?? null,
      input.modelId ?? null,
      input.modelLabel ?? null,
      input.execMode ?? null,
      bit(input.usedSkills),
      bit(input.usedTools),
      bit(input.usedMemory),
      input.config ? JSON.stringify(input.config) : null,
      ts,
      ts,
    );
  return getBenchmarkRun(id)!;
}

export interface InsertItemResultInput {
  benchmarkRunId: string;
  itemId: string;
  domain: BenchmarkDomain;
  repeatIndex: number;
  inputRunId?: string | null;
  rawOutput?: string | null;
  score?: number | null;
  passed?: boolean | null;
  grader?: string | null;
  graderDetail?: Record<string, unknown> | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
  skillsUsed?: string[] | null;
  toolsUsed?: string[] | null;
  memoryUsed?: boolean | null;
  /** Per-item trajectory metrics blob (see benchmarks/metrics.ts). */
  metrics?: object | null;
}

export function insertItemResult(input: InsertItemResultInput): void {
  db()
    .prepare(
      `INSERT INTO benchmark_item_results
         (id, benchmark_run_id, item_id, domain, repeat_index, input_run_id,
          raw_output, score, passed, grader, grader_detail_json,
          latency_ms, input_tokens, output_tokens, cost_usd,
          skills_used_json, tools_used_json, memory_used, metrics_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      uuid(),
      input.benchmarkRunId,
      input.itemId,
      input.domain,
      input.repeatIndex,
      input.inputRunId ?? null,
      input.rawOutput ?? null,
      input.score ?? null,
      input.passed === null || input.passed === undefined ? null : input.passed ? 1 : 0,
      input.grader ?? null,
      input.graderDetail ? JSON.stringify(input.graderDetail) : null,
      input.latencyMs ?? null,
      input.inputTokens ?? null,
      input.outputTokens ?? null,
      input.costUsd ?? null,
      input.skillsUsed ? JSON.stringify(input.skillsUsed) : null,
      input.toolsUsed ? JSON.stringify(input.toolsUsed) : null,
      input.memoryUsed === null || input.memoryUsed === undefined ? null : input.memoryUsed ? 1 : 0,
      input.metrics ? JSON.stringify(input.metrics) : null,
      now(),
    );
}

// ── Read ─────────────────────────────────────────────────────

export function getBenchmarkRun(id: string): BenchmarkRun | null {
  const row = db().prepare("SELECT * FROM benchmark_runs WHERE id = ?").get(id) as RunRow | undefined;
  return rowToRun(row);
}

export interface ListBenchmarkRunsOptions {
  targetKind?: BenchmarkTargetKind;
  targetRef?: string;
  status?: BenchmarkRunStatus;
  pairId?: string;
  limit?: number;
}

export function listBenchmarkRuns(opts: ListBenchmarkRunsOptions = {}): BenchmarkRun[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.targetKind) {
    where.push("target_kind = ?");
    params.push(opts.targetKind);
  }
  if (opts.targetRef) {
    where.push("target_ref = ?");
    params.push(opts.targetRef);
  }
  if (opts.status) {
    where.push("status = ?");
    params.push(opts.status);
  }
  if (opts.pairId) {
    where.push("pair_id = ?");
    params.push(opts.pairId);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = opts.limit && opts.limit > 0 ? `LIMIT ${Math.floor(opts.limit)}` : "";
  const rows = db()
    .prepare(`SELECT * FROM benchmark_runs ${clause} ORDER BY created_at DESC ${limit}`)
    .all(...params) as RunRow[];
  return rows.map(rowToRun).filter((r): r is BenchmarkRun => r !== null);
}

/** Non-terminal runs — the executor / orphan recovery polls these. */
export function listActiveBenchmarkRuns(): BenchmarkRun[] {
  const rows = db()
    .prepare("SELECT * FROM benchmark_runs WHERE status IN ('pending','running') ORDER BY created_at ASC")
    .all() as RunRow[];
  return rows.map(rowToRun).filter((r): r is BenchmarkRun => r !== null);
}

export function listItemResults(benchmarkRunId: string): BenchmarkItemResult[] {
  const rows = db()
    .prepare(
      "SELECT * FROM benchmark_item_results WHERE benchmark_run_id = ? ORDER BY created_at ASC",
    )
    .all(benchmarkRunId) as ResultRow[];
  return rows.map(rowToResult);
}

/**
 * Latest completed AGENT run per profile for a suite — the leaderboard rows.
 * Sorted by overall rating (desc); rating lives in summary_json so the final
 * sort is done in JS.
 */
export function listLeaderboard(suiteKey: string): BenchmarkRun[] {
  const rows = db()
    .prepare(
      `SELECT * FROM benchmark_runs r
         WHERE r.target_kind = 'agent' AND r.status = 'completed' AND r.suite_key = ?
           AND r.completed_at = (
             SELECT MAX(r2.completed_at) FROM benchmark_runs r2
               WHERE r2.target_kind = 'agent' AND r2.status = 'completed'
                 AND r2.suite_key = r.suite_key AND r2.target_ref = r.target_ref
           )`,
    )
    .all(suiteKey) as RunRow[];
  return rows
    .map(rowToRun)
    .filter((r): r is BenchmarkRun => r !== null)
    .sort((a, b) => (b.summary?.overallRating ?? -1) - (a.summary?.overallRating ?? -1));
}

/** Latest completed run for a target (drives the Agent Rating + leaderboard). */
export function latestCompletedRun(
  targetKind: BenchmarkTargetKind,
  targetRef: string,
  suiteKey?: string,
): BenchmarkRun | null {
  const extra = suiteKey ? "AND suite_key = ?" : "";
  const params: unknown[] = [targetKind, targetRef];
  if (suiteKey) params.push(suiteKey);
  const row = db()
    .prepare(
      `SELECT * FROM benchmark_runs
         WHERE target_kind = ? AND target_ref = ? AND status = 'completed' ${extra}
         ORDER BY completed_at DESC LIMIT 1`,
    )
    .get(...params) as RunRow | undefined;
  return rowToRun(row);
}

// ── Update ───────────────────────────────────────────────────

export interface UpdateBenchmarkRunInput {
  status?: BenchmarkRunStatus;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  summary?: BenchmarkSummary | null;
}

export function updateBenchmarkRun(id: string, updates: UpdateBenchmarkRunInput): BenchmarkRun | null {
  const sets: string[] = ["updated_at = ?"];
  const params: unknown[] = [now()];
  if (updates.status !== undefined) {
    sets.push("status = ?");
    params.push(updates.status);
  }
  if (updates.error !== undefined) {
    sets.push("error = ?");
    params.push(updates.error);
  }
  if (updates.startedAt !== undefined) {
    sets.push("started_at = ?");
    params.push(updates.startedAt);
  }
  if (updates.completedAt !== undefined) {
    sets.push("completed_at = ?");
    params.push(updates.completedAt);
  }
  if (updates.summary !== undefined) {
    sets.push("summary_json = ?");
    params.push(updates.summary === null ? null : JSON.stringify(updates.summary));
  }
  inTransaction(() => {
    db()
      .prepare(`UPDATE benchmark_runs SET ${sets.join(", ")} WHERE id = ?`)
      .run(...params, id);
  });
  return getBenchmarkRun(id);
}

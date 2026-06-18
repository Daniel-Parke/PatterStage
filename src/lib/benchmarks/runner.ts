// ═══════════════════════════════════════════════════════════════
// benchmarks/runner.ts — execute one benchmark run (headless)
//
// Drives a suite against ONE target and writes results as it goes:
//   • agent target  → runtime.submitRun() → poll runtime.getRun() to terminal,
//                      a FRESH session per (item, repeat) so nothing bleeds
//                      across items/repeats (critical for the consistency probe);
//                      the agent's standing skills/tools/memory stay active —
//                      that's the variable under test.
//   • model target  → callLLM() against the bare model (no skills/tools/memory)
//                      — the baseline the agent is compared against.
//
// Grading is pure (score.ts). On completion the per-domain summary + overall
// Agent Rating + variance are stamped onto the run. Per-item errors are
// recorded as zero-score results; a missing gateway for the whole agent target
// fails the run fast (a setup problem, not a capability result).
// ═══════════════════════════════════════════════════════════════

import { runtime, RuntimeEndpointError } from "@/lib/runtime";
import { callLLM } from "@/lib/llm";
import { estimateCost } from "@/lib/analytics/model-cost";
import { recordEvent } from "@/lib/analytics/record-event";
import {
  getBenchmarkRun,
  insertItemResult,
  updateBenchmarkRun,
} from "./benchmarks-repository";
import { gradeOutput, summarize, type ResultForAgg } from "./score";
import { getSuite } from "./suites";
import type { BenchmarkItem, BenchmarkRun } from "./types";

export class BenchmarkCancelledError extends Error {
  constructor() {
    super("benchmark run cancelled");
    this.name = "BenchmarkCancelledError";
  }
}

export interface ExecuteBenchmarkOptions {
  signal?: AbortSignal;
  /** Per-(item,repeat) wall-clock cap for the agent path. Default 120s. */
  perItemTimeoutMs?: number;
  /** Agent poll interval. Default 1000ms. */
  pollIntervalMs?: number;
  /** Max concurrent (item,repeat) executions. Default 3. */
  concurrency?: number;
}

interface ExecOutcome {
  output: string;
  inputRunId: string | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  error: string | null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function abortIf(signal?: AbortSignal): void {
  if (signal?.aborted) throw new BenchmarkCancelledError();
}

// ── Per-target execution ─────────────────────────────────────

async function executeAgent(
  run: BenchmarkRun,
  item: BenchmarkItem,
  repeatIndex: number,
  opts: ExecuteBenchmarkOptions,
): Promise<ExecOutcome> {
  const perItemTimeoutMs = opts.perItemTimeoutMs ?? 120_000;
  const pollIntervalMs = opts.pollIntervalMs ?? 1000;
  // Fresh, unique session per (item, repeat) → no cross-item/-repeat bleed.
  const tag = `${run.id}_${item.id}_${repeatIndex}`;
  const handle = await runtime.submitRun({
    input: item.prompt,
    idempotencyKey: `bench_${tag}`,
    profileName: run.targetRef,
    sessionId: `bench-${tag}`,
  });

  const start = Date.now();
  while (Date.now() - start < perItemTimeoutMs) {
    abortIf(opts.signal);
    const r = await runtime.getRun(handle.runId, run.targetRef);
    if (r.status !== "started") {
      return {
        output: r.output ?? "",
        inputRunId: handle.runId,
        latencyMs: Date.now() - start,
        inputTokens: r.usage?.inputTokens ?? null,
        outputTokens: r.usage?.outputTokens ?? null,
        error: r.status === "failed" ? (r.error ?? "run failed") : null,
      };
    }
    await sleep(pollIntervalMs);
  }
  try {
    await runtime.stopRun(handle.runId, run.targetRef);
  } catch {
    // best-effort
  }
  return {
    output: "",
    inputRunId: handle.runId,
    latencyMs: Date.now() - start,
    inputTokens: null,
    outputTokens: null,
    error: "timed out",
  };
}

async function executeModel(run: BenchmarkRun, item: BenchmarkItem): Promise<ExecOutcome> {
  const start = Date.now();
  const resp = await callLLM([{ role: "user", content: item.prompt }], {
    modelId: run.targetRef,
    // Low temperature for a fair, comparable baseline (the agent path uses the
    // profile's own settings — this only governs the bare-model baseline).
    temperature: 0.2,
    maxTokens: 1024,
  });
  return {
    output: resp.content,
    inputRunId: null,
    latencyMs: Date.now() - start,
    inputTokens: resp.usage?.promptTokens ?? null,
    outputTokens: resp.usage?.completionTokens ?? null,
    error: null,
  };
}

// ── Bounded-concurrency pool ─────────────────────────────────

async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.max(1, limit) }, async () => {
    while (index < items.length) {
      const i = index++;
      await worker(items[i]);
    }
  });
  await Promise.all(runners);
}

// ── Run executor ─────────────────────────────────────────────

interface Task {
  item: BenchmarkItem;
  repeatIndex: number;
}

/**
 * Execute a benchmark run to terminal (completed/failed/cancelled), writing
 * results + the summary into the DB. Resolves when the run is finalised; never
 * throws into the caller (the kicker is fire-and-forget).
 */
export async function executeBenchmarkRun(
  runId: string,
  opts: ExecuteBenchmarkOptions = {},
): Promise<void> {
  const run = getBenchmarkRun(runId);
  if (!run || (run.status !== "pending" && run.status !== "running")) return;

  const suite = getSuite(run.suiteKey);
  if (!suite) {
    updateBenchmarkRun(runId, { status: "failed", error: `unknown suite "${run.suiteKey}"`, completedAt: new Date().toISOString() });
    recordEvent("benchmark.failed", { entityType: "benchmark", entityId: runId, profile: run.targetRef });
    return;
  }
  if (suite.version !== run.suiteVersion) {
    updateBenchmarkRun(runId, {
      status: "failed",
      error: `suite "${run.suiteKey}" is now v${suite.version}, run pinned v${run.suiteVersion}`,
      completedAt: new Date().toISOString(),
    });
    recordEvent("benchmark.failed", { entityType: "benchmark", entityId: runId, profile: run.targetRef });
    return;
  }

  updateBenchmarkRun(runId, { status: "running", startedAt: new Date().toISOString() });
  recordEvent("benchmark.started", {
    entityType: "benchmark",
    entityId: runId,
    profile: run.targetRef,
    metadata: { suite: run.suiteKey, version: run.suiteVersion, targetKind: run.targetKind, repeats: run.repeats },
  });

  const tasks: Task[] = [];
  for (const item of suite.items) {
    for (let r = 0; r < run.repeats; r++) tasks.push({ item, repeatIndex: r });
  }

  const agg: ResultForAgg[] = [];
  let totalCost = 0;
  let latencySum = 0;
  let latencyCount = 0;
  // Held in an object so the union type survives CFA across the async closures
  // below (a plain `let` would be narrowed to `null` and break `instanceof`).
  const state: { fatal: Error | null } = { fatal: null };

  await pool(tasks, opts.concurrency ?? 3, async ({ item, repeatIndex }) => {
    if (state.fatal) return;
    try {
      abortIf(opts.signal);
      const outcome =
        run.targetKind === "agent"
          ? await executeAgent(run, item, repeatIndex, opts)
          : await executeModel(run, item);

      const grade = gradeOutput(item.grader, outcome.output);
      const cost = estimateCost(
        run.targetKind === "model" ? run.targetRef : null,
        outcome.inputTokens ?? 0,
        outcome.outputTokens ?? 0,
      );
      totalCost += cost;
      latencySum += outcome.latencyMs;
      latencyCount += 1;

      insertItemResult({
        benchmarkRunId: runId,
        itemId: item.id,
        domain: item.domain,
        repeatIndex,
        inputRunId: outcome.inputRunId,
        rawOutput: outcome.output,
        score: outcome.error ? 0 : grade.score,
        passed: outcome.error ? false : grade.passed,
        grader: item.grader.kind,
        graderDetail: outcome.error ? { error: outcome.error } : grade.detail,
        latencyMs: outcome.latencyMs,
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
        costUsd: cost,
      });

      agg.push({
        domain: item.domain,
        itemId: item.id,
        score: outcome.error ? 0 : grade.score,
        canonical: outcome.error ? null : grade.canonical,
      });
    } catch (err) {
      if (err instanceof BenchmarkCancelledError) {
        state.fatal = err;
        return;
      }
      // A missing gateway for the agent target is a setup failure, not a
      // capability result — abort the whole run rather than scoring zeros.
      if (err instanceof RuntimeEndpointError) {
        state.fatal = err;
        return;
      }
      // Any other per-item error → record a zero and keep going.
      const message = err instanceof Error ? err.message : String(err);
      insertItemResult({
        benchmarkRunId: runId,
        itemId: item.id,
        domain: item.domain,
        repeatIndex,
        score: item.grader.kind === "consistency" ? null : 0,
        passed: item.grader.kind === "consistency" ? null : false,
        grader: item.grader.kind,
        graderDetail: { error: message },
      });
      agg.push({ domain: item.domain, itemId: item.id, score: item.grader.kind === "consistency" ? null : 0, canonical: null });
    }
  });

  const finishedAt = new Date().toISOString();

  if (state.fatal instanceof BenchmarkCancelledError) {
    updateBenchmarkRun(runId, { status: "cancelled", completedAt: finishedAt });
    recordEvent("benchmark.failed", { entityType: "benchmark", entityId: runId, profile: run.targetRef, metadata: { reason: "cancelled" } });
    return;
  }
  if (state.fatal) {
    const message = state.fatal.message;
    updateBenchmarkRun(runId, { status: "failed", error: message, completedAt: finishedAt });
    recordEvent("benchmark.failed", { entityType: "benchmark", entityId: runId, profile: run.targetRef, metadata: { reason: message } });
    return;
  }

  const summary = summarize(agg, run.repeats, {
    totalCostUsd: totalCost,
    avgLatencyMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : undefined,
  });
  updateBenchmarkRun(runId, { status: "completed", completedAt: finishedAt, summary });
  recordEvent("benchmark.completed", {
    entityType: "benchmark",
    entityId: runId,
    profile: run.targetRef,
    metadata: { rating: summary.overallRating, meanScore: summary.meanScore, itemsRun: summary.itemsRun },
  });
}

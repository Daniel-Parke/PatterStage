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

import { runtime, RuntimeEndpointError, RuntimeRequestError } from "@/lib/runtime";
import { callLLM } from "@/lib/llm";
import { estimateCost } from "@/lib/analytics/model-cost";
import { recordEvent } from "@/lib/analytics/record-event";
import {
  getBenchmarkRun,
  insertItemResult,
  updateBenchmarkRun,
} from "./benchmarks-repository";
import { getModel, findModelByModelId } from "@/lib/models-repository";
import { gradeOutput, summarize, type ResultForAgg } from "./score";
import { gradeWithJudge } from "./score-judge";

/**
 * The judge model for LLM-as-judge items. Independent of the model under test
 * to avoid self-grading bias: set `PS_BENCH_JUDGE_MODEL` to a strong model's
 * registry id or provider model string. Unset → gradeWithJudge falls back to
 * the agent default (which may be the model being benchmarked — noted as a
 * limitation in the docs).
 */
function resolveJudgeModelId(): string | undefined {
  const ref = process.env.PS_BENCH_JUDGE_MODEL?.trim();
  if (!ref) return undefined;
  return getModel(ref)?.id ?? findModelByModelId(ref)?.id ?? undefined;
}
import { computeStatCard, capabilityFromStatCard } from "./stats";
import {
  newTrajectory,
  accumulateRunEvent,
  finalizeItemMetrics,
  type ItemMetrics,
} from "@/lib/runtime/run-trajectory";
import { getSuite } from "./suites";
import { createBenchAgent, teardownBenchAgent, type BenchAgentSpec } from "./bench-agent";
import { ensureBenchGateway, gatewaySpawnAvailable } from "@/lib/runtime/gateway-manager";
import { logApiError } from "@/lib/api-logger";
import type { BenchmarkItem, BenchmarkRun } from "./types";

/**
 * Map a run's augmentation toggles to an ephemeral fair-test agent spec. ON
 * layers inherit the base profile's own config; OFF layers are stripped — so
 * the agentic run actually omits what's toggled off. (Per-component SELECTION
 * of specific seed skills/tools is wired from the builder UI later.)
 */
function specFromRun(run: BenchmarkRun): BenchAgentSpec {
  const aug = run.config?.augmentation ?? { skills: true, tools: true, memory: true };
  return {
    base: run.targetRef,
    // Explicit per-component selection wins; else the boolean (on → inherit base,
    // off → strip).
    skills: aug.selectedSkills ?? (aug.skills ? null : []),
    tools: aug.selectedTools ?? (aug.tools ? null : []),
    memory: aug.memory,
  };
}

class BenchmarkCancelledError extends Error {
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
  /** Trajectory metrics (agentic path); null for brain-only. */
  metrics: ItemMetrics | null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function abortIf(signal?: AbortSignal): void {
  if (signal?.aborted) throw new BenchmarkCancelledError();
}

// ── Per-target execution ─────────────────────────────────────

async function executeAgent(
  run: BenchmarkRun,
  profileSlug: string,
  item: BenchmarkItem,
  repeatIndex: number,
  opts: ExecuteBenchmarkOptions,
): Promise<ExecOutcome> {
  const perItemTimeoutMs = opts.perItemTimeoutMs ?? 120_000;
  const pollIntervalMs = opts.pollIntervalMs ?? 1000;
  // Fresh, unique session per (item, repeat) → no cross-item/-repeat bleed.
  // `profileSlug` is the EPHEMERAL fair-test agent assembled from the toggled
  // components (so skills/tools/memory toggles actually apply), not the user's
  // standing profile.
  const tag = `${run.id}_${item.id}_${repeatIndex}`;
  // Hermes caps concurrent runs (HTTP 429). Retry submit with backoff so a busy
  // gateway doesn't score the item zero.
  let handle: Awaited<ReturnType<typeof runtime.submitRun>> | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    abortIf(opts.signal);
    try {
      handle = await runtime.submitRun({
        input: item.prompt,
        idempotencyKey: `bench_${tag}`,
        profileName: profileSlug,
        sessionId: `bench-${tag}`,
      });
      break;
    } catch (err) {
      if (err instanceof RuntimeRequestError && err.status === 429 && attempt < 5) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  if (!handle) throw new Error("submitRun did not return a handle");

  // Capture the TRAJECTORY (tool calls, recovery, steps) from the event stream
  // in parallel with polling. SSE is best-effort UX-only data — polling remains
  // the source of truth for terminal status — so a stream failure never fails
  // the item; it only leaves the metrics thinner.
  const traj = newTrajectory();
  let streaming = true;
  const runId = handle.runId;
  const streamTask = (async () => {
    try {
      for await (const ev of runtime.streamRunEvents(runId, profileSlug)) {
        if (!streaming) break;
        accumulateRunEvent(traj, ev.type, ev.data);
      }
    } catch {
      // best-effort; polling is authoritative
    }
  })();

  const start = Date.now();
  const finish = (over: Omit<ExecOutcome, "metrics">, completed: boolean): ExecOutcome => {
    streaming = false;
    void streamTask; // detach; the generator stops on the next iteration
    return {
      ...over,
      metrics: finalizeItemMetrics(traj, {
        latencyMs: over.latencyMs,
        completed,
        errored: Boolean(over.error),
      }),
    };
  };

  while (Date.now() - start < perItemTimeoutMs) {
    abortIf(opts.signal);
    const r = await runtime.getRun(handle.runId, profileSlug);
    if (r.status !== "started") {
      return finish(
        {
          output: r.output ?? "",
          inputRunId: handle.runId,
          latencyMs: Date.now() - start,
          inputTokens: r.usage?.inputTokens ?? null,
          outputTokens: r.usage?.outputTokens ?? null,
          error: r.status === "failed" ? (r.error ?? "run failed") : null,
        },
        r.status === "completed",
      );
    }
    await sleep(pollIntervalMs);
  }
  try {
    await runtime.stopRun(handle.runId, profileSlug);
  } catch {
    // best-effort
  }
  return finish(
    {
      output: "",
      inputRunId: handle.runId,
      latencyMs: Date.now() - start,
      inputTokens: null,
      outputTokens: null,
      error: "timed out",
    },
    false,
  );
}

/**
 * Brain-only direct-provider budget. The agentic path gets ~120s/item via the
 * gateway (with retries); the baseline must get the SAME budget or it times out
 * on a slow/rate-limited provider and the agent-vs-baseline Δ measures transport
 * resilience, not augmentation. (Interactive callLLM keeps its snappy default.)
 */
const MODEL_BENCHMARK_TIMEOUT_MS = 120_000;

async function executeModel(run: BenchmarkRun, item: BenchmarkItem): Promise<ExecOutcome> {
  const start = Date.now();
  // Brain-only path: call the run's RESOLVED model directly (reliable). For an
  // agent target this is the profile's own LLM with no skills/tools/memory; for
  // a model target it's the chosen registry model. Falls back to the raw model
  // string when no registry id resolved. Retry twice on a transient error/empty
  // so one flaky response doesn't false-zero the item; an exhausted retry
  // returns an ERRORED outcome (recorded as an error, never crashes the pool).
  let lastError = "model returned no output";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await callLLM([{ role: "user", content: item.prompt }], {
        modelId: run.modelId ?? (run.targetKind === "model" ? run.targetRef : undefined),
        model: run.config?.modelString ?? undefined,
        temperature: 0.2,
        maxTokens: 1024,
        // Match the agent's per-item budget so the baseline isn't unfairly
        // timed out on the 45s interactive default.
        timeoutMs: MODEL_BENCHMARK_TIMEOUT_MS,
      });
      if (resp.content && resp.content.trim().length > 0) {
        return {
          output: resp.content,
          inputRunId: null,
          latencyMs: Date.now() - start,
          inputTokens: resp.usage?.promptTokens ?? null,
          outputTokens: resp.usage?.completionTokens ?? null,
          error: null,
          metrics: null, // brain-only has no agentic trajectory
        };
      }
      lastError = "model returned empty output";
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (attempt < 2) await sleep(800 * (attempt + 1));
  }
  return {
    output: "",
    inputRunId: null,
    latencyMs: Date.now() - start,
    inputTokens: null,
    outputTokens: null,
    error: lastError,
    metrics: null,
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

  // Agentic runs go through an EPHEMERAL fair-test agent assembled from the
  // toggled components (so the toggles actually apply); brain-only runs don't.
  const agentic = run.execMode ? run.execMode === "agentic" : run.targetKind === "agent";
  let benchSlug: string | null = null;
  // Whether the toggled config is actually served by a dedicated gateway. When
  // false (no local hermes binary), the agentic run falls back to the shared
  // default gateway and exercises the default agent — surfaced honestly so the
  // result isn't mistaken for a true fair test.
  let togglesApplied = false;
  if (agentic) {
    try {
      benchSlug = createBenchAgent(runId, specFromRun(run));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateBenchmarkRun(runId, {
        status: "failed",
        error: `failed to assemble benchmark agent: ${message}`,
        completedAt: new Date().toISOString(),
      });
      recordEvent("benchmark.failed", { entityType: "benchmark", entityId: runId, profile: run.targetRef, metadata: { reason: message } });
      return;
    }
    // Spawn a dedicated gateway serving exactly this ephemeral profile so the
    // skills/tools/memory toggles actually apply to the agentic run. Best-effort:
    // a null result means we route to the shared default gateway instead.
    if (gatewaySpawnAvailable()) {
      const gw = await ensureBenchGateway(benchSlug, { runId, signal: opts.signal });
      togglesApplied = gw !== null;
    }
  }

  // Pre-flight canary (brain-only path): one trivial call to confirm the chosen
  // brain actually responds with non-empty output BEFORE running the whole
  // suite. Catches "the model is misconfigured / returns empty / errors" fast
  // and fails with a clear reason, instead of silently scoring every item zero.
  if (!agentic) {
    let canaryError: string | null = null;
    try {
      const probe = await callLLM([{ role: "user", content: "Reply with the single word: OK" }], {
        modelId: run.modelId ?? (run.targetKind === "model" ? run.targetRef : undefined),
        model: run.config?.modelString ?? undefined,
        temperature: 0,
        maxTokens: 16,
      });
      if (!probe.content || probe.content.trim().length === 0) {
        canaryError = "the model returned empty output";
      }
    } catch (err) {
      canaryError = err instanceof Error ? err.message : String(err);
    }
    if (canaryError) {
      const reason = `brain "${run.modelLabel ?? run.modelId ?? run.targetRef}" not responding — ${canaryError}. Check the model endpoint / registry config.`;
      updateBenchmarkRun(runId, { status: "failed", error: reason, completedAt: new Date().toISOString() });
      recordEvent("benchmark.failed", { entityType: "benchmark", entityId: runId, profile: run.targetRef, metadata: { reason } });
      return;
    }
  }

  const tasks: Task[] = [];
  for (const item of suite.items) {
    for (let r = 0; r < run.repeats; r++) tasks.push({ item, repeatIndex: r });
  }

  const agg: ResultForAgg[] = [];
  const errorReasons: string[] = [];
  let totalCost = 0;
  let latencySum = 0;
  let latencyCount = 0;
  // Held in an object so the union type survives CFA across the async closures
  // below (a plain `let` would be narrowed to `null` and break `instanceof`).
  const state: { fatal: Error | null } = { fatal: null };

  // Agentic runs consume Hermes concurrency (max ~10); keep them low so a
  // compare pair (two runs) can't trip the 429 limit. Brain-only is just LLM calls.
  const concurrency = opts.concurrency ?? (agentic ? 2 : 4);
  await pool(tasks, concurrency, async ({ item, repeatIndex }) => {
    if (state.fatal) return;
    try {
      abortIf(opts.signal);
      // Route by execution mode: 'agentic' = full Hermes run against the
      // ephemeral fair-test agent; 'model' = brain-only callLLM.
      const outcome = agentic && benchSlug
        ? await executeAgent(run, benchSlug, item, repeatIndex, opts)
        : await executeModel(run, item);

      if (outcome.error) errorReasons.push(outcome.error);
      // Judge-graded items are scored by a strong model (async, IO); everything
      // else uses the pure grader. A judge failure throws → recorded as errored.
      const grade =
        item.grader.kind === "judge" && !outcome.error
          ? await gradeWithJudge(item, outcome.output, { judgeModelId: resolveJudgeModelId() })
          : gradeOutput(item.grader, outcome.output);
      const cost = estimateCost(
        run.config?.modelString ?? run.modelLabel ?? (run.targetKind === "model" ? run.targetRef : null),
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
        // ACTUAL tool usage from the trajectory (empty when the tool layer was
        // toggled off — the proof a fair-test toggle truly applied).
        toolsUsed: outcome.metrics ? outcome.metrics.distinctTools : null,
        metrics: outcome.metrics ?? null,
      });

      agg.push({
        domain: item.domain,
        itemId: item.id,
        score: outcome.error ? 0 : grade.score,
        canonical: outcome.error ? null : grade.canonical,
        statTags: item.statTags,
        latencyMs: outcome.latencyMs,
        errored: Boolean(outcome.error),
        metrics: outcome.metrics ?? null,
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
      errorReasons.push(message);
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
      agg.push({
        domain: item.domain,
        itemId: item.id,
        score: item.grader.kind === "consistency" ? null : 0,
        canonical: null,
        statTags: item.statTags,
        latencyMs: null,
        errored: true,
        metrics: null,
      });
    }
  });

  const finishedAt = new Date().toISOString();
  const teardown = async () => {
    if (benchSlug) {
      try {
        await teardownBenchAgent(benchSlug);
      } catch (e) {
        logApiError("benchmarks.teardown", benchSlug, e);
      }
    }
  };

  if (state.fatal instanceof BenchmarkCancelledError) {
    await teardown();
    updateBenchmarkRun(runId, { status: "cancelled", completedAt: finishedAt });
    recordEvent("benchmark.failed", { entityType: "benchmark", entityId: runId, profile: run.targetRef, metadata: { reason: "cancelled" } });
    return;
  }
  if (state.fatal) {
    await teardown();
    const message = state.fatal.message;
    updateBenchmarkRun(runId, { status: "failed", error: message, completedAt: finishedAt });
    recordEvent("benchmark.failed", { entityType: "benchmark", entityId: runId, profile: run.targetRef, metadata: { reason: message } });
    return;
  }

  await teardown();
  const summary = summarize(agg, run.repeats, {
    totalCostUsd: totalCost,
    avgLatencyMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : undefined,
  });
  // The JRPG stat card is the headline; overall rating is its mean.
  const statResult = computeStatCard(agg);
  summary.stats = statResult.card;
  summary.statSamples = statResult.samples;
  summary.errorRate = statResult.errorRate;
  // ADR-0004: capability only, so a faster Brain does not read as more capable.
  summary.overallRating = capabilityFromStatCard(statResult.card);
  // Record whether the agentic run truly served the toggled config (dedicated
  // gateway) or fell back to the shared default agent — so the UI can be honest.
  if (agentic) summary.togglesApplied = togglesApplied;

  // Honest failure: when (nearly) every item errored/timed-out, this isn't a
  // low score — the run FAILED. Mark it failed with the dominant reason instead
  // of presenting a misleading "completed, rating 4" card (only Speed populated).
  if (statResult.errorRate >= 0.99 && agg.length > 0) {
    const reason = topReason(errorReasons) ?? "every item errored or timed out";
    updateBenchmarkRun(runId, { status: "failed", error: `run failed — ${reason}`, completedAt: finishedAt, summary });
    recordEvent("benchmark.failed", { entityType: "benchmark", entityId: runId, profile: run.targetRef, metadata: { reason, errorRate: statResult.errorRate } });
    return;
  }

  updateBenchmarkRun(runId, { status: "completed", completedAt: finishedAt, summary });
  recordEvent("benchmark.completed", {
    entityType: "benchmark",
    entityId: runId,
    profile: run.targetRef,
    metadata: { rating: summary.overallRating, meanScore: summary.meanScore, itemsRun: summary.itemsRun, errorRate: summary.errorRate },
  });
}

/** Most frequent error reason in a list (for a clear failed-run message). */
function topReason(reasons: string[]): string | null {
  if (reasons.length === 0) return null;
  const counts = new Map<string, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [r, n] of counts) if (n > bestN) { best = r; bestN = n; }
  return best;
}

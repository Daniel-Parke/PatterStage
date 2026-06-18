// ═══════════════════════════════════════════════════════════════
// benchmarks/executor.ts — background orchestration for benchmark runs
//
// Thin layer over runner.ts: fire-and-forget kick, an in-process AbortController
// registry so a cancel can interrupt a live run, a compare-pair helper (agent +
// bare-model sharing a pair_id so the report can show the delta), and boot-time
// orphan recovery (a process that died mid-run leaves a 'running' row that can
// never finish — fail it; re-kick 'pending' rows that never started).
// ═══════════════════════════════════════════════════════════════

import { logApiError } from "@/lib/api-logger";
import {
  createBenchmarkRun,
  getBenchmarkRun,
  listActiveBenchmarkRuns,
  updateBenchmarkRun,
  type CreateBenchmarkRunInput,
} from "./benchmarks-repository";
import { executeBenchmarkRun } from "./runner";
import { getSuite } from "./suites";
import { uuid } from "@/lib/db";
import type { BenchmarkRun, BenchmarkTargetKind } from "./types";

/** runId → controller for an in-flight run in THIS process. */
const inflight = new Map<string, AbortController>();

/** Fire-and-forget execution; resolves immediately, runs in the background. */
export function kickBenchmarkRun(runId: string): void {
  if (inflight.has(runId)) return;
  const controller = new AbortController();
  inflight.set(runId, controller);
  void executeBenchmarkRun(runId, { signal: controller.signal })
    .catch((err) => logApiError("benchmarks.execute", runId, err))
    .finally(() => inflight.delete(runId));
}

/**
 * Cancel a run. If it's executing in this process, abort it; otherwise mark it
 * cancelled in the DB so it doesn't linger. Returns false if there's nothing to
 * cancel (already terminal / unknown).
 */
export function cancelBenchmarkRun(runId: string): boolean {
  const controller = inflight.get(runId);
  if (controller) {
    controller.abort();
    return true;
  }
  const run = getBenchmarkRun(runId);
  if (run && (run.status === "pending" || run.status === "running")) {
    updateBenchmarkRun(runId, { status: "cancelled", completedAt: new Date().toISOString() });
    return true;
  }
  return false;
}

export interface StartBenchmarkInput {
  suiteKey: string;
  targetKind: BenchmarkTargetKind;
  targetRef: string;
  targetLabel?: string | null;
  repeats?: number;
  seed?: string | null;
  pairId?: string | null;
}

/** Create a pending run for the current version of `suiteKey`, then kick it. */
export function startBenchmarkRun(input: StartBenchmarkInput): BenchmarkRun {
  const suite = getSuite(input.suiteKey);
  if (!suite) throw new Error(`unknown suite "${input.suiteKey}"`);
  const create: CreateBenchmarkRunInput = {
    suiteKey: suite.key,
    suiteVersion: suite.version,
    targetKind: input.targetKind,
    targetRef: input.targetRef,
    targetLabel: input.targetLabel ?? null,
    repeats: Math.max(1, Math.floor(input.repeats ?? 3)),
    seed: input.seed ?? null,
    pairId: input.pairId ?? null,
  };
  const run = createBenchmarkRun(create);
  kickBenchmarkRun(run.id);
  return run;
}

export interface CompareInput {
  suiteKey: string;
  agentProfile: string;
  agentLabel?: string | null;
  modelRef: string;
  modelLabel?: string | null;
  repeats?: number;
}

/** Start an agent run + a bare-model run sharing a pair_id (the hypothesis test). */
export function startComparePair(input: CompareInput): {
  pairId: string;
  agent: BenchmarkRun;
  model: BenchmarkRun;
} {
  const pairId = uuid();
  const repeats = input.repeats;
  const agent = startBenchmarkRun({
    suiteKey: input.suiteKey,
    targetKind: "agent",
    targetRef: input.agentProfile,
    targetLabel: input.agentLabel ?? input.agentProfile,
    repeats,
    pairId,
  });
  const model = startBenchmarkRun({
    suiteKey: input.suiteKey,
    targetKind: "model",
    targetRef: input.modelRef,
    targetLabel: input.modelLabel ?? input.modelRef,
    repeats,
    pairId,
  });
  return { pairId, agent, model };
}

/**
 * Boot-time recovery. Call once on server start (instrumentation). A 'running'
 * row means a prior process died mid-run — it can't be resumed cleanly, so fail
 * it. A 'pending' row never started — re-kick it.
 */
export function recoverBenchmarkRuns(): void {
  let active: BenchmarkRun[] = [];
  try {
    active = listActiveBenchmarkRuns();
  } catch (err) {
    logApiError("benchmarks.recover", "list", err);
    return;
  }
  for (const run of active) {
    if (run.status === "running") {
      updateBenchmarkRun(run.id, {
        status: "failed",
        error: "interrupted by a server restart",
        completedAt: new Date().toISOString(),
      });
    } else if (run.status === "pending") {
      kickBenchmarkRun(run.id);
    }
  }
}

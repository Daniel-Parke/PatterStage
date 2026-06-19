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
import { getProfileBenchmarkContext } from "./profile-context";
import { sweepBenchAgents } from "./bench-agent";
import { sweepOrphanBenchGateways } from "@/lib/runtime/gateway-manager";
import { getModel } from "@/lib/models-repository";
import { uuid, ensureDb } from "@/lib/db";
import type {
  AugmentationConfig,
  BenchmarkExecMode,
  BenchmarkRun,
  BenchmarkRunConfig,
  BenchmarkTargetKind,
} from "./types";

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
  /** Agent targets only: which augmentation layers to enable (default all on). */
  augmentation?: Partial<AugmentationConfig>;
}

/**
 * Resolve a target into its (brain + augmentation) unit. An agent target gets
 * its LLM resolved from config.yaml/registry; augmentation toggles are clamped
 * to what the profile actually has (no memory provider → memory off). With NO
 * augmentation the run is brain-only (callLLM, reliable); with any augmentation
 * it is agentic (Hermes). A model target is always brain-only on that model.
 */
function resolveTarget(input: StartBenchmarkInput): Omit<CreateBenchmarkRunInput, "suiteKey" | "suiteVersion"> {
  const base = {
    targetKind: input.targetKind,
    targetRef: input.targetRef,
    repeats: Math.max(1, Math.floor(input.repeats ?? 3)),
    seed: input.seed ?? null,
    pairId: input.pairId ?? null,
  };

  if (input.targetKind === "model") {
    const m = getModel(input.targetRef);
    const aug: AugmentationConfig = { skills: false, tools: false, memory: false };
    return {
      ...base,
      targetLabel: input.targetLabel ?? m?.name ?? input.targetRef,
      modelId: input.targetRef,
      modelLabel: m?.name ?? input.targetRef,
      execMode: "model",
      usedSkills: false,
      usedTools: false,
      usedMemory: false,
      config: { augmentation: aug, modelString: m?.modelId ?? null },
    };
  }

  // agent target
  const ctx = getProfileBenchmarkContext(input.targetRef);
  if (!ctx) throw new Error(`unknown agent profile "${input.targetRef}"`);
  const req = input.augmentation ?? {};
  const selSkills = req.selectedSkills ?? null;
  const selTools = req.selectedTools ?? null;
  // Explicit selection equips those components regardless of the base's own
  // config; otherwise the boolean inherits the base (gated by availability).
  const aug: AugmentationConfig = {
    skills: selSkills ? selSkills.length > 0 : (req.skills ?? true) && ctx.skillsEnabled > 0,
    tools: selTools ? selTools.length > 0 : (req.tools ?? true) && ctx.toolsetCount > 0,
    memory: (req.memory ?? true) && ctx.memoryProvider !== null,
    selectedSkills: selSkills,
    selectedTools: selTools,
  };
  const anyAug = aug.skills || aug.tools || aug.memory;
  const execMode: BenchmarkExecMode = anyAug ? "agentic" : "model";
  const config: BenchmarkRunConfig = { augmentation: aug, modelString: ctx.modelString };
  return {
    ...base,
    targetLabel: input.targetLabel ?? ctx.displayName,
    modelId: ctx.modelRegistryId,
    modelLabel: ctx.modelLabel,
    execMode,
    usedSkills: aug.skills,
    usedTools: aug.tools,
    usedMemory: aug.memory,
    config,
  };
}

/** Create a pending run for the current version of `suiteKey`, then kick it. */
export function startBenchmarkRun(input: StartBenchmarkInput): BenchmarkRun {
  const suite = getSuite(input.suiteKey);
  if (!suite) throw new Error(`unknown suite "${input.suiteKey}"`);
  const run = createBenchmarkRun({
    suiteKey: suite.key,
    suiteVersion: suite.version,
    ...resolveTarget(input),
  });
  kickBenchmarkRun(run.id);
  return run;
}

export interface CompareInput {
  suiteKey: string;
  agentProfile: string;
  agentLabel?: string | null;
  /** Augmentation for the agent side (default all on → agentic). */
  augmentation?: Partial<AugmentationConfig>;
  /** Optional baseline brain: a registry model id. When omitted, the baseline
   *  is the SAME agent run brain-only (augmentation off) — the cleanest test. */
  modelRef?: string | null;
  modelLabel?: string | null;
  repeats?: number;
}

/**
 * Start the hypothesis test as a pair sharing a pair_id: the full agent (its
 * brain + skills/tools/memory) vs a baseline. Baseline = the same agent brain
 * with no augmentation (brain-only) by default, or a chosen registry model.
 */
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
    targetLabel: input.agentLabel ?? undefined,
    augmentation: input.augmentation,
    repeats,
    pairId,
  });
  const model = input.modelRef
    ? startBenchmarkRun({
        suiteKey: input.suiteKey,
        targetKind: "model",
        targetRef: input.modelRef,
        targetLabel: input.modelLabel ?? input.modelRef,
        repeats,
        pairId,
      })
    : startBenchmarkRun({
        suiteKey: input.suiteKey,
        targetKind: "agent",
        targetRef: input.agentProfile,
        targetLabel: `${input.agentLabel ?? input.agentProfile} (brain only)`,
        augmentation: { skills: false, tools: false, memory: false },
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
  // Ensure migrations have run before touching benchmark tables (this is called
  // at boot, possibly before the first lazy DB access creates them).
  try {
    ensureDb();
  } catch {
    return;
  }
  // Kill orphaned benchmark gateways (crashed-run processes) FIRST, then sweep
  // the ephemeral fair-test profiles they served.
  try {
    sweepOrphanBenchGateways();
  } catch (err) {
    logApiError("benchmarks.recover", "sweep-gateways", err);
  }
  try {
    sweepBenchAgents();
  } catch (err) {
    logApiError("benchmarks.recover", "sweep", err);
  }
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

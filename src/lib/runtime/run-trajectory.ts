// ═══════════════════════════════════════════════════════════════
// runtime/run-trajectory.ts — what an agent actually DID, from its event stream
//
// Lifted out of src/lib/benchmarks/metrics.ts, ahead of that subsystem being
// deleted. It is the only code in the repo that records an agent's trajectory
// rather than its output: the `runs` table has no trajectory column, so a
// finished mission or Composer stage yields final text and token counts and
// nothing else. Written for a benchmark harness, needed by every run.
//
// Kept 100% covered on the way across (tests/unit/run-trajectory.test.ts).
//
// The event classifier below duplicates chat-utils.classifyRunEvent /
// parseToolEvent, and that duplication is DELIBERATE, not an oversight: the
// original author's note said "self-contained on purpose (no chat-UI deps) so it
// stays a pure, trivially unit-tested module", and chat-utils pulls in
// @/lib/api-fetch, which a server-side accumulator should not depend on.
// Deduping means extracting the shared taxonomy into a third module that both
// import; until someone does that, the two must be kept in step by hand -- the
// status ladder and the ["name","tool","tool_name"] key preference are the parts
// that must not drift.
//
// Modern agent evaluation grades the TRAJECTORY, not just the final answer:
// which tools were called, whether failed calls recovered, how many steps were
// taken, and the latency/completion of the whole path (Confident AI, Galileo,
// Maxim, NVIDIA). This module folds a run's SSE events into a per-item metric
// blob and aggregates per run. PURE + deterministic (no IO) — the runner feeds
// it events; stats.ts maps the result onto the RPG card.
//
// The distinct tool/skill names seen here are the ACTUAL usage (what the agent
// invoked), as opposed to what was merely equipped — the signal that proves a
// toggle truly applied (tools OFF ⇒ distinctTools empty).
//
// Self-contained on purpose (no chat-UI deps) so it stays a pure, trivially
// unit-tested module. The event taxonomy mirrors chat-utils.classifyRunEvent /
// parseToolEvent.
// ═══════════════════════════════════════════════════════════════

type ToolStatus = "invoked" | "completed" | "failed" | "approval_required";

type RunEventKind = "tool" | "reasoning" | "delta" | "other";

/** Bucket a raw SSE event name (mirrors chat-utils.classifyRunEvent). */
function classifyEvent(type: string): RunEventKind {
  if (type.startsWith("tool")) return "tool";
  if (type.startsWith("reasoning")) return "reasoning";
  if (type === "message.delta" || type === "response.output_text.delta") return "delta";
  return "other";
}

function asObj(data: unknown): Record<string, unknown> | null {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
}

/** Tool name + status from a `tool.*` event (mirrors chat-utils.parseToolEvent). */
function parseTool(type: string, data: unknown): { name: string; status: ToolStatus } {
  const o = asObj(data);
  let name = "tool";
  if (o) {
    for (const k of ["name", "tool", "tool_name"]) {
      if (typeof o[k] === "string") {
        name = o[k] as string;
        break;
      }
    }
  }
  const status: ToolStatus = type.includes("approval")
    ? "approval_required"
    : type.endsWith("completed")
      ? "completed"
      : type.endsWith("failed")
        ? "failed"
        : "invoked";
  return { name, status };
}

interface ToolEventLog {
  name: string;
  status: ToolStatus;
}

/** Mutable accumulator folded over a single item's event stream. */
export interface ItemTrajectory {
  toolEvents: ToolEventLog[];
  reasoningSteps: number;
  deltaChunks: number;
  approvals: number;
}

export function newTrajectory(): ItemTrajectory {
  return { toolEvents: [], reasoningSteps: 0, deltaChunks: 0, approvals: 0 };
}

/** Fold one raw SSE event (backend name + parsed data) into the trajectory. */
export function accumulateRunEvent(t: ItemTrajectory, type: string, data: unknown): ItemTrajectory {
  switch (classifyEvent(type)) {
    case "tool": {
      const tc = parseTool(type, data);
      t.toolEvents.push({ name: tc.name, status: tc.status });
      if (tc.status === "approval_required") t.approvals += 1;
      break;
    }
    case "reasoning":
      t.reasoningSteps += 1;
      break;
    case "delta":
      t.deltaChunks += 1;
      break;
    default:
      break;
  }
  return t;
}

/** Derived per-item metrics — the descriptive signal set behind the stats. */
export interface ItemMetrics {
  /** Distinct tool calls started ('invoked'/'tool.requested'). */
  toolInvocations: number;
  toolCompleted: number;
  toolFailed: number;
  /** Successful tool results that followed a prior failure (recovery/diligence). */
  toolRecoveries: number;
  /** Names of tools actually invoked (ACTUAL usage, not merely equipped). */
  distinctTools: string[];
  reasoningSteps: number;
  /** Crude trajectory length: tool invocations + reasoning steps. */
  steps: number;
  latencyMs: number | null;
  completed: boolean;
  errored: boolean;
}

export interface FinalizeOptions {
  latencyMs?: number | null;
  completed: boolean;
  errored: boolean;
}

export function finalizeItemMetrics(t: ItemTrajectory, opts: FinalizeOptions): ItemMetrics {
  let invocations = 0;
  let completed = 0;
  let failed = 0;
  let recoveries = 0;
  let sawFailure = false;
  const distinct = new Set<string>();

  for (const ev of t.toolEvents) {
    if (ev.status === "invoked") {
      invocations += 1;
      distinct.add(ev.name);
    } else if (ev.status === "completed") {
      completed += 1;
      if (sawFailure) {
        recoveries += 1;
        sawFailure = false;
      }
    } else if (ev.status === "failed") {
      failed += 1;
      sawFailure = true;
    }
  }

  return {
    toolInvocations: invocations,
    toolCompleted: completed,
    toolFailed: failed,
    toolRecoveries: recoveries,
    distinctTools: [...distinct],
    reasoningSteps: t.reasoningSteps,
    steps: invocations + t.reasoningSteps,
    latencyMs: opts.latencyMs ?? null,
    completed: opts.completed,
    errored: opts.errored,
  };
}

/** Run-level rollup of per-item metrics. */
export interface RunMetrics {
  items: number;
  /** Fraction of items that reached a completed terminal state. */
  completionRate: number;
  toolInvocations: number;
  /** completed / (completed + failed) tool results, or null when no tool calls. */
  toolCorrectness: number | null;
  /** recoveries / failures, or null when nothing failed. */
  recoveryRate: number | null;
  meanSteps: number;
  /** Union of tools actually invoked across the run. */
  distinctTools: string[];
  meanLatencyMs: number | null;
}

export function aggregateMetrics(items: ItemMetrics[]): RunMetrics {
  const n = items.length;
  if (n === 0) {
    return {
      items: 0,
      completionRate: 0,
      toolInvocations: 0,
      toolCorrectness: null,
      recoveryRate: null,
      meanSteps: 0,
      distinctTools: [],
      meanLatencyMs: null,
    };
  }

  let completedItems = 0;
  let toolInvocations = 0;
  let toolCompleted = 0;
  let toolFailed = 0;
  let recoveries = 0;
  let stepsSum = 0;
  let latencySum = 0;
  let latencyCount = 0;
  const distinct = new Set<string>();

  for (const m of items) {
    if (m.completed) completedItems += 1;
    toolInvocations += m.toolInvocations;
    toolCompleted += m.toolCompleted;
    toolFailed += m.toolFailed;
    recoveries += m.toolRecoveries;
    stepsSum += m.steps;
    if (typeof m.latencyMs === "number") {
      latencySum += m.latencyMs;
      latencyCount += 1;
    }
    for (const name of m.distinctTools) distinct.add(name);
  }

  const toolResults = toolCompleted + toolFailed;
  return {
    items: n,
    completionRate: completedItems / n,
    toolInvocations,
    toolCorrectness: toolResults > 0 ? toolCompleted / toolResults : null,
    recoveryRate: toolFailed > 0 ? recoveries / toolFailed : null,
    meanSteps: stepsSum / n,
    distinctTools: [...distinct],
    meanLatencyMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : null,
  };
}

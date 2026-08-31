// ═══════════════════════════════════════════════════════════════
// composer/engine.ts — the Composer graph executor
//
// advanceComposerRun() moves a run forward by ONE step (start a node, wait,
// gate, route to the next node via verdict/approval, loop, or complete). It is
// idempotent and safe to call repeatedly — driven by the ComposerTick (start
// pending + backstop) and by reconcile (after each stage's run goes terminal).
// finalizeComposerNodeRun() records a terminal stage outcome (verdict + context).
// Built entirely on the existing durable run/reconcile/scheduler substrate.
// ═══════════════════════════════════════════════════════════════

import { now } from "@/lib/db";
import { logApiError } from "@/lib/api-logger";
import { captureArtifactOnce } from "@/lib/artifacts-repository";
import type { RunStatus } from "@/lib/runtime/types";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { checkUnattendedSpend } from "@/lib/spend/spend-guard";
import { getResearchRunByComposerNodeRunId } from "@/lib/laboratory/deep-research/research-repository";
import { parseVerdict } from "./verdict";
import { dispatchComposerNode } from "./dispatch";
import {
  getComposerRun,
  getComposerRunByParentNodeRunId,
  getNode,
  getNodeRun,
  getNodeRunByRunId,
  getOutgoingEdges,
  getStartNode,
  listActiveComposerRuns,
  listComposerApprovals,
  listNodeRuns,
  maxAttemptForNode,
  updateComposerRun,
  updateNodeRun,
} from "./composer-repository";
import { TERMINAL_COMPOSER_RUN_STATUSES, isTerminalComposerRunStatus } from "./schema";
import type {
  ComposerApproval,
  ComposerNode,
  ComposerNodeRun,
} from "./schema";

// Runs the tick must not advance. That is every TERMINAL status, plus
// `awaiting_approval` -- which is not terminal but is not ours to move either:
// the operator's decision is what unparks it.
const TERMINAL_RUN_STATUSES = new Set<string>([
  ...TERMINAL_COMPOSER_RUN_STATUSES,
  "awaiting_approval",
]);

/**
 * Max wall-clock a "research" node-run may stay running before it is force-
 * failed. Research runs execute in-process (not via the resumable agent
 * backend), so a server restart mid-research would otherwise wedge the workflow.
 */
const RESEARCH_NODE_CAP_MINUTES = 20;

/**
 * Loop guardrails (best practice: "maximum iteration limits + stopping
 * conditions by default"). The engine has no other bound on cycles, so without
 * these a `test → implement → test` loop could run forever.
 *  - Per-node attempt cap: how many times a single stage may (re)run in a run,
 *    overridable per node via `config.maxAttempts`.
 *  - Per-run total-step cap: a backstop on the total number of stage executions.
 */
const MAX_NODE_ATTEMPTS = 5;
const MAX_TOTAL_STEPS = 100;

/** Per-node attempt cap, honoring an optional `config.maxAttempts` override. */
function nodeMaxAttempts(node: ComposerNode | null): number {
  const v = node?.config?.maxAttempts;
  return typeof v === "number" && v >= 1 ? Math.floor(v) : MAX_NODE_ATTEMPTS;
}

function minutesSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

/** Highest-attempt node-run for a node within a run (the current execution). */
function latestNodeRun(composerRunId: string, nodeId: string): ComposerNodeRun | null {
  const all = listNodeRuns(composerRunId).filter((nr) => nr.nodeId === nodeId);
  if (all.length === 0) return null;
  return all.reduce((a, b) => (b.attempt >= a.attempt ? b : a));
}

/** A gate approval for this node recorded AFTER the given time (per-attempt). */
function approvalSince(composerRunId: string, nodeId: string, sinceIso: string): ComposerApproval | null {
  const matches = listComposerApprovals(composerRunId).filter(
    (a) => a.nodeId === nodeId && a.createdAt >= sinceIso,
  );
  return matches.length ? matches[matches.length - 1] : null;
}

/**
 * Write a terminal outcome onto a "research" node-run (status + verdict) and
 * merge its report into the run's context — the research analogue of
 * finalizeComposerNodeRun (which is driven by the agent-run reconcile path).
 */
function applyResearchOutcome(
  node: ComposerNode,
  nodeRun: ComposerNodeRun,
  status: "completed" | "failed",
  output: string | null,
  error: string | null,
): void {
  const verdict =
    status === "failed"
      ? { pass: false, reasons: [error ?? "research stage failed"], suggestions: [] }
      : parseVerdict(output, node.kind);

  updateNodeRun(nodeRun.id, { status, output, verdict, error, completedAt: now() });

  if (output) {
    const run = getComposerRun(nodeRun.composerRunId);
    if (run) {
      const context = { ...(run.context ?? {}), [node.key]: output };
      updateComposerRun(nodeRun.composerRunId, { context });
    }
  }
}

/**
 * Settle a running "research" node-run from its linked research run. Returns
 * true once the node-run has reached a terminal state (so the caller can route),
 * false while research is still in flight. Force-fails past the cap so an
 * interrupted research run can't wedge the workflow.
 */
function settleResearchNode(node: ComposerNode, nodeRun: ComposerNodeRun): boolean {
  const research = getResearchRunByComposerNodeRunId(nodeRun.id);
  if (!research) {
    applyResearchOutcome(node, nodeRun, "failed", null, "research run was never created");
    return true;
  }
  if (research.status === "completed") {
    applyResearchOutcome(node, nodeRun, "completed", research.report, null);
    return true;
  }
  if (research.status === "failed") {
    applyResearchOutcome(node, nodeRun, "failed", null, research.error ?? "research failed");
    return true;
  }
  if (minutesSince(nodeRun.startedAt ?? nodeRun.createdAt) > RESEARCH_NODE_CAP_MINUTES) {
    applyResearchOutcome(node, nodeRun, "failed", null, "research stage exceeded the max runtime");
    return true;
  }
  return false; // still researching
}

/**
 * Settle a running "group" node-run from its linked sub-workflow run. The child
 * is a durable ComposerRun (survives restarts, advances via the tick), so no
 * cap is needed — we simply wait for it to terminate. On completion the child's
 * accumulated context is merged into the parent under the node key.
 */
function settleGroupNode(node: ComposerNode, nodeRun: ComposerNodeRun): boolean {
  const child = getComposerRunByParentNodeRunId(nodeRun.id);
  if (!child) {
    applyGroupOutcome(node, nodeRun, "failed", null, "sub-workflow run was never created");
    return true;
  }
  if (child.status === "completed") {
    applyGroupOutcome(node, nodeRun, "completed", child, null);
    return true;
  }
  if (isTerminalComposerRunStatus(child.status)) {
    // Anything terminal that is not `completed` settles the parent stage as
    // failed: from the parent's side the stage did not deliver, whatever the
    // child's own reason was. The child's error carries that reason through --
    // for a rejection it is already the sentence describeStageFailure composed.
    applyGroupOutcome(node, nodeRun, "failed", child, child.error ?? "sub-workflow did not complete");
    return true;
  }
  return false; // sub-workflow still in flight (incl. its own HIL gate)
}

function applyGroupOutcome(
  node: ComposerNode,
  nodeRun: ComposerNodeRun,
  status: "completed" | "failed",
  child: { context: Record<string, unknown> | null } | null,
  error: string | null,
): void {
  const output = status === "completed" ? "Sub-workflow completed." : null;
  const verdict =
    status === "failed"
      ? { pass: false, reasons: [error ?? "sub-workflow failed"], suggestions: [] }
      : parseVerdict(output, node.kind);

  updateNodeRun(nodeRun.id, { status, output, verdict, error, completedAt: now() });

  if (status === "completed") {
    const run = getComposerRun(nodeRun.composerRunId);
    if (run) {
      const context = { ...(run.context ?? {}), [node.key]: child?.context ?? {} };
      updateComposerRun(nodeRun.composerRunId, { context });
    }
  }
}

/** When a run terminates, nudge the parent group node-run's run to settle now. */
function nudgeParentRun(composerRunId: string): void {
  const run = getComposerRun(composerRunId);
  if (!run?.parentNodeRunId) return;
  const parentNodeRun = getNodeRun(run.parentNodeRunId);
  if (parentNodeRun) void advanceComposerRun(parentNodeRun.composerRunId);
}

export type NextStep =
  | { kind: "node"; nodeId: string }
  | { kind: "complete" }
  /**
   * A dead end. `rejected` distinguishes the operator turning a gate down from a
   * stage that failed -- `resolveNext` already knows which, and used to throw the
   * distinction away by collapsing both into one status on the run row.
   */
  | { kind: "fail"; error: string; rejected: boolean };

/** Pick the outgoing edge to follow from a completed node, by verdict/approval. */
export function resolveNext(
  node: ComposerNode,
  nodeRun: ComposerNodeRun,
  approval: ComposerApproval | null,
): NextStep {
  if (node.isTerminal) return { kind: "complete" };
  const edges = getOutgoingEdges(node.id);

  let cond: string;
  if (approval) cond = approval.approved ? "on_approve" : "on_reject";
  else if (nodeRun.status === "failed" || nodeRun.verdict?.pass === false) cond = "on_fail";
  else {
    // A successful stage may choose among many branches via OUTCOME: <x> →
    // follow an `on_<x>` edge when one exists; otherwise fall back to on_pass.
    const outcome = nodeRun.verdict?.outcome;
    if (outcome) {
      const branch = edges.find((e) => e.condition === `on_${outcome}`);
      if (branch) return { kind: "node", nodeId: branch.toNodeId };
    }
    cond = "on_pass";
  }

  let edge = edges.find((e) => e.condition === cond);
  if (!edge && (cond === "on_pass" || cond === "on_approve")) {
    edge = edges.find((e) => e.condition === "always");
  }
  if (!edge) {
    if (cond === "on_fail" || cond === "on_reject") {
      return {
        kind: "fail",
        error: describeStageFailure(node, nodeRun, cond),
        rejected: cond === "on_reject",
      };
    }
    return { kind: "complete" };
  }
  return { kind: "node", nodeId: edge.toNodeId };
}

/**
 * Build a human-readable run error for a stage that failed/was rejected with no
 * recovery edge — surfaces the stage label + the verdict's reasons instead of
 * the opaque "stage failed with no recovery path", so the UI can show WHY.
 */
function describeStageFailure(node: ComposerNode, nodeRun: ComposerNodeRun, cond: string): string {
  const verb = cond === "on_reject" ? "was rejected" : "failed";
  const reasons = (nodeRun.verdict?.reasons ?? []).map((r) => r.trim()).filter(Boolean);
  if (reasons.length) return `${node.label} ${verb}: ${reasons.join("; ")}`;
  if (nodeRun.error) return `${node.label} ${verb}: ${nodeRun.error}`;
  return `${node.label} ${verb} and the workflow has no recovery path from here.`;
}

/** Capture a completed top-level Composer run's final stage output as an
 *  artifact (idempotent; best-effort). Nested sub-workflow runs are skipped —
 *  the parent run's deliverable is the one users care about. */
function captureComposerArtifact(composerRunId: string, fromNodeRun: ComposerNodeRun): void {
  try {
    const output = fromNodeRun.output;
    if (!output || output.trim().length === 0) return;
    const run = getComposerRun(composerRunId);
    if (!run || run.parentNodeRunId) return;
    const title =
      (run.input ?? "").split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "Composer result";
    captureArtifactOnce({
      sourceKind: "composer",
      sourceRunId: composerRunId,
      sourceNodeId: fromNodeRun.id,
      name: title.length > 80 ? `${title.slice(0, 80)}…` : title,
      description: "Composer run output",
      mimeType: "text/markdown",
      content: output,
      tags: ["composer"],
    });
  } catch (err) {
    logApiError("composer.captureArtifact", composerRunId, err);
  }
}

async function applyNext(
  composerRunId: string,
  fromNodeRun: ComposerNodeRun,
  next: NextStep,
): Promise<void> {
  if (next.kind === "complete") {
    updateComposerRun(composerRunId, { status: "completed", completedAt: now() });
    captureComposerArtifact(composerRunId, fromNodeRun);
    nudgeParentRun(composerRunId); // if this is a sub-workflow, settle its group stage
    return;
  }
  if (next.kind === "fail") {
    // The STAGE is marked as well as the run. It used to be run-only, so a gate
    // the operator rejected kept the `completed` that finalizeComposerNodeRun
    // had just written and the canvas drew it green, two elements below a pink
    // failed header -- the picture contradicted the status line (T-0069).
    //
    // Only the rejected case rewrites the stage: a stage that genuinely FAILED
    // already carries its own `failed` status and its own error, and
    // overwriting those with the routing error would lose the real cause.
    const status = next.rejected ? "rejected" : "failed";
    if (next.rejected) {
      updateNodeRun(fromNodeRun.id, { status: "rejected", completedAt: now() });
    }
    updateComposerRun(composerRunId, { status, error: next.error, completedAt: now() });
    nudgeParentRun(composerRunId);
    return;
  }
  // Reaching a terminal node ends the run — the end-marker runs no agent.
  const target = getNode(next.nodeId);
  if (target?.isTerminal) {
    updateComposerRun(composerRunId, { status: "completed", currentNodeId: next.nodeId, completedAt: now() });
    captureComposerArtifact(composerRunId, fromNodeRun);
    nudgeParentRun(composerRunId);
    return;
  }
  // Loop guardrail: cap re-attempts per node so a stage that keeps failing
  // (or a tight cycle) stops gracefully instead of looping forever.
  const cap = nodeMaxAttempts(target);
  if (maxAttemptForNode(composerRunId, next.nodeId) >= cap) {
    const reasons = (fromNodeRun.verdict?.reasons ?? []).map((r) => r.trim()).filter(Boolean);
    const why = reasons.length ? `: ${reasons.join("; ")}` : "";
    updateComposerRun(composerRunId, {
      status: "failed",
      error: `${target?.label ?? "Stage"} exceeded ${cap} attempts without passing${why} — stopped to avoid an unbounded loop.`,
      completedAt: now(),
    });
    nudgeParentRun(composerRunId);
    return;
  }
  // Route to the next node (a loop-back gets a fresh attempt). Carry the prior
  // failure's reasons/suggestions so a re-run knows what to fix.
  updateComposerRun(composerRunId, { currentNodeId: next.nodeId });
  const priorFailure = fromNodeRun.verdict?.pass === false ? fromNodeRun.verdict : null;
  await dispatchComposerNode(composerRunId, next.nodeId, { priorFailure });
}

/** Advance a Composer run by one step. Idempotent + safe to call repeatedly. */
export async function advanceComposerRun(composerRunId: string): Promise<void> {
  let run = getComposerRun(composerRunId);
  if (!run || TERMINAL_RUN_STATUSES.has(run.status)) return;

  // Loop guardrail (backstop): cap the total stage executions per run so a
  // pathological cycle that slips past the per-node cap can't run forever.
  if (listNodeRuns(composerRunId).length >= MAX_TOTAL_STEPS) {
    updateComposerRun(composerRunId, {
      status: "failed",
      error: `This run hit the maximum of ${MAX_TOTAL_STEPS} stage executions and was stopped to avoid an unbounded loop.`,
      completedAt: now(),
    });
    nudgeParentRun(composerRunId);
    return;
  }

  if (run.status === "pending") {
    const start = getStartNode(run.workflowId);
    if (!start) {
      updateComposerRun(composerRunId, { status: "failed", error: "workflow has no start node", completedAt: now() });
      return;
    }
    updateComposerRun(composerRunId, { status: "running", currentNodeId: start.id });
    run = getComposerRun(composerRunId)!;
  }

  if (!run.currentNodeId) {
    updateComposerRun(composerRunId, { status: "failed", error: "no current node", completedAt: now() });
    return;
  }
  const node = getNode(run.currentNodeId);
  if (!node) {
    updateComposerRun(composerRunId, { status: "failed", error: "current node missing", completedAt: now() });
    return;
  }

  let current = latestNodeRun(composerRunId, node.id);
  if (!current) {
    // Node not started yet → dispatch it.
    await dispatchComposerNode(composerRunId, node.id);
    return;
  }
  if (current.status === "pending") return; // dispatched, not yet running
  if (current.status === "running") {
    // "research" + "group" nodes don't run via the agent reconcile path, so
    // settle them here from their linked research/sub-workflow run. Agent
    // stage-runs wait for reconcile to write their terminal state.
    if (
      (node.kind === "research" && settleResearchNode(node, current)) ||
      (node.kind === "group" && settleGroupNode(node, current))
    ) {
      current = latestNodeRun(composerRunId, node.id)!;
    } else {
      return; // in flight — wait
    }
  }

  // The current node's run is terminal.

  // Interactive clarification: a stage that can't proceed on a too-vague
  // objective asks the user a question (OUTCOME: needs_clarification + QUESTION)
  // instead of dead-ending. Pause for an answer — reusing the awaiting_approval
  // paused state + a `__clarify` context marker (no new run status needed). The
  // /clarify route appends the answer and re-dispatches this stage.
  if (current.verdict?.outcome === "needs_clarification") {
    const question =
      current.verdict.question?.trim() ||
      `"${node.label}" needs more detail to proceed — please clarify your objective.`;
    updateComposerRun(composerRunId, {
      status: "awaiting_approval",
      context: { ...(run.context ?? {}), __clarify: { nodeId: node.id, question } },
    });
    return;
  }

  // A stage that FAILED is not eligible for approval. The gate branch used to run
  // first, so `resolveNext` saw an approval and routed `on_approve` — meaning a
  // human clicking Accept on a crashed stage could carry the run to "completed"
  // with no artifact behind it. A failed stage routes on_fail whatever the gate
  // says; there is nothing for a human to approve.
  const stageFailed = current.status === "failed" || current.verdict?.pass === false;

  if (node.gate === "hil" && !stageFailed) {
    const approval = approvalSince(composerRunId, node.id, current.completedAt ?? current.createdAt);
    if (!approval) {
      updateComposerRun(composerRunId, { status: "awaiting_approval" });
      return;
    }
    await applyNext(composerRunId, current, resolveNext(node, current, approval));
    return;
  }

  await applyNext(composerRunId, current, resolveNext(node, current, null));
}

/**
 * Record a terminal stage outcome onto its node-run (status + verdict) and
 * merge its output into the run's context. Returns the composer run id so the
 * caller (reconcile) can advance. Called when a stage's agent run goes terminal.
 */
export function finalizeComposerNodeRun(
  runId: string,
  runStatus: RunStatus,
  output: string | null,
  error: string | null,
): string | null {
  const nodeRun = getNodeRunByRunId(runId);
  if (!nodeRun) return null;

  // A run that has ENDED keeps its ending. Reconcile snapshots the active set,
  // then awaits the gateway per row — so a cancellation landing during that
  // await would otherwise come back here holding a stale verdict and overwrite
  // the stage's status and merge dead output into a finished run's context.
  //
  // The `runs` row being written `cancelled` already removes it from
  // listActiveRuns, so this is defence in depth for the in-flight await and for
  // any future writer that leaves the row `started` (T-0076).
  const owningRun = getComposerRun(nodeRun.composerRunId);
  if (owningRun && isTerminalComposerRunStatus(owningRun.status)) return null;

  const node = getNode(nodeRun.nodeId);

  const status = runStatus === "completed" ? "completed" : "failed";
  const verdict =
    status === "failed"
      ? { pass: false, reasons: [error ?? "stage run failed"], suggestions: [] }
      : node
        ? parseVerdict(output, node.kind)
        : null;

  updateNodeRun(nodeRun.id, { status, output, verdict, error, completedAt: now() });

  if (node && output) {
    const run = getComposerRun(nodeRun.composerRunId);
    if (run) {
      const context = { ...(run.context ?? {}), [node.key]: output };
      updateComposerRun(nodeRun.composerRunId, { context });
    }
  }
  return nodeRun.composerRunId;
}

export interface ComposerTickResult {
  advanced: number;
  /**
   * Set when the operator's hard spend stop refused this tick. Present only
   * when something was actually refused.
   */
  blocked?: string;
}

/** One Composer tick: advance every active run (skip those awaiting a human). */
export async function composerTick(opts: { isOwner?: boolean } = {}): Promise<ComposerTickResult> {
  if (opts.isOwner === false) return { advanced: 0 };
  if (!isFeatureEnabled("composer")) return { advanced: 0 };

  // The operator's hard spend stop, when he has set a figure AND armed one
  // (T-0021, WO-0014). The tick is the unattended half of Composer: it starts
  // pending runs and advances in-flight ones with nobody watching.
  //
  // advanceComposerRun itself is NOT gated, deliberately. It is also the path a
  // human takes when he approves a gate, and clause 5 says attended use is
  // never blocked. Gating the tick and not the function is what makes the
  // difference between "the workflow paused" and "the workflow is stuck".
  const gate = checkUnattendedSpend();
  if (!gate.allowed) return { advanced: 0, blocked: gate.reason ?? "spend stop" };

  let advanced = 0;
  for (const run of listActiveComposerRuns()) {
    if (run.status === "awaiting_approval") continue; // resumed only by the approve API
    try {
      await advanceComposerRun(run.id);
      advanced += 1;
    } catch (err) {
      logApiError("composer.tick", run.id, err);
    }
  }
  return { advanced };
}

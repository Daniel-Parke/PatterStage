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
import type { RunStatus } from "@/lib/runtime/types";
import { isFeatureEnabled } from "@/lib/feature-flags";
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
  updateComposerRun,
  updateNodeRun,
} from "./composer-repository";
import type {
  ComposerApproval,
  ComposerNode,
  ComposerNodeRun,
} from "./schema";

const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "cancelled", "awaiting_approval"]);

/**
 * Max wall-clock a "research" node-run may stay running before it is force-
 * failed. Research runs execute in-process (not via the resumable agent
 * backend), so a server restart mid-research would otherwise wedge the workflow.
 */
const RESEARCH_NODE_CAP_MINUTES = 20;

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
  if (child.status === "failed" || child.status === "cancelled") {
    applyGroupOutcome(node, nodeRun, "failed", child, child.error ?? "sub-workflow failed");
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
  | { kind: "fail"; error: string };

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
      return { kind: "fail", error: "stage failed with no recovery path" };
    }
    return { kind: "complete" };
  }
  return { kind: "node", nodeId: edge.toNodeId };
}

async function applyNext(
  composerRunId: string,
  fromNodeRun: ComposerNodeRun,
  next: NextStep,
): Promise<void> {
  if (next.kind === "complete") {
    updateComposerRun(composerRunId, { status: "completed", completedAt: now() });
    nudgeParentRun(composerRunId); // if this is a sub-workflow, settle its group stage
    return;
  }
  if (next.kind === "fail") {
    updateComposerRun(composerRunId, { status: "failed", error: next.error, completedAt: now() });
    nudgeParentRun(composerRunId);
    return;
  }
  // Reaching a terminal node ends the run — the end-marker runs no agent.
  const target = getNode(next.nodeId);
  if (target?.isTerminal) {
    updateComposerRun(composerRunId, { status: "completed", currentNodeId: next.nodeId, completedAt: now() });
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
  if (node.gate === "hil") {
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

/** One Composer tick: advance every active run (skip those awaiting a human). */
export async function composerTick(opts: { isOwner?: boolean } = {}): Promise<{ advanced: number }> {
  if (opts.isOwner === false) return { advanced: 0 };
  if (!isFeatureEnabled("composer")) return { advanced: 0 };

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

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
import { parseVerdict } from "./verdict";
import { dispatchComposerNode } from "./dispatch";
import {
  getComposerRun,
  getNode,
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
  else cond = "on_pass";

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
    return;
  }
  if (next.kind === "fail") {
    updateComposerRun(composerRunId, { status: "failed", error: next.error, completedAt: now() });
    return;
  }
  // Reaching a terminal node ends the run — the end-marker runs no agent.
  const target = getNode(next.nodeId);
  if (target?.isTerminal) {
    updateComposerRun(composerRunId, { status: "completed", currentNodeId: next.nodeId, completedAt: now() });
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

  const current = latestNodeRun(composerRunId, node.id);
  if (!current) {
    // Node not started yet → dispatch it.
    await dispatchComposerNode(composerRunId, node.id);
    return;
  }
  if (current.status === "pending" || current.status === "running") {
    return; // in flight — wait for reconcile
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

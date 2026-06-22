// ═══════════════════════════════════════════════════════════════
// composer/dispatch.ts — run one Composer stage as an agent run
//
// Analog of orchestration/dispatch.ts but for a Composer node: create a
// node-run + a runs row (linked by composer_node_run_id, idempotent id),
// build the stage prompt, submit to the runtime. Reconcile later finalizes
// the node-run; the engine routes to the next node.
// ═══════════════════════════════════════════════════════════════

import { now } from "@/lib/db";
import { runtime } from "@/lib/runtime";
import { messageFromError } from "@/lib/api-fetch";
import { logApiError } from "@/lib/api-logger";
import { createRun, attachBackendRun, updateRun } from "@/lib/runs-repository";
import { createResearchRun } from "@/lib/laboratory/deep-research/research-repository";
import { runResearchJob } from "@/lib/laboratory/deep-research/run-job";
import type { ResearchConfig } from "@/lib/laboratory/deep-research/types";
import { buildStagePrompt } from "./stage-prompt";
import {
  createComposerRun,
  createNodeRun,
  getComposerRun,
  getNode,
  getNodeRun,
  getStartNode,
  getWorkflow,
  getWorkflowByKey,
  maxAttemptForNode,
  updateNodeRun,
} from "./composer-repository";
import type { ComposerNode, ComposerRun, NodeVerdict } from "./schema";

/** Hard ceiling on sub-workflow nesting depth (guards runaway recursion). */
const GROUP_MAX_DEPTH = 8;

export interface DispatchComposerNodeResult {
  ok: boolean;
  nodeRunId?: string;
  error?: string;
}

/** The query a "research" node should investigate: explicit config → run input → label. */
function researchQueryFor(node: ComposerNode, run: ComposerRun): string {
  const q = node.config?.query;
  if (typeof q === "string" && q.trim()) return q.trim();
  if (run.input && run.input.trim()) return run.input.trim();
  return node.label;
}

/**
 * Dispatch a "research" node: drive a Deep Research run instead of a Hermes
 * agent run. The node-run is marked running with NO agent run id (so it never
 * enters the agent reconcile path); the engine settles it from the linked
 * research run when it finishes. No `runs` row is created.
 */
async function dispatchResearchNode(
  run: ComposerRun,
  node: ComposerNode,
): Promise<DispatchComposerNodeResult> {
  const attempt = maxAttemptForNode(run.id, node.id) + 1;
  const query = researchQueryFor(node, run);
  const config = node.config ? (node.config as unknown as ResearchConfig) : null;
  const nodeRun = createNodeRun({ composerRunId: run.id, nodeId: node.id, attempt, input: query });

  try {
    const research = createResearchRun({
      query,
      modelId: config?.modelId ?? null,
      config,
      composerNodeRunId: nodeRun.id,
    });
    updateNodeRun(nodeRun.id, { status: "running" });
    // Fire-and-forget; nudge the workflow forward when it settles. The composer
    // tick is the cross-restart backstop (+ a cap in the engine).
    void runResearchJob(research.id, query, config).finally(() => {
      void import("./engine").then((m) => m.advanceComposerRun(run.id)).catch(() => {});
    });
    return { ok: true, nodeRunId: nodeRun.id };
  } catch (err) {
    const message = messageFromError(err, "research stage dispatch failed");
    logApiError("composer.dispatchResearchNode", run.id, err);
    updateNodeRun(nodeRun.id, { status: "failed", error: message, completedAt: now() });
    return { ok: false, nodeRunId: nodeRun.id, error: message };
  }
}

/** Workflow ids on the parent chain + the nesting depth (for the cycle guard). */
function ancestorWorkflowIds(run: ComposerRun): { ids: Set<string>; depth: number } {
  const ids = new Set<string>();
  let cur: ComposerRun | null = run;
  let depth = 0;
  while (cur && depth < 64) {
    ids.add(cur.workflowId);
    if (!cur.parentNodeRunId) break;
    const parentNodeRun = getNodeRun(cur.parentNodeRunId);
    if (!parentNodeRun) break;
    cur = getComposerRun(parentNodeRun.composerRunId);
    depth++;
  }
  return { ids, depth };
}

/**
 * Dispatch a "group" node: run its referenced sub-workflow as a nested
 * ComposerRun (linked via parent_node_run_id), instead of an agent run. The
 * node-run is marked running with NO agent run id; the engine settles it when
 * the child run finishes. Blocks recursion (a workflow referencing an ancestor)
 * and excessive nesting depth.
 */
async function dispatchGroupNode(run: ComposerRun, node: ComposerNode): Promise<DispatchComposerNodeResult> {
  const attempt = maxAttemptForNode(run.id, node.id) + 1;
  const nodeRun = createNodeRun({ composerRunId: run.id, nodeId: node.id, attempt, input: run.input });

  const ref = typeof node.config?.workflowRef === "string" ? node.config.workflowRef.trim() : "";
  const child = ref ? (getWorkflow(ref) ?? getWorkflowByKey(ref)) : null;
  if (!child) {
    const message = "group stage has no valid sub-workflow selected";
    updateNodeRun(nodeRun.id, { status: "failed", error: message, completedAt: now() });
    return { ok: false, nodeRunId: nodeRun.id, error: message };
  }
  const { ids, depth } = ancestorWorkflowIds(run);
  if (ids.has(child.id) || depth >= GROUP_MAX_DEPTH) {
    const message = ids.has(child.id)
      ? `sub-workflow recursion blocked: "${child.name}" already runs in this chain`
      : `sub-workflow nesting too deep (max ${GROUP_MAX_DEPTH})`;
    updateNodeRun(nodeRun.id, { status: "failed", error: message, completedAt: now() });
    return { ok: false, nodeRunId: nodeRun.id, error: message };
  }

  try {
    const childRun = createComposerRun({
      workflowId: child.id,
      input: run.input,
      profileName: run.profileName ?? null,
      parentNodeRunId: nodeRun.id,
    });
    updateNodeRun(nodeRun.id, { status: "running" });
    // Kick the child run; the composer tick is the backstop, and the child
    // nudges this parent to settle when it terminates.
    void import("./engine").then((m) => m.advanceComposerRun(childRun.id)).catch(() => {});
    return { ok: true, nodeRunId: nodeRun.id };
  } catch (err) {
    const message = messageFromError(err, "group stage dispatch failed");
    logApiError("composer.dispatchGroupNode", run.id, err);
    updateNodeRun(nodeRun.id, { status: "failed", error: message, completedAt: now() });
    return { ok: false, nodeRunId: nodeRun.id, error: message };
  }
}

export async function dispatchComposerNode(
  composerRunId: string,
  nodeId: string,
  opts: { priorFailure?: NodeVerdict | null } = {},
): Promise<DispatchComposerNodeResult> {
  const run = getComposerRun(composerRunId);
  const node = getNode(nodeId);
  if (!run || !node) return { ok: false, error: "composer run or node not found" };

  if (node.kind === "research") return dispatchResearchNode(run, node);
  if (node.kind === "group") return dispatchGroupNode(run, node);

  const attempt = maxAttemptForNode(composerRunId, nodeId) + 1;
  // A workflow's domain framing lives on its start node's config (default neutral).
  const startConfig = getStartNode(run.workflowId)?.config;
  const framing = typeof startConfig?.framing === "string" ? startConfig.framing : null;
  const prompt = buildStagePrompt(node, run, { priorFailure: opts.priorFailure ?? null, framing });
  const nodeRun = createNodeRun({ composerRunId, nodeId, attempt, input: prompt });

  // PatterStage-owned run id (also the Idempotency-Key); idempotent insert.
  const runId = `cn_${nodeRun.id}`;
  createRun({ id: runId, composerNodeRunId: nodeRun.id, profileName: run.profileName ?? null });

  try {
    const handle = await runtime.submitRun({
      input: prompt,
      idempotencyKey: runId,
      profileName: run.profileName ?? undefined,
    });
    attachBackendRun(runId, { runId: handle.runId, status: handle.status });
    updateNodeRun(nodeRun.id, { status: "running", runId });
    return { ok: true, nodeRunId: nodeRun.id };
  } catch (err) {
    const message = messageFromError(err, "stage dispatch failed");
    logApiError("composer.dispatchComposerNode", composerRunId, err);
    updateRun(runId, { status: "failed", error: message });
    updateNodeRun(nodeRun.id, { status: "failed", runId, error: message, completedAt: now() });
    return { ok: false, nodeRunId: nodeRun.id, error: message };
  }
}

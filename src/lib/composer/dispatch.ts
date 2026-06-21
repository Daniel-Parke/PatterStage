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
import { buildStagePrompt } from "./stage-prompt";
import {
  createNodeRun,
  getComposerRun,
  getNode,
  maxAttemptForNode,
  updateNodeRun,
} from "./composer-repository";
import type { NodeVerdict } from "./schema";

export interface DispatchComposerNodeResult {
  ok: boolean;
  nodeRunId?: string;
  error?: string;
}

export async function dispatchComposerNode(
  composerRunId: string,
  nodeId: string,
  opts: { priorFailure?: NodeVerdict | null } = {},
): Promise<DispatchComposerNodeResult> {
  const run = getComposerRun(composerRunId);
  const node = getNode(nodeId);
  if (!run || !node) return { ok: false, error: "composer run or node not found" };

  const attempt = maxAttemptForNode(composerRunId, nodeId) + 1;
  const prompt = buildStagePrompt(node, run, { priorFailure: opts.priorFailure ?? null });
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

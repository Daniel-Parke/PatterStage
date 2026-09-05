// ═══════════════════════════════════════════════════════════════
// composer/seed.ts — ensure the built-in workflows exist
//
// Idempotent: creates the seeded "Software Delivery" workflow on first boot
// (keyed, so re-running is a no-op). Called from the orchestration boot path.
// ═══════════════════════════════════════════════════════════════

import { uuid, now } from "@/lib/db";
import {
  createWorkflowFromDef,
  getWorkflowByKey,
  insertWorkflowEdge,
  listWorkflowEdges,
  listWorkflowNodes,
  updateWorkflowNodeConfig,
} from "./composer-repository";
import {
  DEFAULT_SOFTWARE_DELIVERY_WORKFLOW,
  SOFTWARE_DELIVERY_INPUT_SPEC,
  DEFAULT_DRAFT_REVIEW_WORKFLOW,
  DEFAULT_RESEARCH_SUMMARISE_WORKFLOW,
  DRAFT_REVIEW_WORKFLOW_KEY,
  RESEARCH_SUMMARISE_WORKFLOW_KEY,
  SOFTWARE_DELIVERY_WORKFLOW_KEY,
} from "./schema";

/**
 * Recovery edges added after the seeded workflow first shipped. Applied
 * non-destructively to an EXISTING seeded workflow (which createWorkflowFromDef
 * never re-touches) so older installs gain the FORWARD-on-failure routing that
 * keeps an enrichment-stage blip from dead-ending a run. Fresh installs already
 * get these from the def — this is the idempotent back-fill for upgrades.
 */
const RECOVERY_EDGES: { from: string; to: string; condition: string; label: string }[] = [
  { from: "research", to: "hypothesise", condition: "on_fail", label: "skip research" },
  { from: "hypothesise", to: "plan", condition: "on_fail", label: "continue" },
];

/** Idempotently add the recovery edges to the existing seeded workflow. */
function ensureRecoveryEdges(): void {
  const wf = getWorkflowByKey(SOFTWARE_DELIVERY_WORKFLOW_KEY);
  if (!wf) return;
  const idByKey = new Map(listWorkflowNodes(wf.id).map((n) => [n.key, n.id]));
  const edges = listWorkflowEdges(wf.id);
  const ts = now();
  for (const re of RECOVERY_EDGES) {
    const from = idByKey.get(re.from);
    const to = idByKey.get(re.to);
    if (!from || !to) continue;
    const exists = edges.some(
      (e) => e.fromNodeId === from && e.toNodeId === to && e.condition === re.condition,
    );
    if (exists) continue;
    insertWorkflowEdge({
      id: uuid(),
      workflowId: wf.id,
      fromNodeId: from,
      toNodeId: to,
      condition: re.condition,
      label: re.label,
      createdAt: ts,
    });
  }
}

/**
 * Idempotently back-fill the seeded workflow's start-node config (input
 * contract + "software" framing) onto older installs created before those
 * shipped — without losing run history. Each key is ensured independently so a
 * partial upgrade (e.g. inputSpec from H1 but not framing) is completed.
 */
function ensureSoftwareDeliveryStartConfig(): void {
  const wf = getWorkflowByKey(SOFTWARE_DELIVERY_WORKFLOW_KEY);
  if (!wf) return;
  const nodes = listWorkflowNodes(wf.id);
  const start = nodes.find((n) => n.isStart) ?? nodes.find((n) => n.key === "review");
  if (!start) return;
  const config = { ...((start.config ?? {}) as Record<string, unknown>) };
  let changed = false;
  if (!config.inputSpec) { config.inputSpec = SOFTWARE_DELIVERY_INPUT_SPEC; changed = true; }
  if (!config.framing) { config.framing = "software"; changed = true; }
  if (!changed) return;
  updateWorkflowNodeConfig(start.id, JSON.stringify(config));
}

/** Idempotently ensure the default Composer workflow(s) exist. */
export function ensureDefaultComposerWorkflows(): void {
  if (!getWorkflowByKey(SOFTWARE_DELIVERY_WORKFLOW_KEY)) {
    createWorkflowFromDef(DEFAULT_SOFTWARE_DELIVERY_WORKFLOW);
  }
  // Two starters a first run can be made sense of. Software Delivery is
  // sixteen stages, which is a fine third workflow and an intimidating first
  // one (T-0106). Keyed, so a second call writes nothing.
  if (!getWorkflowByKey(RESEARCH_SUMMARISE_WORKFLOW_KEY)) {
    createWorkflowFromDef(DEFAULT_RESEARCH_SUMMARISE_WORKFLOW);
  }
  if (!getWorkflowByKey(DRAFT_REVIEW_WORKFLOW_KEY)) {
    createWorkflowFromDef(DEFAULT_DRAFT_REVIEW_WORKFLOW);
  }
  ensureRecoveryEdges();
  ensureSoftwareDeliveryStartConfig();
}

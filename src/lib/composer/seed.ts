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
  insertWorkflowNode,
  clearWorkflowNodeTerminal,
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
/**
 * Stage kinds that exist to produce something.
 *
 * Mirrors WORKING_STAGE_KINDS in canvas-graph.ts, which refuses to SAVE this
 * shape; this one repairs installs that were given it before that rule existed.
 */
const WORKING_STAGE_KINDS = ["documentation", "review", "research", "implementation", "planning", "testing"];

/**
 * Move the End marker off a stage that was supposed to do work.
 *
 * "Research then summarise" shipped with its `write` stage marked terminal, and
 * a terminal stage is where the run STOPS: `applyNext` completes the run on
 * reaching one without ever dispatching it. So an approved gate ended the run
 * with no summary written, and the run said `completed`. The seed definition is
 * fixed, but a keyed seed writes nothing on an install that already has the
 * workflow, so without this the defect is permanent for every existing user.
 *
 * Narrow on purpose. It repairs only a terminal stage whose kind means it was
 * meant to produce output, because that shape cannot be a deliberate choice --
 * the engine cannot honour it and the Build tab now refuses to save it. An
 * operator's own edits to a seeded workflow are left alone.
 *
 * Run history is untouched: nothing is recreated, the marker is moved.
 */
function ensureNoWorkingTerminal(): void {
  for (const key of [
    SOFTWARE_DELIVERY_WORKFLOW_KEY,
    RESEARCH_SUMMARISE_WORKFLOW_KEY,
    DRAFT_REVIEW_WORKFLOW_KEY,
  ]) {
    const wf = getWorkflowByKey(key);
    if (!wf) continue;

    const nodes = listWorkflowNodes(wf.id);
    const broken = nodes.filter((n) => n.isTerminal && WORKING_STAGE_KINDS.includes(n.kind));
    if (broken.length === 0) continue;

    // Somewhere for the run to stop. Reuse an inert marker if the workflow
    // already has one, so a partially-repaired install does not grow a second.
    let marker = nodes.find((n) => n.isTerminal && !WORKING_STAGE_KINDS.includes(n.kind));
    if (!marker) {
      marker = insertWorkflowNode({
        id: uuid(),
        workflowId: wf.id,
        key: "done",
        label: "Done",
        kind: "custom",
        gate: "auto",
        isStart: false,
        isTerminal: true,
        configJson: JSON.stringify({ _ui: { x: 0, y: (nodes.length + 1) * 120 } }),
        pos: nodes.length,
        createdAt: now(),
      });
    }

    const edges = listWorkflowEdges(wf.id);
    for (const node of broken) {
      clearWorkflowNodeTerminal(node.id);
      const linked = edges.some((e) => e.fromNodeId === node.id && e.toNodeId === marker!.id);
      if (linked) continue;
      insertWorkflowEdge({
        id: uuid(),
        workflowId: wf.id,
        fromNodeId: node.id,
        toNodeId: marker.id,
        condition: "always",
        label: null,
        createdAt: now(),
      });
    }
  }
}

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
  ensureNoWorkingTerminal();
}

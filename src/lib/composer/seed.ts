// ═══════════════════════════════════════════════════════════════
// composer/seed.ts — ensure the built-in workflows exist
//
// Idempotent: creates the seeded "Software Delivery" workflow on first boot
// (keyed, so re-running is a no-op). Called from the orchestration boot path.
// ═══════════════════════════════════════════════════════════════

import { db, uuid, now } from "@/lib/db";
import {
  createWorkflowFromDef,
  getWorkflowByKey,
  listWorkflowEdges,
  listWorkflowNodes,
} from "./composer-repository";
import { DEFAULT_SOFTWARE_DELIVERY_WORKFLOW, SOFTWARE_DELIVERY_WORKFLOW_KEY } from "./schema";

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
    db()
      .prepare(
        "INSERT INTO composer_edges (id, workflow_id, from_node_id, to_node_id, condition, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(uuid(), wf.id, from, to, re.condition, re.label, ts);
  }
}

/** Idempotently ensure the default Composer workflow(s) exist. */
export function ensureDefaultComposerWorkflows(): void {
  if (!getWorkflowByKey(SOFTWARE_DELIVERY_WORKFLOW_KEY)) {
    createWorkflowFromDef(DEFAULT_SOFTWARE_DELIVERY_WORKFLOW);
  }
  ensureRecoveryEdges();
}

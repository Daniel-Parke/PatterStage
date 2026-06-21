// ═══════════════════════════════════════════════════════════════
// composer/seed.ts — ensure the built-in workflows exist
//
// Idempotent: creates the seeded "Software Delivery" workflow on first boot
// (keyed, so re-running is a no-op). Called from the orchestration boot path.
// ═══════════════════════════════════════════════════════════════

import { createWorkflowFromDef, getWorkflowByKey } from "./composer-repository";
import { DEFAULT_SOFTWARE_DELIVERY_WORKFLOW, SOFTWARE_DELIVERY_WORKFLOW_KEY } from "./schema";

/** Idempotently ensure the default Composer workflow(s) exist. */
export function ensureDefaultComposerWorkflows(): void {
  if (!getWorkflowByKey(SOFTWARE_DELIVERY_WORKFLOW_KEY)) {
    createWorkflowFromDef(DEFAULT_SOFTWARE_DELIVERY_WORKFLOW);
  }
}

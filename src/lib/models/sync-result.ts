// ═══════════════════════════════════════════════════════════════
// models/sync-result.ts — the wire shape of a model-sync action (CORE)
//
// Extracted from sync-manager.ts for the hermes module move
// (org/decisions/ADR-0005-product-modules.md). sync-manager itself is Hermes end to end
// — its header reads "Push/Pull orchestration between PatterStage and Hermes
// config files" — but this type is not: it is the response body of
// PatterStage's OWN /api/models/sync/push, and its three consumers are core
// UI (ModelsTableSection, ModelSyncButtons, useModelsPage).
//
// Sibling of the task-types.ts extraction: a neutral symbol living in a
// vendor-named file made core look coupled when it was not.
// ═══════════════════════════════════════════════════════════════

/**
 * Outcome of a single model/credential sync action.
 *
 * `details` is an ordered log of what the action actually did, surfaced to the
 * operator so a "success" that changed nothing is distinguishable from one
 * that wrote a file.
 */
export interface SyncActionResult {
  success: boolean;
  backupPath: string | null;
  details: Array<{ action: string; detail: string }>;
}

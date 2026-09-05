// ═══════════════════════════════════════════════════════════════
// model-diff.ts — what a pull would change about one model
//
// Lifted out of `POST /api/models/sync/pull` so the preview and the apply
// answer from the same comparison. They did not: the preview listed the DB
// row's own values with nothing compared, so it offered "3 changes" for a
// model already in sync, and read a different section of config.yaml than the
// pull it was previewing (T-0100, D13).
//
// No repository imports, deliberately. This is pure over two plain objects,
// which is what lets the pull route's narrow test doubles keep working.
// ═══════════════════════════════════════════════════════════════

import type { HermesConfigModelEntry } from "./hermes-config-read";

export interface ModelDiff {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ModelDiffResult {
  diffs: ModelDiff[];
  updates: Record<string, unknown>;
}

/**
 * The fields a pull would rewrite, and the patch that would do it.
 *
 * `modelId` and `provider` can only differ when the caller matched on
 * something other than the key; the pull matches by `provider::modelId`, so in
 * practice a real pull differs in `baseUrl` or `contextLength`. Both are kept
 * because the diff is also shown for a section found another way.
 */
export function diffModelAgainstHermes(
  model: {
    modelId: string;
    provider: string;
    baseUrl: string | null;
    contextLength: number | null;
  },
  hermes: HermesConfigModelEntry,
): ModelDiffResult {
  const diffs: ModelDiff[] = [];
  const updates: Record<string, unknown> = {};
  const pushDiff = (field: string, before: unknown, after: unknown) => {
    diffs.push({ field, before, after });
    updates[field] = after;
  };

  if (hermes.modelId && hermes.modelId !== model.modelId) {
    pushDiff("modelId", model.modelId, hermes.modelId);
  }
  if (hermes.provider && hermes.provider !== model.provider) {
    pushDiff("provider", model.provider, hermes.provider);
  }
  if (hermes.baseUrl !== model.baseUrl) {
    // "" rather than null, as the apply has always written it: an absent
    // base_url in Hermes clears the registry's, it does not null it.
    pushDiff("baseUrl", model.baseUrl, hermes.baseUrl ?? "");
  }
  if (hermes.contextLength != null && hermes.contextLength !== model.contextLength) {
    pushDiff("contextLength", model.contextLength, hermes.contextLength);
  }

  return { diffs, updates };
}

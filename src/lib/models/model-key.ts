// ═══════════════════════════════════════════════════════════════
// model-key — small helpers for the "provider::modelId" /
// "provider::modelIdString" composite keys used by the model and
// fallback import routes.
// ═══════════════════════════════════════════════════════════════
//
// The import routes dedupe rows across DB↔Hermes by a (provider, model) key.
// The fallback chain keys on `modelIdString` (the literal model name in the
// upstream provider's vocabulary, e.g. "gpt-4o") rather than `modelId`
// (PatterStage's internal model_id column), which is why two helpers produce
// the same string: the name says which table a key is for. The separator is
// never stored, only recomputed at lookup time.

/** Compose a `provider::modelId` key for the models table. */
export function modelKey(provider: string, modelId: string): string {
  return `${provider}::${modelId}`;
}

/**
 * Compose a `provider::modelIdString` key for the fallback chain.
 * `modelIdString` is the literal model identifier in the upstream
 * provider's vocabulary (e.g. "gpt-4o", "claude-3-5-sonnet"), which
 * is what the YAML `fallback_providers[].model` field stores.
 */
export function fallbackKey(
  provider: string,
  modelIdString: string,
): string {
  return `${provider}::${modelIdString}`;
}

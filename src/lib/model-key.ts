// ═══════════════════════════════════════════════════════════════
// model-key — small helpers for the "provider::modelId" /
// "provider::modelIdString" composite keys used by the model and
// fallback import routes.
// ═══════════════════════════════════════════════════════════════
//
// Background: 3 List 3 routes (models/import, models/sync/pull,
// models/fallbacks/import) repeatedly compose a lookup key from a
// (provider, modelId) pair to dedupe rows across DB↔Hermes imports:
//
//   `${entry.provider}::${entry.modelId}`      (9 sites, after
//   session-68 migration of sync-manager + modules/hermes/lib/config-sync +
//   sync/pull + modules/hermes/lib/config-import)
//
// The fallback chain has a sibling key:
//
//   `${entry.provider}::${entry.modelIdString}` (2 sites)
//
// — different second field name because the fallback chain stores
// the model identifier as `modelIdString` (the literal model name in
// the upstream provider's vocabulary, e.g. "gpt-4o") rather than
// `modelId` (PatterStage's internal model_id column).
//
// Each site was a 1-line template literal, but the same composite-key
// contract is repeated 7 times — bugs of the form "I added a
// `default_model::${provider}::${model}` variant and forgot to update
// the matching has() check" are easy to miss without a typed helper.
//
// Usage:
//   const k = modelKey("openai", "gpt-4o");  // "openai::gpt-4o"
//   const fk = fallbackKey("openai", "gpt-4o");  // "openai::gpt-4o"
//
// Both helpers are pure and dependency-free. The separator (`::`) is
// hard-coded to match the existing inline form; do not change it
// without auditing all DB rows (the separator is not stored, only
// recomputed at lookup time, so changing the helper is safe).
//
// Byte-equivalence contract:
//   modelKey("a", "b")     === "a::b"
//   fallbackKey("a", "b")  === "a::b"
// The 2 helpers produce the same string for the same inputs — they
// differ only in the typed name, which documents intent at the call
// site (a `fallbackKey` says "this key is for the fallback chain").

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

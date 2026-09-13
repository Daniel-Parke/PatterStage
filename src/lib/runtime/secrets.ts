// ═══════════════════════════════════════════════════════════════
// runtime/secrets.ts — Gateway bearer-key resolution + masking
//
// The Hermes API Server requires `Authorization: Bearer <API_SERVER_KEY>` on
// every request. Keys are NEVER returned from a list/GET API and must be
// masked in logs. Today the key comes from the environment; Phase 2 will
// resolve a per-profile key via the profile's `api_key_ref` (each Hermes
// profile gateway can have its own key), with rotation that does not require
// a PatterStage restart.
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve the bearer key for a profile's gateway. Returns null when no key is
 * configured (the caller then sends an unauthenticated request, which a
 * key-required gateway will reject with 401 — surfaced clearly to the user).
 *
 * `profileName` is retained but no longer consulted: it existed so ephemeral
 * benchmark gateways could present their own generated key, and that subsystem is
 * gone (org/decisions/ADR-0004). Keeping the parameter means a genuine per-profile key
 * scheme has somewhere to land without a signature change at 30-odd call sites.
 */
export function getGatewayKey(_profileName?: string): string | null {
  const key = process.env.API_SERVER_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

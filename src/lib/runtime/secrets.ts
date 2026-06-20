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

import { getBenchGatewayKey } from "./gateway-manager";

/**
 * Resolve the bearer key for a profile's gateway. Returns null when no key is
 * configured (the caller then sends an unauthenticated request, which a
 * key-required gateway will reject with 401 — surfaced clearly to the user).
 */
export function getGatewayKey(profileName?: string): string | null {
  // Ephemeral benchmark gateways carry their own generated key.
  if (profileName) {
    const benchKey = getBenchGatewayKey(profileName);
    if (benchKey) return benchKey;
  }
  const key = process.env.API_SERVER_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

/** Mask a key for logs/diagnostics — never log the raw value. */
export function maskKey(key: string | null | undefined): string {
  if (!key) return "(none)";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "****";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

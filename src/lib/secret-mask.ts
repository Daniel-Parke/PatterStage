// ═══════════════════════════════════════════════════════════════
// Secret masking helpers
// ═══════════════════════════════════════════════════════════════
//
// Centralised helpers for masking sensitive values before they leave
// the server. Both /api/config (model.api_key + auxiliary.<task>.api_key)
// and /api/models/import (credential keyHint) reuse these primitives.

/** Mask an API key for client display — show first 4 + last 4 chars, or "••••" if too short. */
export function maskApiKey(key: string): string {
  return key.length > 8 ? `${key.slice(0, 4)}••••${key.slice(-4)}` : "••••";
}

/** Mask an API key with literal "..." separator — used for the credential keyHint import preview. */
export function maskKeyHint(key: string): string {
  return key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : "••••";
}

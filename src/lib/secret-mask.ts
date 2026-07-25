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

// Env var names whose value must be FULLY hidden in the read-only .env preview —
// passwords, secrets, tokens, and private keys, where revealing even the first/
// last few chars leaks meaningful credential material. API keys are deliberately
// NOT in this set: their first4…last4 hint helps identify WHICH key is set
// without exposing a usable secret (a long random API key isn't reconstructable
// from 8 of its chars; a short password might be).
const FULLY_MASKED_ENV_NAME = /(pass(word|phrase)?|secret|token|priv(ate)?[_-]?key)/i;

/** Whether an .env var name should have its value fully hidden (no hint). */
export function isFullyMaskedEnvName(name: string): boolean {
  return FULLY_MASKED_ENV_NAME.test(name);
}

/**
 * Mask an .env value for the read-only preview. Password/secret/token/private-key
 * names are fully hidden; everything else keeps the first4…last4 hint so the user
 * can confirm a value is set without it being exposed.
 */
export function maskEnvValue(name: string, value: string): string {
  if (!value) return "";
  return isFullyMaskedEnvName(name) ? "••••••••" : maskKeyHint(value);
}

/**
 * Mask every value in a whole `.env` body, preserving comments, blank lines and
 * key order.
 *
 * This exists because masking used to happen ONLY in a React component
 * (EnvLineRow), while `GET /api/agent/files/env` returned the raw file — so
 * every API key, bot token and password left the server in plaintext to anyone
 * who called the endpoint instead of loading the page. Masking belongs on the
 * server: the client is not a security boundary.
 */
export function maskEnvFileContent(content: string): string {
  return content
    .split("\n")
    .map((line) => {
      const eq = line.indexOf("=");
      if (!line.trim() || line.trim().startsWith("#") || eq < 0) return line;
      const key = line.slice(0, eq).trim();
      const value = line
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      return `${key}=${maskEnvValue(key, value)}`;
    })
    .join("\n");
}

// ═══════════════════════════════════════════════════════════════
// Secret masking: values masked before they leave the server, shared by
// /api/config and /api/models/import (credential keyHint).
//
// AT THE LIB ROOT ON PURPOSE (C7, T-0144): the config layer, the logger and
// the API each mask with it, so it is owned by none of them and belongs to
// no domain.
// ═══════════════════════════════════════════════════════════════

/** Mask an API key for client display — show first 4 + last 4 chars, or "••••" if too short. */
export function maskApiKey(key: string): string {
  return key.length > 8 ? `${key.slice(0, 4)}••••${key.slice(-4)}` : "••••";
}

/** A key name that holds an API key: `api_key`, `apiKey`, `api-key`, any case. */
const API_KEY_NAME = /^api[_-]?key$/i;

/**
 * Mask every API key in a config object, at any depth. GET /api/config masked
 * two hand-listed shapes, so `fallback_providers[].api_key` left the server in
 * plaintext (T-0095, D74); a list of shapes drifts, a walk does not. Returns a
 * new structure; empty strings and non-strings are left alone, since inventing
 * a mask for `0` would misreport what is configured.
 */
export function maskSecretsDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => maskSecretsDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] =
        API_KEY_NAME.test(key) && typeof inner === "string" && inner.length > 0
          ? maskApiKey(inner)
          : maskSecretsDeep(inner);
    }
    return out as T;
  }
  return value;
}

/** Mask an API key with literal "..." separator — used for the credential keyHint import preview. */
export function maskKeyHint(key: string): string {
  return key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : "••••";
}

// Env names whose value is FULLY hidden in the .env preview: passwords, secrets,
// tokens and private keys, where even the first/last chars leak. API keys are
// NOT here: their first4…last4 hint identifies WHICH key is set, and a long
// random key is not reconstructable from 8 chars where a short password might be.
const FULLY_MASKED_ENV_NAME = /(pass(word|phrase)?|secret|token|priv(ate)?[_-]?key)/i;

/** Whether an .env var name should have its value fully hidden (no hint). */
export function isFullyMaskedEnvName(name: string): boolean {
  return FULLY_MASKED_ENV_NAME.test(name);
}

/** Mask an .env value for the preview: fully hidden for the names above, first4…last4 otherwise. */
export function maskEnvValue(name: string, value: string): string {
  if (!value) return "";
  return isFullyMaskedEnvName(name) ? "••••••••" : maskKeyHint(value);
}

/**
 * Mask every value in a `.env` body, keeping comments, blank lines and order.
 * Masking used to happen ONLY in EnvLineRow while `GET /api/agent/files/env`
 * returned the raw file, so every key and token left the server in plaintext
 * to anyone calling the endpoint. The client is not a security boundary.
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

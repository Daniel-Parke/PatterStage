// ═══════════════════════════════════════════════════════════════
// auth-token.ts — the single-operator access token
//
// Scripts use the operator token as Bearer. Browsers use revocable sessions.
// ═══════════════════════════════════════════════════════════════

import { randomBytes, timingSafeEqual } from "crypto";
import { mkdirSync, readFileSync, writeFileSync } from "fs";

import { OWNER_ONLY_DIR, OWNER_ONLY_FILE, restrictToOwner } from "@/lib/fs/fs-helpers";

import { PS_DATA_DIR, readEnv } from "@/lib/host/paths";

export const SESSION_COOKIE = "ps_session";
export const TOKEN_QUERY_PARAM = "ps_token";

/**
 * `token` (default) requires the shared secret on every request. `none`
 * disables the check entirely and is only correct when something else in front
 * of PatterStage already authenticates — it is logged loudly at boot.
 */
export type AuthMode = "token" | "none";

export function getAuthMode(): AuthMode {
  return readEnv("PS_AUTH_MODE")?.toLowerCase() === "none" ? "none" : "token";
}

function getAuthTokenPath(): string {
  return readEnv("PS_AUTH_TOKEN_FILE") ?? PS_DATA_DIR + "/auth-token";
}

/** Report the active token source without exposing its value. */
export function describeTokenSource(): { kind: "env" | "file"; location: string } {
  if (readEnv("PS_AUTH_TOKEN")) return { kind: "env", location: "PS_AUTH_TOKEN" };
  return { kind: "file", location: getAuthTokenPath() };
}

/** The active token; the environment value takes precedence over the file. */
export function readAuthToken(): string | null {
  const fromEnv = readEnv("PS_AUTH_TOKEN");
  if (fromEnv) return fromEnv;

  const path = getAuthTokenPath();
  try {
    // Read on every request: replacement may preserve size and timestamp.
    const token = readFileSync(path, "utf-8").trim();
    if (!token) return null;
    return token;
  } catch {
    return null;
  }
}

/**
 * Mint the token file if it does not exist yet and return the active token.
 * Called from instrumentation at boot, so an existing install that has never
 * had a token gets one automatically instead of locking the operator out.
 */
export function ensureAuthToken(): string {
  const existing = readAuthToken();
  if (existing) return existing;

  const token = randomBytes(32).toString("base64url");
  const path = getAuthTokenPath();
  const dir = path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
  mkdirSync(dir, { recursive: true });
  // The file was already 0600, but a readable directory shows every name in it,
  // and this one is created at the default umask (critic-03b).
  restrictToOwner(dir, OWNER_ONLY_DIR);
  writeFileSync(path, token + "\n", { encoding: "utf-8", mode: OWNER_ONLY_FILE });
  restrictToOwner(path, OWNER_ONLY_FILE);
  return token;
}

/** Constant-time comparison that never throws on a length mismatch. */
export function tokenMatches(supplied: string | null | undefined, expected: string | null): boolean {
  if (!supplied || !expected) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ═══════════════════════════════════════════════════════════════
// auth-token.ts — the single-operator access token
//
// PatterStage is a single-operator control plane, so authentication is one
// shared secret rather than a user table: a random token minted at first boot
// into PS_DATA_DIR/auth-token (mode 0600). Every request is checked against it
// in src/proxy.ts — NOT in route handlers.
//
// Two ways to present it:
//   • `Authorization: Bearer <token>`  — scripts, curl, the deploy runner.
//   • the `ps_session` cookie          — the browser, set by the proxy after a
//     one-time `?ps_token=<token>` hand-off (the Jupyter model).
//
// Deliberately NOT a password/login: there is no user to name, and a login form
// would imply an account system this app does not have and should not grow.
// ═══════════════════════════════════════════════════════════════

import { randomBytes, timingSafeEqual } from "crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "fs";

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

export function getAuthTokenPath(): string {
  return readEnv("PS_AUTH_TOKEN_FILE") ?? PS_DATA_DIR + "/auth-token";
}

/**
 * Where the ACTIVE token actually comes from, resolved the same way
 * `readAuthToken()` resolves it.
 *
 * The 401 page used to say "the token lives in PS_DATA_DIR/auth-token", which
 * is the name of a variable, not a place: a first-time user who lost the boot
 * line has no way to expand it. This returns the real answer for the install in
 * front of them, including the container case where the file is not read at all
 * because `PS_AUTH_TOKEN` won.
 */
export function describeTokenSource(): { kind: "env" | "file"; location: string } {
  if (readEnv("PS_AUTH_TOKEN")) return { kind: "env", location: "PS_AUTH_TOKEN" };
  return { kind: "file", location: getAuthTokenPath() };
}

// The token is read on every request, so cache it and re-read only when the
// file's mtime/size changes (statSync is cheap; a rotated token takes effect
// without a restart).
let cached: { token: string; mtimeMs: number; size: number } | null = null;

/**
 * The active token, or null when none is configured. `PS_AUTH_TOKEN` wins so a
 * container can inject it without a writable data dir.
 */
export function readAuthToken(): string | null {
  const fromEnv = readEnv("PS_AUTH_TOKEN");
  if (fromEnv) return fromEnv;

  const path = getAuthTokenPath();
  try {
    const stat = statSync(path);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      return cached.token;
    }
    const token = readFileSync(path, "utf-8").trim();
    if (!token) return null;
    cached = { token, mtimeMs: stat.mtimeMs, size: stat.size };
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
  cached = null;
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

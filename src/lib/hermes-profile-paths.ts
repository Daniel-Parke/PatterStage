// ═══════════════════════════════════════════════════════════════
// hermes-profile-paths.ts — Default root + per-profile HERMES_HOME
// Mirrors upstream hermes_constants.get_default_hermes_root()
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { basename, join, relative, resolve } from "path";

import { buildHermesPathBundle, normPath, type HermesPathBundle } from "./hermes-paths";
import { getHermesHome } from "./hermes-home";

const NATIVE_HERMES_HOME = join(homedir(), ".hermes");

function isPathUnderRoot(absolutePath: string, root: string): boolean {
  const R = resolve(root);
  const C = resolve(absolutePath);
  if (C === R) return true;
  const rel = relative(R, C);
  return rel !== "" && !rel.startsWith("..") && !rel.includes("..");
}

/**
 * True when `home` is a named profile directory (`.../profiles/<name>`).
 */
export function isProfileHermesHome(home: string): boolean {
  const resolved = resolve(normPath(home));
  return basename(resolve(resolved, "..")) === "profiles";
}

/** Profile segment when `home` is `.../profiles/<name>`, else null. */
export function getProfileNameFromHermesHome(home: string): string | null {
  if (!isProfileHermesHome(home)) return null;
  return basename(normPath(home));
}

/**
 * Root Hermes directory from an explicit home path (profile-as-home or install root).
 * Mirrors upstream hermes_constants.get_default_hermes_root().
 */
export function getHermesDefaultRootFromHome(home: string): string {
  const envPath = resolve(normPath(home));

  if (isPathUnderRoot(envPath, NATIVE_HERMES_HOME)) {
    return resolve(NATIVE_HERMES_HOME);
  }

  if (basename(resolve(envPath, "..")) === "profiles") {
    return resolve(envPath, "..", "..");
  }

  return envPath;
}

/**
 * Root Hermes directory for profile listing (native ~/.hermes or Docker /opt/data).
 * Differs from getHermesHome() when env points at a profile-as-home path.
 */
export function getHermesDefaultRoot(): string {
  const envHome = process.env.HERMES_HOME || process.env.AGENT_HOME;
  if (!envHome || !String(envHome).trim()) {
    return NATIVE_HERMES_HOME;
  }
  return getHermesDefaultRootFromHome(String(envHome).trim());
}

/**
 * Read sticky default profile name from `active_profile` (Hermes CLI).
 */
export function readHermesActiveProfile(defaultRoot?: string): string | null {
  const root = defaultRoot ?? getHermesDefaultRoot();
  const path = join(root, "active_profile");
  if (!existsSync(path)) return null;
  try {
    const name = readFileSync(path, "utf-8").trim();
    return name && name !== "default" ? name : null;
  } catch {
    return null;
  }
}

/**
 * Filesystem root for a profile's Hermes state (full HERMES_HOME for subprocesses).
 */
export function resolveProfileHermesHome(profileName: string): string {
  const profile = (profileName || "default").trim() || "default";
  const envHome = normPath(getHermesHome());
  const defaultRoot = getHermesDefaultRoot();

  if (profile === "default") {
    if (isProfileHermesHome(envHome)) {
      return defaultRoot;
    }
    return envHome;
  }

  if (isProfileHermesHome(envHome)) {
    const activeName = getProfileNameFromHermesHome(envHome);
    if (activeName === profile) {
      return envHome;
    }
  }

  return join(defaultRoot, "profiles", profile);
}

/** Path bundle for a specific profile (or current env home for default). */
export function buildProfileHermesPathBundle(profileName: string): HermesPathBundle {
  return buildHermesPathBundle(resolveProfileHermesHome(profileName));
}

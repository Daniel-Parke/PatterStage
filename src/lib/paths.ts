// ═══════════════════════════════════════════════════════════════
// paths.ts — PatterStage data directories + env resolution
// ═══════════════════════════════════════════════════════════════
// Hermes install paths: use getActiveHermesPaths() / getActiveHermesHome()
// from @/lib/hermes-agent-runtime (active agent registry).
//
// Canonical env vars and exported symbols are PS_* (PatterStage). The legacy
// CH_* / CONTROL_HUB_* env-var names are still read as fallbacks (below) so
// existing installs keep working before they migrate.

import { homedir } from "os";
import { existsSync } from "fs";

// ── Env helper ──────────────────────────────────────────────────
/** Return the first non-empty value among the given env keys (new name first,
 *  legacy aliases after). Lets PS_ vars supersede the CH_ and CONTROL_HUB_
 *  fallbacks transparently. */
export function readEnv(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return undefined;
}

// ── PatterStage data root ───────────────────────────────────────
function normalizeDirPath(dir: string): string {
  return dir.replace(/[/\\]+$/, "");
}

/**
 * Resolve the data dir: explicit env (PS_DATA_DIR → CH_DATA_DIR →
 * CONTROL_HUB_DATA_DIR) wins; otherwise default to ~/patterstage/data, but
 * fall back to a pre-existing legacy ~/control-hub/data so an un-migrated
 * install keeps reading its data.
 */
export function getPsDataDir(): string {
  const raw = readEnv("PS_DATA_DIR", "CH_DATA_DIR", "CONTROL_HUB_DATA_DIR");
  if (raw) return normalizeDirPath(raw);
  const next = normalizeDirPath(homedir() + "/patterstage/data");
  const legacy = normalizeDirPath(homedir() + "/control-hub/data");
  if (!existsSync(next) && existsSync(legacy)) return legacy;
  return next;
}

export const PS_DATA_DIR = getPsDataDir();

/**
 * Resolve the SQLite DB path inside a data dir: prefer patterstage.db, but
 * fall back to a pre-existing control-hub.db in the same dir so the on-disk
 * rename is an optimisation (done by the update migration), not a correctness
 * requirement.
 */
export function getDbPath(dir: string = PS_DATA_DIR): string {
  const next = dir + "/patterstage.db";
  const legacy = dir + "/control-hub.db";
  if (!existsSync(next) && existsSync(legacy)) return legacy;
  return next;
}

/** Hardware cron scripts (PatterStage–managed; never under Hermes home). */
export function getPsScriptsDir(): string {
  // PS_SCRIPTS_DIR is canonical; CH_SCRIPTS_DIR is a legacy back-compat alias.
  const raw = readEnv("PS_SCRIPTS_DIR", "CH_SCRIPTS_DIR");
  if (raw) return normalizeDirPath(raw);
  return PS_DATA_DIR + "/scripts";
}

/** Hardware cron logs and PatterStage-local log artifacts. */
export function getPsHardwareLogDir(): string {
  // PS_HARDWARE_LOG_DIR is canonical; CH_HARDWARE_LOG_DIR is a legacy alias.
  const raw = readEnv("PS_HARDWARE_LOG_DIR", "CH_HARDWARE_LOG_DIR");
  if (raw) return normalizeDirPath(raw);
  return PS_DATA_DIR + "/logs";
}

// ── PatterStage–owned paths only ─────────────────────────────────

export const PATHS = {
  patterStageDb: getDbPath(),
  missions: PS_DATA_DIR + "/missions",
  templates: PS_DATA_DIR + "/templates",
  stories: PS_DATA_DIR + "/stories",
  recroom: PS_DATA_DIR + "/recroom",
  workspaces: PS_DATA_DIR + "/workspaces",
  auditLog: PS_DATA_DIR + "/audit",
  psScripts: getPsScriptsDir(),
  psHardwareLogs: getPsHardwareLogDir(),
} as const;


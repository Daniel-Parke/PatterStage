// ═══════════════════════════════════════════════════════════════
// paths.ts — PatterStage data directories + env resolution
// ═══════════════════════════════════════════════════════════════
// Hermes install paths: use getActiveHermesPaths() / getActiveHermesHome()
// from @/lib/hermes-agent-runtime (active agent registry).
//
// Canonical env vars are PS_* (PatterStage). The legacy CH_* / CONTROL_HUB_*
// names are still read as fallbacks so existing installs keep working before
// they migrate. The internal symbol `CH_DATA_DIR` keeps its historical name
// (it's an internal abbreviation, not a user-facing identifier; renaming it
// would churn ~14 importers for no behavioural change).

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

/** Back-compat alias for the historical name. */
export const getChDataDir = getPsDataDir;

export const CH_DATA_DIR = getPsDataDir();

/**
 * Resolve the SQLite DB path inside a data dir: prefer patterstage.db, but
 * fall back to a pre-existing control-hub.db in the same dir so the on-disk
 * rename is an optimisation (done by the update migration), not a correctness
 * requirement.
 */
export function getDbPath(dir: string = CH_DATA_DIR): string {
  const next = dir + "/patterstage.db";
  const legacy = dir + "/control-hub.db";
  if (!existsSync(next) && existsSync(legacy)) return legacy;
  return next;
}

/** Hardware cron scripts (PatterStage–managed; never under Hermes home). */
export function getChScriptsDir(): string {
  const raw = readEnv("PS_SCRIPTS_DIR", "CH_SCRIPTS_DIR");
  if (raw) return normalizeDirPath(raw);
  return CH_DATA_DIR + "/scripts";
}

/** Hardware cron logs and hub-local log artifacts. */
export function getChHardwareLogDir(): string {
  const raw = readEnv("PS_HARDWARE_LOG_DIR", "CH_HARDWARE_LOG_DIR");
  if (raw) return normalizeDirPath(raw);
  return CH_DATA_DIR + "/logs";
}

// ── PatterStage–owned paths only ─────────────────────────────────

export const PATHS = {
  patterStageDb: getDbPath(),
  missions: CH_DATA_DIR + "/missions",
  templates: CH_DATA_DIR + "/templates",
  stories: CH_DATA_DIR + "/stories",
  recroom: CH_DATA_DIR + "/recroom",
  workspaces: CH_DATA_DIR + "/workspaces",
  auditLog: CH_DATA_DIR + "/audit",
  chScripts: getChScriptsDir(),
  chHardwareLogs: getChHardwareLogDir(),
} as const;

// ── YAML config reader (generic; used on arbitrary YAML content) ─

import * as yaml from "js-yaml";

export function getConfigValue(content: string, dottedKey: string): string {
  try {
    const parsed = yaml.load(content) as Record<string, unknown>;
    const keys = dottedKey.split(".");
    let current: unknown = parsed;
    for (const key of keys) {
      if (typeof current !== "object" || current === null) return "";
      current = (current as Record<string, unknown>)[key];
    }
    return typeof current === "string" ? current : current != null ? String(current) : "";
  } catch {
    return "";
  }
}

// ── Discord home channel ───────────────────────────────────────

export function getDiscordHomeChannel(envContent: string): string {
  const match = envContent.match(/^DISCORD_HOME_CHANNEL=(.+)$/m);
  if (match) return match[1].trim().replace(/^['"]|['"]$/g, "");
  return "";
}

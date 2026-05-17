// ═══════════════════════════════════════════════════════════════
// paths.ts — Control Hub data directories (CH_DATA_DIR only)
// ═══════════════════════════════════════════════════════════════
// Hermes install paths: use getActiveHermesPaths() / getActiveHermesHome()
// from @/lib/hermes-agent-runtime (active agent registry).

import { homedir } from "os";

// ── Control Hub data root ───────────────────────────────────────
function normalizeDirPath(dir: string): string {
  return dir.replace(/[/\\]+$/, "");
}

export function getChDataDir(): string {
  const raw = process.env.CH_DATA_DIR || process.env.CONTROL_HUB_DATA_DIR;
  if (raw && String(raw).trim()) {
    return normalizeDirPath(String(raw).trim());
  }
  return normalizeDirPath(homedir() + "/control-hub/data");
}

export const CH_DATA_DIR = getChDataDir();

/** Hardware cron scripts (Control Hub–managed; never under Hermes home). */
export function getChScriptsDir(): string {
  const raw = process.env.CH_SCRIPTS_DIR;
  if (raw && String(raw).trim()) {
    return normalizeDirPath(String(raw).trim());
  }
  return CH_DATA_DIR + "/scripts";
}

/** Hardware cron logs and hub-local log artifacts. */
export function getChHardwareLogDir(): string {
  const raw = process.env.CH_HARDWARE_LOG_DIR;
  if (raw && String(raw).trim()) {
    return normalizeDirPath(String(raw).trim());
  }
  return CH_DATA_DIR + "/logs";
}

// ── Control Hub–owned paths only ─────────────────────────────────

export const PATHS = {
  controlHubDb: CH_DATA_DIR + "/control-hub.db",
  missions: CH_DATA_DIR + "/missions",
  templates: CH_DATA_DIR + "/templates",
  stories: CH_DATA_DIR + "/stories",
  recroom: CH_DATA_DIR + "/recroom",
  workspaces: CH_DATA_DIR + "/workspaces",
  // teams: CH_DATA_DIR + "/teams",  // removed — replaced by Hermes kanban
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

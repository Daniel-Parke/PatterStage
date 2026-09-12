// ═══════════════════════════════════════════════════════════════
// paths.ts — PatterStage data directories + env resolution
// ═══════════════════════════════════════════════════════════════
// Hermes install paths: use getActiveHermesPaths() / getActiveHermesHome()
// from @/modules/hermes/lib/agent-runtime (active agent registry).
//
// Canonical env vars and exported symbols are PS_* (PatterStage). The legacy
// CH_* / CONTROL_HUB_* env-var names are still read as fallbacks (below) so
// existing installs keep working before they migrate.

import { homedir } from "os";
import { existsSync, statSync } from "fs";

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

/** True if `dir` already contains a PatterStage SQLite DB (either name). */
function dirHasDb(dir: string): boolean {
  return existsSync(dir + "/patterstage.db") || existsSync(dir + "/control-hub.db");
}

/**
 * Candidate data dirs under `home`, in priority order. Includes the canonical
 * uppercase `PatterStage` (matches the repo name + is case-sensitive on Linux),
 * the lowercase default, and the pre-rename `control-hub` legacy.
 */
function dataDirCandidates(home: string): string[] {
  return [
    home + "/PatterStage/data",
    home + "/patterstage/data",
    home + "/control-hub/data",
  ].map(normalizeDirPath);
}

/**
 * Pure, testable data-dir discovery (used when no env var is set). A dir that
 * already holds a populated DB wins over creating/opening an empty one — this
 * is the fix for the "freshly-created empty dir wins the existence race and the
 * server opens a brand-new empty DB beside the real one" bug. Falls back to the
 * first existing candidate, else the canonical lowercase default.
 */
export function resolveDataDir(
  home: string,
  hasDb: (dir: string) => boolean = dirHasDb,
  dirExists: (dir: string) => boolean = existsSync,
): string {
  const candidates = dataDirCandidates(home);
  return (
    candidates.find(hasDb) ??
    candidates.find(dirExists) ??
    normalizeDirPath(home + "/patterstage/data")
  );
}

/**
 * Resolve the data dir: an explicit env var (PS_DATA_DIR → CH_DATA_DIR →
 * CONTROL_HUB_DATA_DIR) always wins (set it once and resolution is never
 * guessed). Otherwise discover an existing populated data dir before defaulting
 * (see resolveDataDir) so we never silently open an empty DB.
 */
export function getPsDataDir(): string {
  const raw = readEnv("PS_DATA_DIR", "CH_DATA_DIR", "CONTROL_HUB_DATA_DIR");
  if (raw) return normalizeDirPath(raw);
  return resolveDataDir(homedir());
}

export const PS_DATA_DIR = getPsDataDir();

function fileSize(p: string): number {
  try {
    return statSync(p).size;
  } catch {
    return -1;
  }
}

/**
 * Resolve the SQLite DB path inside a data dir: prefer patterstage.db, but fall
 * back to a pre-existing control-hub.db so the on-disk rename is an optimisation
 * (done by the update migration), not a correctness requirement. When BOTH
 * exist, prefer the one with data (larger file) so a stale empty patterstage.db
 * never shadows a populated control-hub.db; ties resolve to the canonical name.
 */
export function getDbPath(dir: string = PS_DATA_DIR): string {
  const next = dir + "/patterstage.db";
  const legacy = dir + "/control-hub.db";
  const nextEx = existsSync(next);
  const legEx = existsSync(legacy);
  if (nextEx && legEx) return fileSize(legacy) > fileSize(next) ? legacy : next;
  if (!nextEx && legEx) return legacy;
  return next;
}

/**
 * Diagnostic for boot: returns a warning string when the active DB looks empty
 * but a sibling candidate dir holds a clearly larger (populated) DB — i.e. we
 * may be reading the wrong database. Returns null when all is well. Cheap
 * (stat only); the caller logs it.
 */
export function shadowedDataWarning(activeDir: string = PS_DATA_DIR): string | null {
  // The warning exists for the discovery case, where the directory was
  // guessed. When the operator chose it there is nothing to warn about, and
  // "set PS_DATA_DIR explicitly" is wrong advice on an instance that did
  // (T-0092, finding F).
  if (readEnv("PS_DATA_DIR", "CH_DATA_DIR", "CONTROL_HUB_DATA_DIR")) return null;
  const activeDb = getDbPath(activeDir);
  const activeSize = fileSize(activeDb);
  for (const cand of dataDirCandidates(homedir())) {
    if (normalizeDirPath(cand) === normalizeDirPath(activeDir)) continue;
    if (!dirHasDb(cand)) continue;
    const candSize = fileSize(getDbPath(cand));
    // A sibling DB at least 256 KB larger than the active one is suspicious.
    if (candSize - activeSize > 256 * 1024) {
      return `Active DB ${activeDb} (${Math.round(activeSize / 1024)} KB) looks emptier than ${getDbPath(cand)} (${Math.round(candSize / 1024)} KB). Set PS_DATA_DIR explicitly if this is the wrong directory.`;
    }
  }
  return null;
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


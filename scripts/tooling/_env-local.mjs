// _env-local.mjs — load PatterStage .env.local (plain ESM). Mirrors
// scripts/lib/ps-dotenv-local.sh: only whitelisted keys are exported, and a
// legacy CH_* key is bridged to its PS_* name (an explicit PS_ wins).

import { existsSync, readFileSync } from "fs";
import { join } from "path";

const WHITELIST = /^(PS_[A-Z0-9_]+|CH_[A-Z0-9_]+|INSTALL_HERMES_[A-Z0-9_]+|HERMES_HOME)$/;
const NONBLANK_KEYS = new Set([
  "SCRIPTS_DIR", "ENABLE_DEPLOY_API",
  "REQUEST_SIGNING_SECRET", "READ_ONLY",
]);
const SUPPORTED_LEGACY_NAMES = new Set([
  "CH_DATA_DIR", "CH_SCRIPTS_DIR", "CH_HARDWARE_LOG_DIR", "CH_ENABLE_DEPLOY_API",
  "CH_REQUEST_SIGNING_SECRET", "CH_READ_ONLY", "CH_RUN_MAX_MINUTES",
  "CH_UPDATE_GIT_BRANCH", "CH_PULL_RECONCILE_DISK", "CH_ALLOWED_DEV_ORIGINS",
]);
let warnedAboutLegacyBridge = false;

function selectsValue(key, value) {
  return NONBLANK_KEYS.has(key.replace(/^(?:PS|CH)_/, ""))
    ? Boolean(value?.trim())
    : Boolean(value);
}

function effectiveLegacyValue(key, value) {
  switch (key) {
    case "CH_DATA_DIR": return Boolean(value.trim()); // deploy discovery ignores a blank path
    case "CH_ENABLE_DEPLOY_API": return ["1", "true", "yes", "0", "false", "no"].includes(value.trim().toLowerCase());
    case "CH_READ_ONLY": return ["1", "true"].includes(value.trim().toLowerCase());
    case "CH_RUN_MAX_MINUTES": return Boolean(Number(value));
    case "CH_PULL_RECONCILE_DISK": return value === "1";
    case "CH_ALLOWED_DEV_ORIGINS": return value.split(",").some((entry) => Boolean(entry.trim().replace(/^https?:\/\//, "")));
    default: return true;
  }
}

/** Parse `.env.local` into a {key:value} map (CR-stripped; comments skipped). */
export function parseEnvLocal(dir) {
  const out = {};
  if (!dir) return out;
  const file = join(dir, ".env.local");
  if (!existsSync(file)) return out;
  for (let line of readFileSync(file, "utf-8").split("\n")) {
    line = line.replace(/\r$/, "");
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    out[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return out;
}

/** Export whitelisted keys into process.env; bridge CH_* → PS_*. */
export function loadEnvLocal(dir) {
  const map = parseEnvLocal(dir);
  const inherited = { ...process.env };
  for (const [key, val] of Object.entries(map)) {
    if (!WHITELIST.test(key)) continue;
    process.env[key] = val;
    if (key.startsWith("CH_")) {
      const psKey = "PS_" + key.slice(3);
      if (!process.env[psKey]) {
        process.env[psKey] = val;
      }
    }
  }
  // Select from the final source values, not the bridged PS_* copy: a later
  // empty canonical line restores a CH_* fallback, and an inherited CH_* can
  // win even when there was no .env.local file to parse.
  const names = [];
  for (const chKey of SUPPORTED_LEGACY_NAMES) {
    const psKey = `PS_${chKey.slice(3)}`;
    const canonical = Object.hasOwn(map, psKey) ? map[psKey] : inherited[psKey];
    const legacy = process.env[chKey];
    // Only the data-dir consumer reads inherited CH_* directly. Other script
    // aliases reach their PS_* readers through an explicit .env.local line.
    if ((chKey === "CH_DATA_DIR" || Object.hasOwn(map, chKey))
      && !selectsValue(psKey, canonical) && selectsValue(chKey, legacy)
      && effectiveLegacyValue(chKey, legacy)) names.push(`${chKey} → ${psKey}`);
  }
  const canonicalData = Object.hasOwn(map, "PS_DATA_DIR") ? map.PS_DATA_DIR : inherited.PS_DATA_DIR;
  const controlData = process.env.CONTROL_HUB_DATA_DIR;
  if (!selectsValue("PS_DATA_DIR", canonicalData) && !selectsValue("CH_DATA_DIR", process.env.CH_DATA_DIR)
    && selectsValue("CONTROL_HUB_DATA_DIR", controlData) && controlData.trim()) {
    names.push("CONTROL_HUB_DATA_DIR → PS_DATA_DIR");
  }
  if (!warnedAboutLegacyBridge && names.length > 0) {
    console.warn(`[config] Pre-rename configuration selected: ${names.join(", ")}. These names work through v1.0.0 and retire in the first later release; move to the named replacements.`);
    warnedAboutLegacyBridge = true;
  }
  return map;
}

/** Read a single raw value from .env.local without exporting (e.g. PORT). */
export function readEnvLocalValue(dir, key) {
  const v = parseEnvLocal(dir)[key];
  return v && v.trim() ? v.trim() : undefined;
}

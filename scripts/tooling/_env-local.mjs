// _env-local.mjs — load PatterStage .env.local (plain ESM). Mirrors
// scripts/lib/ps-dotenv-local.sh: only whitelisted keys are exported, and a
// legacy CH_* key is bridged to its PS_* name (an explicit PS_ wins).

import { existsSync, readFileSync } from "fs";
import { join } from "path";

const WHITELIST = /^(PS_[A-Z0-9_]+|CH_[A-Z0-9_]+|INSTALL_HERMES_[A-Z0-9_]+|HERMES_HOME)$/;

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
  for (const [key, val] of Object.entries(map)) {
    if (!WHITELIST.test(key)) continue;
    process.env[key] = val;
    if (key.startsWith("CH_")) {
      const psKey = "PS_" + key.slice(3);
      if (!process.env[psKey]) process.env[psKey] = val;
    }
  }
  return map;
}

/** Read a single raw value from .env.local without exporting (e.g. PORT). */
export function readEnvLocalValue(dir, key) {
  const v = parseEnvLocal(dir)[key];
  return v && v.trim() ? v.trim() : undefined;
}

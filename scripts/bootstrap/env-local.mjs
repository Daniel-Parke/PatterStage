// ═══════════════════════════════════════════════════════════════
// env-local.mjs — the .env.local reader/writer used by setup.mjs
// ═══════════════════════════════════════════════════════════════
// Split out of setup.mjs so the writer can be exercised against a temp file
// (tests/scripts/run-shell-custom-tests.sh) instead of only against the repo's
// real .env.local, which is the operator's live config and must never be a test
// fixture. The behaviour is the bash ps_env_set contract, in Node:
//
//   - a value containing a newline is refused, because it is not a dotenv value
//     but a captured stream (see scripts/lib/ps-port.sh for how one got in);
//   - a key that is not an identifier is refused;
//   - the rewrite keeps blank lines, comments and KEY=VALUE lines and drops
//     everything else, so orphan lines left by an earlier corrupt write are
//     cleaned up rather than preserved for ever.
//
// Multi-line quoted values are not supported and never were: readEnvFile below
// and ps_load_patterstage_env_local both parse strictly line by line.

import { existsSync, readFileSync, writeFileSync } from "fs";

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ASSIGN_RE = /^[A-Za-z_][A-Za-z0-9_]*=/;

/** True when `line` is something a dotenv parser can make sense of. */
export function isDotenvLine(line) {
  const l = line.replace(/\r$/, "");
  return l.trim() === "" || l.startsWith("#") || ASSIGN_RE.test(l);
}

/** Read a dotenv file into a plain object. Missing file → {}. */
export function readEnvFile(file) {
  const map = {};
  if (!existsSync(file)) return map;
  for (let line of readFileSync(file, "utf-8").split("\n")) {
    line = line.replace(/\r$/, "");
    const eq = line.indexOf("=");
    if (eq > 0 && !line.startsWith("#")) map[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return map;
}

/**
 * Set `key=val` in a dotenv file: drop prior `key=` lines and any orphan line,
 * then append one. Throws rather than writing something a reader cannot parse.
 */
export function setEnvVar(file, key, val) {
  if (!KEY_RE.test(String(key))) {
    throw new Error(`refusing to write a key that is not an identifier: ${key}`);
  }
  const value = String(val);
  if (/[\r\n]/.test(value)) {
    throw new Error(
      `refusing to write a multi-line value for ${key}: ` +
        `a newline in a dotenv value means a captured stream, not a value ` +
        `(first line: ${value.split(/[\r\n]/)[0]})`,
    );
  }
  const existing = existsSync(file) ? readFileSync(file, "utf-8").split("\n") : [];
  const kept = existing.filter(
    (l) => l.trim() !== "" && isDotenvLine(l) && !l.replace(/\r$/, "").startsWith(`${key}=`),
  );
  kept.push(`${key}=${value}`);
  writeFileSync(file, kept.join("\n") + "\n");
}

/**
 * Set `key=val` only when the file has no `key=` line yet. Returns true when it
 * wrote. The bash twin is `ps_env_set_if_absent` in scripts/lib/ps-env.sh: a
 * default a fresh install should get, and a choice a re-run must never undo
 * (decision 17, T-0095).
 */
export function setEnvVarIfAbsent(file, key, val) {
  if (Object.prototype.hasOwnProperty.call(readEnvFile(file), String(key))) return false;
  setEnvVar(file, key, val);
  return true;
}

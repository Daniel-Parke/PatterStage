#!/usr/bin/env node
/**
 * Detect the local Hermes install and write PS_DATA_DIR/hermes-detection.json.
 * Canonical layout: HERMES_HOME (default ~/.hermes) + HERMES_HOME/hermes-agent/
 */
import { existsSync, mkdirSync, readdirSync } from "fs";
import { homedir } from "os";
import { basename, join, resolve } from "path";

function normalizeDir(d) {
  return String(d || "").replace(/[/\\]+$/, "");
}

function getPsDataDir() {
  const raw = process.env.PS_DATA_DIR || process.env.CH_DATA_DIR || process.env.CONTROL_HUB_DATA_DIR;
  if (raw && String(raw).trim()) return normalizeDir(String(raw).trim());
  return normalizeDir(join(homedir(), "control-hub", "data"));
}

function getHermesHome() {
  const envHome = process.env.HERMES_HOME || process.env.AGENT_HOME;
  if (envHome && String(envHome).trim()) return normalizeDir(String(envHome).trim());
  return join(homedir(), ".hermes");
}

function isPathUnderRoot(child, root) {
  const C = resolve(child);
  const R = resolve(root);
  if (C === R) return true;
  const rel = C.slice(R.length).replace(/^[/\\]+/, "");
  return rel.length > 0 && !rel.startsWith("..") && !rel.includes("..");
}

function getHermesDefaultRootFromHome(home) {
  const native = join(homedir(), ".hermes");
  const envPath = resolve(home);
  if (isPathUnderRoot(envPath, native)) return resolve(native);
  if (basename(resolve(envPath, "..")) === "profiles") {
    return resolve(envPath, "..", "..");
  }
  return envPath;
}

function isProfileHermesHome(home) {
  return basename(resolve(home, "..")) === "profiles";
}

function getHermesAgentPackageDir(home) {
  const defaultRoot = getHermesDefaultRootFromHome(home);
  return join(defaultRoot, "hermes-agent");
}

function resolveHermesAgentPackage(home) {
  const pkg = getHermesAgentPackageDir(home);
  if (existsSync(join(pkg, "cron", "jobs.py"))) return resolve(pkg);
  return null;
}

function legacyInstallDetected() {
  return existsSync(join(homedir(), ".local", "share", "hermes-agent"));
}

const home = getHermesHome();
const defaultRoot = getHermesDefaultRootFromHome(home);
const canonicalAgentPackage = resolve(getHermesAgentPackageDir(home));
const hasConfigYaml = existsSync(join(home, "config.yaml"));
const hasHermesMd = existsSync(join(home, "HERMES.md"));
const isValidHermesRoot = hasConfigYaml || hasHermesMd;
const profileHome = isProfileHermesHome(home);
const hermesAgentPath = resolveHermesAgentPackage(home);
const legacyDetected = legacyInstallDetected();

let profileCount = 0;
const profilesDir = join(defaultRoot, "profiles");
if (existsSync(profilesDir)) {
  try {
    for (const name of readdirSync(profilesDir)) {
      if (existsSync(join(profilesDir, name, "config.yaml"))) profileCount++;
    }
  } catch {
    /* ignore */
  }
}

const outDir = getPsDataDir();
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "hermes-detection.json");
const doc = {
  version: 3,
  generatedAt: new Date().toISOString(),
  hermesHome: home,
  defaultRoot,
  canonicalAgentPackage,
  isProfileHome: profileHome,
  hermesAgentPath,
  valid: isValidHermesRoot,
  profileCount,
  hasConfigYaml,
  hasHermesMd,
  legacyInstallDetected: legacyDetected,
};

const { writeFileSync } = await import("fs");
writeFileSync(outPath, JSON.stringify(doc, null, 2), "utf8");

console.log(
  `PatterStage uses Hermes at: ${home} (defaultRoot: ${defaultRoot}, valid: ${isValidHermesRoot})`
);
console.log(`Agent package: ${canonicalAgentPackage}`);
if (hermesAgentPath) {
  console.log(`✓ hermes-agent cron module found`);
} else {
  console.log(`⚠  hermes-agent not found at ${canonicalAgentPackage} — install Hermes (see https://hermes-agent.nousresearch.com/docs/getting-started/installation)`);
}
if (legacyDetected) {
  console.log(
    `⚠  Legacy install at ~/.local/share/hermes-agent is ignored. Use a single install under ~/.hermes (run: hermes update or the Nous installer).`
  );
}

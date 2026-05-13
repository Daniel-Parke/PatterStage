#!/usr/bin/env node
/**
 * Detect the local Hermes install and write CH_DATA_DIR/hermes-detection.json.
 * Resolves from HERMES_HOME / AGENT_HOME env vars, defaulting to ~/.hermes.
 */
import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

function normalizeDir(d) {
  return String(d || "").replace(/[/\\]+$/, "");
}

function getChDataDir() {
  const raw = process.env.CH_DATA_DIR || process.env.CONTROL_HUB_DATA_DIR;
  if (raw && String(raw).trim()) return normalizeDir(String(raw).trim());
  return normalizeDir(join(homedir(), "control-hub", "data"));
}

function getHermesHome() {
  const envHome = process.env.HERMES_HOME || process.env.AGENT_HOME;
  if (envHome && String(envHome).trim()) return normalizeDir(String(envHome).trim());
  return join(homedir(), ".hermes");
}

const home = getHermesHome();
const hasConfigYaml = existsSync(join(home, "config.yaml"));
const hasHermesMd = existsSync(join(home, "HERMES.md"));
const isValidHermesRoot = hasConfigYaml || hasHermesMd;

let profileCount = 0;
if (isValidHermesRoot) {
  const profilesDir = join(home, "profiles");
  if (existsSync(profilesDir)) {
    try {
      const { readdirSync } = await import("fs");
      for (const name of readdirSync(profilesDir)) {
        if (existsSync(join(profilesDir, name, "config.yaml"))) profileCount++;
      }
    } catch { /* ignore */ }
  }
}

const outDir = getChDataDir();
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "hermes-detection.json");
const doc = {
  version: 1,
  generatedAt: new Date().toISOString(),
  hermesHome: home,
  valid: isValidHermesRoot,
  profileCount,
  hasConfigYaml,
  hasHermesMd,
};

const { writeFileSync } = await import("fs");
writeFileSync(outPath, JSON.stringify(doc, null, 2), "utf8");
console.log(`Detected Hermes at ${home} (valid: ${isValidHermesRoot}, profiles: ${profileCount})`);

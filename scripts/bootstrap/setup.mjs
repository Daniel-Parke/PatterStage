#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// setup.mjs — cross-platform PatterStage setup (Windows/macOS/Linux)
// ═══════════════════════════════════════════════════════════════
// The Windows path (run by install.ps1) and a portable alternative to
// scripts/bootstrap/setup.sh. Non-interactive: picks a PORT, writes .env.local,
// wires the Hermes API key when a config.yaml exists, creates the data dirs +
// copies the bundled host scripts, then installs/builds/migrates/seeds.
//   Flags: --skip-build (skip npm install/build/migrate/seed — for tests)

import { spawnSync } from "child_process";
import {
  existsSync, mkdirSync, readFileSync, copyFileSync, readdirSync, appendFileSync,
} from "fs";
import { homedir, networkInterfaces } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

import { isWindows, portInUse } from "../tooling/_platform.mjs";
import { readEnvFile, setEnvVar, setEnvVarIfAbsent } from "./env-local.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const SKIP_BUILD = args.includes("--skip-build");
const log = (m) => console.log(m);
const npmBin = () => (isWindows ? "npm.cmd" : "npm");

function run(cmd, cmdArgs, env = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: isWindows && cmd.endsWith(".cmd"),
    windowsHide: true,
  });
  return r.status === 0;
}
function tsx(scriptRel, scriptArgs, env = {}) {
  return run(process.execPath, ["--import", "tsx", join(REPO_ROOT, scriptRel), ...scriptArgs], env);
}

// ── .env.local ──────────────────────────────────────────────────
// The reader and writer live in ./env-local.mjs so they can be tested against a
// temp file. The old writer here kept every line it did not recognise as
// `KEY=`, so orphan lines from a corrupt earlier write were preserved on every
// re-run, and it accepted a multi-line value without a word.
const ENV_FILE = join(REPO_ROOT, ".env.local");
const readEnvLocal = () => readEnvFile(ENV_FILE);
const setEnvLocal = (key, val) => setEnvVar(ENV_FILE, key, val);
const setEnvLocalIfAbsent = (key, val) => setEnvVarIfAbsent(ENV_FILE, key, val);

// ── data dir ────────────────────────────────────────────────────
function resolveDataDir() {
  const raw = process.env.PS_DATA_DIR || process.env.CH_DATA_DIR || process.env.CONTROL_HUB_DATA_DIR
    || readEnvLocal().PS_DATA_DIR;
  if (raw && raw.trim()) return raw.trim().replace(/[/\\]+$/, "");
  const next = join(homedir(), "patterstage", "data");
  const legacy = join(homedir(), "control-hub", "data");
  return !existsSync(next) && existsSync(legacy) ? legacy : next;
}

async function pickPort() {
  const fromEnv = process.env.PORT || readEnvLocal().PORT;
  if (fromEnv && /^\d+$/.test(fromEnv)) return Number(fromEnv);
  for (let p = 42069; p <= 42100; p++) if (!(await portInUse(p))) return p;
  return 42069;
}

function lanOrigins(port) {
  const hosts = new Set(["127.0.0.1", "localhost"]);
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const i of ifaces || []) if (i.family === "IPv4" && !i.internal) hosts.add(i.address);
  }
  return [...hosts].map((h) => `http://${h}:${port}`).join(",");
}

// ── main ────────────────────────────────────────────────────────
async function main() {
  log("╔══════════════════════════════════════════╗");
  log("║       PatterStage — Setup (cross-platform) ║");
  log("╚══════════════════════════════════════════╝");

  const major = Number(process.versions.node.split(".")[0]);
  if (major < 20) {
    console.error(`✗ Node.js 20+ required (found ${process.version})`);
    process.exit(1);
  }
  log(`✓ Node.js ${process.version}`);

  const port = await pickPort();
  setEnvLocal("PORT", String(port));
  setEnvLocal("PS_ALLOWED_DEV_ORIGINS", lanOrigins(port));
  log(`✓ PORT ${port}`);

  const HERMES_HOME = process.env.HERMES_HOME || readEnvLocal().HERMES_HOME || join(homedir(), ".hermes");
  setEnvLocal("HERMES_HOME", HERMES_HOME);
  // The deploy buttons work on a fresh solo install (decision 17, T-0095);
  // an operator who turned them off stays off.
  setEnvLocalIfAbsent("PS_ENABLE_DEPLOY_API", "true");

  const hermesConfigured = existsSync(join(HERMES_HOME, "config.yaml"));
  if (hermesConfigured) {
    // Wire a shared Hermes API Server bearer key.
    const hermesEnv = join(HERMES_HOME, ".env");
    mkdirSync(HERMES_HOME, { recursive: true });
    let key = "";
    if (existsSync(hermesEnv)) {
      const m = readFileSync(hermesEnv, "utf-8").match(/^API_SERVER_KEY=(.+)$/m);
      key = m ? m[1].trim() : "";
    }
    if (!key) {
      key = randomBytes(24).toString("hex");
      appendFileSync(hermesEnv, `\n# Enable API server for PatterStage\nAPI_SERVER_KEY=${key}\n`);
    }
    if (!/^API_SERVER_ENABLED=true/m.test(existsSync(hermesEnv) ? readFileSync(hermesEnv, "utf-8") : "")) {
      appendFileSync(hermesEnv, "API_SERVER_ENABLED=true\n");
    }
    setEnvLocal("API_SERVER_KEY", key);
    log("✓ Hermes API server key wired");
  } else {
    log(`ℹ  No Hermes config at ${HERMES_HOME}/config.yaml — standalone mode.`);
  }

  // Data dirs + bundled host scripts.
  const dataRoot = resolveDataDir();
  for (const d of ["missions", "templates", "operations", "recroom", "stories", "workspaces", "audit", "scripts", "logs"]) {
    mkdirSync(join(dataRoot, d), { recursive: true });
  }
  const hwDir = join(REPO_ROOT, "scripts", "hardware");
  if (existsSync(hwDir)) {
    for (const f of readdirSync(hwDir)) {
      if (!/\.(sh|mjs)$/.test(f)) continue;
      const dest = join(dataRoot, "scripts", f);
      if (!existsSync(dest)) copyFileSync(join(hwDir, f), dest);
    }
  }
  log(`✓ Data directories at ${dataRoot}`);

  if (SKIP_BUILD) {
    log("ℹ  --skip-build: skipping npm install/build/migrate/seed.");
    log("\nSetup (config) complete. PORT=" + port + " · PS_DATA_DIR=" + dataRoot);
    return;
  }

  log("\nInstalling dependencies…");
  if (!run(npmBin(), ["install"])) process.exit(1);
  log("Building production bundle…");
  if (!run(npmBin(), ["run", "build"])) process.exit(1);
  log("Applying database migrations…");
  tsx("scripts/tooling/migrate-db.ts", [], { PS_DATA_DIR: dataRoot });
  run(process.execPath, [join(REPO_ROOT, "scripts/tooling/migrate-to-runtime.mjs"), "--apply"], { PS_DATA_DIR: dataRoot });
  if (hermesConfigured) tsx("scripts/tooling/import-hermes-state.ts", [], { PS_DATA_DIR: dataRoot, HERMES_HOME });
  log("Seeding professional catalog…");
  tsx("scripts/tooling/seed-catalog.ts", ["--merge"], { PS_DATA_DIR: dataRoot, HERMES_HOME });
  if (hermesConfigured) tsx("scripts/tooling/ensure-hermes-model-sync.ts", [], { PS_DATA_DIR: dataRoot, HERMES_HOME });
  run(process.execPath, [join(REPO_ROOT, "scripts/tooling/discover-agents.mjs")], { PS_DATA_DIR: dataRoot });

  log("\n╔══════════════════════════════════════════╗");
  log("║       Setup Complete!                     ║");
  log("╚══════════════════════════════════════════╝");
  log(`PORT: ${port} · PS_DATA_DIR: ${dataRoot} · HERMES_HOME: ${HERMES_HOME}`);
  log("Start:  npm run start:network");
}

main().catch((e) => {
  console.error("setup failed:", e);
  process.exit(1);
});

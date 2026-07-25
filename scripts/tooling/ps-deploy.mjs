#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// ps-deploy.mjs — cross-platform deploy runner (Windows/macOS/Linux)
// ═══════════════════════════════════════════════════════════════
// Single implementation of update / rebuild / restart, spawned detached by
// src/lib/deploy-spawn.ts (the in-app Update/Rebuild/Restart buttons) and by
// the thin scripts/application/ps-deploy.sh CLI wrapper. Ports
// scripts/lib/ps-deploy-impl.sh — writes the identical ps-deploy.status format
// that src/lib/deploy-status.ts reads. Plain ESM so it runs in bare `node`
// outside the Next build.

import { spawnSync } from "child_process";
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, renameSync,
  copyFileSync, rmSync, openSync, closeSync, statSync,
} from "fs";
import { homedir, tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { isWindows, detachedSpawn, isPidAlive, killByPort, killPid, portInUse } from "./_platform.mjs";
import { loadEnvLocal, readEnvLocalValue } from "./_env-local.mjs";

const SCRIPTS_TOOLING = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_ROOT = join(SCRIPTS_TOOLING, "..");
const APP_DIR = join(SCRIPTS_ROOT, "..");

// ── paths (mirror src/lib/paths.ts) ─────────────────────────────

function normDir(d) {
  return d.replace(/[/\\]+$/, "");
}
function dirHasDb(d) {
  return existsSync(join(d, "patterstage.db")) || existsSync(join(d, "control-hub.db"));
}
// Mirrors src/lib/paths.ts (resolveDataDir/getDbPath). Keep in lockstep: an
// explicit env var wins; else a dir that already holds a populated DB beats
// creating/opening an empty one (the case-sensitive ~/PatterStage vs
// ~/patterstage race); when both DB names exist, prefer the larger (populated).
export function resolveDataDir() {
  const raw = process.env.PS_DATA_DIR || process.env.CH_DATA_DIR || process.env.CONTROL_HUB_DATA_DIR;
  if (raw && raw.trim()) return normDir(raw.trim());
  const home = homedir();
  const candidates = [
    normDir(join(home, "PatterStage", "data")),
    normDir(join(home, "patterstage", "data")),
    normDir(join(home, "control-hub", "data")),
  ];
  return (
    candidates.find(dirHasDb) ??
    candidates.find((d) => existsSync(d)) ??
    normDir(join(home, "patterstage", "data"))
  );
}
export function resolveDbPath(dir) {
  const next = join(dir, "patterstage.db");
  const legacy = join(dir, "control-hub.db");
  const nextEx = existsSync(next);
  const legEx = existsSync(legacy);
  if (nextEx && legEx) {
    try {
      return statSync(legacy).size > statSync(next).size ? legacy : next;
    } catch {
      return next;
    }
  }
  if (!nextEx && legEx) return legacy;
  return next;
}
function hermesHome() {
  return process.env.HERMES_HOME || process.env.AGENT_HOME || join(homedir(), ".hermes");
}
function logsDir() {
  return join(hermesHome(), "logs");
}

const LOGS = () => logsDir();
const STATUS_FILE = () => process.env.PS_DEPLOY_STATUS_FILE || join(LOGS(), "ps-deploy.status");
const PID_FILE = () => join(LOGS(), "ps-server.pid");
const RUNTIME_LOG = () => process.env.PS_RUNTIME_LOG || join(LOGS(), "ps-runtime.log");
const logFile = (base) => join(LOGS(), base);

// ── status + logging (mirror ps-deploy-status.sh) ───────────────

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
function ensureLogs() {
  mkdirSync(LOGS(), { recursive: true });
}
export function statusWrite(state, action, phase, message, exitCode = "", logHint = "") {
  ensureLogs();
  const sf = STATUS_FILE();
  let startedAt;
  if (state === "running") {
    startedAt = nowIso();
  } else {
    let prev = "";
    try {
      const m = readFileSync(sf, "utf-8").match(/^startedAt=(.*)$/m);
      prev = m ? m[1] : "";
    } catch {
      /* none */
    }
    startedAt = prev || nowIso();
  }
  const finishedAt = state === "running" ? "" : nowIso();
  const body =
    `state=${state}\n` +
    `action=${action}\n` +
    `phase=${phase}\n` +
    `message=${String(message).replace(/\n/g, " ")}\n` +
    `startedAt=${startedAt}\n` +
    `finishedAt=${finishedAt}\n` +
    `exitCode=${exitCode}\n` +
    `logHint=${logHint}\n`;
  const tmp = `${sf}.${process.pid}.tmp`;
  writeFileSync(tmp, body);
  renameSync(tmp, sf);
}
function log(base, msg) {
  ensureLogs();
  try {
    const fd = openSync(logFile(base), "a");
    writeFileSync(fd, `[${new Date().toISOString()}] ${msg}\n`);
    closeSync(fd);
  } catch {
    /* best-effort */
  }
}

// ── lock (atomic mkdir; replaces flock + the fd-200 footgun) ─────

const LOCK_DIR = () => join(process.env.TMPDIR || tmpdir(), "ps-deploy.lock.d");
let lockHeld = false;
export function acquireLock() {
  const dir = LOCK_DIR();
  try {
    mkdirSync(dir);
  } catch (e) {
    if (e && e.code === "EEXIST") {
      // Stale-holder reclaim: if the recorded PID is dead, take it over once.
      let holderPid = 0;
      try {
        holderPid = Number(readFileSync(join(dir, "pid"), "utf-8").trim());
      } catch {
        /* no pid file */
      }
      if (holderPid && isPidAlive(holderPid)) return false;
      try {
        rmSync(dir, { recursive: true, force: true });
        mkdirSync(dir);
      } catch {
        return false;
      }
    } else {
      return false;
    }
  }
  try {
    writeFileSync(join(dir, "pid"), String(process.pid));
  } catch {
    /* ignore */
  }
  lockHeld = true;
  return true;
}
export function releaseLock() {
  if (!lockHeld) return;
  try {
    rmSync(LOCK_DIR(), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  lockHeld = false;
}
process.on("exit", releaseLock);

// ── child-process runner ────────────────────────────────────────

const npmBin = () => (isWindows ? "npm.cmd" : "npm");

/** Run a command, appending stdout+stderr to <base> log. Returns true on exit 0. */
function run(cmd, args, base, opts = {}) {
  ensureLogs();
  const fd = openSync(logFile(base), "a");
  try {
    const r = spawnSync(cmd, args, {
      cwd: opts.cwd || APP_DIR,
      env: { ...process.env, ...(opts.env || {}) },
      stdio: ["ignore", fd, fd],
      shell: isWindows && cmd.endsWith(".cmd"),
      windowsHide: true,
    });
    return r.status === 0;
  } finally {
    closeSync(fd);
  }
}
// node --import tsx <script.ts> [args]  → argv-safe, no npm/npx/shell
function runTsx(scriptRel, args, base) {
  return run(process.execPath, ["--import", "tsx", join(SCRIPTS_ROOT, scriptRel), ...args], base);
}

// ── rename migration (port of ps-rename-migrate.sh) ─────────────

export function renameMigrate(dataDir, repo) {
  const legacy = join(dataDir, "control-hub.db");
  const next = join(dataDir, "patterstage.db");
  if (existsSync(legacy) && !existsSync(next)) {
    try {
      renameSync(legacy, next);
      for (const s of ["-wal", "-shm"]) {
        if (existsSync(legacy + s)) renameSync(legacy + s, next + s);
      }
    } catch {
      /* best-effort */
    }
  }
  if (!repo) return;
  const envFile = join(repo, ".env.local");
  if (!existsSync(envFile)) return;
  let txt;
  try {
    txt = readFileSync(envFile, "utf-8");
  } catch {
    return;
  }
  if (/^PS_RENAMED=/m.test(txt)) return;
  if (/^CH_/m.test(txt)) {
    txt = txt.replace(/^CH_/gm, "PS_");
  }
  if (!/\n$/.test(txt)) txt += "\n";
  txt += "PS_RENAMED=1\n";
  try {
    writeFileSync(envFile, txt);
  } catch {
    /* ignore */
  }
}

function backupDb(dataDir) {
  const db = resolveDbPath(dataDir);
  if (!existsSync(db)) return null;
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15);
  const bak = `${db}.pre-migrate-${ts}.bak`;
  try {
    copyFileSync(db, bak);
    for (const s of ["-wal", "-shm"]) if (existsSync(db + s)) copyFileSync(db + s, bak + s);
    return bak;
  } catch {
    return null;
  }
}

function migrateDb(dataDir) {
  backupDb(dataDir);
  const env = { PS_DATA_DIR: dataDir };
  const okSchema = run(npmBin(), ["run", "db:migrate"], "ps-build.log", { env });
  // legacy data migration (cron_jobs → schedules); non-fatal
  run(process.execPath, [join(SCRIPTS_TOOLING, "migrate-to-runtime.mjs"), "--apply"], "ps-build.log", { env });
  return okSchema;
}

// ── port resolution ─────────────────────────────────────────────

export async function resolvePort() {
  const fromEnv = process.env.PORT || readEnvLocalValue(APP_DIR, "PORT");
  if (fromEnv && /^\d+$/.test(fromEnv)) return Number(fromEnv);
  for (let p = 42069; p <= 42100; p++) {
    if (!(await portInUse(p))) return p;
  }
  return 42069;
}

// ── restart body (port of ps_deploy_do_restart_body) ────────────

async function restartBody() {
  const port = await resolvePort();
  const host = process.env.PS_NEXT_BIND_HOST || "0.0.0.0";
  // Grace before we tear down the listener. On a bare `restart`, the HTTP
  // request that spawned us is being served BY the very server on `port`;
  // deploy-spawn (src/lib/deploy-spawn.ts) probes our liveness for ~2s before
  // returning 200 {started}. Wait past that window so the caller's response
  // flushes first — otherwise killByPort drops the connection mid-response and
  // the client sees HTTP 000. (For update/rebuild the build already took far
  // longer than this, so it's a negligible no-op there.)
  await new Promise((r) => setTimeout(r, 3000));
  log("ps-restart.log", `Stopping listeners on port ${port}…`);
  killByPort(port);
  // also kill the recorded server pid if still alive
  try {
    const old = Number(readFileSync(PID_FILE(), "utf-8").trim());
    if (old && isPidAlive(old)) killPid(old, { tree: true });
  } catch {
    /* none */
  }
  try {
    rmSync(PID_FILE(), { force: true });
  } catch {
    /* ignore */
  }

  const nextBin = join(APP_DIR, "node_modules", "next", "dist", "bin", "next");
  if (!existsSync(nextBin)) {
    log("ps-restart.log", "next binary missing — running npm install…");
    if (!run(npmBin(), ["install", "--prefer-offline"], "ps-restart.log")) {
      log("ps-restart.log", "ERROR: npm install failed — cannot start server");
      return false;
    }
  }

  // fresh runtime log per start
  try {
    writeFileSync(RUNTIME_LOG(), "");
  } catch {
    /* ignore */
  }
  log("ps-restart.log", `Starting next-server on ${host}:${port}…`);
  const pid = detachedSpawn(
    process.execPath,
    [nextBin, "start", "-p", String(port), "-H", host],
    { cwd: APP_DIR, env: { ...process.env, PS_ENABLE_DEPLOY_API: process.env.PS_ENABLE_DEPLOY_API || "true" }, logFile: RUNTIME_LOG() },
  );
  if (!pid) {
    log("ps-restart.log", "ERROR: failed to spawn next-server");
    return false;
  }
  try {
    writeFileSync(PID_FILE(), String(pid));
  } catch {
    /* ignore */
  }
  log("ps-restart.log", `Server started (PID ${pid}) — stdout → ${RUNTIME_LOG()}`);

  // readiness: real HTTP GET /api/health (not just TCP). /api/health is the one
  // unauthenticated endpoint (src/proxy.ts) — /api/status now requires a token.
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (res.status === 200) {
        log("ps-restart.log", `Server ready on http://127.0.0.1:${port} (HTTP 200)`);
        return true;
      }
    } catch {
      /* not up yet */
    }
    if (!isPidAlive(pid)) {
      log("ps-restart.log", `ERROR: next-server died during startup — see ${RUNTIME_LOG()}`);
      return false;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  log("ps-restart.log", "ERROR: server did not respond at /api/health within 20s");
  return false;
}

// ── shared step helpers ─────────────────────────────────────────

function resolveTooling() {
  const r = spawnSync(npmBin(), ["--version"], { stdio: "ignore", shell: isWindows });
  return r.status === 0;
}
function mtimeMs(p) {
  try {
    return statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}
function npmInstallIfNeeded(base) {
  const lock = join(APP_DIR, "package-lock.json");
  const marker = join(APP_DIR, ".next", "BUILD_ID");
  let need = false;
  if (existsSync(lock) && (!existsSync(marker) || mtimeMs(lock) > mtimeMs(marker))) {
    need = true;
  }
  if (!need) return true;
  log(base, "Installing dependencies (npm install)…");
  return run(npmBin(), ["install", "--prefer-offline"], base);
}
function gitOk(args) {
  const r = spawnSync("git", args, { cwd: APP_DIR, stdio: "ignore" });
  return r.status === 0;
}

// ── commands ────────────────────────────────────────────────────

function fail(action, phase, message, code = 1, hint = "ps-restart.log") {
  statusWrite("failed", action, phase, message, String(code), hint);
  log(hint, `ERROR: ${message}`);
  releaseLock();
  process.exit(code);
}

async function cmdRestart() {
  if (!acquireLock()) fail("restart", "lock", "Deploy already in progress", 1, "ps-restart.log");
  statusWrite("running", "restart", "restart", "Restarting server…", "", "ps-restart.log");
  if (!resolveTooling()) fail("restart", "restart", "npm not found — cannot restart", 1, "ps-restart.log");
  if (!(await restartBody())) fail("restart", "restart", "Restart failed — see ps-restart.log", 1, "ps-restart.log");
  statusWrite("success", "restart", "done", "Restart complete", "0", "ps-restart.log");
  process.exit(0);
}

async function runBuildAndMigrate(action, base, branch) {
  if (branch) {
    const cur = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: APP_DIR, encoding: "utf-8" }).stdout?.trim();
    if (cur && cur !== branch) {
      statusWrite("running", action, "git", `Checking out ${branch}…`, "", "");
      if (!gitOk(["checkout", branch, "--quiet"])) fail(action, "git", `Branch '${branch}' not found locally`, 1, "ps-restart.log");
    }
  }
  npmInstallIfNeeded(base);
  statusWrite("running", action, "build", "Building production bundle…", "", base);
  log(base, "Building production bundle…");
  if (!run(npmBin(), ["run", "build"], base)) fail(action, "build", `Build failed — see ${base}`, 1, base);
  log(base, "Build successful");

  const dataDir = resolveDataDir();
  log(base, "Applying PatterStage rename migration (DB + .env.local)…");
  renameMigrate(dataDir, APP_DIR);
  log(base, "Backing up + migrating database…");
  migrateDb(dataDir);

  const hh = hermesHome();
  if (existsSync(join(hh, "config.yaml"))) runTsx("tooling/import-hermes-state.ts", [], base);
  runTsx("tooling/seed-catalog.ts", ["--merge"], base);
  runTsx("tooling/ensure-hermes-model-sync.ts", [], base);
  mkdirSync(join(dataDir, "scripts"), { recursive: true });
  mkdirSync(join(dataDir, "logs"), { recursive: true });
  run(process.execPath, [join(SCRIPTS_TOOLING, "discover-agents.mjs")], base, { env: { PS_DATA_DIR: dataDir } });
}

async function cmdRebuild(branch) {
  if (!acquireLock()) fail("rebuild", "lock", "Deploy already in progress", 1, "ps-restart.log");
  statusWrite("running", "rebuild", "build", "Rebuild started…", "", "ps-build.log");
  if (!resolveTooling()) fail("rebuild", "build", "npm not found — cannot build", 1, "ps-build.log");
  await runBuildAndMigrate("rebuild", "ps-build.log", branch);
  statusWrite("running", "rebuild", "restart", "Restarting server…", "", "ps-restart.log");
  if (!(await restartBody())) fail("rebuild", "restart", "Restart failed after build — see ps-restart.log", 1, "ps-restart.log");
  statusWrite("success", "rebuild", "done", "Rebuild complete", "0", "ps-restart.log");
  process.exit(0);
}

async function cmdUpdate(branch, restartOnly) {
  if (!acquireLock()) fail("update", "lock", "Deploy already in progress", 1, "ps-update.log");
  statusWrite("running", "update", "git", "Update started…", "", "ps-update.log");
  if (!resolveTooling()) fail("update", "git", "npm not found — cannot update", 1, "ps-update.log");
  if (!gitOk(["rev-parse", "--is-inside-work-tree"])) fail("update", "git", `${APP_DIR} is not a git repository`, 1, "ps-update.log");

  if (!restartOnly) {
    log("ps-update.log", `Fetching origin/${branch}…`);
    // A failed fetch must abort: otherwise `reset --hard origin/<branch>` resets
    // to the STALE local ref and we'd report "update complete" while running old
    // code. (Offline, bad remote, or missing branch all surface here.)
    if (!gitOk(["fetch", "origin", branch, "--quiet"]))
      fail("update", "git", `git fetch origin ${branch} failed (offline or branch missing?) — not updating`, 1, "ps-update.log");
    if (!gitOk(["checkout", branch, "--quiet"]))
      fail("update", "git", `git checkout ${branch} failed`, 1, "ps-update.log");
    if (!gitOk(["reset", "--hard", `origin/${branch}`, "--quiet"])) fail("update", "git", "git reset failed", 1, "ps-update.log");
    log("ps-update.log", "Code updated.");
    await runBuildAndMigrate("update", "ps-update.log", null);
  }

  statusWrite("running", "update", "restart", "Restarting server…", "", "ps-restart.log");
  if (!(await restartBody())) fail("update", "restart", "Restart failed — see ps-restart.log", 1, "ps-restart.log");
  statusWrite("success", "update", "done", "Update complete", "0", "ps-update.log");
  process.exit(0);
}

// ── main ─────────────────────────────────────────────────────────

export async function main(argv) {
  loadEnvLocal(APP_DIR);
  const sub = argv[0];
  const rest = argv.slice(1);
  let branch = process.env.PS_UPDATE_GIT_BRANCH || "dev";
  let restartOnly = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--branch") branch = rest[++i];
    else if (rest[i] === "--restart-only") restartOnly = true;
  }
  switch (sub) {
    case "update":
      return cmdUpdate(branch, restartOnly);
    case "rebuild":
      return cmdRebuild(rest.includes("--branch") ? branch : "");
    case "restart":
      return cmdRestart();
    default:
      process.stderr.write(
        "Usage: node scripts/tooling/ps-deploy.mjs update [--restart-only] [--branch NAME] | rebuild [--branch NAME] | restart\n",
      );
      process.exit(1);
  }
}

// Run only when invoked as the entry point (not when imported by a test).
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main(process.argv.slice(2)).catch((e) => {
    try {
      log("ps-update.log", `FATAL: ${e && e.stack ? e.stack : e}`);
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
}

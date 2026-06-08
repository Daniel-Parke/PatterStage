import { NextRequest, NextResponse } from "next/server";
import { execFileSync, execSync, spawn } from "child_process";
import { existsSync, writeFileSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";

import { logApiError } from "@/lib/api-logger";
import { getCorrelationId, requireAuth, requireDeployApiEnabled, requireSignedRequest } from "@/lib/api-auth";
import { appendAuditLine } from "@/lib/audit-log";
import {
  isDeployInProgress,
  readDeployStatus,
  tailLogHint,
  writeDeployStatusRunning,
} from "@/lib/deploy-status";
import { sanitizeGitBranch } from "@/lib/git-branch";

// ═══════════════════════════════════════════════════════════════
// Update API — Version Check + Update + Restart
// ═══════════════════════════════════════════════════════════════
// GET  /api/update                       → check for updates
// POST /api/update { action: "update" }  → spawn scripts/application/ch-deploy.sh update (gated)
// POST /api/update { action: "rebuild" } → build current tree + restart (optional branch checkout)
// GET  /api/update?deploy=1            → deploy status from ch-deploy.status
// POST /api/update { action: "restart" } → restart only (gated)
//
// CH_ENABLE_DEPLOY_API=true required for POST.
// Optional CH_REQUEST_SIGNING_SECRET + signature headers for POST hardening.
// CH_UPDATE_GIT_BRANCH (default dev) — remote tracking branch for deploy.

const APP_DIR = process.cwd();
const CH_DEPLOY_SCRIPT = APP_DIR + "/scripts/application/ch-deploy.sh";
const CACHE_FILE = tmpdir() + "/ch-version-cache.json";
const CACHE_TTL_MS = 5 * 60 * 1000;

const UPDATE_BRANCH = sanitizeGitBranch(
  process.env.CH_UPDATE_GIT_BRANCH || "dev"
);

// ── Branch listing ──────────────────────────────────────────────

const MAX_REMOTE_BRANCHES = 50;

function listRemoteBranches(): string[] {
  try {
    // Ensure we have the latest remote refs
    execSync("git fetch origin --quiet 2>/dev/null", {
      cwd: APP_DIR,
      timeout: 15000,
    });

    // Get remote branches
    const rawRemote = execSync("git branch -r --format='%(refname:short)'", {
      cwd: APP_DIR,
      encoding: "utf-8",
      timeout: 10000,
    });

    // Get local branches — only include branches that exist locally (active/checked-out)
    const rawLocal = execSync("git branch --format='%(refname:short)'", {
      cwd: APP_DIR,
      encoding: "utf-8",
      timeout: 10000,
    });
    const localSet = new Set<string>();
    for (const line of rawLocal.split("\n")) {
      const b = line.trim();
      if (b) localSet.add(b);
    }

    const seen = new Set<string>();
    const out: string[] = [];
    for (const line of rawRemote.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "origin/HEAD" || !trimmed.startsWith("origin/")) continue;
      const short = trimmed.replace(/^origin\//, "");
      const clean = sanitizeGitBranch(short);
      if (!clean || clean === "HEAD") continue;
      if (seen.has(clean)) continue;
      // Only include branches that exist locally (active) or are the configured deploy branch
      const isDeployBranch = clean === UPDATE_BRANCH;
      const existsLocally = localSet.has(clean);
      if (!existsLocally && !isDeployBranch) continue;
      seen.add(clean);
      out.push(clean);
    }
    // Always include UPDATE_BRANCH even if never checked out locally
    if (!seen.has(UPDATE_BRANCH)) {
      try {
        execSync(`git ls-remote --heads origin ${UPDATE_BRANCH} 2>/dev/null`, {
          cwd: APP_DIR,
          encoding: "utf-8",
          timeout: 10000,
        });
        out.push(UPDATE_BRANCH);
      } catch {
        // branch doesn't exist on remote — skip
      }
    }
    out.sort((a, b) => a.localeCompare(b));
    return out.slice(0, MAX_REMOTE_BRANCHES);
  } catch {
    return [];
  }
}

interface VersionCache {
  localHash: string;
  remoteHash: string;
  updateAvailable: boolean;
  commitMessage: string;
  commitDate: string;
  behind: number;
  /** Remote branch compared against `origin/<name>` (cache key). */
  comparedBranch: string;
  /** Local checkout name (`git rev-parse --abbrev-ref HEAD`). */
  checkoutBranch: string;
  lastChecked: string;
}

function runGit(args: string[]): string {
  return execFileSync("git", args, {
    cwd: APP_DIR,
    encoding: "utf-8",
    timeout: 30000,
  }).trim();
}

/** Resolves `origin/<branch>` after fetch; returns an error message or null if OK. */
function verifyDeployBranchOnOrigin(branch: string): string | null {
  const name = sanitizeGitBranch(branch);
  try {
    runGit(["fetch", "origin", name, "--quiet"]);
    const full = runGit(["rev-parse", "origin/" + name]);
    if (!/^[0-9a-f]{40}$/i.test(full)) {
      return "Branch not found on origin: " + name;
    }
    return null;
  } catch {
    return "Branch not found on origin: " + name;
  }
}

function getCachedVersion(): VersionCache | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const raw = JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as Partial<VersionCache>;
    if (Date.now() - new Date(raw.lastChecked ?? 0).getTime() > CACHE_TTL_MS)
      return null;
    if (typeof raw.comparedBranch !== "string" || typeof raw.checkoutBranch !== "string") {
      return null;
    }
    return raw as VersionCache;
  } catch {
    return null;
  }
}

function saveVersionCache(cache: VersionCache): void {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    // ignore
  }
}

function checkVersion(branch?: string): VersionCache {
  const targetBranch = branch ?? UPDATE_BRANCH;
  const cached = getCachedVersion();
  if (cached && cached.comparedBranch === targetBranch) return cached;

  try {
    runGit(["fetch", "origin", targetBranch, "--quiet"]);
    const localHash = runGit(["rev-parse", "HEAD"]);
    const remoteRef = "origin/" + targetBranch;
    const remoteHash = runGit(["rev-parse", remoteRef]);
    const currentBranch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);

    let commitMessage = "";
    let commitDate = "";
    let behind = 0;

    if (localHash !== remoteHash) {
      try {
        commitMessage = runGit(["log", "--format=%s", "-1", remoteRef]);
        commitDate = runGit(["log", "--format=%ci", "-1", remoteRef]);
        behind = parseInt(
          runGit(["rev-list", "--count", localHash + ".." + remoteHash]) || "0",
          10
        );
      } catch {
        // ignore
      }
    }

    const cache: VersionCache = {
      localHash: localHash.substring(0, 7),
      remoteHash: remoteHash.substring(0, 7),
      updateAvailable: localHash !== remoteHash,
      commitMessage,
      commitDate,
      behind,
      comparedBranch: targetBranch,
      checkoutBranch: currentBranch,
      lastChecked: new Date().toISOString(),
    };
    saveVersionCache(cache);
    return cache;
  } catch {
    return {
      localHash: "unknown",
      remoteHash: "unknown",
      updateAvailable: false,
      commitMessage: "",
      commitDate: "",
      behind: 0,
      comparedBranch: targetBranch,
      checkoutBranch: "unknown",
      lastChecked: new Date().toISOString(),
    };
  }
}

// GET /api/update
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("deploy") === "1") {
      const deploy = readDeployStatus();
      const logTail =
        deploy.state === "failed" && deploy.logHint
          ? tailLogHint(deploy.logHint)
          : [];
      return NextResponse.json({
        data: { deploy: { ...deploy, logTail } },
      });
    }

    // Branch listing endpoint
    if (searchParams.get("branches") === "1") {
      const branches = listRemoteBranches();
      return NextResponse.json({
        data: { branches, default: UPDATE_BRANCH },
      });
    }

    const branchParam = searchParams.get("branch");
    const branch = branchParam
      ? sanitizeGitBranch(branchParam)
      : UPDATE_BRANCH;
    const ver = checkVersion(branch);
    return NextResponse.json({
      data: { ...ver, branch: ver.checkoutBranch },
    });
  } catch (error) {
    logApiError("GET /api/update", "checking version", error);
    return NextResponse.json({ error: "Failed to check version" }, { status: 500 });
  }
}

// POST /api/update
export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  const gated = requireDeployApiEnabled();
  if (gated) return gated;

  const auth = requireAuth(request);
  if (auth) return auth;
  const signed = requireSignedRequest(request);
  if (signed) return signed;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || "update";

    if (isDeployInProgress()) {
      return NextResponse.json(
        { error: "Deploy already in progress" },
        { status: 409 },
      );
    }

    if (action === "restart") {
      const missing = deployScriptMissingResponse();
      if (missing) return missing;
      writeDeployStatusRunning("restart", "restart", "Restart queued…");
      const spawned = await spawnChDeploy("ch-restart", ["restart"]);
      if (!spawned.ok) {
        return NextResponse.json(
          { error: spawned.error ?? "Failed to start restart" },
          { status: 500 }
        );
      }
      appendAuditLine({
        action: "deploy.restart",
        resource: "update",
        ok: true,
        correlationId,
      });
      return NextResponse.json({ data: { action: "restart", status: "started" } });
    }

    if (action === "rebuild") {
      const missing = deployScriptMissingResponse();
      if (missing) return missing;

      const rebuildArgs = ["rebuild"];
      let rebuildBranch: string | undefined;
      if (body.branch && typeof body.branch === "string" && body.branch.trim()) {
        rebuildBranch = sanitizeGitBranch(String(body.branch));
        rebuildArgs.push("--branch", rebuildBranch);
      }

      writeDeployStatusRunning("rebuild", "build", "Rebuild queued…");
      const spawnedRebuild = await spawnChDeploy("ch-rebuild", rebuildArgs);
      if (!spawnedRebuild.ok) {
        logApiError("POST /api/update", "spawn rebuild", new Error(spawnedRebuild.error ?? ""));
        appendAuditLine({
          action: "deploy.rebuild",
          resource: "build",
          ok: false,
          correlationId,
        });
        return NextResponse.json(
          { error: spawnedRebuild.error ?? "Failed to start build" },
          { status: 500 }
        );
      }

      appendAuditLine({
        action: "deploy.rebuild",
        resource: "build",
        ok: true,
        correlationId,
      });
      return NextResponse.json({
        data: {
          action: "rebuild",
          status: "started",
          ...(rebuildBranch ? { branch: rebuildBranch } : {}),
        },
      });
    }

    if (action === "update") {
      const updateBranch = body.branch
        ? sanitizeGitBranch(String(body.branch))
        : UPDATE_BRANCH;
      const updateBranchErr = verifyDeployBranchOnOrigin(updateBranch);
      if (updateBranchErr) {
        return NextResponse.json({ error: updateBranchErr }, { status: 400 });
      }
      const missing = deployScriptMissingResponse();
      if (missing) return missing;
      writeDeployStatusRunning("update", "git", "Update queued…");
      const spawnedUpdate = await spawnChDeploy("ch-update", ["update", "--branch", updateBranch]);
      if (!spawnedUpdate.ok) {
        logApiError("POST /api/update", "spawn update", new Error(spawnedUpdate.error ?? ""));
        appendAuditLine({
          action: "deploy.update",
          resource: "ch-deploy",
          ok: false,
          correlationId,
        });
        return NextResponse.json(
          { error: spawnedUpdate.error ?? "Failed to start update" },
          { status: 500 }
        );
      }
      try {
        unlinkSync(CACHE_FILE);
      } catch (error) {
        logApiError("POST /api/update", "cache cleanup", error);
      }

      appendAuditLine({
        action: "deploy.update",
        resource: "full",
        ok: true,
        detail: updateBranch,
        correlationId,
      });

      return NextResponse.json({
        data: { action: "update", status: "started", branch: updateBranch },
      });
    }

    return NextResponse.json(
      { error: "Unknown action. Use 'update', 'rebuild', or 'restart'" },
      { status: 400 }
    );
  } catch (error) {
    logApiError("POST /api/update", "processing request", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

function quoteShellSingle(arg: string): string {
  return "'" + arg.replace(/'/g, "'\"'\"'") + "'";
}

async function spawnChDeploy(
  unitName: string,
  deployArgs: string[],
): Promise<{ ok: boolean; error?: string; pid?: number }> {
  try {
    execFileSync("bash", ["-n", CH_DEPLOY_SCRIPT], { stdio: "ignore", timeout: 8000 });
  } catch {
    return {
      ok: false,
      error: "Deploy script missing or not readable by bash",
    };
  }

  const command =
    `sleep 1; bash ${quoteShellSingle(CH_DEPLOY_SCRIPT)} ${deployArgs.map(quoteShellSingle).join(" ")}`.trimEnd();

  let spawned: { ok: boolean; error?: string; pid?: number } = {
    ok: false,
    error: "no spawn path attempted",
  };

  // Try systemd-run first. If the binary is missing (e.g. in a Docker
  // container) it emits an 'error' event asynchronously — attach a
  // handler so the failure doesn't bubble up as an uncaughtException
  // in the next-server event loop.
  const trySpawn = (cmd: string, args: string[]): number | undefined => {
    try {
      const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
      // Swallow async errors (ENOENT, EACCES) so they don't crash the
      // server. We only care whether spawn produced a usable PID.
      child.on("error", () => {
        /* surfaced via spawned.ok=false, not via uncaughtException */
      });
      if (typeof child.pid === "number" && child.pid > 0) {
        child.unref();
        return child.pid;
      }
      return undefined;
    } catch {
      return undefined;
    }
  };

  // Clear any stale failed systemd transient unit before spawning (best-effort).
  try {
    execFileSync("systemctl", ["--user", "reset-failed", `${unitName}.service`], {
      stdio: "ignore",
      timeout: 5000,
    });
  } catch {
    // reset-failed fails if unit doesn't exist or systemctl is missing — fine
  }

  // Check whether systemd-run is actually available BEFORE we try to
  // spawn it. Node's spawn() returns a child with a PID before the
  // ENOENT for a missing binary surfaces asynchronously — so just
  // calling spawn("systemd-run", ...) and trusting the PID leads to
  // the child dying 1ms later and confusing the liveness probe.
  let systemdRunAvailable = false;
  try {
    execFileSync("which", ["systemd-run"], { stdio: "ignore" });
    systemdRunAvailable = true;
  } catch {
    systemdRunAvailable = false;
  }

  if (systemdRunAvailable) {
    const sysPid = trySpawn("systemd-run", [
      "--user",
      `--unit=${unitName}`,
      "--property=Type=oneshot",
      "bash",
      "-c",
      command,
    ]);
    if (sysPid !== undefined) {
      spawned = { ok: true, pid: sysPid };
    }
  }

  if (!spawned.ok) {
    // Fall back to nohup. Works in Docker containers and minimal
    // environments where systemd isn't available.
    const bgPid = trySpawn("nohup", ["bash", "-c", command]);
    if (bgPid !== undefined) {
      spawned = { ok: true, pid: bgPid };
    } else {
      spawned = { ok: false, error: "nohup spawn returned no pid" };
    }
  }

  if (!spawned.ok) {
    return spawned;
  }

  // Post-spawn liveness probe — close the silent-failure window.
  //
  // The original bug (2026-06-08): the deploy script died silently
  // (lock contention, missing tool, etc.) but the API returned
  // 200 {status:"started"} and the UI spun forever. The user reported
  // "rebuild button doesn't work" because the new code never made it
  // to the server.
  //
  // The fix: wait briefly for the spawned child to either die
  // (immediate failure — surface it) or survive (normal operation —
  // the script is now doing its work in the background, return
  // success). We do NOT try to grab the deploy lock ourselves because
  // the script legitimately holds it for the entire duration of the
  // deploy (often 5-30s); trying to grab it would always fail and
  // we'd mis-report a successful deploy as a stuck one. Instead, the
  // probe checks the status file for a terminal `state=failed
  // phase=lock` write, which is how the script reports a stuck lock.
  const childPid = spawned.pid;
  // Wait up to 1.5s for the child to either die or write a failed
  // status. The script's own `sleep 1` plus a syntax check is ~1.0s;
  // any child that dies before then was a synchronous spawn failure.
  const probeDeadlineMs = 1500;
  const probeStart = Date.now();
  while (Date.now() - probeStart < probeDeadlineMs) {
    // If the child has already exited, it died — surface the failure.
    let childAlive = false;
    if (typeof childPid === "number") {
      try {
        // kill -0 is a no-op that returns success iff the process exists.
        execFileSync("kill", ["-0", String(childPid)], { stdio: "ignore" });
        childAlive = true;
      } catch {
        childAlive = false;
      }
    }
    // Check the status file for a terminal failed write by the script.
    let scriptReportedFailure = false;
    try {
      const statusPath = process.env.HOME
        ? process.env.HOME + "/.hermes/logs/ch-deploy.status"
        : "";
      if (statusPath && existsSync(statusPath)) {
        const raw = readFileSync(statusPath, "utf-8");
        if (/^state=failed/m.test(raw) && /^phase=lock/m.test(raw)) {
          scriptReportedFailure = true;
        }
      }
    } catch {
      // best-effort
    }
    if (!childAlive || scriptReportedFailure) {
      const reason = scriptReportedFailure
        ? "Deploy already in progress (lock held by another process). Wait for the current deploy to finish or run: lsof -ti:42069 | xargs -r kill -9; rm -f /tmp/ch-deploy.lock"
        : `Deploy script exited immediately (PID ${childPid} no longer alive after ${Date.now() - probeStart}ms). Check ~/.hermes/logs/ch-update.log for the cause.`;
      return { ok: false, error: reason };
    }
    // Child is alive and hasn't reported a failure yet — wait more.
    await new Promise((r) => setTimeout(r, 200));
  }

  return { ok: true, pid: childPid };
}

function deployScriptMissingResponse(): NextResponse | null {
  if (!existsSync(CH_DEPLOY_SCRIPT)) {
    return NextResponse.json(
      { error: "Deploy script missing (scripts/application/ch-deploy.sh)" },
      { status: 500 }
    );
  }
  return null;
}

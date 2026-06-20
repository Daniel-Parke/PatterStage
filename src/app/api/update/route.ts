import { NextRequest, NextResponse } from "next/server";
import { execFileSync, execSync } from "child_process";
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
import { spawnChDeploy } from "@/lib/deploy-spawn";

// ═══════════════════════════════════════════════════════════════
// Update API — Version Check + Update + Restart
// ═══════════════════════════════════════════════════════════════
// GET  /api/update                       → check for updates
// POST /api/update { action: "update" }  → spawn scripts/application/ps-deploy.sh update (gated)
// POST /api/update { action: "rebuild" } → build current tree + restart (optional branch checkout)
// GET  /api/update?deploy=1            → deploy status from ps-deploy.status
// POST /api/update { action: "restart" } → restart only (gated)
//
// CH_ENABLE_DEPLOY_API=true required for POST.
// Optional CH_REQUEST_SIGNING_SECRET + signature headers for POST hardening.
// CH_UPDATE_GIT_BRANCH (default dev) — remote tracking branch for deploy.

const APP_DIR = process.cwd();
const CH_DEPLOY_SCRIPT = APP_DIR + "/scripts/application/ps-deploy.sh";
const CACHE_FILE = tmpdir() + "/ch-version-cache.json";
const CACHE_TTL_MS = 5 * 60 * 1000;

const UPDATE_BRANCH = sanitizeGitBranch(
  process.env.PS_UPDATE_GIT_BRANCH || process.env.CH_UPDATE_GIT_BRANCH || "dev"
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
      const spawned = await spawnChDeploy(CH_DEPLOY_SCRIPT, "ps-restart", ["restart"]);
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
      const spawnedRebuild = await spawnChDeploy(CH_DEPLOY_SCRIPT, "ps-rebuild", rebuildArgs);
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
      const spawnedUpdate = await spawnChDeploy(CH_DEPLOY_SCRIPT, "ps-update", ["update", "--branch", updateBranch]);
      if (!spawnedUpdate.ok) {
        logApiError("POST /api/update", "spawn update", new Error(spawnedUpdate.error ?? ""));
        appendAuditLine({
          action: "deploy.update",
          resource: "ps-deploy",
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

function deployScriptMissingResponse(): NextResponse | null {
  if (!existsSync(CH_DEPLOY_SCRIPT)) {
    return NextResponse.json(
      { error: "Deploy script missing (scripts/application/ps-deploy.sh)" },
      { status: 500 }
    );
  }
  return null;
}

import { NextRequest, NextResponse } from "next/server";
import { execFileSync, execSync, spawn } from "child_process";
import { existsSync, writeFileSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";

import { logApiError } from "@/lib/api-logger";
import {
  getCorrelationId,
  requireChApiKey,
  requireDeployApiEnabled,
  requireSignedRequest,
} from "@/lib/api-auth";
import { appendAuditLine } from "@/lib/audit-log";

// ═══════════════════════════════════════════════════════════════
// Update API — Version Check + Update + Restart
// ═══════════════════════════════════════════════════════════════
// GET  /api/update                       → check for updates
// POST /api/update { action: "update" }  → pull + build + restart (gated)
// POST /api/update { action: "rebuild" } → build + restart (no git, gated)
// POST /api/update { action: "restart" } → restart only (gated)
//
// CH_ENABLE_DEPLOY_API=true required for POST.
// CH_API_KEY optional; when set, require X-CH-API-Key or Bearer.
// CH_UPDATE_GIT_BRANCH (default main) — remote tracking branch for deploy.

const APP_DIR = process.cwd();
const LOCK_FILE = tmpdir() + "/ch-deploy.lock";
const RELEASE_SCRIPT = APP_DIR + "/scripts/release.sh";
const RESTART_SCRIPT = APP_DIR + "/scripts/restart.sh";
const CACHE_FILE = tmpdir() + "/ch-version-cache.json";
const CACHE_TTL_MS = 5 * 60 * 1000;

const UPDATE_BRANCH = sanitizeGitBranch(
  process.env.CH_UPDATE_GIT_BRANCH || "main"
);

// ── Branch listing ──────────────────────────────────────────────

function listRemoteBranches(): string[] {
  try {
    // Ensure we have the latest remote refs
    execSync("git fetch origin --quiet 2>/dev/null", {
      cwd: APP_DIR,
      timeout: 15000,
    });
    const raw = execSync("git branch -r --format='%(refname:short)'", {
      cwd: APP_DIR,
      encoding: "utf-8",
      timeout: 10000,
    });
    const branches = raw
      .split("\n")
      .map((b) => b.trim())
      .filter((b) => b && b !== "origin/HEAD" && b.startsWith("origin/"))
      .map((b) => b.replace(/^origin\//, ""))
      .filter((b) => b);
    return Array.from(new Set(branches)).sort();
  } catch {
    return [];
  }
}

function sanitizeGitBranch(raw: string): string {
  const s = raw.replace(/[^a-zA-Z0-9._/-]/g, "").slice(0, 200);
  return s || "main";
}

interface VersionCache {
  localHash: string;
  remoteHash: string;
  updateAvailable: boolean;
  commitMessage: string;
  commitDate: string;
  behind: number;
  branch: string;
  lastChecked: string;
}

function runGit(args: string[]): string {
  return execFileSync("git", args, {
    cwd: APP_DIR,
    encoding: "utf-8",
    timeout: 30000,
  }).trim();
}

function getCachedVersion(): VersionCache | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const raw = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
    if (Date.now() - new Date(raw.lastChecked).getTime() > CACHE_TTL_MS)
      return null;
    return raw;
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
  if (cached && cached.branch === targetBranch) return cached;

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
      branch: currentBranch,
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
      branch: "unknown",
      lastChecked: new Date().toISOString(),
    };
  }
}

// GET /api/update
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Branch listing endpoint
    if (searchParams.get("branches") === "1") {
      const branches = listRemoteBranches();
      return NextResponse.json({ data: { branches, default: "main" } });
    }

    const branchParam = searchParams.get("branch");
    const branch = branchParam
      ? sanitizeGitBranch(branchParam)
      : UPDATE_BRANCH;
    return NextResponse.json({ data: checkVersion(branch) });
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

  const auth = requireChApiKey(request);
  if (auth) return auth;
  const signed = requireSignedRequest(request);
  if (signed) return signed;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || "update";

    if (existsSync(LOCK_FILE)) {
      return NextResponse.json(
        { error: "Update already in progress" },
        { status: 409 }
      );
    }

    if (action === "restart") {
      spawnScript(RESTART_SCRIPT);
      appendAuditLine({
        action: "deploy.restart",
        resource: "update",
        ok: true,
        correlationId,
      });
      return NextResponse.json({ data: { action: "restart", status: "started" } });
    }

    if (action === "rebuild") {
      const rebuildBranch = body.branch
        ? sanitizeGitBranch(String(body.branch))
        : sanitizeGitBranch(process.env.CH_UPDATE_GIT_BRANCH || "main");
      // Run build as a detached background process so the server's memory
      // context is not consumed by npm/build child processes (avoids OOM
      // kills on memory-constrained systems). Uses systemd-run like restart.
      const BUILD_SCRIPT = APP_DIR + "/scripts/build.sh";
      try {
        spawnScript(BUILD_SCRIPT, "ch-rebuild", rebuildBranch);
      } catch (error) {
        logApiError("POST /api/update", "spawn build", error);
        appendAuditLine({
          action: "deploy.rebuild",
          resource: "build",
          ok: false,
          correlationId,
        });
        return NextResponse.json(
          { error: "Failed to start build" },
          { status: 500 }
        );
      }

      appendAuditLine({
        action: "deploy.rebuild",
        resource: "build",
        ok: true,
        correlationId,
      });
      return NextResponse.json({ data: { action: "rebuild", status: "started", branch: rebuildBranch } });
    }

    if (action === "update") {
      try {
        runGit(["fetch", "origin", UPDATE_BRANCH, "--quiet"]);
        runGit(["checkout", UPDATE_BRANCH, "--quiet"]);
        runGit(["reset", "--hard", "origin/" + UPDATE_BRANCH, "--quiet"]);
      } catch (error) {
        logApiError("POST /api/update", "git operations", error);
        appendAuditLine({
          action: "deploy.update",
          resource: "git",
          ok: false,
          detail: "git failed",
          correlationId,
        });
        return NextResponse.json({ error: "Git update failed" }, { status: 500 });
      }

      try {
        const diff = execSync(
          'git diff --name-only HEAD@{1} HEAD 2>/dev/null || echo ""',
          { cwd: APP_DIR, encoding: "utf-8", timeout: 30000 }
        );
        if (diff.includes("package")) {
          execSync("npm install --prefer-offline", {
            cwd: APP_DIR,
            timeout: 120000,
            stdio: "pipe",
          });
        }
      } catch (error) {
        logApiError("POST /api/update", "npm install", error);
        appendAuditLine({
          action: "deploy.update",
          resource: "npm",
          ok: false,
          correlationId,
        });
        return NextResponse.json({ error: "npm install failed" }, { status: 500 });
      }

      try {
        execSync("npm run build", {
          cwd: APP_DIR,
          timeout: 180000,
          stdio: "pipe",
        });
      } catch (error) {
        logApiError("POST /api/update", "build", error);
        appendAuditLine({
          action: "deploy.update",
          resource: "build",
          ok: false,
          correlationId,
        });
        return NextResponse.json(
          {
            error: "Build failed — update aborted (server still running)",
          },
          { status: 500 }
        );
      }

      spawnScript(RELEASE_SCRIPT);
      try {
        unlinkSync(CACHE_FILE);
      } catch (error) {
        logApiError("POST /api/update", "cache cleanup", error);
      }

      let short = "";
      try {
        short = runGit(["rev-parse", "--short", "HEAD"]);
      } catch {
        // Keep response successful even if git hash retrieval fails.
      }

      appendAuditLine({
        action: "deploy.update",
        resource: "full",
        ok: true,
        detail: short,
        correlationId,
      });

      return NextResponse.json({
        data: { action: "update", status: "started", newHash: short },
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

function spawnScript(scriptPath: string, unitName = "ch-action", branch?: string): void {
  const branchArgs = branch ? `--branch "${branch}"` : "";
  const command = `sleep 3; bash "${scriptPath}" ${branchArgs}`.trimEnd();

  try {
    spawn(
      "systemd-run",
      [
        "--user",
        `--unit=${unitName}`,
        "--property=Type=oneshot",
        "bash",
        "-c",
        command,
      ],
      { detached: true, stdio: "ignore" }
    ).unref();
    return;
  } catch {
    // fall through
  }

  try {
    spawn("nohup", ["bash", "-c", command], {
      detached: true,
      stdio: "ignore",
    }).unref();
  } catch {
    // ignore
  }
}

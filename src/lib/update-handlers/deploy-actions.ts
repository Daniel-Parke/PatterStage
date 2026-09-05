// ═══════════════════════════════════════════════════════════════
// update-handlers/deploy-actions.ts - restart, rebuild, update
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the /api/update route god-file. The three actions POST
// accepts, in order of how much they touch: restart the server, rebuild
// the current checkout, or pull a branch and deploy it. Each one writes
// the running status before it spawns, so a page that reloads mid-deploy
// still finds the deploy in progress, and each one appends an audit line.
//
// The gates (PS_ENABLE_DEPLOY_API, auth, request signing, "already in
// progress") stay in route.ts: by the time a function here runs, the
// caller has already earned the right to spawn a process.

import { unlinkSync } from "fs";
import { NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import { appendAuditLine } from "@/lib/audit-log";
import { spawnDeploy } from "@/lib/deploy-spawn";
import { writeDeployStatusRunning } from "@/lib/deploy-status";
import { sanitizeGitBranch } from "@/lib/git/git-branch";

import { verifyDeployBranchOnOrigin } from "./remote-branches";
import { CACHE_FILE, PS_DEPLOY_SCRIPT, UPDATE_BRANCH, deployScriptMissingResponse } from "./shared";

export async function handleRestartAction(correlationId: string): Promise<NextResponse> {
  const missing = deployScriptMissingResponse();
  if (missing) return missing;
  writeDeployStatusRunning("restart", "restart", "Restart queued…");
  const spawned = await spawnDeploy(PS_DEPLOY_SCRIPT, "ps-restart", ["restart"]);
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

export async function handleRebuildAction(
  body: { branch?: unknown },
  correlationId: string,
): Promise<NextResponse> {
  const missing = deployScriptMissingResponse();
  if (missing) return missing;

  const rebuildArgs = ["rebuild"];
  let rebuildBranch: string | undefined;
  if (body.branch && typeof body.branch === "string" && body.branch.trim()) {
    rebuildBranch = sanitizeGitBranch(String(body.branch));
    rebuildArgs.push("--branch", rebuildBranch);
  }

  writeDeployStatusRunning("rebuild", "build", "Rebuild queued…");
  const spawnedRebuild = await spawnDeploy(PS_DEPLOY_SCRIPT, "ps-rebuild", rebuildArgs);
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

export async function handleUpdateAction(
  body: { branch?: unknown },
  correlationId: string,
): Promise<NextResponse> {
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
  const spawnedUpdate = await spawnDeploy(PS_DEPLOY_SCRIPT, "ps-update", ["update", "--branch", updateBranch]);
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

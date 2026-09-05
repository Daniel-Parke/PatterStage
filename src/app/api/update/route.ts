import { NextRequest, NextResponse } from "next/server";

import { logApiError } from "@/lib/api-logger";
import {
  getCorrelationId,
  isDeployApiEnabled,
  requireAuthenticatedHostWrites,
  requireDeployApiEnabled,
  requireSignedRequest,
} from "@/lib/api-auth";
import { isDeployInProgress, readDeployStatus, tailLogHint } from "@/lib/deploy-status";
import { sanitizeGitBranch } from "@/lib/git/git-branch";
import {
  handleRebuildAction,
  handleRestartAction,
  handleUpdateAction,
} from "@/lib/update-handlers/deploy-actions";
import { listRemoteBranches } from "@/lib/update-handlers/remote-branches";
import { UPDATE_BRANCH } from "@/lib/update-handlers/shared";
import { checkVersion } from "@/lib/update-handlers/version-check";

// ═══════════════════════════════════════════════════════════════
// Update API — Version Check + Update + Restart
// ═══════════════════════════════════════════════════════════════
// GET  /api/update                       → check for updates
// POST /api/update { action: "update" }  → spawn scripts/application/ps-deploy.sh update (gated)
// POST /api/update { action: "rebuild" } → build current tree + restart (optional branch checkout)
// GET  /api/update?deploy=1            → deploy status from ps-deploy.status
// POST /api/update { action: "restart" } → restart only (gated)
//
// PS_ENABLE_DEPLOY_API=true required for POST.
// Optional PS_REQUEST_SIGNING_SECRET + signature headers for POST hardening.
// PS_UPDATE_GIT_BRANCH (default dev) — remote tracking branch for deploy.
//
// This file is the gate-and-dispatch layer. The work lives under
// src/lib/update-handlers/:
//
//   shared.ts           deploy-runner path, cache path, deploy branch, runGit
//   remote-branches.ts  the deployable branch list and the origin check
//   version-check.ts    HEAD vs origin/<branch>, cached for five minutes
//   deploy-actions.ts   restart, rebuild, update
//
// Authentication is enforced once in src/proxy.ts; the gates below are
// this route's own and never a second token check (design-lint
// no-auth-in-route-handler).

// GET /api/update
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // `deployEnabled` travels on both answers so the footer can say "the deploy
    // API is off" BEFORE the click, instead of painting three enabled buttons
    // that 403 (T-0095, D53). The deploy-status answer is the one it reads on
    // mount.
    const deployEnabled = isDeployApiEnabled();

    if (searchParams.get("deploy") === "1") {
      const deploy = readDeployStatus();
      const logTail =
        deploy.state === "failed" && deploy.logHint
          ? tailLogHint(deploy.logHint)
          : [];
      return NextResponse.json({
        data: { deploy: { ...deploy, logTail }, deployEnabled },
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
      data: { ...ver, branch: ver.checkoutBranch, deployEnabled },
    });
  } catch (error) {
    logApiError("GET /api/update", "checking version", error);
    return NextResponse.json({ error: "Failed to check version" }, { status: 500 });
  }
}

// POST /api/update
export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  // Spawning the deploy script is a host write. The proxy refuses it under
  // PS_AUTH_MODE=none before this runs; the route says so itself as well
  // (T-0095, D123).
  const hostWrites = requireAuthenticatedHostWrites();
  if (hostWrites) return hostWrites;
  const gated = requireDeployApiEnabled();
  if (gated) return gated;

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
      return await handleRestartAction(correlationId);
    }

    if (action === "rebuild") {
      return await handleRebuildAction(body, correlationId);
    }

    if (action === "update") {
      return await handleUpdateAction(body, correlationId);
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

// ═══════════════════════════════════════════════════════════════
// update-handlers/shared.ts - what every /api/update branch needs
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the /api/update route god-file: the paths the deploy
// runner lives at, the version-cache location, the configured deploy
// branch, and the one-line git helper the branch and version modules
// both call. Nothing here reads a request or writes a response except
// `deployScriptMissingResponse`, which is the pre-flight every POST
// action runs before it spawns anything.

import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { NextResponse } from "next/server";

import { sanitizeGitBranch } from "@/lib/git/git-branch";

export const APP_DIR = process.cwd();
// Cross-platform Node deploy runner (Windows/macOS/Linux). The bash
// scripts/application/ps-deploy.sh is now a thin wrapper around this.
export const PS_DEPLOY_SCRIPT = APP_DIR + "/scripts/tooling/ps-deploy.mjs";
export const CACHE_FILE = tmpdir() + "/ps-version-cache.json";
export const CACHE_TTL_MS = 5 * 60 * 1000;

export const UPDATE_BRANCH = sanitizeGitBranch(
  process.env.PS_UPDATE_GIT_BRANCH || process.env.CH_UPDATE_GIT_BRANCH || "dev"
);

export function runGit(args: string[]): string {
  return execFileSync("git", args, {
    cwd: APP_DIR,
    encoding: "utf-8",
    timeout: 30000,
  }).trim();
}

export function deployScriptMissingResponse(): NextResponse | null {
  if (!existsSync(PS_DEPLOY_SCRIPT)) {
    return NextResponse.json(
      { error: "Deploy runner missing (scripts/tooling/ps-deploy.mjs)" },
      { status: 500 }
    );
  }
  return null;
}

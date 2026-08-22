// ═══════════════════════════════════════════════════════════════
// git-workspace-branches — Git branch list + current ref for UI
// (extracted for testability; GET route delegates here.)
// ═══════════════════════════════════════════════════════════════

import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import { resolve as pathResolve } from "path";

import { logApiError } from "@/lib/api-logger";
import { normalizeGitCurrentForBranchesList } from "@/lib/git/git-branch-current";

export type GitExecFileAsync = (
  file: string,
  args: string[],
  options: { maxBuffer?: number; timeout?: number; windowsHide?: boolean },
) => Promise<{ stdout: string | Buffer }>;

const defaultExecFileAsync = promisify(execFile) as GitExecFileAsync;

export interface GitBranchMetadata {
  isGitRepo: boolean;
  branches: string[];
  current: string | null;
}

/**
 * Return branch names and normalised current branch for an absolute workspace path.
 * Uses a `.git` marker fast-path (no shell when absent). `execFileAsync` is injectable for tests.
 */
export async function readGitBranchMetadataForWorkspacePath(
  abs: string,
  execFileAsync: GitExecFileAsync = defaultExecFileAsync,
  exists: typeof existsSync = existsSync,
): Promise<GitBranchMetadata> {
  const gitMarker = pathResolve(abs, ".git");
  if (!exists(gitMarker)) {
    return { isGitRepo: false, branches: [], current: null };
  }

  let branchOut = "";
  try {
    const r = await execFileAsync("git", ["-C", abs, "branch", "--format=%(refname:short)"], {
      maxBuffer: 1024 * 1024,
      timeout: 8000,
      windowsHide: true,
    });
    branchOut = String(r.stdout || "");
  } catch (err) {
    logApiError("readGitBranchMetadataForWorkspacePath", "git branch", err);
  }
  const branches = branchOut
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let currentRaw: string | null = null;
  try {
    const r = await execFileAsync("git", ["-C", abs, "rev-parse", "--abbrev-ref", "HEAD"], {
      maxBuffer: 65536,
      timeout: 5000,
      windowsHide: true,
    });
    currentRaw = String(r.stdout || "").trim() || null;
  } catch {
    currentRaw = null;
  }
  const current = normalizeGitCurrentForBranchesList(branches, currentRaw);

  return { isGitRepo: true, branches, current };
}

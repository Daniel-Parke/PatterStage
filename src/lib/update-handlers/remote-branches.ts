// ═══════════════════════════════════════════════════════════════
// update-handlers/remote-branches.ts - which branches may be deployed
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the /api/update route god-file. The dropdown in
// VersionFooter is fed by `listRemoteBranches`, and `verifyDeployBranchOnOrigin`
// is the gate a POST update passes before anything is spawned. Every
// branch name that leaves this module has been through
// `sanitizeGitBranch`.

import { execFileSync } from "child_process";

import { sanitizeGitBranch } from "@/lib/git/git-branch";

import { APP_DIR, UPDATE_BRANCH, runGit } from "./shared";

const MAX_REMOTE_BRANCHES = 50;

export function listRemoteBranches(): string[] {
  try {
    // Ensure we have the latest remote refs (execFileSync: no shell, so no
    // "2>/dev/null" — which breaks on Windows cmd; stderr is dropped via stdio).
    execFileSync("git", ["fetch", "origin", "--quiet"], {
      cwd: APP_DIR,
      timeout: 15000,
      stdio: ["ignore", "ignore", "ignore"],
    });

    // Get remote branches
    const rawRemote = execFileSync("git", ["branch", "-r", "--format=%(refname:short)"], {
      cwd: APP_DIR,
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["ignore", "pipe", "ignore"],
    });

    // Get local branches — only include branches that exist locally (active/checked-out)
    const rawLocal = execFileSync("git", ["branch", "--format=%(refname:short)"], {
      cwd: APP_DIR,
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["ignore", "pipe", "ignore"],
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
        execFileSync("git", ["ls-remote", "--heads", "origin", UPDATE_BRANCH], {
          cwd: APP_DIR,
          encoding: "utf-8",
          timeout: 10000,
          stdio: ["ignore", "pipe", "ignore"],
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

/** Resolves `origin/<branch>` after fetch; returns an error message or null if OK. */
export function verifyDeployBranchOnOrigin(branch: string): string | null {
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

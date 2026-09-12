// ═══════════════════════════════════════════════════════════════
// update-handlers/version-check.ts - how far behind origin are we
// ═══════════════════════════════════════════════════════════════
//
// Extracted from the /api/update route god-file. Compares HEAD against
// `origin/<branch>` and caches the answer in the temp dir for five
// minutes, keyed by the branch it compared. Every failure path returns
// an "unknown" record rather than throwing: the footer showing "unknown"
// is a better outcome than the sidebar failing to render.

import { existsSync, writeFileSync, readFileSync } from "fs";

import { CACHE_FILE, CACHE_TTL_MS, UPDATE_BRANCH, runGit } from "./shared";

export interface VersionCache {
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
  /**
   * True when the compare could not be made at all (git could not reach
   * origin, or the checkout is not a git tree). The footer used to read only
   * `updateAvailable`, which is false on that path too, and painted "Up to
   * Date" over a failed fetch (T-0095, D107). Not knowing is its own state.
   */
  checkFailed: boolean;
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
    // A cache written before the field existed is a successful compare, or it
    // would not have been written: failures are never cached.
    return { ...(raw as VersionCache), checkFailed: raw.checkFailed === true };
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

export function checkVersion(branch?: string): VersionCache {
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
      checkFailed: false,
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
      checkFailed: true,
    };
  }
}

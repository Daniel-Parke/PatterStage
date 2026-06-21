// ═══════════════════════════════════════════════════════════════
// useGitBranches — debounced git-branch detection for a local path.
// Moves LocalDirRow's hand-rolled debounce + fetch + setState out of the
// component. Returns null until a non-empty path settles (400ms), then the
// repo's branch info (or EMPTY when not a git repo / lookup fails).
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useState } from "react";

import { useApiResource } from "./useApiResource";

export interface GitBranchesData {
  isGitRepo: boolean;
  branches: string[];
  current: string | null;
}

const EMPTY: GitBranchesData = { isGitRepo: false, branches: [], current: null };

export function useGitBranches(path: string): GitBranchesData | null {
  const trimmed = path.trim();
  const [debounced, setDebounced] = useState(trimmed);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(trimmed), 400);
    return () => clearTimeout(t);
  }, [trimmed]);

  const { data } = useApiResource<GitBranchesData>(
    ["git-branches", debounced],
    `/api/fs/git/branches?path=${encodeURIComponent(debounced)}`,
    {
      select: (payload) => payload as GitBranchesData | undefined,
      fallback: EMPTY,
      enabled: debounced.length > 0,
    },
  );

  if (trimmed.length === 0) return null;
  return data ?? EMPTY;
}

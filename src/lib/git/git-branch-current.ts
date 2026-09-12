// ═══════════════════════════════════════════════════════════════
// git-branch-current — Normalise `git rev-parse --abbrev-ref HEAD`
// for /api/fs/git/branches so the UI never shows bogus branch labels.
// ═══════════════════════════════════════════════════════════════

/**
 * Coerce raw `rev-parse` output to a branch name listed in `branches`,
 * or null for detached HEAD, literal `HEAD`, bare SHA, or unknown refs.
 */
export function normalizeGitCurrentForBranchesList(
  branches: string[],
  raw: string | null,
): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t === "HEAD") return null;
  if (/^[0-9a-f]{7,40}$/i.test(t)) return null;
  if (branches.length > 0 && !branches.includes(t)) return null;
  return t;
}

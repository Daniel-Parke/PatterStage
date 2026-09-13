/**
 * Git branch names for deploy / version checks.
 * Same rules on client (Sidebar) and server (POST /api/update) — no shell metacharacters.
 */

export const MAX_DEPLOY_GIT_BRANCH_LEN = 200;

/**
 * Sanitise a raw branch name for use in shell commands.
 * Strips any character not in `[a-zA-Z0-9._/-]` and clamps to MAX_DEPLOY_GIT_BRANCH_LEN.
 * Returns `"dev"` as a safe fallback if the input becomes empty.
 */
export function sanitizeGitBranch(raw: string): string {
  const s = raw.replace(/[^a-zA-Z0-9._/-]/g, "").slice(0, MAX_DEPLOY_GIT_BRANCH_LEN);
  return s || "dev";
}

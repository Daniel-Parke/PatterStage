// ═══════════════════════════════════════════════════════════════
// deploy-action-labels.ts - what the deploy status says out loud
// ═══════════════════════════════════════════════════════════════
//
// Extracted from VersionFooter.tsx alongside useVersionFooter. The poll
// loop reads a machine-shaped status record from GET /api/update?deploy=1
// and has to render one line of English for it. That mapping is copy, not
// state, so it lives here next to `deploy-action-fallback.ts` rather than
// inside the hook.

/** The three deploy actions supported by POST /api/update. */
export type DeployAction = "update" | "restart" | "rebuild";

/**
 * The line shown while a deploy is running. `phase` is the runner's own
 * vocabulary; anything it does not recognise falls back to the runner's
 * message, and then to a generic "working".
 */
export function deployPhaseLabel(deploy: { phase?: string; message?: string }): string {
  return deploy.phase === "build"
    ? "Building…"
    : deploy.phase === "install"
      ? "Installing dependencies…"
      : deploy.phase === "restart"
        ? "Restarting server…"
        : deploy.phase === "git"
          ? "Updating code…"
          : deploy.message || "Working…";
}

/** The line shown once the deploy the caller was waiting on has succeeded. */
export function deployCompletionLabel(action: DeployAction): string {
  return action === "rebuild"
    ? "Rebuild complete"
    : action === "restart"
      ? "Restart complete"
      : "Update complete";
}

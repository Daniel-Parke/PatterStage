// ═══════════════════════════════════════════════════════════════
// feature-flags.ts — env-gated feature flags
//
// Keeps in-progress surfaces dark in normal installs while they land
// incrementally. Read from an env var so a flag can be toggled per-process
// without a DB write or rebuild.
// ═══════════════════════════════════════════════════════════════

const TRUTHY = new Set(["1", "true", "yes", "on"]);

export type FeatureFlag = "composer";

/** True when the given feature flag is enabled for this process. */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  switch (flag) {
    case "composer":
      // The Composer graph orchestrator. Schema + seed always present; this
      // gates the execution engine + API + UI until it ships by default.
      return TRUTHY.has((process.env.PS_COMPOSER ?? "").trim().toLowerCase());
    default:
      return false;
  }
}

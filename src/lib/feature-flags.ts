// ═══════════════════════════════════════════════════════════════
// feature-flags.ts — env-gated feature flags
//
// Keeps in-progress surfaces dark in normal installs while their data model
// lands incrementally. A flag is read from an env var so it can be toggled
// per-process without a DB write or rebuild.
// ═══════════════════════════════════════════════════════════════

const TRUTHY = new Set(["1", "true", "yes", "on"]);

export type FeatureFlag = "missions_v2";

/** True when the given feature flag is enabled for this process. */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  switch (flag) {
    case "missions_v2":
      // Mission V2 (multi-phase orchestration). Foundation tables always exist;
      // this gates the V2 read/write/UI paths until the engine ships.
      return TRUTHY.has((process.env.PS_MISSIONS_V2 ?? "").trim().toLowerCase());
    default:
      return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// feature-flags.ts — env-gated feature flags (default ON)
//
// Flags default to ENABLED so a page is shown in the sidebar, linkable, and
// served out of the box. An operator opts OUT by setting the flag's env var to
// a falsy value (0/false/no/off) — same convention as `isDeployApiEnabled`
// in api-auth.ts. Read from env so a flag toggles per-process without a DB
// write or rebuild.
// ═══════════════════════════════════════════════════════════════

const FALSY = new Set(["0", "false", "no", "off"]);

export type FeatureFlag = "composer";

/** Each feature flag → the env var(s) that can disable it (first non-empty wins). */
const FLAG_ENV: Record<FeatureFlag, string[]> = {
  // The Composer graph orchestrator (engine + API + UI). Schema + seed are
  // always present; this only gates whether the feature is live.
  composer: ["PS_COMPOSER"],
};

function firstEnvValue(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value.trim() !== "") return value.trim().toLowerCase();
  }
  return undefined;
}

/**
 * True unless the flag's env var is explicitly falsy. Unset / empty / any
 * truthy value all resolve to enabled (default ON).
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const value = firstEnvValue(FLAG_ENV[flag]);
  if (value === undefined) return true;
  return !FALSY.has(value);
}

/** All known flags + their current enabled state — surfaced to the client. */
export function getFeatureFlags(): Record<FeatureFlag, boolean> {
  const out = {} as Record<FeatureFlag, boolean>;
  for (const flag of Object.keys(FLAG_ENV) as FeatureFlag[]) {
    out[flag] = isFeatureEnabled(flag);
  }
  return out;
}

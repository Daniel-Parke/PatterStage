// ═══════════════════════════════════════════════════════════════
// hermes-home.ts — Local Hermes install path resolution
// ═══════════════════════════════════════════════════════════════
//
// Resolves the local Hermes agent filesystem root from environment
// variables with a hard-coded fallback to ~/.hermes.
// ═══════════════════════════════════════════════════════════════

import { homedir } from "os";

const DEFAULT_HERMES_HOME = homedir() + "/.hermes";

/**
 * Resolve the Hermes filesystem root:
 *   1. HERMES_HOME or AGENT_HOME env var
 *   2. Hard-coded default: ~/.hermes
 */
export function getHermesHome(): string {
  const envHome = process.env.HERMES_HOME || process.env.AGENT_HOME;
  if (envHome && String(envHome).trim()) {
    return String(envHome).trim().replace(/[/\\]+$/, "");
  }
  return DEFAULT_HERMES_HOME;
}

/** Alias for path allowlist checks. */
export function getHermesFilesystemRoot(): string {
  return getHermesHome();
}

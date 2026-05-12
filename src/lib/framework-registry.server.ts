// ═══════════════════════════════════════════════════════════════
// framework-registry.server.ts — server-only framework persistence
//
// MUST NOT be imported by client components. Contains fs and
// hermes-agent-runtime imports that only exist in the server.
//
// Used by: hermes-config-sync, sync-manager, API routes.
// ═══════════════════════════════════════════════════════════════

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { getActiveHermesHome } from "./hermes-agent-runtime";

let _activeFrameworkId: string | null = null;

/** Lazily construct the active-framework file path. */
function activeFwFilePath(): string {
  return `${getActiveHermesHome()}/.control-hub-active-fw.json`;
}

/**
 * Read the currently active framework ID from disk.
 * Returns "hermes" as default if the file does not exist or is malformed.
 */
export function getActiveFrameworkId(): string {
  if (_activeFrameworkId !== null) return _activeFrameworkId;
  try {
    const file = activeFwFilePath();
    if (!existsSync(file)) {
      _activeFrameworkId = "hermes";
      return _activeFrameworkId;
    }
    const raw = JSON.parse(readFileSync(file, "utf-8"));
    _activeFrameworkId = (raw.id as string) || "hermes";
    return _activeFrameworkId;
  } catch {
    _activeFrameworkId = "hermes";
    return _activeFrameworkId;
  }
}

/**
 * Persist the active framework ID to disk and update the in-memory cache.
 */
export function setActiveFrameworkId(id: string): void {
  _activeFrameworkId = id;
  try {
    const home = getActiveHermesHome();
    if (!existsSync(home)) mkdirSync(home, { recursive: true });
    writeFileSync(
      activeFwFilePath(),
      JSON.stringify({ id, updatedAt: new Date().toISOString() }),
      "utf-8"
    );
  } catch {
    // best-effort
  }
}

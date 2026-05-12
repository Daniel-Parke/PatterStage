// ═══════════════════════════════════════════════════════════════
// framework-registry.server.ts — server-only framework persistence
//
// MUST NOT be imported by client components. Contains fs and
// hermes-agent-runtime imports that only exist in the server.
//
// Used by: hermes-config-sync, sync-manager, API routes.
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { getActiveHermesHome } from "./hermes-agent-runtime";

/** Path to the persisted active-framework file. */
const ACTIVE_FW_FILE = `${getActiveHermesHome()}/.control-hub-active-fw.json`;

let _activeFrameworkId: string | null = null;

/**
 * Read the currently active framework ID from disk.
 * Returns "hermes" as default if the file does not exist or is malformed.
 */
export function getActiveFrameworkId(): string {
  if (_activeFrameworkId !== null) return _activeFrameworkId;
  try {
    if (!existsSync(ACTIVE_FW_FILE)) {
      _activeFrameworkId = "hermes";
      return _activeFrameworkId;
    }
    const raw = JSON.parse(readFileSync(ACTIVE_FW_FILE, "utf-8"));
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
      `${home}/.control-hub-active-fw.json`,
      JSON.stringify({ id, updatedAt: new Date().toISOString() }),
      "utf-8"
    );
  } catch {
    // best-effort
  }
}

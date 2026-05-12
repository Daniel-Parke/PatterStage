// ═══════════════════════════════════════════════════════════════
// Framework Registry — maps framework IDs to display metadata
//
// This module is SAFE for client components — server-side functions
// use guards to prevent fs from being bundled into client code.
// ═══════════════════════════════════════════════════════════════

export interface FrameworkEntry {
    id: string;
    label: string;
    description: string;
    icon: string;
    /** User-friendly filesystem root description (e.g. "~/.hermes/*") */
    filesystemRootDescription: string;
}

/** Currently registered agent frameworks. */
export const FRAMEWORKS: FrameworkEntry[] = [
    {
        id: "hermes",
        label: "Default Hermes",
        description: "The standard Hermes agent installed at ~/.hermes/",
        icon: "Server",
        filesystemRootDescription: "~/.hermes/*",
    },
];

/** The reserved ID for the universal/default scope. */
export const UNIVERSAL_FRAMEWORK_ID = "*";

/** The reserved display label for the universal scope. */
export const UNIVERSAL_FRAMEWORK_LABEL = "Universal";

export function getFramework(id: string): FrameworkEntry | undefined {
    return FRAMEWORKS.find(f => f.id === id);
}

export function listFrameworks(): FrameworkEntry[] {
  return [...FRAMEWORKS];
}

// ── Server-side helpers (guarded so fs is not bundled in client) ─

let _activeFrameworkId: string | null = null;

/**
 * Server-side: read the currently active framework ID from disk.
 * Returns null when called from the browser (client components).
 */
export function getActiveFrameworkId(): string {
  if (_activeFrameworkId !== null) return _activeFrameworkId;
  if (typeof window !== "undefined") {
    return "hermes";
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getActiveHermesHome } = require("./hermes-agent-runtime");
    const file = `${getActiveHermesHome()}/.control-hub-active-fw.json`;
    if (!fs.existsSync(file)) { _activeFrameworkId = "hermes"; return _activeFrameworkId; }
    const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    _activeFrameworkId = (raw.id as string) || "hermes";
    return _activeFrameworkId;
  } catch {
    _activeFrameworkId = "hermes";
    return _activeFrameworkId;
  }
}

/**
 * Server-side: persist the active framework ID to disk.
 * No-op when called from the browser (client components).
 */
export function setActiveFrameworkId(id: string): void {
  _activeFrameworkId = id;
  if (typeof window !== "undefined") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getActiveHermesHome } = require("./hermes-agent-runtime");
    const home = getActiveHermesHome();
    if (!fs.existsSync(home)) fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(
      `${home}/.control-hub-active-fw.json`,
      JSON.stringify({ id, updatedAt: new Date().toISOString() }),
      "utf-8"
    );
  } catch {
    // best-effort
  }
}

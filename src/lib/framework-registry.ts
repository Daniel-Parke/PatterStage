// ═══════════════════════════════════════════════════════════════
// Framework Registry — maps framework IDs to display metadata
//
// This module is SAFE for client components. No fs or server-only
// imports. Server-side persistence is in framework-registry.server.ts.
// ═══════════════════════════════════════════════════════════════

export interface FrameworkEntry {
    id: string;
    label: string;
    description: string;
    icon: string;
    /** User-friendly filesystem root description (e.g. "~/.hermes/*") */
    filesystemRootDescription: string;
}

/** Internal mutable registry — frameworks registered at module load time. */
const _frameworks = new Map<string, FrameworkEntry>();

/** Seed with the built-in Hermes framework. */
_frameworks.set("hermes", {
    id: "hermes",
    label: "Default Hermes",
    description: "The standard Hermes agent installed at ~/.hermes/",
    icon: "Server",
    filesystemRootDescription: "~/.hermes/*",
});

/**
 * Register a new agent framework at runtime.
 * Idempotent: calling twice with the same id overwrites the previous entry.
 * Returns true if the framework was newly added, false if it was replaced.
 */
export function registerFramework(entry: FrameworkEntry): boolean {
    const existed = _frameworks.has(entry.id);
    _frameworks.set(entry.id, entry);
    return !existed;
}

/**
 * Unregister a framework by id. Returns true if it existed and was removed.
 * Cannot unregister the built-in "hermes" framework (returns false for safety).
 */
export function unregisterFramework(id: string): boolean {
    if (id === "hermes") return false;
    return _frameworks.delete(id);
}

/** Check if a framework id is registered. */
export function isFrameworkRegistered(id: string): boolean {
    return _frameworks.has(id);
}

/** The reserved ID for the universal/default scope. */
export const UNIVERSAL_FRAMEWORK_ID = "*";

/** The reserved display label for the universal scope. */
export const UNIVERSAL_FRAMEWORK_LABEL = "Universal";

export function getFramework(id: string): FrameworkEntry | undefined {
    return _frameworks.get(id);
}

export function listFrameworks(): FrameworkEntry[] {
  return [..._frameworks.values()];
}

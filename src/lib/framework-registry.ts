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

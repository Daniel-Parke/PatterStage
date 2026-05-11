// ═══════════════════════════════════════════════════════════════
// Framework Registry — maps framework IDs to display metadata
//
// This module is SAFE for client components — no fs imports.
// Active framework persistence is handled server-side in the
// /api/models/framework API route.
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

export function getFramework(id: string): FrameworkEntry | undefined {
    return FRAMEWORKS.find(f => f.id === id);
}

export function listFrameworks(): FrameworkEntry[] {
  return [...FRAMEWORKS];
}

export function getActiveFrameworkId(): string {
  return "hermes";
}

export function setActiveFrameworkId(_id: string): void {
  // Persisted via /api/models/framework API route.
}

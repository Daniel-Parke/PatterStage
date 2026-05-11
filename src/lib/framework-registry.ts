// ═══════════════════════════════════════════════════════════════
// Framework Registry — maps framework IDs to display metadata
// ═══════════════════════════════════════════════════════════════

export interface FrameworkEntry {
    id: string;
    label: string;
    description: string;
    icon: string;
    filesystemRoot: string;
}

export const FRAMEWORKS: FrameworkEntry[] = [
    {
        id: "hermes",
        label: "Default Hermes",
        description: "~/.hermes/*",
        icon: "Server",
        filesystemRoot: "",
    },
];

export function getFramework(id: string): FrameworkEntry | undefined {
    return FRAMEWORKS.find(f => f.id === id);
}

/**
 * Returns the active framework ID used for model lookup/sync.
 * Currently hard-coded to "hermes" since only one framework is registered.
 */
export function getActiveFrameworkId(): string {
  return "hermes";
}

export function listFrameworks(): FrameworkEntry[] {
  return FRAMEWORKS;
}
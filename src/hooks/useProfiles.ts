// ═══════════════════════════════════════════════════════════════
// useProfiles — agent profile list for selectors. Thin useApiResource
// wrapper so ProfileSelector (and any future picker) stops hand-rolling
// fetch/loading state in a useEffect.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useApiResource } from "./useApiResource";

export interface UiProfile {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  /** Whether the stored profile matches Hermes on disk; the Tools page reads it (T-0129). */
  syncStatus?: "synced" | "drift" | "error";
}

export function useProfiles() {
  return useApiResource<UiProfile[]>("/api/agent/profiles", {
    select: (payload) => {
      const raw = (payload as { profiles?: Record<string, unknown>[] } | undefined)?.profiles;
      if (!Array.isArray(raw)) return undefined;
      return raw.map((p) => ({
        id: p.id as string,
        name: p.name as string,
        description: (p.description as string) || "",
        isDefault: (p.isDefault as boolean) ?? false,
        syncStatus: p.syncStatus as UiProfile["syncStatus"],
      }));
    },
    fallback: [],
  });
}

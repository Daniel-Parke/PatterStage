// ═══════════════════════════════════════════════════════════════
// useArtifacts — list + single-artifact read hooks for the registry.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useApiResource } from "./useApiResource";
import type { Artifact, ArtifactSummary } from "@/lib/artifacts-repository";

/** All artifacts (newest first), optionally filtered by source kind. */
export function useArtifacts(kind?: string) {
  const qs = kind ? `?kind=${encodeURIComponent(kind)}` : "";
  return useApiResource<ArtifactSummary[]>(["artifacts", kind ?? "all"], `/api/artifacts${qs}`, {
    select: (p) => (p as { artifacts?: ArtifactSummary[] } | undefined)?.artifacts,
    fallback: [],
    refetchInterval: 5000,
  });
}

/** One artifact with its content body. */
export function useArtifact(id: string | null) {
  return useApiResource<Artifact>(["artifact", id ?? "none"], `/api/artifacts/${id ?? ""}`, {
    select: (p) => (p as { artifact?: Artifact } | undefined)?.artifact,
    enabled: Boolean(id),
  });
}

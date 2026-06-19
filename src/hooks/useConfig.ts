// ═══════════════════════════════════════════════════════════════
// useConfig — TanStack Query data layer for the parsed config.yaml
// ═══════════════════════════════════════════════════════════════
//
// Returns the parsed config object (or null on error, which the page
// renders as "Failed to load configuration.").

"use client";

import { useApiResource } from "./useApiResource";

export function useConfig() {
  return useApiResource<Record<string, unknown>>(["config"], "/api/config", {
    select: (p) => (p as Record<string, unknown> | null) ?? undefined,
    fallback: {},
    errorMessage: "Failed to load config",
  });
}

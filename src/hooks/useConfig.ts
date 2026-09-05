// ═══════════════════════════════════════════════════════════════
// useConfig — TanStack Query data layer for the parsed config.yaml
// ═══════════════════════════════════════════════════════════════
//
// Returns the parsed config object (or null on error, which the page
// renders as "Failed to load configuration.").

"use client";

import { useApiResource } from "./useApiResource";

export function useConfig() {
  const resource = useApiResource<Record<string, unknown>, { configError: string | null }>(
    ["config"],
    "/api/config",
    {
      select: (p) => (p as Record<string, unknown> | null) ?? undefined,
      fallback: {},
      errorMessage: "Failed to load config",
      // An unparseable file answers 200 with `{}` and this sibling. Without it
      // the caller cannot tell a broken config.yaml from an empty one, and
      // every surface that reads this hook drew a fresh install (T-0100, D75).
      selectMeta: (b) => ({
        configError: (b as { configError?: string } | null)?.configError ?? null,
      }),
    },
  );
  return { ...resource, configError: resource.meta?.configError ?? null };
}

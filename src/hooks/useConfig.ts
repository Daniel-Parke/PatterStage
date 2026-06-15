// ═══════════════════════════════════════════════════════════════
// useConfig — TanStack Query data layer for the parsed config.yaml
// ═══════════════════════════════════════════════════════════════
//
// Replaces the config index page's single-fetch `useApiData` usage.
// Returns the parsed config object (or null on error, which the page
// renders as "Failed to load configuration.").

"use client";

import { useQuery } from "@tanstack/react-query";

import { safeApiCall } from "@/lib/api-fetch";

async function fetchConfig(): Promise<Record<string, unknown>> {
  const res = await safeApiCall<{ data?: Record<string, unknown> }>("/api/config");
  if (!res.ok) throw new Error(res.error ?? "Failed to load config");
  return res.data?.data ?? {};
}

export function useConfig() {
  const query = useQuery({
    queryKey: ["config"],
    queryFn: fetchConfig,
  });
  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.isError ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}

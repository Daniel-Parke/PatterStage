// ═══════════════════════════════════════════════════════════════
// useLogs — TanStack Query data layer for the System Logs viewer
// ═══════════════════════════════════════════════════════════════
//
// The reactive log name + line count live in the query key (so a file/size
// change refetches), and the 5s auto-refresh maps to `refetchInterval` gated
// by the page's `autoRefresh` toggle. `isFetching` drives the "Refresh"
// affordance (true during any fetch), `isLoading` the first-load spinner.

"use client";

import { useApiResource } from "./useApiResource";
import type { LogGetData } from "@/app/api/logs/route";

export function useLogs(name: string, lines: number, opts: { autoRefresh: boolean }) {
  return useApiResource<LogGetData>(
    ["logs", name, lines],
    `/api/logs?name=${encodeURIComponent(name)}&lines=${lines}`,
    {
      select: (p) => p as LogGetData | undefined,
      errorMessage: "Failed to load log",
      refetchInterval: opts.autoRefresh ? 5_000 : false,
    },
  );
}

export type { LogGetData };

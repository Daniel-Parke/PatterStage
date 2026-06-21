// ═══════════════════════════════════════════════════════════════
// useScripts — host script files (PS_DATA_DIR/scripts) via /api/scripts
//
// File-aware view for the Scripts page: list files + schedule + last run, run a
// script on demand, and fetch its log. Scheduling itself stays on the System-cron
// stack (useSystemCronJobs → /api/cron/hardware).
// ═══════════════════════════════════════════════════════════════

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { safeApiCall } from "@/lib/api-fetch";

export interface ScriptFile {
  name: string;
  path: string;
  size: number;
  modified: string;
  schedule: string | null;
  hasLog: boolean;
  lastRun: string | null;
}

async function fetchScripts(): Promise<ScriptFile[]> {
  const res = await safeApiCall<{ data?: { scripts: ScriptFile[] } }>("/api/scripts");
  if (!res.ok) throw new Error(res.error ?? "Failed to load scripts");
  return res.data?.data?.scripts ?? [];
}

export function useScripts() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["scripts"], queryFn: fetchScripts, refetchInterval: 30_000 });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["scripts"] });

  const run = useMutation({
    mutationFn: (name: string) =>
      safeApiCall<{ data?: { exitCode: number | null; ok: boolean } }>("/api/scripts/run", {
        method: "POST",
        body: { name },
      }),
    onSuccess: invalidate,
  });

  return {
    scripts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.isError ? (query.error as Error).message : null,
    refetch: () => query.refetch(),
    run,
  };
}

/** Fetch the tail of a script's log on demand (used by the Logs modal). */
export async function fetchScriptLog(name: string, lines = 200): Promise<string> {
  const res = await safeApiCall<{ data?: { log: string } }>(
    `/api/scripts/logs?name=${encodeURIComponent(name)}&lines=${lines}`,
  );
  if (!res.ok) throw new Error(res.error ?? "Failed to load log");
  return res.data?.data?.log ?? "";
}

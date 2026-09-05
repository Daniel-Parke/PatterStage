// ═══════════════════════════════════════════════════════════════
// useScripts — host script files (PS_DATA_DIR/scripts) via /api/scripts
//
// File-aware view for the Scripts page: list files + schedule + last run, run a
// script on demand, and fetch its log. A schedule lives on the host crontab
// where there is one and in PatterStage's own `schedules` table where there is
// not, so the payload carries `scheduler` and every row says which it is on
// (T-0107, decision 10).
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
  /** Where this row's schedule lives. null when it has none. */
  scheduleSource: "host" | "patterstage" | null;
  /** The `schedules.id` when scheduleSource === "patterstage", else null. */
  scheduleId: string | null;
  hasLog: boolean;
  lastRun: string | null;
}

/** Whether this host schedules without PatterStage, and what that means. */
export interface SchedulerAvailability {
  available: boolean;
  reason: string;
}

interface ScriptsPayload {
  scripts: ScriptFile[];
  scheduler: SchedulerAvailability;
}

/** The answer before the first response lands. Optimistic on purpose: the
 *  Schedule button is only reachable from a rendered row, which implies a read
 *  that already completed, and an empty reason renders nothing. */
const SCHEDULER_UNKNOWN: SchedulerAvailability = { available: true, reason: "" };

async function fetchScripts(): Promise<ScriptsPayload> {
  const res = await safeApiCall<{ data?: ScriptsPayload }>("/api/scripts");
  if (!res.ok) throw new Error(res.error ?? "Failed to load scripts");
  return {
    scripts: res.data?.data?.scripts ?? [],
    scheduler: res.data?.data?.scheduler ?? SCHEDULER_UNKNOWN,
  };
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
    scripts: query.data?.scripts ?? [],
    scheduler: query.data?.scheduler ?? SCHEDULER_UNKNOWN,
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

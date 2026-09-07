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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiQueryKey, useApiResource } from "@/hooks/useApiResource";
import { safeApiCall } from "@/lib/api-fetch";

/** How a run ended. "not-started" never reached the script at all. */
export type ScriptRunOutcome = "succeeded" | "failed" | "not-started";

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
  /**
   * How the last recorded run ended, from the ledger, or null when it holds
   * nothing for this script. `lastRun` above is the log file's timestamp: it
   * says when output was last written, never whether the run worked.
   */
  lastOutcome: ScriptRunOutcome | null;
  /** When that recorded run happened, or null when there is none. */
  lastOutcomeAt: string | null;
  /** The code that run returned, when it ran at all. */
  lastExitCode: number | null;
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


export function useScripts() {
  const qc = useQueryClient();
  const query = useApiResource<ScriptsPayload>("/api/scripts", {
    select: (p) => {
      const d = p as Partial<ScriptsPayload> | null;
      if (!d) return undefined;
      return { scripts: d.scripts ?? [], scheduler: d.scheduler ?? SCHEDULER_UNKNOWN };
    },
    errorMessage: "Failed to load scripts",
    refetchInterval: 30_000,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: apiQueryKey("/api/scripts") });

  const run = useMutation({
    // A run that could not be started answers non-2xx with the reason, so the
    // caller reads `ok` and the outcome, not an exit code that never existed.
    mutationFn: (name: string) =>
      safeApiCall<{ data?: { outcome: ScriptRunOutcome; exitCode: number | null; ok: boolean } }>(
        "/api/scripts/run",
        { method: "POST", body: { name } },
      ),
    onSuccess: invalidate,
  });

  return {
    scripts: query.data?.scripts ?? [],
    scheduler: query.data?.scheduler ?? SCHEDULER_UNKNOWN,
    isLoading: query.isLoading,
    error: query.error,
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

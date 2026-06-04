// ═══════════════════════════════════════════════════════════════
// useCronJobs — Unified hook for agent cron job CRUD
// ═══════════════════════════════════════════════════════════════
// Handles cron job list, toggle, delete, run, pauseAll, sync.
// Uses /api/cron endpoint with standard { jobs, total } shape.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback } from "react";
import { useApiData } from "@/hooks/useApiData";
import { useToast } from "@/components/ui/Toast";
import { safeApiCall } from "@/lib/api-fetch";
import { useCronJobMutation } from "@/hooks/useCronJobMutation";
import { toastFromResult } from "@/lib/toast-from-result";

// Re-export CronJob type from JobCard for consumers
import type { CronJob } from "@/components/cron/JobCard";
export type { CronJob };

interface CronData {
  jobs: CronJob[];
  total: number;
}

export function useCronJobs() {
  const { showToast } = useToast();
  const { data, loading, refetch: loadJobs } = useApiData<CronData>("/api/cron");

  const jobs = (data?.jobs as CronJob[]) ?? [];

  // Toggle / delete / pauseAll are factored into useCronJobMutation
  // (shared with useSystemCronJobs). Run-now is a single-call agent-specific
  // action, so it stays inline.
  const { handleToggle, handleDelete, handlePauseAll, pauseAllBusy } =
    useCronJobMutation<CronJob>({
      endpoint: "/api/cron",
      findJob: (id) => jobs.find((j) => j.id === id),
      buildToggleBody: (_job, nextEnabled) => ({
        action: nextEnabled ? "resume" : "pause",
      }),
      toggleSuccess: (nextEnabled) =>
        `Job ${nextEnabled ? "Resumed" : "Paused"}`,
      toggleErrorFallback: (nextEnabled) =>
        `Failed to ${nextEnabled ? "resume" : "pause"} job`,
      deleteSuccess: "Job deleted",
      deleteErrorFallback: "Failed to delete job",
      pauseAll: {
        success: "All jobs paused",
        errorFallback: "Failed to pause jobs",
      },
      refetch: loadJobs,
    });

  const handleRun = useCallback(
    async (id: string) => {
      const result = await safeApiCall("/api/cron", {
        method: "PUT",
        body: { id, action: "run" },
      });
      toastFromResult(
        showToast,
        result,
        "Run triggered",
        "Failed to trigger run",
      );
      loadJobs();
    },
    [showToast, loadJobs],
  );

  return {
    data,
    jobs,
    loading,
    loadJobs,
    handleToggle,
    handleDelete,
    handleRun,
    handlePauseAll,
    pauseAllBusy,
  };
}

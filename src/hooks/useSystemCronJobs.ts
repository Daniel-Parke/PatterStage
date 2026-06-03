// ═══════════════════════════════════════════════════════════════
// useSystemCronJobs — System cron jobs
// ═══════════════════════════════════════════════════════════════
// Handles system cron job CRUD via /api/cron/hardware.
// Toggle / delete / pauseAll share patterns with useCronJobs via
// the shared useCronJobMutation hook; handleSave is hardware-specific.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useMemo } from "react";
import { useApiData } from "@/hooks/useApiData";
import { useToast } from "@/components/ui/Toast";
import { safeApiCall } from "@/lib/api-fetch";
import { useCronJobMutation } from "@/hooks/useCronJobMutation";
import type { SystemCronJob } from "@/types/hermes";

const HARDWARE_ENDPOINT = "/api/cron/hardware";

interface SystemCronData {
  jobs: SystemCronJob[];
  total: number;
}

export function useSystemCronJobs() {
  const { showToast } = useToast();

  const { data, loading, refetch: loadJobs } = useApiData<SystemCronData>(
    HARDWARE_ENDPOINT,
  );

  const jobs = useMemo(() => data?.jobs ?? [], [data]);

  // Toggle / delete / pauseAll are factored into useCronJobMutation
  // (shared with useCronJobs). handleSave is hardware-specific and stays
  // inline below.
  const { handleToggle, handleDelete, handlePauseAll } =
    useCronJobMutation<SystemCronJob>({
      endpoint: HARDWARE_ENDPOINT,
      findJob: (id) => jobs.find((j) => j.id === id),
      buildToggleBody: (_job, nextEnabled) => ({ enabled: nextEnabled }),
      toggleSuccess: (nextEnabled) =>
        nextEnabled ? "System cron job enabled" : "System cron job paused",
      toggleErrorFallback: () => "Failed to update system cron job",
      deleteSuccess: "System cron job deleted",
      deleteErrorFallback: "Failed to delete system cron job",
      pauseAll: {
        success: "Paused {count} system cron job(s)",
        errorFallback: "Failed to pause system cron jobs",
        showCount: true,
      },
      refetch: loadJobs,
    });

  const handleSave = useCallback(
    async (job: Partial<SystemCronJob>) => {
      try {
        if (job.id) {
          const result = await safeApiCall(HARDWARE_ENDPOINT, {
            method: "PUT",
            body: job,
          });
          if (!result.ok) throw new Error(result.error || "Failed to update system cron job");
          showToast("System cron job updated");
        } else {
          const result = await safeApiCall(HARDWARE_ENDPOINT, {
            method: "POST",
            body: job,
          });
          if (!result.ok) throw new Error(result.error || "Failed to create system cron job");
          showToast("System cron job created");
        }
        loadJobs();
      } catch (e) {
        showToast(
          e instanceof Error ? e.message : "Failed to save system cron job",
          "error",
        );
      }
    },
    [showToast, loadJobs],
  );

  return {
    jobs,
    loading,
    loadJobs,
    handleToggle,
    handleDelete,
    handleSave,
    handlePauseAll,
  };
}

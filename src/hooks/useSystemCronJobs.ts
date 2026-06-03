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
import { safeApiCall, toastError } from "@/lib/api-fetch";
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
      // The PUT-vs-POST branch only differs in (a) HTTP method, (b) success
      // toast text, and (c) fallback error text. Collapsing it into a single
      // safeApiCall + toast trio keeps the two branches in lockstep if a
      // future "also clear form" or "also sync" extension lands. The
      // `id`-derived discriminator is exactly the same branch the inline
      // form used (job.id is truthy → PUT/update, falsy → POST/create), so
      // the behaviour is byte-equivalent: same endpoint, same method, same
      // body, same success toasts in each branch, same fallback text in
      // each branch, same loadJobs() refetch on success, same toastError
      // catch-block toast.
      const isUpdate = !!job.id;
      const successMsg = isUpdate
        ? "System cron job updated"
        : "System cron job created";
      const fallback = isUpdate
        ? "Failed to update system cron job"
        : "Failed to create system cron job";
      try {
        const result = await safeApiCall(HARDWARE_ENDPOINT, {
          method: isUpdate ? "PUT" : "POST",
          body: job,
        });
        if (!result.ok) throw new Error(result.error || fallback);
        showToast(successMsg);
        loadJobs();
      } catch (e) {
        toastError(showToast, e, "Failed to save system cron job");
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

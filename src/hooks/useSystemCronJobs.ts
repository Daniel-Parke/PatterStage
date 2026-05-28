// ═══════════════════════════════════════════════════════════════
// useSystemCronJobs — System cron jobs
// ═══════════════════════════════════════════════════════════════
// Handles system cron job CRUD via /api/cron/hardware.
// Shares patterns with useCronJobs but uses hardware-specific
// toast messages and has handleSave (specific to hardware).
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback } from "react";
import { useApiData } from "@/hooks/useApiData";
import { useToast } from "@/components/ui/Toast";
import { safeApiCall } from "@/lib/api-fetch";
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
    { transform: (raw) => raw as SystemCronData },
  );

  const jobs = data?.jobs ?? [];

  const handleToggle = useCallback(
    async (id: string) => {
      const job = jobs.find((j) => j.id === id);
      if (!job) return;
      const newEnabled = !job.enabled;
      const { ok, error } = await safeApiCall(HARDWARE_ENDPOINT, {
        method: "PUT",
        body: { id, enabled: newEnabled },
      });
      if (ok) {
        showToast(newEnabled ? "System cron job enabled" : "System cron job paused");
        loadJobs();
      } else {
        showToast(error ?? "Failed to update system cron job", "error");
      }
    },
    [jobs, showToast, loadJobs],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const { ok, error } = await safeApiCall(`${HARDWARE_ENDPOINT}?id=${id}`, {
        method: "DELETE",
      });
      if (ok) {
        showToast("System cron job deleted");
      } else {
        showToast(error ?? "Failed to delete system cron job", "error");
      }
      loadJobs();
    },
    [showToast, loadJobs],
  );

  const handleSave = useCallback(
    async (job: Partial<SystemCronJob>) => {
      try {
        if (job.id) {
          const { ok, error } = await safeApiCall(HARDWARE_ENDPOINT, {
            method: "PUT",
            body: job,
          });
          if (!ok) throw new Error(error || "Failed to update system cron job");
          showToast("System cron job updated");
        } else {
          const { ok, error } = await safeApiCall(HARDWARE_ENDPOINT, {
            method: "POST",
            body: job,
          });
          if (!ok) throw new Error(error || "Failed to create system cron job");
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

  const handlePauseAll = useCallback(async (): Promise<void> => {
    const { ok, error, data: resData } = await safeApiCall<{ pausedCount?: number }>(
      HARDWARE_ENDPOINT,
      {
        method: "POST",
        body: { action: "pauseAll" },
      },
    );
    if (!ok) {
      showToast(error || "Failed to pause system cron jobs", "error");
    } else {
      showToast(`Paused ${resData?.pausedCount ?? 0} system cron job(s)`);
    }
    // Always refetch so the UI reflects the latest state regardless of outcome.
    loadJobs();
  }, [showToast, loadJobs]);

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

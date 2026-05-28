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

// Re-export CronJob type from JobCard for consumers
import type { CronJob } from "@/components/cron/JobCard";
export type { CronJob };

interface CronData {
  jobs: CronJob[];
  total: number;
}

export function useCronJobs() {
  const { showToast } = useToast();
  const { data, loading, refetch: loadJobs } = useApiData<CronData>("/api/cron", {
    transform: (raw) => raw as CronData,
  });

  const jobs = (data?.jobs as CronJob[]) ?? [];

  const handleToggle = useCallback(
    async (id: string) => {
      const job = data?.jobs.find((j: CronJob) => j.id === id);
      if (!job) return;
      const action = job.enabled ? "pause" : "resume";
      const { ok, error } = await safeApiCall("/api/cron", {
        method: "PUT",
        body: { id, action },
      });
      showToast(
        ok
          ? `Job ${action === "pause" ? "Paused" : "Resumed"}`
          : (error ?? `Failed to ${action} job`),
        ok ? undefined : "error",
      );
      loadJobs();
    },
    [data, showToast, loadJobs],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const { ok, error } = await safeApiCall(`/api/cron?id=${id}`, {
        method: "DELETE",
      });
      showToast(
        ok ? "Job deleted" : (error ?? "Failed to delete job"),
        ok ? undefined : "error",
      );
      loadJobs();
    },
    [showToast, loadJobs],
  );

  const handleRun = useCallback(
    async (id: string) => {
      const { ok, error } = await safeApiCall("/api/cron", {
        method: "PUT",
        body: { id, action: "run" },
      });
      showToast(
        ok ? "Run triggered" : (error ?? "Failed to trigger run"),
        ok ? undefined : "error",
      );
      loadJobs();
    },
    [showToast, loadJobs],
  );

  const handlePauseAll = useCallback(async (): Promise<void> => {
    const { ok, error } = await safeApiCall("/api/cron", {
      method: "POST",
      body: { action: "pauseAll" },
    });
    showToast(
      ok ? "All jobs paused" : (error ?? "Failed to pause jobs"),
      ok ? undefined : "error",
    );
    loadJobs();
  }, [showToast, loadJobs]);

  return {
    data,
    jobs,
    loading,
    loadJobs,
    handleToggle,
    handleDelete,
    handleRun,
    handlePauseAll,
  };
}

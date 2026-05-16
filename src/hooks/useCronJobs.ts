// ═══════════════════════════════════════════════════════════════
// useCronJobs — Shared hook for agent cron job CRUD
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback } from "react";
import { useApiData } from "@/hooks/useApiData";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, safeApiCall } from "@/lib/api-fetch";
import type { CronJob } from "@/components/cron/JobCard";

interface CronData {
  jobs: CronJob[];
  total: number;
}

export function useCronJobs() {
  const { showToast } = useToast();
  const { data, loading, error: _apiError, refetch: loadJobs } = useApiData<CronData>("/api/cron", {
    transform: (raw) => raw as CronData,
  });

  const handleToggle = useCallback(
    async (id: string) => {
      const job = data?.jobs.find((j) => j.id === id);
      if (!job) return;
      const action = job.enabled ? "pause" : "resume";
      const { ok, error } = await safeApiCall("/api/cron", { method: "PUT", body: { id, action } });
      showToast(ok ? `Job ${action === "pause" ? "Paused" : "Resumed"}` : (error ?? `Failed to ${action} job`), ok ? undefined : "error");
      loadJobs();
    },
    [data, showToast, loadJobs],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await apiFetch(`/api/cron?id=${id}`, { method: "DELETE" });
        showToast("Job deleted");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to delete job", "error");
      }
      loadJobs();
    },
    [showToast, loadJobs],
  );

  const handleRun = useCallback(
    async (id: string) => {
      const { ok, error } = await safeApiCall("/api/cron", { method: "PUT", body: { id, action: "run" } });
      showToast(ok ? "Run triggered" : (error ?? "Failed to trigger run"), ok ? undefined : "error");
      loadJobs();
    },
    [showToast, loadJobs],
  );

  const handlePauseAll = useCallback(
    async () => {
      const { ok, error } = await safeApiCall("/api/cron", { method: "POST", body: { action: "pauseAll" } });
      showToast(ok ? "All jobs paused" : (error ?? "Failed to pause jobs"), ok ? undefined : "error");
      loadJobs();
    },
    [showToast, loadJobs],
  );

  const handleSync = useCallback(
    async () => {
      const { ok, error } = await safeApiCall("/api/cron", { method: "POST", body: { action: "sync" } });
      showToast(ok ? "Sync complete" : (error ?? "Sync failed"), ok ? undefined : "error");
      loadJobs();
    },
    [showToast, loadJobs],
  );

  return {
    data,
    loading,
    loadJobs,
    handleToggle,
    handleDelete,
    handleRun,
    handlePauseAll,
    handleSync,
  };
}

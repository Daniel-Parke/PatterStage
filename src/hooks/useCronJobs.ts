// ═══════════════════════════════════════════════════════════════
// useCronJobs — Shared hook for agent cron job CRUD
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback } from "react";
import { useApiData } from "@/hooks/useApiData";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api-fetch";
import type { CronJob } from "@/components/cron/JobCard";

interface CronData {
  jobs: CronJob[];
  total: number;
}

/** Thin wrapper: call apiFetch and return { ok, error } for consistent error display. */
async function safeApiCall<T>(method: string, url: string, body?: T): Promise<{ ok: boolean; error?: string }> {
  try {
    await apiFetch(url, {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed" };
  }
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
      const { ok, error } = await safeApiCall("PUT", "/api/cron", { id, action });
      showToast(ok ? `Job ${action === "pause" ? "Paused" : "Resumed"}` : (error ?? `Failed to ${action} job`), ok ? undefined : "error");
      loadJobs();
    },
    [data, showToast, loadJobs],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const { ok, error } = await safeApiCall("DELETE", `/api/cron?id=${id}`);
      showToast(ok ? "Job deleted" : (error ?? "Failed to delete job"), ok ? undefined : "error");
      loadJobs();
    },
    [showToast, loadJobs],
  );

  const handleRun = useCallback(
    async (id: string) => {
      const { ok, error } = await safeApiCall("PUT", "/api/cron", { id, action: "run" });
      showToast(ok ? "Run triggered" : (error ?? "Failed to trigger run"), ok ? undefined : "error");
      loadJobs();
    },
    [showToast, loadJobs],
  );

  const handleEdit = useCallback((setEditingJob: (job: CronJob | null) => void, setShowCreate: (v: boolean) => void) => {
    return (job: CronJob) => {
      setEditingJob(job);
      setShowCreate(true);
    };
  }, []);

  const handlePauseAll = useCallback(
    async () => {
      const { ok, error } = await safeApiCall("POST", "/api/cron", { action: "pauseAll" });
      if (!ok) {
        showToast(error ?? "Failed to pause jobs", "error");
      } else {
        showToast("All jobs paused");
      }
      loadJobs();
    },
    [showToast, loadJobs],
  );

  const handleSync = useCallback(
    async () => {
      const { ok, error } = await safeApiCall("POST", "/api/cron", { action: "sync" });
      if (ok) {
        showToast("Sync complete");
      } else {
        showToast(error ?? "Sync failed", "error");
      }
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
    handleEdit,
    handlePauseAll,
    handleSync,
  };
}

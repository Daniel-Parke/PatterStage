// ═══════════════════════════════════════════════════════════════
// useCronJobs — Shared hook for agent cron job CRUD
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback } from "react";
import { useApiData } from "@/hooks/useApiData";
import { useToast } from "@/components/ui/Toast";
import type { CronJob } from "@/components/cron/JobCard";

interface CronData {
  jobs: CronJob[];
  total: number;
}

/** Generic fetch-with-body wrapper that handles error display. */
async function apiPost(path: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: j?.error ?? "Request failed" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

async function apiPut(path: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: j?.error ?? "Request failed" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

async function apiDelete(path: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(path, { method: "DELETE" });
    const j = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: j?.error ?? "Request failed" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
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
      const { ok, error } = await apiPut("/api/cron", { id, action });
      showToast(ok ? `Job ${action === "pause" ? "Paused" : "Resumed"}` : (error ?? `Failed to ${action} job`), ok ? undefined : "error");
      loadJobs();
    },
    [data, showToast, loadJobs],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const { ok, error } = await apiDelete(`/api/cron?id=${id}`);
      showToast(ok ? "Job deleted" : (error ?? "Failed to delete job"), ok ? undefined : "error");
      loadJobs();
    },
    [showToast, loadJobs],
  );

  const handleRun = useCallback(
    async (id: string) => {
      const { ok, error } = await apiPut("/api/cron", { id, action: "run" });
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
      const { ok, error } = await apiPost("/api/cron", { action: "pauseAll" });
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
      const { ok, error } = await apiPost("/api/cron", { action: "sync" });
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

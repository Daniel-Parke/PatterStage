// ═══════════════════════════════════════════════════════════════
// useHardwareCronJobs — Shared hook for hardware cron CRUD
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { safeApiCall } from "@/lib/api-fetch";
import type { HardwareCronJob } from "@/components/cron/HardwareCronCard";

export function useHardwareCronJobs() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<HardwareCronJob[]>([]);
  const [loading, setLoading] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await safeApiCall<{ jobs?: HardwareCronJob[] }>("/api/cron/hardware");
    if (!ok) {
      showToast("Failed to load hardware cron jobs", "error");
      setJobs([]);
    } else {
      setJobs(data?.jobs ?? []);
    }
    setLoading(false);
  }, [showToast]);

  const handleToggle = useCallback(
    async (id: string) => {
      const job = jobs.find((j) => j.id === id);
      if (!job) return;
      const newEnabled = !job.enabled;
      const { ok, error } = await safeApiCall("/api/cron/hardware", {
        method: "PUT",
        body: { id, enabled: newEnabled },
      });
      if (ok) {
        showToast(newEnabled ? "Hardware job enabled" : "Hardware job paused");
        loadJobs();
      } else {
        showToast(error ?? "Failed to update hardware job", "error");
      }
    },
    [jobs, showToast, loadJobs],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const { ok, error } = await safeApiCall(`/api/cron/hardware?id=${id}`, {
        method: "DELETE",
      });
      if (ok) {
        showToast("Hardware cron job deleted");
      } else {
        showToast(error ?? "Failed to delete hardware job", "error");
      }
      loadJobs();
    },
    [showToast, loadJobs],
  );

  const handleSave = useCallback(
    async (job: Partial<HardwareCronJob>) => {
      try {
        if (job.id) {
          const { ok, error } = await safeApiCall("/api/cron/hardware", {
            method: "PUT",
            body: job,
          });
          if (!ok) throw new Error(error || "Failed to update hardware job");
          showToast("Hardware cron job updated");
        } else {
          const { ok, error } = await safeApiCall("/api/cron/hardware", {
            method: "POST",
            body: job,
          });
          if (!ok) throw new Error(error || "Failed to create hardware job");
          showToast("Hardware cron job created");
        }
        loadJobs();
      } catch (e) {
        showToast(
          e instanceof Error ? e.message : "Failed to save hardware job",
          "error",
        );
      }
    },
    [showToast, loadJobs],
  );

  const handlePauseAll = useCallback(async () => {
    const { ok, error, data } = await safeApiCall<{ pausedCount?: number }>("/api/cron/hardware", {
      method: "POST",
      body: { action: "pauseAll" },
    });
    if (!ok) {
      showToast(error || "Failed to pause hardware jobs", "error");
    } else {
      showToast(
        `Paused ${data?.pausedCount ?? 0} hardware job(s)`,
      );
      loadJobs();
    }
  }, [showToast, loadJobs]);

  const handleSync = useCallback(async () => {
    const { ok, error } = await safeApiCall("/api/cron/hardware", {
      method: "POST",
      body: { action: "sync" },
    });
    if (ok) {
      showToast("Hardware jobs synced");
      loadJobs();
    } else {
      showToast(error || "Hardware sync failed", "error");
    }
  }, [showToast, loadJobs]);

  return {
    jobs,
    loading,
    loadJobs,
    handleToggle,
    handleDelete,
    handleSave,
    handlePauseAll,
    handleSync,
  };
}

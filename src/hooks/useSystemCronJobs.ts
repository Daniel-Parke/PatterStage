// ═══════════════════════════════════════════════════════════════
// useSystemCronJobs — Shared hook for system cron CRUD
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { safeApiCall } from "@/lib/api-fetch";
import type { SystemCronJob } from "@/types/hermes";

export function useSystemCronJobs() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<SystemCronJob[]>([]);
  const [loading, setLoading] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await safeApiCall<{ jobs?: SystemCronJob[] }>("/api/cron/hardware");
    if (!ok) {
      showToast("Failed to load system cron jobs", "error");
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
      const { ok, error } = await safeApiCall(`/api/cron/hardware?id=${id}`, {
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
          const { ok, error } = await safeApiCall("/api/cron/hardware", {
            method: "PUT",
            body: job,
          });
          if (!ok) throw new Error(error || "Failed to update system cron job");
          showToast("System cron job updated");
        } else {
          const { ok, error } = await safeApiCall("/api/cron/hardware", {
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

  const handlePauseAll = useCallback(async () => {
    const { ok, error, data } = await safeApiCall<{ pausedCount?: number }>("/api/cron/hardware", {
      method: "POST",
      body: { action: "pauseAll" },
    });
    if (!ok) {
      showToast(error || "Failed to pause system cron jobs", "error");
    } else {
      showToast(
        `Paused ${data?.pausedCount ?? 0} system cron job(s)`,
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
      showToast("System cron jobs synced");
      loadJobs();
    } else {
      showToast(error || "System cron sync failed", "error");
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

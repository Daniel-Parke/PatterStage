// ═══════════════════════════════════════════════════════════════
// useHardwareCronJobs — Shared hook for hardware cron CRUD
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import type { HardwareCronJob } from "@/components/cron/HardwareCronCard";

export function useHardwareCronJobs() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<HardwareCronJob[]>([]);
  const [loading, setLoading] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cron/hardware");
      const d = (await res.json()) as { data?: { jobs: HardwareCronJob[] }; error?: string };
      if (!res.ok) {
        showToast(d.error ?? "Failed to load hardware cron jobs", "error");
        setJobs([]);
        return;
      }
      setJobs(d.data?.jobs ?? []);
    } catch {
      showToast("Failed to load hardware cron jobs", "error");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const handleToggle = useCallback(
    async (id: string) => {
      const job = jobs.find((j) => j.id === id);
      if (!job) return;
      const newEnabled = !job.enabled;
      try {
        const res = await fetch("/api/cron/hardware", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, enabled: newEnabled }),
        });
        if (res.ok) {
          showToast(newEnabled ? "Hardware job enabled" : "Hardware job paused");
          loadJobs();
        } else {
          const body = await res.json().catch(() => null);
          showToast(body?.error || "Failed to update hardware job", "error");
        }
      } catch {
        showToast("Failed to update hardware job", "error");
      }
    },
    [jobs, showToast, loadJobs],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/cron/hardware?id=${id}`, { method: "DELETE" });
        if (res.ok) {
          showToast("Hardware cron job deleted");
        } else {
          const body = await res.json().catch(() => null);
          showToast(body?.error || "Failed to delete hardware job", "error");
        }
        loadJobs();
      } catch {
        showToast("Failed to delete hardware job", "error");
      }
    },
    [showToast, loadJobs],
  );

  const handleSave = useCallback(
    async (job: Partial<HardwareCronJob>) => {
      try {
        if (job.id) {
          const res = await fetch("/api/cron/hardware", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(job),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.error || "Failed to update hardware job");
          }
          showToast("Hardware cron job updated");
        } else {
          const res = await fetch("/api/cron/hardware", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(job),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.error || "Failed to create hardware job");
          }
          showToast("Hardware cron job created");
        }
        loadJobs();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to save hardware job", "error");
      }
    },
    [showToast, loadJobs],
  );

  const handlePauseAll = useCallback(async () => {
    try {
      const res = await fetch("/api/cron/hardware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pauseAll" }),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast(j.error || "Failed to pause hardware jobs", "error");
      } else {
        showToast(`Paused ${j.data?.pausedCount ?? 0} hardware job(s)`);
        loadJobs();
      }
    } catch {
      showToast("Failed to pause hardware jobs", "error");
    }
  }, [showToast, loadJobs]);

  const handleSync = useCallback(async () => {
    try {
      const res = await fetch("/api/cron/hardware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const d = await res.json();
      if (!res.ok) {
        showToast(d.error || "Hardware sync failed", "error");
      } else {
        showToast("Hardware jobs synced");
        loadJobs();
      }
    } catch {
      showToast("Hardware sync failed", "error");
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

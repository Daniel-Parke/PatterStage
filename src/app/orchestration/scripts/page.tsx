// ═══════════════════════════════════════════════════════════════
// Scripts — host shell scripts on a timer (the "old-fashioned" cron)
//
// The dedicated home for system/host cron: real shell scripts scheduled on the
// host crontab, separate from agent Missions (which own scheduled agent runs on
// the Control Hub scheduler). Reuses the existing System-cron stack
// (useSystemCronJobs → /api/cron/hardware + hardware-cron) and the
// SystemCronCard / SystemCronModal components.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Terminal, Plus, Pause, Zap } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Input";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import { useSystemCronJobs } from "@/hooks/useSystemCronJobs";
import { safeApiCall } from "@/lib/api-fetch";
import SystemCronCard from "@/components/cron/SystemCronCard";
import SystemCronModal from "@/components/cron/SystemCronModal";
import type { SystemCronJob } from "@/types/hermes";

function filterJobs(jobs: SystemCronJob[], search: string): SystemCronJob[] {
  if (!search) return jobs;
  const q = search.toLowerCase();
  return jobs.filter((j) => j.name.toLowerCase().includes(q) || j.schedule.includes(q));
}

export default function ScriptsPage() {
  const { jobs, loading, loadJobs, handleToggle, handleDelete, handleSave, handlePauseAll } = useSystemCronJobs();
  const { showToast, toastElement } = useToast();

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingJob, setEditingJob] = useState<SystemCronJob | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Load on mount (the cron page lazily loaded the System tab; here it is the page).
  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const closeModal = useCallback(() => {
    setShowCreate(false);
    setEditingJob(null);
  }, []);
  const openCreate = useCallback(() => setShowCreate(true), []);
  const openEditor = useCallback((job: SystemCronJob) => setEditingJob(job), []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await safeApiCall("/api/cron/hardware", { method: "POST", body: { action: "sync" } });
      await loadJobs();
      showToast(res.ok ? "Scripts synced from host crontab" : "Sync failed", res.ok ? "success" : "error");
    } finally {
      setSyncing(false);
    }
  }, [loadJobs, showToast]);

  const { enabled, total } = useMemo(
    () =>
      jobs.reduce(
        (acc, j) => {
          if (j.enabled) acc.enabled += 1;
          acc.total += 1;
          return acc;
        },
        { enabled: 0, total: 0 },
      ),
    [jobs],
  );

  const filtered = filterJobs(jobs, search);

  return (
    <AppPageShell>
      <PageHeader
        icon={Terminal}
        title="Scripts"
        subtitle={total > 0 ? `Host shell scripts on a timer · ${enabled}/${total} enabled` : "Host shell scripts on a timer"}
        color="cyan"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" color="cyan" size="sm" icon={Pause} disabled={total === 0} onClick={() => void handlePauseAll()}>
              Pause all
            </Button>
            <Button variant="secondary" color="cyan" size="sm" icon={Zap} loading={syncing} disabled={syncing} onClick={() => void handleSync()}>
              {syncing ? "Syncing…" : "Sync"}
            </Button>
            <Button variant="primary" color="cyan" size="sm" icon={Plus} onClick={openCreate}>
              New Script
            </Button>
          </div>
        }
      />

      <div className="px-6 py-6">
        <p className="mb-5 max-w-3xl font-mono text-xs text-white/40">
          Schedule plain shell scripts on the host crontab — backups, cleanups, health checks. For scheduling
          <strong className="text-white/60"> agent</strong> work, use a mission&apos;s <strong className="text-white/60">Schedule</strong> dispatch
          mode on the <a href="/orchestration/missions" className="text-neon-cyan hover:underline">Missions</a> page.
        </p>

        {loading ? (
          <LoadingSpinner text="Loading scripts..." />
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-cyan-500/20 bg-dark-900/50">
            <EmptyState
              icon={Terminal}
              title="No scripts"
              description={search ? "No scripts match your search" : "Add a host shell script on a timer"}
              action={
                !search ? (
                  <Button variant="primary" color="cyan" size="sm" icon={Plus} onClick={openCreate}>
                    Create Script
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <SearchInput value={search} onChange={setSearch} placeholder="Search scripts..." accentColor="cyan" />
            </div>
            <div className="grid gap-3">
              {filtered.map((job) => (
                <SystemCronCard key={job.id} job={job} onToggle={handleToggle} onEdit={openEditor} onDelete={handleDelete} />
              ))}
            </div>
          </>
        )}
      </div>

      <SystemCronModal
        open={showCreate || !!editingJob}
        editingJob={editingJob}
        onClose={closeModal}
        onSave={async (job) => {
          await handleSave(job);
          closeModal();
        }}
      />

      {toastElement}
    </AppPageShell>
  );
}

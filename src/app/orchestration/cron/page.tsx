// ═══════════════════════════════════════════════════════════════
// Cron Job Manager — Full CRUD + Control
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Plus,
  Play,
  Pause,
  Cpu,
  Zap,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Input";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import { useApiData } from "@/hooks/useApiData";
import JobCard, { CronJob } from "@/components/cron/JobCard";
import JobFormModal from "@/components/cron/JobFormModal";
import HardwareCronCard, { HardwareCronJob } from "@/components/cron/HardwareCronCard";
import HardwareCronModal from "@/components/cron/HardwareCronModal";

interface CronData {
  jobs: CronJob[];
  total: number;
}

export default function CronPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [pauseAllBusy, setPauseAllBusy] = useState(false);
  const [hwPauseAllBusy, setHwPauseAllBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [hwSyncing, setHwSyncing] = useState(false);

  // Hardware cron tab state
  const [activeTab, setActiveTab] = useState<"agent" | "hardware">("agent");
  const [showHardwareCreate, setShowHardwareCreate] = useState(false);
  const [editingHardwareJob, setEditingHardwareJob] = useState<HardwareCronJob | null>(null);
  const [hardwareJobs, setHardwareJobs] = useState<HardwareCronJob[]>([]);
  const [hardwareLoading, setHardwareLoading] = useState(false);
  const [hardwareSearch, setHardwareSearch] = useState("");
  const { showToast, toastElement } = useToast();

  const { data, loading, error: _apiError, refetch: loadJobs } = useApiData<CronData>("/api/cron", {
    transform: (raw) => raw as CronData,
  });

  // ── Agent job handlers ────────────────────────────────────────

  const handleToggle = async (id: string) => {
    const job = data?.jobs.find((j) => j.id === id);
    if (!job) return;
    const action = job.enabled ? "pause" : "resume";
    const res = await fetch("/api/cron", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      showToast(`Job ${action === "pause" ? "Paused" : "Resumed"}`);
    } else {
      const body = await res.json().catch(() => null);
      showToast(body?.error || `Failed to ${action} job`, "error");
    }
    loadJobs();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/cron?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Job deleted");
    } else {
      const body = await res.json().catch(() => null);
      showToast(body?.error || "Failed to delete job", "error");
    }
    loadJobs();
  };

  const handleRun = async (id: string) => {
    const res = await fetch("/api/cron", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "run" }),
    });
    if (res.ok) {
      showToast("Run triggered");
    } else {
      const body = await res.json().catch(() => null);
      showToast(body?.error || "Failed to trigger run", "error");
    }
    loadJobs();
  };

  const handleEdit = (job: CronJob) => {
    setEditingJob(job);
  };

  const handlePauseAll = async () => {
    if (!data?.jobs.length) return;
    if (
      !confirm(
        "Pause every cron job? Hermes will not run them until you resume each job or edit jobs.json.",
      )
    ) {
      return;
    }
    setPauseAllBusy(true);
    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pauseAll" }),
      });
      const j = (await res.json()) as {
        error?: string;
        data?: { pausedCount?: number };
      };
      if (!res.ok) {
        showToast(j.error || "Failed to pause jobs", "error");
        return;
      }
      showToast(`Paused ${j.data?.pausedCount ?? 0} job(s)`);
      loadJobs();
    } finally {
      setPauseAllBusy(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const d = (await res.json()) as {
        error?: string;
        data?: { hermesImported?: { action: string }[] };
      };
      if (!res.ok) {
        showToast(d.error || "Sync failed", "error");
      } else {
        const imported = d.data?.hermesImported?.length ?? 0;
        showToast(`Synced — ${imported} Hermes job(s) imported`);
      }
    } catch {
      showToast("Sync failed", "error");
    } finally {
      setSyncing(false);
      void loadJobs();
    }
  };

  // ── Hardware Cron handlers ────────────────────────────────────

  const loadHardwareJobs = useCallback(async () => {
    setHardwareLoading(true);
    try {
      const res = await fetch("/api/cron/hardware");
      const d = (await res.json()) as { data?: { jobs: HardwareCronJob[] }; error?: string };
      if (!res.ok) {
        showToast(d.error ?? "Failed to load hardware cron jobs", "error");
        setHardwareJobs([]);
        return;
      }
      setHardwareJobs(d.data?.jobs ?? []);
    } catch {
      showToast("Failed to load hardware cron jobs", "error");
      setHardwareJobs([]);
    } finally {
      setHardwareLoading(false);
    }
  }, [showToast]);

  const handleHardwareToggle = async (id: string) => {
    const job = hardwareJobs.find((j) => j.id === id);
    if (!job) return;
    const newEnabled = !job.enabled;
    const res = await fetch("/api/cron/hardware", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: newEnabled }),
    });
    if (res.ok) {
      showToast(newEnabled ? "Hardware job enabled" : "Hardware job paused");
      loadHardwareJobs();
    } else {
      const body = await res.json().catch(() => null);
      showToast(body?.error || "Failed to update hardware job", "error");
    }
  };

  const handleHardwareDelete = async (id: string) => {
    const res = await fetch(`/api/cron/hardware?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("Hardware cron job deleted");
      loadHardwareJobs();
    } else {
      const body = await res.json().catch(() => null);
      showToast(body?.error || "Failed to delete hardware job", "error");
    }
  };

  const handleHardwareSave = async (job: Partial<HardwareCronJob>) => {
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
    loadHardwareJobs();
  };

  const handleHwPauseAll = async () => {
    if (!confirm("Pause all hardware cron jobs?")) return;
    setHwPauseAllBusy(true);
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
        loadHardwareJobs();
      }
    } catch {
      showToast("Failed to pause hardware jobs", "error");
    } finally {
      setHwPauseAllBusy(false);
    }
  };

  const handleHwSync = async () => {
    setHwSyncing(true);
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
        loadHardwareJobs();
      }
    } catch {
      showToast("Hardware sync failed", "error");
    } finally {
      setHwSyncing(false);
    }
  };

  // ── Derived state ─────────────────────────────────────────────

  const filteredJobs =
    data?.jobs.filter(
      (job) =>
        !search ||
        job.name.toLowerCase().includes(search.toLowerCase()) ||
        job.schedule.includes(search) ||
        job.prompt.toLowerCase().includes(search.toLowerCase()),
    ) || [];

  const filteredHardwareJobs = hardwareJobs.filter(
    (job) =>
      !hardwareSearch ||
      job.name.toLowerCase().includes(hardwareSearch.toLowerCase()) ||
      job.schedule.includes(hardwareSearch),
  );

  const enabledCount = data?.jobs.filter((j) => j.enabled).length || 0;
  const enabledHwCount = hardwareJobs.filter((j) => j.enabled).length || 0;

  // Load hardware jobs when switching to the hardware tab
  const [hwLoaded, setHwLoaded] = useState(false);
  useEffect(() => {
    if (activeTab === "hardware" && !hwLoaded) {
      void loadHardwareJobs();
      setHwLoaded(true);
    }
    if (activeTab !== "hardware") {
      setHwLoaded(false);
    }
  }, [activeTab, hwLoaded, loadHardwareJobs]);

  const pageSubtitle = data
    ? `Agent: ${enabledCount}/${data.total}  •  Hardware: ${enabledHwCount}/${hardwareJobs.length || 0}`
    : "Scheduled tasks";

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-dark-950 grid-bg">
      <PageHeader
        icon={Clock}
        title="Cron Jobs"
        subtitle={pageSubtitle}
        color="orange"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab("agent")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === "agent"
                    ? "bg-neon-orange/20 text-neon-orange"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Agent
              </button>
              <button
                onClick={() => setActiveTab("hardware")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === "hardware"
                    ? "bg-neon-cyan/20 text-neon-cyan"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                Hardware
              </button>
            </div>
            {activeTab === "agent" && (
              <>
                <Button
                  variant="secondary"
                  color="orange"
                  size="sm"
                  icon={Pause}
                  disabled={pauseAllBusy || !data?.total}
                  onClick={() => void handlePauseAll()}
                >
                  {pauseAllBusy ? "Pausing…" : "Pause all"}
                </Button>
                <Button
                  variant="secondary"
                  color="orange"
                  size="sm"
                  icon={Zap}
                  loading={syncing}
                  disabled={syncing}
                  onClick={() => void handleSync()}
                >
                  {syncing ? "Syncing…" : "Sync Jobs"}
                </Button>
                <Button
                  variant="primary"
                  color="orange"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowCreate(true)}
                >
                  New Job
                </Button>
              </>
            )}
            {activeTab === "hardware" && (
              <>
                <Button
                  variant="secondary"
                  color="cyan"
                  size="sm"
                  icon={Pause}
                  disabled={hwPauseAllBusy || !hardwareJobs.length}
                  onClick={() => void handleHwPauseAll()}
                >
                  {hwPauseAllBusy ? "Pausing…" : "Pause all"}
                </Button>
                <Button
                  variant="secondary"
                  color="cyan"
                  size="sm"
                  icon={Zap}
                  loading={hwSyncing}
                  disabled={hwSyncing}
                  onClick={() => void handleHwSync()}
                >
                  {hwSyncing ? "Syncing…" : "Sync Jobs"}
                </Button>
                <Button
                  variant="primary"
                  color="cyan"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowHardwareCreate(true)}
                >
                  New Job
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="px-6 py-6">
        {/* ── Agent Tab ── */}
        {activeTab === "agent" && (
          <>
            <div className="mb-6">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search agent jobs..."
                accentColor="orange"
              />
            </div>

            {loading ? (
              <LoadingSpinner text="Loading cron jobs..." />
            ) : filteredJobs.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-dark-900/50">
                <EmptyState
                  icon={Clock}
                  title="No cron jobs"
                  description={
                    search
                      ? "No jobs match your search"
                      : "Create your first scheduled job"
                  }
                  action={
                    !search ? (
                      <Button
                        variant="primary"
                        color="orange"
                        size="sm"
                        icon={Plus}
                        onClick={() => setShowCreate(true)}
                      >
                        Create Agent Job
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onRun={handleRun}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Hardware Tab ── */}
        {activeTab === "hardware" && (
          <>
            <div className="mb-6">
              <SearchInput
                value={hardwareSearch}
                onChange={setHardwareSearch}
                placeholder="Search hardware jobs..."
                accentColor="cyan"
              />
            </div>

            {hardwareLoading ? (
              <LoadingSpinner text="Loading hardware cron jobs..." />
            ) : filteredHardwareJobs.length === 0 ? (
              <div className="rounded-xl border border-cyan-500/20 bg-dark-900/50">
                <EmptyState
                  icon={Cpu}
                  title="No hardware cron jobs"
                  description={
                    hardwareSearch
                      ? "No jobs match your search"
                      : "Add a real system cron job"
                  }
                  action={
                    !hardwareSearch ? (
                      <Button
                        variant="primary"
                        color="cyan"
                        size="sm"
                        icon={Plus}
                        onClick={() => setShowHardwareCreate(true)}
                      >
                        Create Hardware Job
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredHardwareJobs.map((job) => (
                  <HardwareCronCard
                    key={job.id}
                    job={job}
                    onToggle={(id) => void handleHardwareToggle(id)}
                    onEdit={(job) => {
                      setEditingHardwareJob(job);
                      setShowHardwareCreate(true);
                    }}
                    onDelete={(id) => void handleHardwareDelete(id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Agent Job Modal (create + edit) ── */}
      <JobFormModal
        job={editingJob}
        open={showCreate || !!editingJob}
        onClose={() => {
          setShowCreate(false);
          setEditingJob(null);
        }}
        onSaved={() => {
          setShowCreate(false);
          setEditingJob(null);
          showToast(editingJob ? "Job updated!" : "Job created!");
          void loadJobs();
        }}
      />

      {/* ── Hardware Modal (create + edit) ── */}
      <HardwareCronModal
        open={showHardwareCreate || !!editingHardwareJob}
        editingJob={editingHardwareJob}
        onClose={() => {
          setShowHardwareCreate(false);
          setEditingHardwareJob(null);
        }}
        onSave={async (job) => {
          await handleHardwareSave(job);
          setShowHardwareCreate(false);
          setEditingHardwareJob(null);
          void loadHardwareJobs();
        }}
      />

      {toastElement}
    </div>
  );
}
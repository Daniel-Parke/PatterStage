// ═══════════════════════════════════════════════════════════════
// Cron Job Manager — Full CRUD + Control
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  Plus,
  Pause,
  Cpu,
  Zap,
} from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Input";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import { useCronJobs } from "@/hooks/useCronJobs";
import { useSystemCronJobs } from "@/hooks/useSystemCronJobs";
import { safeApiCall } from "@/lib/api-fetch";
import JobCard, { CronJob } from "@/components/cron/JobCard";
import JobFormModal from "@/components/cron/JobFormModal";
import SystemCronCard from "@/components/cron/SystemCronCard";
import type { SystemCronJob } from "@/types/hermes";
import SystemCronModal from "@/components/cron/SystemCronModal";

// ── Tab config ──────────────────────────────────────────────

interface TabConfig {
  key: "agent" | "system";
  label: string;
  icon: typeof Clock;
  bgColor: string;
}

const TABS: TabConfig[] = [
  { key: "agent", label: "Agent", icon: Clock, bgColor: "bg-neon-orange/20 text-neon-orange" },
  { key: "system", label: "System", icon: Cpu, bgColor: "bg-neon-cyan/20 text-neon-cyan" },
];

// ── Search filter helpers ───────────────────────────────────

function filterJobs<T extends { name: string; schedule: string; prompt?: string }>(
  jobs: T[], search: string,
): T[] {
  if (!search) return jobs;
  const q = search.toLowerCase();
  return jobs.filter((j) =>
    j.name.toLowerCase().includes(q) ||
    j.schedule.includes(q) ||
    (j.prompt && j.prompt.toLowerCase().includes(q)),
  );
}

// ── Tab button component ───────────────────────────────────

function TabButton({ tab, activeTab, onSelect }: {
  tab: TabConfig;
  activeTab: "agent" | "system";
  onSelect: (key: "agent" | "system") => void;
}) {
  return (
    <button
      onClick={() => onSelect(tab.key)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
        activeTab === tab.key ? tab.bgColor : "text-white/50 hover:text-white"
      }`}
    >
      <tab.icon className="w-3.5 h-3.5" />
      {tab.label}
    </button>
  );
}

// ── Shared button bar for agent/hardware tabs ───────────────

interface ActionButtonsProps {
  color: "orange" | "cyan";
  pauseBusy: boolean;
  hasJobs: boolean;
  onPauseAll: () => void;
  onSync: () => void;
  syncing: boolean;
  onCreate: () => void;
  createLabel: string;
}

function ActionButtons({ color, pauseBusy, hasJobs, onPauseAll, onSync, syncing, onCreate, createLabel }: ActionButtonsProps) {
  return (
    <>
      <Button variant="secondary" color={color} size="sm" icon={Pause} disabled={pauseBusy || !hasJobs} onClick={onPauseAll}>
        {pauseBusy ? "Pausing…" : "Pause all"}
      </Button>
      <Button variant="secondary" color={color} size="sm" icon={Zap} loading={syncing} disabled={syncing} onClick={onSync}>
        {syncing ? "Syncing…" : "Sync Jobs"}
      </Button>
      <Button variant="primary" color={color} size="sm" icon={Plus} onClick={onCreate}>
        {createLabel}
      </Button>
    </>
  );
}

// ── Tab Content Component (manages own search state) ────────

interface CronTabContentProps {
  isAgent: boolean;
  jobs: (CronJob | SystemCronJob)[];
  loading: boolean;
  accentColor: "orange" | "cyan";
  icon: typeof Clock | typeof Cpu;
  title: string;
  desc: string;
  searchPlaceholder: string;
  createLabel: string;
  onCreate: () => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRun?: (id: string) => void;
  onEdit?: (job: CronJob | SystemCronJob) => void;
}

function CronTabContent({
  isAgent,
  jobs,
  loading,
  accentColor,
  icon: Icon,
  title,
  desc,
  searchPlaceholder,
  createLabel,
  onCreate,
  onToggle,
  onDelete,
  onRun,
  onEdit,
}: CronTabContentProps) {
  const [search, setSearch] = useState("");
  const filtered = filterJobs(jobs, search);

  if (loading) {
    return <LoadingSpinner text={`Loading ${isAgent ? "" : "system "}cron jobs...`} />;
  }

  if (filtered.length === 0) {
    return (
      <div className={`rounded-xl border ${isAgent ? "border-white/10" : "border-cyan-500/20"} bg-dark-900/50`}>
        <EmptyState
          icon={Icon}
          title={title}
          description={search ? "No jobs match your search" : desc}
          action={
            !search ? (
              <Button variant="primary" color={accentColor} size="sm" icon={Plus} onClick={onCreate}>
                {createLabel}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <SearchInput value={search} onChange={setSearch} placeholder={searchPlaceholder} accentColor={accentColor} />
      </div>
      <div className="grid gap-3">
        {filtered.map((job) =>
          isAgent ? (
            <JobCard
              key={job.id}
              job={job as CronJob}
              onToggle={onToggle}
              onDelete={onDelete}
              onRun={onRun!}
              onEdit={(j) => onEdit?.(j)}
            />
          ) : (
            <SystemCronCard
              key={job.id}
              job={job as SystemCronJob}
              onToggle={onToggle}
              onEdit={(j) => onEdit?.(j)}
              onDelete={onDelete}
            />
          ),
        )}
      </div>
    </>
  );
}

// ── Main Page ───────────────────────────────────────────────

export default function CronPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [pauseAllBusy, setPauseAllBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [activeTab, setActiveTab] = useState<"agent" | "system">("agent");
  const [showHardwareCreate, setShowHardwareCreate] = useState(false);
  const [editingHardwareJob, setEditingHardwareJob] = useState<SystemCronJob | null>(null);
  const { showToast, toastElement } = useToast();

  const agent = useCronJobs();
  const hardware = useSystemCronJobs();
  const { loadJobs: loadHardwareJobs } = hardware;

  useEffect(() => {
    if (activeTab === "system") {
      void loadHardwareJobs();
    }
  }, [activeTab, loadHardwareJobs]);

  const handleSyncAll = useCallback(async () => {
    setSyncing(true);
    const [agentRes, hwRes] = await Promise.all([
      safeApiCall("/api/cron", { method: "POST", body: { action: "sync" } }),
      safeApiCall("/api/cron/hardware", { method: "POST", body: { action: "sync" } }),
    ]);
    await Promise.all([agent.loadJobs(), hardware.loadJobs()]);
    if (agentRes.ok && hwRes.ok) {
      showToast("Agent and system cron synced", "success");
    } else {
      const parts: string[] = [];
      if (!agentRes.ok) parts.push("agent");
      if (!hwRes.ok) parts.push("system");
      showToast(`Sync failed: ${parts.join(", ")}`, "error");
    }
    setSyncing(false);
  }, [agent, hardware, showToast]);

  // ── Derived state ─────────────────────────────────────────

  const enabledCount = agent.data?.jobs.filter((j) => j.enabled).length ?? 0;
  const hardwareEnabled = hardware.jobs.filter((j) => j.enabled).length;
  const hardwareTotal = hardware.jobs.length;
  const pageSubtitle = agent.data
    ? `Agent: ${enabledCount}/${agent.data.total}  •  System: ${hardwareEnabled}/${hardwareTotal || 0}`
    : "Scheduled tasks";

  // ── Render ────────────────────────────────────────────────

  return (
    <AppPageShell>
      <PageHeader
        icon={Clock}
        title="Cron Jobs"
        subtitle={pageSubtitle}
        color="orange"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5">
              {TABS.map((tab) => (
                <TabButton key={tab.key} tab={tab} activeTab={activeTab} onSelect={setActiveTab} />
              ))}
            </div>
            <ActionButtons
              color={activeTab === "agent" ? "orange" : "cyan"}
              pauseBusy={activeTab === "agent" ? pauseAllBusy : false}
              hasJobs={activeTab === "agent" ? !!agent.data?.total : hardwareTotal > 0}
              onPauseAll={() => {
                if (activeTab === "agent") {
                  setPauseAllBusy(true);
                  void (async () => {
                    await agent.handlePauseAll();
                    setPauseAllBusy(false);
                  })();
                } else {
                  void hardware.handlePauseAll();
                }
              }}
              onSync={() => void handleSyncAll()}
              syncing={syncing}
              onCreate={() =>
                activeTab === "agent"
                  ? setShowCreate(true)
                  : setShowHardwareCreate(true)
              }
              createLabel="New Job"
            />
          </div>
        }
      />

      <div className="px-6 py-6">
        {(() => {
          const tabConfig = activeTab === "agent"
            ? {
                isAgent: true as const,
                jobs: agent.data?.jobs ?? [],
                loading: agent.loading,
                accentColor: "orange" as const,
                icon: Clock,
                title: "No cron jobs",
                desc: "Create your first scheduled job",
                searchPlaceholder: "Search agent jobs...",
                createLabel: "Create Agent Job",
                onCreate: () => setShowCreate(true),
                onToggle: (id: string) => agent.handleToggle(id),
                onDelete: (id: string) => agent.handleDelete(id),
                onRun: (id: string) => agent.handleRun(id),
                onEdit: (job: CronJob | SystemCronJob) => {
                  if ("command" in job) return; // agent jobs don't have "command"
                  setEditingJob(job);
                  setShowCreate(true);
                },
              }
            : {
                isAgent: false as const,
                jobs: hardware.jobs,
                loading: hardware.loading,
                accentColor: "cyan" as const,
                icon: Cpu,
                title: "No system cron jobs",
                desc: "Add a real system cron job",
                searchPlaceholder: "Search system jobs...",
                createLabel: "Create System Job",
                onCreate: () => setShowHardwareCreate(true),
                onToggle: (id: string) => hardware.handleToggle(id),
                onDelete: (id: string) => hardware.handleDelete(id),
                onRun: undefined,
                onEdit: (job: CronJob | SystemCronJob) => {
                  if ("command" in job) {
                    setEditingHardwareJob(job);
                    setShowHardwareCreate(true);
                  } else {
                    setEditingJob(job);
                    setShowCreate(true);
                  }
                },
              };

          return (
            <CronTabContent
              isAgent={tabConfig.isAgent}
              jobs={tabConfig.jobs}
              loading={tabConfig.loading}
              accentColor={tabConfig.accentColor}
              icon={tabConfig.icon}
              title={tabConfig.title}
              desc={tabConfig.desc}
              searchPlaceholder={tabConfig.searchPlaceholder}
              createLabel={tabConfig.createLabel}
              onCreate={tabConfig.onCreate}
              onToggle={tabConfig.onToggle}
              onDelete={tabConfig.onDelete}
              onRun={tabConfig.onRun}
              onEdit={tabConfig.onEdit}
            />
          );
        })()}
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
          agent.loadJobs();
        }}
      />

      {/* ── System Modal (create + edit) ── */}
      <SystemCronModal
        open={showHardwareCreate || !!editingHardwareJob}
        editingJob={editingHardwareJob}
        onClose={() => {
          setShowHardwareCreate(false);
          setEditingHardwareJob(null);
        }}
        onSave={async (job) => {
          await hardware.handleSave(job);
          setShowHardwareCreate(false);
          setEditingHardwareJob(null);
        }}
      />

      {toastElement}
    </AppPageShell>
  );
}

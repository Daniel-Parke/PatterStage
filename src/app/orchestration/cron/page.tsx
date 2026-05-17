// ═══════════════════════════════════════════════════════════════
// Cron Job Manager — Full CRUD + Control
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import {
  Clock,
  Plus,
  Pause,
  Cpu,
  Zap,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Input";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import { useCronJobs } from "@/hooks/useCronJobs";
import { useSystemCronJobs } from "@/hooks/useSystemCronJobs";
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
  color: string;
  bgColor: string;
}

const TABS: TabConfig[] = [
  { key: "agent", label: "Agent", icon: Clock, color: "text-neon-orange", bgColor: "bg-neon-orange/20 text-neon-orange" },
  { key: "system", label: "System", icon: Cpu, color: "text-neon-cyan", bgColor: "bg-neon-cyan/20 text-neon-cyan" },
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
  onEditAgent?: (job: CronJob) => void;
  onEditSystem?: (job: SystemCronJob) => void;
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
  onEditAgent,
  onEditSystem,
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
              onEdit={(j) => onEditAgent?.(j)}
            />
          ) : (
            <SystemCronCard
              key={job.id}
              job={job as SystemCronJob}
              onToggle={onToggle}
              onEdit={(j) => onEditSystem?.(j)}
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

  // ── Derived state ─────────────────────────────────────────

  const enabledCount = agent.data?.jobs.filter((j) => j.enabled).length || 0;
  const pageSubtitle = agent.data
    ? `Agent: ${enabledCount}/${agent.data.total}  •  System: ${hardware.jobs.filter((j) => j.enabled).length}/${hardware.jobs.length || 0}`
    : "Scheduled tasks";

  // ── Render ────────────────────────────────────────────────

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
              {TABS.map((tab) => (
                <TabButton key={tab.key} tab={tab} activeTab={activeTab} onSelect={setActiveTab} />
              ))}
            </div>
            {activeTab === "agent" && (
              <ActionButtons
                color="orange"
                pauseBusy={pauseAllBusy}
                hasJobs={!!agent.data?.total}
                onPauseAll={async () => {
                  setPauseAllBusy(true);
                  await agent.handlePauseAll();
                  setPauseAllBusy(false);
                }}
                onSync={async () => {
                  setSyncing(true);
                  await agent.handleSync();
                  setSyncing(false);
                }}
                syncing={syncing}
                onCreate={() => setShowCreate(true)}
                createLabel="New Job"
              />
            )}
            {activeTab === "system" && (
              <>
                {hardware.jobs.length === 0 && hardware.loading === false && (
                  <button
                    onClick={() => hardware.loadJobs()}
                    className="text-xs px-3 py-1.5 rounded-lg border border-cyan-500/20 text-cyan-400/60 hover:text-cyan-300 transition-colors"
                  >
                    Load jobs
                  </button>
                )}
                <ActionButtons
                  color="cyan"
                  pauseBusy={false}
                  hasJobs={hardware.jobs.length > 0}
                  onPauseAll={() => hardware.handlePauseAll()}
                  onSync={() => hardware.handleSync()}
                  syncing={false}
                  onCreate={() => setShowHardwareCreate(true)}
                  createLabel="New Job"
                />
              </>
            )}
          </div>
        }
      />

      <div className="px-6 py-6">
        {activeTab === "agent" ? (
          <CronTabContent
            isAgent
            jobs={agent.data?.jobs ?? []}
            loading={agent.loading}
            accentColor="orange"
            icon={Clock}
            title="No cron jobs"
            desc="Create your first scheduled job"
            searchPlaceholder="Search agent jobs..."
            createLabel="Create Agent Job"
            onCreate={() => setShowCreate(true)}
            onToggle={(id) => agent.handleToggle(id)}
            onDelete={(id) => agent.handleDelete(id)}
            onRun={(id) => agent.handleRun(id)}
            onEditAgent={(job) => {
              setEditingJob(job);
              setShowCreate(true);
            }}
          />
        ) : (
          <CronTabContent
            isAgent={false}
            jobs={hardware.jobs}
            loading={hardware.loading}
            accentColor="cyan"
            icon={Cpu}
            title="No system cron jobs"
            desc="Add a real system cron job"
            searchPlaceholder="Search system jobs..."
            createLabel="Create System Job"
            onCreate={() => setShowHardwareCreate(true)}
            onToggle={(id) => hardware.handleToggle(id)}
            onDelete={(id) => hardware.handleDelete(id)}
            onEditSystem={(job) => {
              setEditingHardwareJob(job);
              setShowHardwareCreate(true);
            }}
          />
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
    </div>
  );
}

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
import { useHardwareCronJobs } from "@/hooks/useHardwareCronJobs";
import JobCard, { CronJob } from "@/components/cron/JobCard";
import JobFormModal from "@/components/cron/JobFormModal";
import HardwareCronCard, { HardwareCronJob } from "@/components/cron/HardwareCronCard";
import HardwareCronModal from "@/components/cron/HardwareCronModal";

// ── Tab config ──────────────────────────────────────────────

interface TabConfig {
  key: "agent" | "hardware";
  label: string;
  icon: typeof Clock;
  color: string;
  bgColor: string;
}

const TABS: TabConfig[] = [
  { key: "agent", label: "Agent", icon: Clock, color: "text-neon-orange", bgColor: "bg-neon-orange/20 text-neon-orange" },
  { key: "hardware", label: "Hardware", icon: Cpu, color: "text-neon-cyan", bgColor: "bg-neon-cyan/20 text-neon-cyan" },
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
  activeTab: "agent" | "hardware";
  onSelect: (key: "agent" | "hardware") => void;
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

// ── Main Page ───────────────────────────────────────────────

export default function CronPage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [pauseAllBusy, setPauseAllBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [activeTab, setActiveTab] = useState<"agent" | "hardware">("agent");
  const [showHardwareCreate, setShowHardwareCreate] = useState(false);
  const [editingHardwareJob, setEditingHardwareJob] = useState<HardwareCronJob | null>(null);
  const [hardwareSearch, setHardwareSearch] = useState("");
  const { showToast, toastElement } = useToast();

  const agent = useCronJobs();
  const hardware = useHardwareCronJobs();

  // ── Derived state ─────────────────────────────────────────

  const filteredJobs = filterJobs(agent.data?.jobs ?? [], search);
  const filteredHardwareJobs = filterJobs(hardware.jobs, hardwareSearch);
  const enabledCount = agent.data?.jobs.filter((j) => j.enabled).length || 0;
  const enabledHwCount = hardware.jobs.filter((j) => j.enabled).length || 0;

  const pageSubtitle = agent.data
    ? `Agent: ${enabledCount}/${agent.data.total}  •  Hardware: ${enabledHwCount}/${hardware.jobs.length || 0}`
    : "Scheduled tasks";

  // ── Render ────────────────────────────────────────────────

  const renderTabContent = () => {
    const isAgent = activeTab === "agent";
    const jobs = isAgent ? filteredJobs : filteredHardwareJobs;
    const loading = isAgent ? agent.loading : hardware.loading;
    const icon = isAgent ? Clock : Cpu;
    const title = isAgent ? "No cron jobs" : "No hardware cron jobs";
    const desc = isAgent
      ? (search ? "No jobs match your search" : "Create your first scheduled job")
      : (hardwareSearch ? "No jobs match your search" : "Add a real system cron job");
    const accentColor = isAgent ? "orange" : "cyan";
    const searchValue = isAgent ? search : hardwareSearch;
    const setSearchValue = isAgent ? setSearch : setHardwareSearch;
    const searchPlaceholder = isAgent ? "Search agent jobs..." : "Search hardware jobs...";
    const borderClass = isAgent ? "" : "border-cyan-500/20";
    const createAction = isAgent
      ? () => setShowCreate(true)
      : () => setShowHardwareCreate(true);

    return (
      <>
        <div className="mb-6">
          <SearchInput value={searchValue} onChange={setSearchValue} placeholder={searchPlaceholder} accentColor={accentColor} />
        </div>
        {loading ? (
          <LoadingSpinner text={`Loading ${isAgent ? "" : "hardware "}cron jobs...`} />
        ) : jobs.length === 0 ? (
          <div className={`rounded-xl border ${borderClass || "border-white/10"} bg-dark-900/50`}>
            <EmptyState
              icon={icon}
              title={title}
              description={desc}
              action={
                !searchValue ? (
                  <Button variant="primary" color={accentColor} size="sm" icon={Plus} onClick={createAction}>
                    {isAgent ? "Create Agent Job" : "Create Hardware Job"}
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="grid gap-3">
            {jobs.map((job) =>
              isAgent ? (
                <JobCard
                  key={job.id}
                  job={job as CronJob}
                  onToggle={(id) => agent.handleToggle(id)}
                  onDelete={(id) => agent.handleDelete(id)}
                  onRun={(id) => agent.handleRun(id)}
                  onEdit={(j) => {
                    setEditingJob(j);
                    setShowCreate(true);
                  }}
                />
              ) : (
                <HardwareCronCard
                  key={job.id}
                  job={job as HardwareCronJob}
                  onToggle={(id) => hardware.handleToggle(id)}
                  onEdit={(j) => {
                    setEditingHardwareJob(j);
                    setShowHardwareCreate(true);
                  }}
                  onDelete={(id) => hardware.handleDelete(id)}
                />
              ),
            )}
          </div>
        )}
      </>
    );
  };

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
            {activeTab === "hardware" && (
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
        {renderTabContent()}
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

      {/* ── Hardware Modal (create + edit) ── */}
      <HardwareCronModal
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

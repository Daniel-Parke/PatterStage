// ═══════════════════════════════════════════════════════════════
// Cron Job Manager — Full CRUD + Control
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  /**
   * Edit handler. The discriminator (`isAgent`) decides the runtime type:
   * - `isAgent: true` → `CronJob`
   * - `isAgent: false` → `SystemCronJob`
   * This makes the runtime `if ("command" in job)` check that the original
   * code did inline unnecessary — the union type narrows automatically.
   */
  onEdit: (job: CronJob | SystemCronJob) => void;
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
              onEdit={onEdit}
            />
          ) : (
            <SystemCronCard
              key={job.id}
              job={job as SystemCronJob}
              onToggle={onToggle}
              onEdit={onEdit}
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
  const [syncing, setSyncing] = useState(false);

  const [activeTab, setActiveTab] = useState<"agent" | "system">("agent");
  const [showHardwareCreate, setShowHardwareCreate] = useState(false);
  const [editingHardwareJob, setEditingHardwareJob] = useState<SystemCronJob | null>(null);
  const { showToast, toastElement } = useToast();

  const agent = useCronJobs();
  const hardware = useSystemCronJobs();
  // Destructure loadJobs to a stable reference. `hardware` is a fresh object
  // literal on every render (returned by useSystemCronJobs), so depending on
  // it directly caused the effect to re-fire every render, producing the
  // loading-spinner ↔ empty-state flicker on the System tab.
  const { loadJobs: loadHardwareJobs } = hardware;

  // Close the agent cron modal. The same `setShowCreate(false)` +
  // `setEditingJob(null)` pair appears at 2 sites (the modal's onClose
  // and the onSaved success path) — centralising it here keeps the 2
  // sites in lockstep if a future "clear form fields" or "reset
  // hardware paths" reset is added — a single edit here updates both.
  // The pattern mirrors the `closeComposer` callback that
  // useMissionsPage exposes for the same 2-setter shape (see
  // session-98-list2-close-composer-setter-pair.md).
  const closeAgentModal = useCallback(() => {
    setShowCreate(false);
    setEditingJob(null);
  }, []);

  // Close the system cron modal. The same `setShowHardwareCreate(false)`
  // + `setEditingHardwareJob(null)` pair appears at 2 sites (the modal's
  // onClose and the onSave success path). Same discriminator as
  // `closeAgentModal` — page-local, not in a hook, because the state is
  // page-local. Promotes to a hook if a 2nd page needs the same shape.
  const closeSystemModal = useCallback(() => {
    setShowHardwareCreate(false);
    setEditingHardwareJob(null);
  }, []);

  // Open the agent cron modal in "create" mode. The setter-pair 1-liner
  // `() => setShowCreate(true)` appears at 2 sites (the ActionButtons
  // `onCreate` for the agent tab, and the CronTabContent `onCreate`).
  // Promoted to a named callback so a future "also reset form fields"
  // extension lands in one place. Mirrors the `closeCreate` pattern
  // promoted in session 101.
  const openAgentCreate = useCallback(() => {
    setShowCreate(true);
  }, []);

  // Open the system cron modal in "create" mode. Same shape as
  // `openAgentCreate` but for the system tab. Promotes to a single
  // source of truth so the action-bar and tab-content paths stay
  // in lockstep.
  const openSystemCreate = useCallback(() => {
    setShowHardwareCreate(true);
  }, []);

  // Open the agent cron modal in "edit" mode for a specific job. The
  // `setEditingJob(job); setShowCreate(true)` pair appears at 1 site
  // (the CronTabContent `onEdit`). Promoted to a named callback so
  // the discriminator ("set editing state, then open the modal")
  // lives in exactly one place. Mirrors the `closeEdit` pattern
  // promoted in session 101.
  const openAgentEditor = useCallback((job: CronJob | SystemCronJob) => {
    setEditingJob(job as CronJob);
    setShowCreate(true);
  }, []);

  // Open the system cron modal in "edit" mode for a specific job.
  // Same shape as `openAgentEditor` but for the system tab.
  const openSystemEditor = useCallback((job: CronJob | SystemCronJob) => {
    setEditingHardwareJob(job as SystemCronJob);
    setShowHardwareCreate(true);
  }, []);

  // Open the cron modal in "create" mode for whichever tab is currently
  // active. The `onCreate` prop on `ActionButtons` is a single callback
  // that the tab-conditional inline arrow function used to fill — a
  // "future 'reset form fields on create' extension would have to be
  // added in two places (one per tab branch). The discriminator lives
  // in this single callback so a future reset lands once.
  // Mirrors the `closeCreate` discriminator pattern (session 101) but
  // for the open direction.
  const openCreateForActiveTab = useCallback(() => {
    if (activeTab === "agent") {
      setShowCreate(true);
    } else {
      setShowHardwareCreate(true);
    }
  }, [activeTab]);

  // Pause all jobs for whichever tab is currently active. The
  // tab-conditional inline arrow function used to fill `ActionButtons`'s
  // `onPauseAll` — symmetric to `openCreateForActiveTab` above. A future
  // "confirm dialog before pausing" or "toast with paused count" extension
  // would have to be added in two places (one per tab branch) without
  // this extraction. Centralising the discriminator here keeps the
  // two paths in lockstep.
  const handlePauseAllForActiveTab = useCallback(() => {
    if (activeTab === "agent") {
      void agent.handlePauseAll();
    } else {
      void hardware.handlePauseAll();
    }
  }, [activeTab, agent, hardware]);

  useEffect(() => {
    if (activeTab === "system") {
      void loadHardwareJobs();
    }
  }, [activeTab, loadHardwareJobs]);

  const handleSyncAll = useCallback(async () => {
    setSyncing(true);
    try {
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
    } finally {
      // Always reset syncing state so the UI never gets stuck in "syncing"
      // even if an exception is thrown (e.g., network failure).
      setSyncing(false);
    }
  }, [agent, hardware, showToast]);

  // ── Derived state ─────────────────────────────────────────

  const enabledCount = agent.data?.jobs.filter((j) => j.enabled).length ?? 0;
  // Single .reduce() pass over `hardware.jobs` instead of two
  // independent `.filter().length` / `.length` reads. The
  // `enabled` + `total` pair is derived from the same array, so
  // a single pass with a named accumulator matches the same-shape
  // session-188 reduction in `agents/page.tsx` and
  // `models/import/route.ts`. The `enabled` field is the boolean
  // flag the hardware cron table uses to gate execution; `total`
  // is the row count regardless of enabled state. `|| 0` on the
  // total preserves the original `hardwareTotal || 0` display
  // fallback for the empty-array case (the page header renders
  // "System: 0/0" instead of "System: 0/-" when no jobs exist).
  const { enabled: hardwareEnabled, total: hardwareTotal } = useMemo(
    () =>
      hardware.jobs.reduce(
        (acc, j) => {
          if (j.enabled) acc.enabled += 1;
          acc.total += 1;
          return acc;
        },
        { enabled: 0, total: 0 },
      ),
    [hardware.jobs],
  );
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
              pauseBusy={activeTab === "agent" ? agent.pauseAllBusy : false}
              hasJobs={activeTab === "agent" ? !!agent.data?.total : hardwareTotal > 0}
              onPauseAll={handlePauseAllForActiveTab}
              onSync={() => void handleSyncAll()}
              syncing={syncing}
              onCreate={openCreateForActiveTab}
              createLabel="New Job"
            />
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
            onCreate={openAgentCreate}
            onToggle={(id) => agent.handleToggle(id)}
            onDelete={(id) => agent.handleDelete(id)}
            onRun={(id) => agent.handleRun(id)}
            onEdit={openAgentEditor}
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
            onCreate={openSystemCreate}
            onToggle={(id) => hardware.handleToggle(id)}
            onDelete={(id) => hardware.handleDelete(id)}
            onRun={undefined}
            onEdit={openSystemEditor}
          />
        )}
      </div>

      {/* ── Agent Job Modal (create + edit) ── */}
      <JobFormModal
        job={editingJob}
        open={showCreate || !!editingJob}
        onClose={closeAgentModal}
        onSaved={() => {
          closeAgentModal();
          showToast(editingJob ? "Job updated!" : "Job created!");
          agent.loadJobs();
        }}
      />

      {/* ── System Modal (create + edit) ── */}
      <SystemCronModal
        open={showHardwareCreate || !!editingHardwareJob}
        editingJob={editingHardwareJob}
        onClose={closeSystemModal}
        onSave={async (job) => {
          await hardware.handleSave(job);
          closeSystemModal();
        }}
      />

      {toastElement}
    </AppPageShell>
  );
}

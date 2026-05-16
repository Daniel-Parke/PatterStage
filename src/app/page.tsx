// ═══════════════════════════════════════════════════════════════
// Dashboard - Control Hub Home (Redesigned)
// ═══════════════════════════════════════════════════════════════
// Lean operational overview. No nav cards, no fake terminals.
// One-glance situational awareness → one-click actions.

"use client";

import { useState, useEffect, useCallback, useMemo, memo as reactMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  // Dashboard icons
  Activity,
  Layers,
  ListTodo,
  Globe,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Pause,
  Play,
  Radio,
  Rocket,
  ChevronRight,
  ChevronDown,
  Clock,
  Loader2,
  XCircle,
  Gamepad2,
  BookOpen,
} from "lucide-react";
import { StatusDot } from "@/components/ui/Card";
import IntervalSelector from "@/components/ui/IntervalSelector";
import CategoryAccordion from "@/components/ui/CategoryAccordion";
import TemplateCard from "@/components/ui/TemplateCard";
import { useToast } from "@/components/ui/Toast";
import type { SystemStatus, AccentColor } from "@/types/hermes";
import { timeAgo, timeUntil, titleCase } from "@/lib/utils";
import AppPageShell from "@/components/layout/AppPageShell";
import { StatPillSkeleton } from "@/components/skeletons";

interface HermesProcess {
  id: string;
  type: "cron" | "gateway" | "manual" | "subagent";
  name: string;
  status: "running" | "idle";
  startedAt: string | null;
  lastActivity: string | null;
  model: string;
  pid: number | null;
  turns: number;
}

interface MissionBrief {
  id: string;
  name: string;
  status: string;
  dispatchMode: string;
  createdAt: string;
  cronJobId?: string;
  cronJob?: { state: string; enabled: boolean; lastRun: string | null; lastStatus: string | null };
  latestSession?: { id: string; modified: string } | null;
}

// ── Live Clock (isolated re-render) ───────────────────────────

const LiveClock = reactMemo(function LiveClock() {
  const [time, setTime] = useState<Date>(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <>
      <div className="text-sm font-mono text-neon-cyan" suppressHydrationWarning>
        {time.toLocaleTimeString("en-US", { hour12: false })}
      </div>
      <div className="text-xs text-white/40" suppressHydrationWarning>
        {time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
      </div>
    </>
  );
});

// ── Status Badge ──────────────────────────────────────────────
function MissionStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    queued: { bg: "bg-neon-orange/10", text: "text-neon-orange", icon: <Clock className="w-3 h-3" /> },
    dispatched: { bg: "bg-neon-cyan/10", text: "text-neon-cyan", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    successful: { bg: "bg-neon-green/10", text: "text-neon-green", icon: <CheckCircle2 className="w-3 h-3" /> },
    failed: { bg: "bg-red-500/10", text: "text-red-400", icon: <XCircle className="w-3 h-3" /> },
  };
  const s = styles[status] || styles.queued;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${s.bg} ${s.text}`}>
      {s.icon} {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

interface CronJob {
  id: string;
  name: string;
  state: string;
  enabled: boolean;
  schedule: string;
  lastRun: string | null;
  nextRun: string | null;
  lastStatus: string | null;
}

interface MonitorData {
  cron: { total: number; active: number; paused: number; jobs: CronJob[] };
  sessions: { total: number; recent: Array<{ id: string; modified: string; size: number }> };
  gateway: { platforms: Record<string, boolean>; connectedCount: number };
  memory: { factCount: number; dbSize: string; provider: string };
  errors: Array<{ source: string; message: string; timestamp: string; severity: string }>;
  system: { uptime: string; configPresent: boolean; soulPresent: boolean };
  sync: { lastRun: string | null; allSuccessful: boolean; sourceStatuses: Record<string, string> };
}

function CronStatusBadge({ state, enabled }: { state: string; enabled: boolean }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/5 text-white/40">
        <Pause className="w-2.5 h-2.5" /> Paused
      </span>
    );
  }
  const styles: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    running: { bg: "bg-neon-green/10", text: "text-neon-green", icon: <Loader2 className="w-2.5 h-2.5 animate-spin" />, label: "Running" },
    scheduled: { bg: "bg-neon-green/10", text: "text-neon-green", icon: <Play className="w-2.5 h-2.5" />, label: "Active" },
    queued: { bg: "bg-neon-orange/10", text: "text-neon-orange", icon: <Clock className="w-2.5 h-2.5" />, label: "Queued" },
    completed: { bg: "bg-neon-green/10", text: "text-neon-green", icon: <CheckCircle2 className="w-2.5 h-2.5" />, label: "Done" },
    failed: { bg: "bg-red-500/10", text: "text-red-400", icon: <XCircle className="w-2.5 h-2.5" />, label: "Failed" },
  };
  const s = styles[state] || { bg: "bg-white/5", text: "text-white/40", icon: null, label: state.charAt(0).toUpperCase() + state.slice(1) };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${s.bg} ${s.text}`}>
      {s.icon} {s.label}
    </span>
  );
}

// ── Compact Stat Pill ─────────────────────────────────────────
function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: AccentColor;
}) {
  const colorClasses: Record<AccentColor, string> = {
    cyan: "border-neon-cyan/20 text-neon-cyan",
    purple: "border-neon-purple/20 text-neon-purple",
    green: "border-neon-green/20 text-neon-green",
    pink: "border-neon-pink/20 text-neon-pink",
    orange: "border-neon-orange/20 text-neon-orange",
    red: "border-red-500/20 text-red-400",
    blue: "border-blue-500/20 text-blue-400",
    yellow: "border-yellow-500/20 text-yellow-400",
  };
  return (
    <div className={`rounded-lg border ${colorClasses[color]} bg-dark-900/50 px-4 py-3 flex items-center gap-3`}>
      <Icon className="w-4 h-4 opacity-60" />
      <div>
        <div className="text-[10px] font-mono text-white/40 uppercase">{label}</div>
        <div className="text-lg font-bold font-mono">{value}</div>
      </div>
    </div>
  );
}

// ── Template Category Constants (module-level — don't re-create on every render) ──

const DEFAULT_PLATFORMS = ["discord", "telegram", "slack", "whatsapp"] as const;

const TEMPLATE_CAT_ORDER = [
  "Business - Operations",
  "Engineering - QA",
  "Engineering - DevOps",
  "Engineering - Software",
  "Engineering - Data",
  "Engineering - Data Science",
  "Business - Creative",
  "Support",
  "Custom",
] as const;

const TEMPLATE_CAT_COLORS: Record<string, AccentColor> = {
  "Engineering - QA": "pink",
  "Engineering - DevOps": "cyan",
  "Engineering - Software": "purple",
  "Engineering - Data": "green",
  "Engineering - Data Science": "orange",
  "Business - Operations": "cyan",
  "Business - Creative": "orange",
  "Support": "blue",
  "Custom": "purple",
};

export default function Dashboard() {
  const [data, setDataFields] = useState<{
    status: SystemStatus | null;
    monitor: MonitorData | null;
    processes: HermesProcess[];
    missions: MissionBrief[];
    config: Record<string, unknown> | null;
    templates: Array<{ id: string; name: string; icon: string; color: string; category: string; profile: string; description: string; isCustom?: boolean }>;
  }>({
    status: null,
    monitor: null,
    processes: [],
    missions: [],
    config: null,
    templates: [],
  });
  const { status, monitor, processes, missions, config, templates } = data;

  const setData = useCallback((partial: Partial<typeof data>) => {
    setDataFields(prev => ({ ...prev, ...partial }));
  }, []);
  const [dispatchExpanded, setDispatchExpanded] = useState(false);
  const [errorSev, setErrorSev] = useState<"all" | "error" | "warning">("all");
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const { showToast, toastElement } = useToast();
  const router = useRouter();

  const filteredErrors = useMemo(() => {
    if (!monitor?.errors) return [];
    if (errorSev === "all") return monitor.errors;
    // Use the DB severity field — reliable, no string matching
    return monitor.errors.filter((e) => e.severity === errorSev);
  }, [monitor, errorSev]);

  // Cancel a mission from the dashboard
  const handleCancelMission = useCallback(async (missionId: string, missionName: string) => {
    // First click: show confirmation state
    if (cancelConfirmId !== missionId) {
      setCancelConfirmId(missionId);
      setTimeout(() => setCancelConfirmId((prev) => prev === missionId ? null : prev), 4000);
      return;
    }
    setCancelConfirmId(null);
    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", missionId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        showToast(body?.error || "Failed to cancel mission", "error");
        return;
      }
      showToast(`Cancelled "${missionName}"`, "success");
      // Refresh missions
      const data = await fetch("/api/missions");
      const d = await data.json();
      if (d.data) setData({ missions: d.data.missions || [] });
    } catch {
      showToast("Failed to cancel mission", "error");
    }
  }, [showToast, setData, cancelConfirmId]);

  // Update cron job schedule inline
  const handleCronScheduleChange = useCallback(async (jobId: string, newSchedule: string) => {
    try {
      const putRes = await fetch("/api/cron", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId, schedule: newSchedule }),
      });
      if (!putRes.ok) {
        const body = await putRes.json().catch(() => null);
        showToast(body?.error || "Failed to update cron schedule", "error");
        return;
      }
      // Refresh monitor data to show updated schedule
      const res = await fetch("/api/monitor");
      const d = await res.json();
      if (d.data) setData({ monitor: d.data });
      showToast("Schedule updated", "success");
    } catch {
      showToast("Failed to update cron schedule", "error");
    }
  }, [showToast, setData]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    // Batch all initial fetches — single render update
    const initialLoad = async () => {
      const [statusRes, configRes, templatesRes, monitorRes, processesRes, missionsRes] =
        await Promise.all([
          fetch("/api/status", { signal }).then((r) => r.json()).catch(() => ({ data: null })),
          fetch("/api/config", { signal }).then((r) => r.json()).catch(() => ({ data: null })),
          fetch("/api/templates", { signal }).then((r) => r.json()).catch(() => ({ data: null })),
          fetch("/api/monitor", { signal }).then((r) => r.json()).catch(() => ({ data: null })),
          fetch("/api/agents", { signal }).then((r) => r.json()).catch(() => ({ data: null })),
          fetch("/api/missions", { signal }).then((r) => r.json()).catch(() => ({ data: null })),
        ]);

      if (!signal.aborted) {
        setData({
          status: statusRes.data,
          config: configRes.data,
          templates: templatesRes.data?.templates || [],
          monitor: monitorRes.data,
          processes: processesRes.data?.processes || processesRes.processes || [],
          missions: missionsRes.data?.missions || [],
        });
      }
    };
    initialLoad();

    // Polling: monitor (10s), processes (15s), missions (15s)
    const monitorInterval = setInterval(async () => {
      if (!signal.aborted) {
        const res = await fetch("/api/monitor", { signal }).catch(() => null);
        if (res?.ok) {
          const d = await res.json().catch(() => null);
          if (d?.data) setData({ monitor: d.data });
        }
      }
    }, 10000);

    const processesInterval = setInterval(async () => {
      if (!signal.aborted) {
        const res = await fetch("/api/agents", { signal }).catch(() => null);
        if (res?.ok) {
          const d = await res.json().catch(() => null);
          if (d?.data) setData({ processes: d.data.processes || [] });
        }
      }
    }, 15000);

    const missionsInterval = setInterval(async () => {
      if (!signal.aborted) {
        const res = await fetch("/api/missions", { signal }).catch(() => null);
        if (res?.ok) {
          const d = await res.json().catch(() => null);
          if (d?.data) setData({ missions: d.data.missions || [] });
        }
      }
    }, 15000);

    return () => {
      controller.abort();
      clearInterval(monitorInterval);
      clearInterval(processesInterval);
      clearInterval(missionsInterval);
    };
  }, [setData]);

  const modelConfig = config?.model as Record<string, unknown> | undefined;
  const currentModel = (modelConfig?.default as string) || "-";
  const currentProvider = (modelConfig?.provider as string) || "";
  const activeProcesses = useMemo(() => processes.filter((p) => p.status === "running"), [processes]);
  const activeMissions = useMemo(() => missions.filter((m) => m.status === "queued" || m.status === "dispatched"), [missions]);

  // Snapshot current time for render — capture once on mount
  const [now] = useState(() => Date.now());

  // Group templates by category for the dispatch section
  const groupedTemplates = useMemo(() => {
    const grouped: Record<string, typeof templates> = {};
    for (const t of templates) {
      const cat = t.isCustom ? "Custom" : (t.category || "Other");
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    }
    return grouped;
  }, [templates]);

  return (
    <AppPageShell variant="scanlines">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-neon-cyan text-glow-cyan">CONTROL</span>{" "}
            <span className="text-white/70">HUB</span>
          </h1>
          <p className="text-xs text-white/40 font-mono">
            {currentModel}{currentProvider ? ` · ${currentProvider}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <LiveClock />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neon-green pulse-glow" />
            <span className="text-xs text-white/60 font-mono">ONLINE</span>
          </div>
        </div>
      </div>
      {toastElement}

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* ═══ Compact Stat Row ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {monitor ? (
            <>
              <StatPill
                icon={Radio}
                label="Processes"
                value={activeProcesses.length > 0 ? `${activeProcesses.length} Active` : status?.soulFile ? "Idle" : "Offline"}
                color={activeProcesses.length > 0 ? "green" : status?.soulFile ? "cyan" : "pink"}
              />
              <StatPill
                icon={ListTodo}
                label="Cron Jobs"
                value={`${monitor.cron.active} Active`}
                color="orange"
              />
              <StatPill
                icon={Activity}
                label="Sessions"
                value={`${monitor.sessions.total}`}
                color="purple"
              />
              <StatPill
                icon={Layers}
                label={`Memory · ${monitor.memory.provider || "Not Installed"}`}
                value={monitor.memory.factCount >= 0 ? `${monitor.memory.factCount} facts` : "0 facts"}
                color="pink"
              />
            </>
          ) : (
            <>
              <StatPillSkeleton />
              <StatPillSkeleton />
              <StatPillSkeleton />
              <StatPillSkeleton />
            </>
          )}
        </div>

        {/* ═══ Handoff / continuation ═══ */}
        <div className="rounded-xl border border-white/10 bg-dark-900/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
              Continue work
            </div>
            <div className="text-sm text-white/80 mt-1">
              {monitor?.sessions?.recent?.[0] ? (
                <>
                  Latest session {timeAgo(monitor.sessions.recent[0].modified)}{" "}
                  <Link
                    href={"/sessions/" + monitor.sessions.recent[0].id}
                    className="text-neon-cyan hover:underline font-mono text-xs"
                  >
                    open transcript
                  </Link>
                </>
              ) : (
                "No sessions yet — run a mission or use Hermes chat."
              )}
            </div>
          </div>
          <Link
            href="/sessions"
            className="text-xs font-mono text-neon-purple hover:underline inline-flex items-center gap-1"
          >
            Session browser <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {/* ═══ Mission Dispatch Quick Launch ═══ */}
        <div className="rounded-xl border border-neon-cyan/20 bg-dark-900/50 overflow-hidden">
          <button
            onClick={() => setDispatchExpanded(!dispatchExpanded)}
            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-neon-cyan" />
              <span className="text-sm font-mono text-white/80">Mission Dispatch</span>
              <span className="text-[10px] font-mono text-white/25">({templates.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/orchestration/missions"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-mono text-neon-cyan hover:underline flex items-center gap-1"
              >
                full control <ChevronRight className="w-3 h-3" />
              </Link>
              {dispatchExpanded ? (
                <ChevronDown className="w-4 h-4 text-white/20" />
              ) : (
                <ChevronRight className="w-4 h-4 text-white/20" />
              )}
            </div>
          </button>

          {/* Collapsed: horizontal pill strip */}
          {!dispatchExpanded && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {templates.slice(0, 12).map((t) => (
                <TemplateCard
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  icon={t.icon}
                  color={t.color}
                  description={t.description}
                  isCustom={t.isCustom}
                  compact
                  onSelect={() => router.push(`/missions?template=${t.id}`)}
                />
              ))}
              {templates.length > 12 && (
                <button
                  onClick={() => setDispatchExpanded(true)}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-mono text-white/30 hover:text-neon-cyan transition-colors"
                >
                  +{templates.length - 12} more
                </button>
              )}
            </div>
          )}

          {/* Expanded: grouped by category, all compact pills */}
          {dispatchExpanded && (
            <div className="px-4 pb-4 space-y-3">
              {TEMPLATE_CAT_ORDER.map((cat) => {
                const items = groupedTemplates[cat];
                if (!items) return null;
                const color = TEMPLATE_CAT_COLORS[cat] || "cyan";
                return (
                  <CategoryAccordion
                    key={cat}
                    name={cat}
                    count={items.length}
                    color={color}
                    expandable={cat === "Custom" && items.length > 6}
                    defaultOpen={true}
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((t) => (
                        <TemplateCard
                          key={t.id}
                          id={t.id}
                          name={t.name}
                          icon={t.icon}
                          color={t.color}
                          description={t.description}
                          isCustom={t.isCustom}
                          compact
                          onSelect={() => router.push(`/missions?template=${t.id}`)}
                        />
                      ))}
                    </div>
                  </CategoryAccordion>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ Active Missions ═══ */}
        {activeMissions.length > 0 && (
          <div className="rounded-xl border border-neon-cyan/20 bg-dark-900/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
              <div className="flex items-center gap-2">
                <Rocket className="w-3.5 h-3.5 text-neon-cyan" />
                <span className="text-xs font-mono text-white/60">Active Missions</span>
                <span className="text-[10px] font-mono text-white/25">
                  ({activeMissions.length})
                </span>
              </div>
              <Link href="/orchestration/missions" className="text-[10px] font-mono text-neon-cyan hover:underline flex items-center gap-1">
                all missions <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-white/5">
              {activeMissions
                .map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusDot
                        status={m.status === "dispatched" ? "online" : "warning"}
                        pulse={m.status === "dispatched"}
                      />
                      <Link href="/orchestration/missions" className="text-xs text-white/80 truncate hover:text-neon-cyan transition-colors">{m.name}</Link>
                      <span className="text-[10px] font-mono text-white/30 capitalize">{m.dispatchMode}</span>
                      {m.latestSession ? (
                        <Link
                          href={`/sessions/${m.latestSession.id}`}
                          className="text-[10px] font-mono text-white/25 hover:text-neon-cyan transition-colors"
                          title="View session"
                        >
                          {m.latestSession.id.slice(-20)}
                        </Link>
                      ) : m.cronJobId && m.status === "dispatched" ? (
                        <span className="text-[10px] font-mono text-white/15 italic">
                          Session loading...
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <MissionStatusBadge status={m.status} />
                      <span className="text-[10px] font-mono text-white/25">{timeAgo(m.createdAt)}</span>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCancelMission(m.id, m.name); }}
                        className={`text-[10px] font-mono transition-colors px-1.5 py-0.5 rounded ${
                          cancelConfirmId === m.id
                            ? "bg-red-500/20 text-red-400"
                            : "text-white/20 hover:text-red-400 hover:bg-red-500/10"
                        }`}
                        title="Cancel mission"
                      >
                        {cancelConfirmId === m.id ? "Confirm?" : "Cancel"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ═══ Three-Panel System Monitor ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Cron Jobs Panel */}
          <div className="rounded-xl border border-neon-orange/20 bg-dark-900/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
              <div className="flex items-center gap-2">
                <ListTodo className="w-3.5 h-3.5 text-neon-orange" />
                <span className="text-xs font-mono text-white/60">Cron Jobs</span>
              </div>
              <Link href="/orchestration/cron" className="text-[10px] font-mono text-neon-orange hover:underline">
                manage →
              </Link>
            </div>
            <div className="divide-y divide-white/5">
              {monitor?.cron.jobs.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-white/30">No cron jobs</div>
              )}
              {monitor?.cron.jobs.map((job) => (
                <div key={job.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white/80 truncate">{job.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-shrink-0">
                        <IntervalSelector
                          value={job.schedule}
                          onChange={(v) => handleCronScheduleChange(job.id, v)}
                          compact
                        />
                      </div>
                      {job.enabled && (
                        <span className={`text-xs truncate ml-2 ${
                          job.state === "running"
                            ? "text-neon-green"
                            : job.lastStatus === "ok"
                            ? "text-neon-green"
                            : job.lastStatus && job.lastStatus !== "ok"
                            ? "text-red-400"
                            : "text-neon-orange"
                        }`}>
                          {job.state === "running"
                            ? "Executing..."
                            : job.lastRun && !job.nextRun
                            ? `${titleCase(job.lastStatus || "Ok")} ${timeAgo(job.lastRun)}`
                            : job.nextRun &&
                              new Date(job.nextRun).getTime() > now
                            ? "Next " + timeUntil(job.nextRun)
                            : job.lastRun
                            ? `Active · Ran ${timeAgo(job.lastRun)}`
                            : "Queued"}
                        </span>
                      )}
                    </div>
                  </div>
                  <CronStatusBadge state={job.state} enabled={job.enabled} />
                </div>
              ))}
            </div>
          </div>

          {/* Platforms Panel */}
          <div className="rounded-xl border border-neon-cyan/20 bg-dark-900/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-neon-cyan" />
                <span className="text-xs font-mono text-white/60">Platforms</span>
              </div>
              <Link href="/gateway" className="text-[10px] font-mono text-neon-cyan hover:underline">
                details →
              </Link>
            </div>
            <div className="px-4 py-3 space-y-2">
              {monitor
                ? Object.entries(monitor.gateway.platforms).map(([platform, connected]) => (
                    <div key={platform} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusDot status={connected ? "online" : "idle"} pulse={connected} />
                        <span className="text-xs text-white/70 capitalize">{platform}</span>
                      </div>
                      <span className={`text-[10px] font-mono ${connected ? "text-neon-green" : "text-white/25"}`}>
                        {connected ? "Connected" : "Disabled"}
                      </span>
                    </div>
                  ))
                : DEFAULT_PLATFORMS.map((p) => (
                    <div key={p} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusDot status="idle" />
                        <span className="text-xs text-white/70 capitalize">{p}</span>
                      </div>
                      <span className="text-[10px] font-mono text-white/25">...</span>
                    </div>
                  ))}
              {monitor && monitor.gateway.connectedCount === 0 && (
                <div className="text-[10px] text-white/30 text-center py-2">No platforms configured</div>
              )}
            </div>
            {monitor?.sync.lastRun && (
              <div className="px-4 py-2 border-t border-white/10">
                <div className="text-[10px] text-white/30 font-mono flex items-center gap-2">
                  <RefreshCw className="w-3 h-3" />
                  Sync: {timeAgo(monitor.sync.lastRun)}
                  {monitor.sync.allSuccessful ? (
                    <span className="text-neon-green">✓</span>
                  ) : (
                    <span className="text-red-400">✗</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Errors Panel */}
          <div className="rounded-xl border border-red-500/20 bg-dark-900/50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs font-mono text-white/60">Errors</span>
              </div>
              <div className="flex items-center gap-1">
                {(["all", "error", "warning"] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setErrorSev(sev)}
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                      errorSev === sev ? "bg-red-500/20 text-red-400" : "text-white/30 hover:text-white/60"
                    }`}
                  >
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredErrors.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <CheckCircle2 className="w-5 h-5 text-neon-green mx-auto mb-1" />
                  <div className="text-xs text-neon-green">No recent errors</div>
                </div>
              )}
              {filteredErrors.map((err, i) => (
                <div key={i} className="px-4 py-2 border-b border-white/5 last:border-0">
                  <div className="text-[10px] text-red-400/80 font-mono truncate">{err.message}</div>
                  <div className="text-[10px] text-white/20 font-mono mt-0.5">
                    {err.source} {err.timestamp && `· ${err.timestamp}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* ═══ Running Hermes Processes ═══ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-mono text-white/40 uppercase tracking-widest flex items-center gap-2">
              <Radio className="w-3 h-3 text-neon-purple" />
              Running Hermes Processes
              <span className="text-[10px] text-white/25 ml-1">({activeProcesses.length} Active)</span>
            </h2>
            <RefreshCw
              className="w-3 h-3 text-white/20 hover:text-white/50 cursor-pointer"
              onClick={() => {
                fetch("/api/agents")
                  .then((r) => r.json())
                  .then((d) => setData({ processes: d.data?.processes || d.processes || [] }))
                  .catch(() => showToast("Failed to refresh processes", "error"));
              }}
            />
          </div>
          {processes.length === 0 ? (
            <div className="rounded-xl border border-neon-purple/20 bg-dark-900/50 p-6 text-center">
              <Radio className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <div className="text-xs text-white/30">No Active Processes Detected</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {processes.map((proc) => (
                <div key={proc.id} className="rounded-xl border border-neon-purple/20 bg-dark-900/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Radio className={`w-4 h-4 ${proc.status === "running" ? "text-neon-green pulse-glow" : "text-white/30"}`} />
                      <span className="text-sm text-white/90 font-medium truncate">{proc.name}</span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      proc.status === "running" ? "bg-neon-green/10 text-neon-green" : "bg-white/5 text-white/30"
                    }`}>
                      {titleCase(proc.status)}
                    </span>
                  </div>
                  <div className="space-y-1 text-[10px] font-mono text-white/40">
                    <div className="flex justify-between">
                      <span>Type</span>
                      <span className="text-white/60 capitalize">{proc.type}</span>
                    </div>
                    {proc.model !== "unknown" && proc.model !== "gateway" && (
                      <div className="flex justify-between">
                        <span>Model</span>
                        <span className="text-white/60">{proc.model}</span>
                      </div>
                    )}
                    {proc.turns > 0 && (
                      <div className="flex justify-between">
                        <span>Turns</span>
                        <span className="text-white/60">{proc.turns}</span>
                      </div>
                    )}
                    {proc.lastActivity && (
                      <div className="flex justify-between">
                        <span>Last activity</span>
                        <span className="text-white/60">{timeAgo(proc.lastActivity)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ═══ Rec Room ═══ */}
        <div className="rounded-xl border border-purple-500/20 bg-dark-900/50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-dark-800/50">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-3.5 h-3.5 text-neon-purple" />
              <span className="text-xs font-mono text-white/60">Rec Room</span>
            </div>
          </div>
          <Link href="/recroom/story-weaver" className="flex items-center justify-center gap-3 py-4 hover:bg-white/[0.02] transition-colors">
            <BookOpen className="w-5 h-5 text-neon-purple" />
            <span className="text-sm font-mono text-white/60">Story Weaver</span>
          </Link>
        </div>
      </div>
    </AppPageShell>
  );
}

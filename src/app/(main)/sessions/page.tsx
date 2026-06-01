// ═══════════════════════════════════════════════════════════════
// Session History — Unified view of all agent sessions
//
// Control Hub is the source of truth. Sessions born from missions
// and cron jobs are written directly to the DB. Hermes CLI
// sessions are synced from ~/.hermes/<profile>/sessions/ on
// every page load via the /api/sessions endpoint.
//
// Sources: cli (Hermes interactive), cron (scheduled jobs),
//         mission (Control Hub dispatch), api (direct API calls)
//
// UX features layered on top of the raw session list (June 2026):
//   - "Group by mission" toggle collapses sessions with the same
//     missionId into a single expandable card so recurring
//     missions don't produce dozens of indistinguishable rows.
//   - Live indicator (pulsing dot + elapsed time) on active sessions
//     so users can tell "still running" from "recently completed".
//   - Mission badge is a real link to /orchestration/missions/{id}.
//   - "Hide API noise" toggle (opt-in) filters out short-lived
//     api-source sessions that drown out meaningful activity.
//   - "5 msgs" badge per row from messageCount, populated by the
//     Hermes state.db sync.
//   - Title fallback resolves cron job names from ~/.hermes/cron/jobs.json
//     via src/lib/session-title.ts so recurring cron sessions get
//     human-readable names like "Cron: Review & Refactor — 20260601 185050".
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Clock,
  MessageSquare,
  HardDrive,
  ChevronRight,
  ChevronDown,
  Filter,
  Layers,
  EyeOff,
  Activity,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/Input";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import Badge from "@/components/ui/Badge";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { timeAgo } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import AppPageShell from "@/components/layout/AppPageShell";
import type { SessionRecord } from "@/lib/session-repository";
import type { SessionSource } from "@/lib/session-repository";
import { SOURCE_META, formatSessionTitle } from "@/components/session/constants";

// ── Types ────────────────────────────────────────────────────

interface SessionsResponse {
  sessions: SessionRecord[];
  total: number;
}

interface MissionGroup {
  kind: "mission";
  key: string;
  missionId: string;
  sessions: SessionRecord[];
  firstStartedAt: string;
  lastStartedAt: string;
  activeCount: number;
}

interface SingleSession {
  kind: "session";
  key: string;
  session: SessionRecord;
}

type ListEntry = MissionGroup | SingleSession;

// ── Constants ────────────────────────────────────────────────

const PAGE_SIZE = 50;
const GROUP_BY_MISSION_STORAGE_KEY = "ch.sessions.groupByMission";
const HIDE_API_NOISE_STORAGE_KEY = "ch.sessions.hideApiNoise";

// ── Hooks ────────────────────────────────────────────────────

function useStoredBool(key: string, defaultValue: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(defaultValue);
  // Hydrate from localStorage after mount to avoid SSR hydration mismatches
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === "true") setValue(true);
      else if (raw === "false") setValue(false);
    } catch {
      // localStorage may be unavailable (private mode, etc.) — keep default
    }
  }, [key]);
  const update = useCallback(
    (v: boolean) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, v ? "true" : "false");
      } catch {
        // ignore
      }
    },
    [key],
  );
  return [value, update];
}

// ── Grouping helper ──────────────────────────────────────────

function buildGroupedEntries(
  sessions: SessionRecord[],
  groupByMission: boolean,
): ListEntry[] {
  if (!groupByMission) {
    return sessions.map((s) => ({ kind: "session", key: s.id, session: s }));
  }

  const missionGroups = new Map<string, SessionRecord[]>();
  const standalone: SessionRecord[] = [];

  for (const s of sessions) {
    if (s.missionId) {
      const list = missionGroups.get(s.missionId) ?? [];
      list.push(s);
      missionGroups.set(s.missionId, list);
    } else {
      standalone.push(s);
    }
  }

  const entries: ListEntry[] = [];
  for (const [missionId, list] of missionGroups.entries()) {
    // Sort within group: newest first
    list.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    const firstStartedAt = list[list.length - 1].startedAt;
    const lastStartedAt = list[0].startedAt;
    const activeCount = list.filter((s) => s.status === "active").length;
    entries.push({
      kind: "mission",
      key: `mission:${missionId}`,
      missionId,
      sessions: list,
      firstStartedAt,
      lastStartedAt,
      activeCount,
    });
  }
  for (const s of standalone) {
    entries.push({ kind: "session", key: s.id, session: s });
  }

  // Sort entries: mission groups first (by last activity), then standalone
  entries.sort((a, b) => {
    const aTime = a.kind === "mission" ? a.lastStartedAt : a.session.startedAt;
    const bTime = b.kind === "mission" ? b.lastStartedAt : b.session.startedAt;
    return aTime < bTime ? 1 : -1;
  });

  return entries;
}

// ── Live elapsed-time formatter ──────────────────────────────

function formatElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// ── Components ───────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="relative inline-flex items-center" title="Session is active">
      <span className="absolute inline-flex h-2 w-2 rounded-full bg-neon-green opacity-75 animate-ping" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-green" />
    </span>
  );
}

function SessionCard({ session }: { session: SessionRecord }) {
  const title = formatSessionTitle(session);
  const meta = SOURCE_META[session.source] ?? SOURCE_META.cli;
  const isActive = session.status === "active";

  return (
    <Link href={`/sessions/${session.id}`}>
      <div className="rounded-xl border border-white/10 bg-dark-900/50 p-4 hover:border-neon-orange/30 transition-colors group cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {isActive && <LiveDot />}
              <MessageSquare className="w-4 h-4 text-neon-orange flex-shrink-0" />
              <h3 className="font-semibold text-white truncate">{title}</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-white/30 font-mono flex-wrap">
              <span
                className={`flex items-center gap-1 ${isActive ? "text-neon-green" : ""}`}
              >
                <Clock className="w-3 h-3" />
                {isActive ? `${formatElapsed(session.startedAt)} ago` : timeAgo(session.startedAt)}
              </span>
              <span className="flex items-center gap-1">
                <span
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${meta.colorClass}`}
                >
                  {meta.icon}
                  {meta.label}
                </span>
              </span>
              {session.profileName && (
                <span className="text-white/40">{session.profileName}</span>
              )}
              {session.modelId && <Badge color="purple">{session.modelId}</Badge>}
              {typeof session.messageCount === "number" && session.messageCount > 0 && (
                <span
                  className="flex items-center gap-1 text-white/40"
                  title={`${session.messageCount} message${session.messageCount === 1 ? "" : "s"}`}
                >
                  <MessageSquare className="w-3 h-3" />
                  {session.messageCount} msgs
                </span>
              )}
              {session.size > 0 && (
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {(session.size / 1024).toFixed(1)} KB
                </span>
              )}
              {session.missionId && (
                <Link
                  href={`/orchestration/missions/${session.missionId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="z-10"
                  title="Open parent mission"
                >
                  <Badge color="green">mission</Badge>
                </Link>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-neon-orange group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-4" />
        </div>
      </div>
    </Link>
  );
}

function MissionGroupCard({ group }: { group: MissionGroup }) {
  const [expanded, setExpanded] = useState(false);
  const hasActive = group.activeCount > 0;
  const oldest = group.sessions[group.sessions.length - 1];
  const latest = group.sessions[0];
  const title = formatSessionTitle(latest);

  return (
    <div className="rounded-xl border border-neon-green/20 bg-neon-green/[0.03] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 hover:bg-neon-green/[0.04] transition-colors text-left flex items-center justify-between gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {hasActive && <LiveDot />}
            <Layers className="w-4 h-4 text-neon-green flex-shrink-0" />
            <h3 className="font-semibold text-white truncate">{title}</h3>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green">
              {group.sessions.length} sessions
            </span>
            {hasActive && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neon-green/20 text-neon-green">
                {group.activeCount} active
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-white/30 font-mono flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(group.firstStartedAt)} → {timeAgo(group.lastStartedAt)}
            </span>
            <span>id: {group.missionId.slice(0, 8)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/orchestration/missions/${group.missionId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] font-mono px-2 py-1 rounded bg-neon-green/10 text-neon-green hover:bg-neon-green/20 transition-colors"
            title="Open the parent mission"
          >
            ↗ Mission
          </Link>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-white/30" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/30" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-white/5 p-3 space-y-2 bg-dark-900/30">
          {group.sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
          {oldest && oldest.id !== latest.id && (
            <p className="text-[10px] font-mono text-white/20 px-2">
              Showing all {group.sessions.length} sessions · oldest: {timeAgo(oldest.startedAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────

export default function SessionsPage() {
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SessionSource | null>(null);
  const [page, setPage] = useState(0);
  const [groupByMission, setGroupByMission] = useStoredBool(GROUP_BY_MISSION_STORAGE_KEY, true);
  const [hideApiNoise, setHideApiNoise] = useStoredBool(HIDE_API_NOISE_STORAGE_KEY, false);
  // Tick state so the live indicator refreshes every second for active sessions
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  const { showToast, toastElement } = useToast();

  const loadSessions = useCallback(
    async (offset: number) => {
      setLoading(true);
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (sourceFilter) params.set("source", sourceFilter);

      try {
        const json = await apiFetch(`/api/sessions?${params}`);
        setData(json.data ?? { sessions: [], total: 0 });
      } catch {
        showToast("Failed to load sessions", "error");
      } finally {
        setLoading(false);
      }
    },
    [sourceFilter, showToast],
  );

  // Initial load + reload on filter change
  useEffect(() => {
    setPage(0);
    void loadSessions(0);
  }, [loadSessions]);

  // Stable reference for downstream useMemo hooks — prevents unnecessary recomputation
  // on renders where data hasn't changed. Using data?.sessions as dependency is safe:
  // it only produces a new reference when the API response changes.
  const sessions = useMemo(() => data?.sessions ?? [], [data?.sessions]);

  // All known session source types — always show filter buttons regardless of current page contents
  const sources = Object.keys(SOURCE_META) as SessionSource[];

  const searchedSessions = useMemo(() => {
    if (!search) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(
      (s) =>
        (s.title?.toLowerCase() ?? "").includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.profileName?.toLowerCase() ?? "").includes(q) ||
        (s.missionId?.toLowerCase() ?? "").includes(q),
    );
  }, [sessions, search]);

  // Apply "hide API noise" filter (opt-in, default off). Heuristic: short
  // api-source sessions (< 1KB) that completed in under a minute. The list
  // is dominated by these during heavy Hindsight stress testing.
  const filteredSessions = useMemo(() => {
    if (!hideApiNoise) return searchedSessions;
    return searchedSessions.filter((s) => {
      if (s.source !== "api") return true;
      if (s.size >= 1024) return true;
      const ageMs = Date.now() - new Date(s.startedAt).getTime();
      if (ageMs > 60_000) return true;
      return false;
    });
  }, [searchedSessions, hideApiNoise]);

  const entries = useMemo(
    () => buildGroupedEntries(filteredSessions, groupByMission),
    [filteredSessions, groupByMission],
  );

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <AppPageShell>
      <PageHeader
        icon={Clock}
        title="Session History"
        subtitle={`${data?.total ?? 0} recorded sessions across all agents`}
        color="orange"
      />

      <div className="px-6 py-6">
        {/* Search + Source Filter + View Options */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search sessions by title, ID, profile, or mission id..."
                accentColor="orange"
              />
            </div>
            {sources.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-white/30 flex-shrink-0" />
                <button
                  onClick={() => setSourceFilter(null)}
                  className={`text-xs font-mono px-2 py-1 rounded transition-colors ${
                    !sourceFilter
                      ? "bg-neon-orange/20 text-neon-orange"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  All
                </button>
                {sources.map((src) => (
                  <button
                    key={src}
                    onClick={() => setSourceFilter(src)}
                    className={`text-xs font-mono px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                      sourceFilter === src
                        ? "bg-neon-orange/20 text-neon-orange"
                        : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    {SOURCE_META[src]?.icon}
                    {SOURCE_META[src]?.label ?? src}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View options row: group-by-mission, hide-api-noise, live indicator hint */}
          <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setGroupByMission(!groupByMission)}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                groupByMission
                  ? "bg-neon-green/10 text-neon-green"
                  : "text-white/40 hover:text-white/60"
              }`}
              title="Collapse sessions with the same missionId into a single card"
            >
              <Layers className="w-3 h-3" />
              Group by mission
            </button>
            <button
              type="button"
              onClick={() => setHideApiNoise(!hideApiNoise)}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                hideApiNoise
                  ? "bg-neon-purple/10 text-neon-purple"
                  : "text-white/40 hover:text-white/60"
              }`}
              title="Hide short-lived api-source sessions (< 1KB, < 1 min) that dominate the list during stress testing"
            >
              <EyeOff className="w-3 h-3" />
              Hide API noise
            </button>
            <span
              className="flex items-center gap-1 text-white/20 px-2 py-1"
              title="Active sessions get a pulsing dot and live elapsed time"
            >
              <Activity className="w-3 h-3" />
              <LiveDot /> = live
            </span>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner text="Loading sessions..." />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No sessions found"
            description={
              search || sourceFilter || hideApiNoise
                ? "Try a different filter"
                : "No recorded sessions yet"
            }
          />
        ) : (
          <>
            <div className="text-xs text-white/30 font-mono mb-3">
              Showing {entries.length} {groupByMission ? "entries" : "sessions"} of{" "}
              {data?.total ?? 0} total
            </div>
            <div className="grid gap-3">
              {entries.map((entry) =>
                entry.kind === "mission" ? (
                  <MissionGroupCard key={entry.key} group={entry} />
                ) : (
                  <SessionCard key={entry.key} session={entry.session} />
                ),
              )}
            </div>
            {totalPages > 1 && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(newPage) => {
                  setPage(newPage);
                  void loadSessions(newPage * PAGE_SIZE);
                }}
              />
            )}
          </>
        )}
      </div>
      {toastElement}
    </AppPageShell>
  );
}

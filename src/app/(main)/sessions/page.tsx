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

import { useCallback, useState, useEffect, useMemo, useRef } from "react";
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
import { LiveDot } from "@/components/ui/LiveDot";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { timeAgo, formatElapsed, pluralise } from "@/lib/utils";
import { useApiData } from "@/hooks/useApiData";
import { useInterval } from "@/hooks/useInterval";
import { useStoredBool } from "@/hooks/useStoredBool";
import { searchSessionsByQuery, isApiNoiseSession } from "@/lib/session-filters";
import { buildGroupedEntries, type MissionGroup } from "@/lib/sessions-grouping";
import AppPageShell from "@/components/layout/AppPageShell";
import type { SessionRecord } from "@/lib/session-repository";
import type { SessionSource } from "@/lib/session-repository";
import { SOURCE_META } from "@/components/session/constants";
import { formatSessionTitle } from "@/lib/session-title";

// ── Types ────────────────────────────────────────────────────

interface SessionsResponse {
  sessions: SessionRecord[];
  total: number;
}

// ── Constants ────────────────────────────────────────────────

const PAGE_SIZE = 50;
const GROUP_BY_MISSION_STORAGE_KEY = "ch.sessions.groupByMission";
const HIDE_API_NOISE_STORAGE_KEY = "ch.sessions.hideApiNoise";

// ── Components ───────────────────────────────────────────────

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
                  title={`${session.messageCount} message${pluralise(session.messageCount)}`}
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
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SessionSource | null>(null);
  const [page, setPage] = useState(0);
  const [groupByMission, setGroupByMission] = useStoredBool(GROUP_BY_MISSION_STORAGE_KEY, true);
  const [hideApiNoise, setHideApiNoise] = useStoredBool(HIDE_API_NOISE_STORAGE_KEY, false);
  // Tick state so the live indicator refreshes every second for active sessions
  const [, setNowTick] = useState(0);
  useInterval(() => setNowTick((n) => n + 1), { ms: 1000 });
  const { toastElement } = useToast();

  // When the source filter changes, jump back to page 0 so the user
  // doesn't see "no results" on a stale page index. We mirror the
  // filter into a ref so the `urlBuilder` closure can read the
  // freshest value without invalidating the `useApiData` URL callback
  // (which would trigger an extra fetch on the same page transition).
  const sourceFilterRef = useRef(sourceFilter);
  useEffect(() => {
    sourceFilterRef.current = sourceFilter;
    setPage(0);
  }, [sourceFilter]);

  // Open/close sibling pair for the source filter. The "All" button
  // (line 327) clears the filter (sets it to `null`); each source button
  // in the .map() (line 339) sets it to that source. Both paths were
  // inline `() => setSourceFilter(X)` arrows — promoting to named
  // useCallback siblings follows the session 116 P-7 / session 118 P-7
  // pattern. `selectSourceFilter` takes a parameter because the .map()
  // supplies the source; the `null` path (`clearSourceFilter`) is the
  // 1-arg "close" sibling. Both callbacks list the stable `useState`
  // setter explicitly in the deps array to satisfy
  // `react-hooks/exhaustive-deps`.
  const clearSourceFilter = useCallback(
    () => setSourceFilter(null),
    [setSourceFilter],
  );
  const selectSourceFilter = useCallback(
    (src: SessionSource) => setSourceFilter(src),
    [setSourceFilter],
  );
  // Toggle callbacks for the 2 view-options row buttons (group-by-mission
  // and hide-api-noise). Both were inline `() => setX(!X)` arrows on the
  // button onClick props — promoting to named useCallbacks follows the
  // session 191 sibling pattern (the Skills page's
  // `toggleActiveCollapsed` / `toggleInactiveCollapsed` pair). We pass
  // the next boolean to the `useStoredBool` setter rather than calling
  // the setter with a functional updater — `useStoredBool` returns a
  // `(v: boolean) => void` setter (not a React `Dispatch`), so the
  // functional form isn't available. The deps array lists the captured
  // boolean so the `react-hooks/exhaustive-deps` rule is satisfied
  // (the setter itself has a stable identity per `key`).
  const toggleGroupByMission = useCallback(
    () => setGroupByMission(!groupByMission),
    [groupByMission, setGroupByMission],
  );
  const toggleHideApiNoise = useCallback(
    () => setHideApiNoise(!hideApiNoise),
    [hideApiNoise, setHideApiNoise],
  );

  // URL is rebuilt from the current page + source filter. The hook
  // re-fetches on URL change, so a page click or a filter change
  // triggers a single fetch (matches the pre-refactor `loadSessions`
  // behaviour: 1 fetch per state change, no extra renders).
  const sessionsUrl = useCallback(
    () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (sourceFilterRef.current) params.set("source", sourceFilterRef.current);
      return `/api/sessions?${params}`;
    },
    [page],
  );

  const { data, loading, error: loadError, refetch } = useApiData<SessionsResponse>(sessionsUrl, {
    urlBuilder: sessionsUrl,
  });

  // Surface API errors as a persistent <LoadErrorBanner> with a Retry
  // button. The banner is always rendered when `loadError` is non-null —
  // it's sticky (the empty list state below the banner is now the
  // "load failed, not catalog empty" state, which is the canonical
  // disambiguation the umbrella skill's `LoadErrorBanner` pattern
  // (Pattern #19) was designed for). The Retry button calls
  // `useApiData`'s `refetch` so the user can re-attempt the fetch
  // without manually reloading the page.
  //
  // Replaces the previous `useEffect(() => showToast(loadError, "error"))`
  // form (4s toast, no recovery affordance, disappeared on its own
  // leaving the user staring at a frozen list with a generic "no
  // results" empty state).

  // Stable reference for downstream useMemo hooks — prevents unnecessary recomputation
  // on renders where data hasn't changed. Using data?.sessions as dependency is safe:
  // it only produces a new reference when the API response changes.
  const sessions = useMemo(() => data?.sessions ?? [], [data?.sessions]);

  // All known session source types — always show filter buttons regardless of current page contents
  const sources = Object.keys(SOURCE_META) as SessionSource[];

  // Combined search + "hide API noise" filter. Both passes live in
  // the same `useMemo` because the noise filter is just a refinement
  // of the search result (an opt-in second predicate). The merged
  // shape avoids a 2-step chain of `useMemo`es where the intermediate
  // `searchedSessions` is only read once. The noise predicate and
  // search predicate are still pure helpers (searchSessionsByQuery /
  // isApiNoiseSession) so each one is unit-testable in isolation.
  const filteredSessions = useMemo(() => {
    const matched = searchSessionsByQuery(sessions, search);
    return hideApiNoise ? matched.filter((s) => !isApiNoiseSession(s)) : matched;
  }, [sessions, search, hideApiNoise]);

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
        {loadError && (
          <LoadErrorBanner
            error={loadError}
            onRetry={() => void refetch()}
            hint="The list below may be empty because the load failed — not because there are no sessions to show."
          />
        )}
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
                  onClick={clearSourceFilter}
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
                    onClick={() => selectSourceFilter(src)}
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
              onClick={toggleGroupByMission}
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
              onClick={toggleHideApiNoise}
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
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>
      {toastElement}
    </AppPageShell>
  );
}

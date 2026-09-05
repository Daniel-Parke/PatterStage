// ═══════════════════════════════════════════════════════════════
// Session History — Unified view of all agent sessions
//
// PatterStage is the source of truth. Sessions born from missions
// and cron jobs are written directly to the DB. Hermes CLI
// sessions are synced from ~/.hermes/<profile>/sessions/ on
// every page load via the /api/sessions endpoint.
//
// Sources: cli (Hermes interactive), cron (scheduled jobs),
//         mission (PatterStage dispatch), api (direct API calls)
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
//     via src/lib/sessions/session-title.ts so recurring cron sessions get
//     human-readable names like "Cron: Review & Refactor — 20260601 185050".
//
// The row, the mission-group row and the filter bar are presentational
// components under src/components/session/; this file is the shell that
// owns the query, the filters and the paging.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { Clock } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { useSessions } from "@/hooks/useSessions";
import { useInterval } from "@/hooks/useInterval";
import { useStoredBool } from "@/hooks/useStoredBool";
import { isApiNoiseSession } from "@/lib/sessions/session-filters";
import { buildGroupedEntries } from "@/lib/sessions/sessions-grouping";
import AppPageShell from "@/components/layout/AppPageShell";
import { Panel } from "@/components/dashboard/Panel";
import AgentSetupNotice from "@/components/agents/AgentSetupNotice";
import type { SessionSource } from "@/lib/sessions/session-repository";
import { SOURCE_META } from "@/components/session/constants";
import SessionInsights from "@/components/session/SessionInsights";
import SessionCard from "@/components/session/SessionCard";
import MissionGroupCard from "@/components/session/MissionGroupCard";
import SessionFilterBar from "@/components/session/SessionFilterBar";

// ── Constants ────────────────────────────────────────────────

const PAGE_SIZE = 50;
// Storage keys use the `ps.*` prefix; the legacy `ch.*` keys (pre-rename) are
// migrated forward once via useStoredBool's legacyKey param so saved prefs survive.
const GROUP_BY_MISSION_STORAGE_KEY = "ps.sessions.groupByMission";
const GROUP_BY_MISSION_LEGACY_KEY = "ch.sessions.groupByMission";
const HIDE_API_NOISE_STORAGE_KEY = "ps.sessions.hideApiNoise";
const HIDE_API_NOISE_LEGACY_KEY = "ch.sessions.hideApiNoise";

// ── Page ────────────────────────────────────────────────────

export default function SessionsPage() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SessionSource | null>(null);
  const [page, setPage] = useState(0);
  // Search runs SERVER-SIDE over the full table (not just the loaded page), so a
  // term that matches a session deep in the 35k+ history is actually found.
  // Debounce so each keystroke doesn't fire a query; reset to page 0 on change.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(0); }, [debouncedSearch]);
  const [groupByMission, setGroupByMission] = useStoredBool(GROUP_BY_MISSION_STORAGE_KEY, true, GROUP_BY_MISSION_LEGACY_KEY);
  const [hideApiNoise, setHideApiNoise] = useStoredBool(HIDE_API_NOISE_STORAGE_KEY, false, HIDE_API_NOISE_LEGACY_KEY);
  // Tick state so the live indicator refreshes every second for active sessions
  const [, setNowTick] = useState(0);
  useInterval(() => setNowTick((n) => n + 1), { ms: 1000 });
  const { toastElement } = useToast();

  // Open/close sibling pair for the source filter. The "All" button
  // clears the filter (sets it to `null`); each source button in the
  // filter bar's .map() sets it to that source. Both paths were
  // inline `() => setSourceFilter(X)` arrows — promoting to named
  // useCallback siblings follows the session 116 P-7 / session 118 P-7
  // pattern. `selectSourceFilter` takes a parameter because the .map()
  // supplies the source; the `null` path (`clearSourceFilter`) is the
  // 1-arg "close" sibling. Both callbacks list the stable `useState`
  // setter explicitly in the deps array to satisfy
  // `react-hooks/exhaustive-deps`.
  // Both filter callbacks also reset to page 0 so the user doesn't land
  // on a stale page index with "no results" after narrowing the filter.
  // (Previously a `useEffect` watched `sourceFilter` to reset the page;
  // folding the reset into the setters keeps `sourceFilter` + `page` in
  // the query key changing together — one refetch per filter change.)
  const clearSourceFilter = useCallback(() => {
    setSourceFilter(null);
    setPage(0);
  }, [setSourceFilter, setPage]);
  const selectSourceFilter = useCallback((src: SessionSource) => {
    setSourceFilter(src);
    setPage(0);
  }, [setSourceFilter, setPage]);
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

  // page + sourceFilter live in the query key (src/hooks/useSessions.ts),
  // so a page click or filter change triggers exactly one fetch and a
  // cached page re-displays instantly.
  const { data, isLoading: loading, error: loadError, refetch } = useSessions(
    page,
    sourceFilter,
    PAGE_SIZE,
    debouncedSearch,
  );

  // Surface API errors as a persistent <LoadErrorBanner> with a Retry
  // button. The banner is always rendered when `loadError` is non-null —
  // it's sticky (the empty list state below the banner is now the
  // "load failed, not catalog empty" state, which is the canonical
  // disambiguation the umbrella skill's `LoadErrorBanner` pattern
  // (Pattern #19) was designed for). The Retry button calls
  // `useSessions`'s `refetch` so the user can re-attempt the fetch
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

  // Search is now applied server-side (full table), so the loaded page only
  // needs the opt-in "hide API noise" refinement (a pure, unit-tested predicate).
  const filteredSessions = useMemo(() => {
    return hideApiNoise ? sessions.filter((s) => !isApiNoiseSession(s)) : sessions;
  }, [sessions, hideApiNoise]);

  const entries = useMemo(
    () => buildGroupedEntries(filteredSessions, groupByMission),
    [filteredSessions, groupByMission],
  );

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE);

  return (
    <AppPageShell>
      <PageHeader
        icon={Clock}
        subtitle={`${data?.total ?? 0} recorded sessions across all agents`}
        color="orange"
      />

      {/* An empty session list means one of two very different things. On an
          install with no agent it is not "you have not run anything yet", it is
          "nothing can produce a transcript here". Say which. */}
      <AgentSetupNotice what="Recording sessions" />

      <div className="px-6 py-6">
        {loadError && (
          <LoadErrorBanner
            error={loadError}
            onRetry={() => void refetch()}
            hint="The list below may be empty because the load failed — not because there are no sessions to show."
          />
        )}
        {/* The tiles read the same `data` object the header above reads its
            count from, and the repository computes both from one aggregate,
            so the two cannot say different things (T-0042). */}
        <SessionInsights totals={data?.totals} />
        {/* Search + Source Filter + View Options */}
        <SessionFilterBar
          search={search}
          onSearchChange={setSearch}
          sources={sources}
          sourceFilter={sourceFilter}
          onClearSourceFilter={clearSourceFilter}
          onSelectSourceFilter={selectSourceFilter}
          groupByMission={groupByMission}
          onToggleGroupByMission={toggleGroupByMission}
          hideApiNoise={hideApiNoise}
          onToggleHideApiNoise={toggleHideApiNoise}
        />

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
            <div className="text-xs text-ps-text-muted font-mono mb-3">
              Showing {entries.length} {groupByMission ? "entries" : "sessions"} of{" "}
              {data?.total ?? 0} {debouncedSearch ? "matching" : "total"}
              {hideApiNoise ? " · API noise hidden" : ""}
            </div>
            {/* One container around the lot, not one per record. A session
                carries eight comparable fields, which WG-WEB-003 (D) rules is
                a ledger; the divider is what separates two records now, and
                the Panel is what a future styling ruling edits. */}
            <Panel>
              <div className="divide-y divide-white/5">
                {entries.map((entry) =>
                  entry.kind === "mission" ? (
                    <MissionGroupCard key={entry.key} group={entry} />
                  ) : (
                    <SessionCard key={entry.key} session={entry.session} />
                  ),
                )}
              </div>
            </Panel>
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

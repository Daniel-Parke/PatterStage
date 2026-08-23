// ═══════════════════════════════════════════════════════════════
// System Logs — Live log viewer for Hermes log files
//
// Thin page shell: the query, the auto-scroll bookkeeping and the
// two-step delete live here. The header controls, the file sidebar and
// the terminal pane are presentational components under
// src/components/logs/.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Terminal, Search, ChevronDown, X } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import AppPageShell from "@/components/layout/AppPageShell";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { safeApiCallData, setErrorFromCaught } from "@/lib/api-fetch";
import { useLogs } from "@/hooks/useLogs";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import { formatBytes } from "@/lib/utils";
import LogInsights from "@/components/logs/LogInsights";
import LogsHeaderActions from "@/components/logs/LogsHeaderActions";
import LogFilePicker from "@/components/logs/LogFilePicker";
import LogTerminal from "@/components/logs/LogTerminal";

export default function LogsPage() {
  const [activeLog, setActiveLog] = useState("agent");
  const [search, setSearch] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lineCount, setLineCount] = useState(200);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  // "Delete all logs" is a destructive singleton action — no auto-dismiss
  // (the user must explicitly confirm or cancel). The hook returns
  // `isArmed` for the singleton key; `confirm` runs the action.
  const { isArmed: deleteArmed, arm: armDelete, confirm: confirmDelete, cancel: cancelDelete } =
    useTwoStepConfirm({ autoDismissMs: 0 });

  // Auto-refresh is owned by the query: a 5s `refetchInterval` gated by
  // the `autoRefresh` toggle (src/hooks/useLogs.ts). The reactive log
  // name + line count live in the query key, so switching files or line
  // counts refetches. `isLoading` drives the first-load full-page
  // spinner; `isFetching` (any in-flight fetch on top of cached data)
  // drives the "Refresh" button spinner.
  const { data, isLoading: loading, isFetching, error: loadError, refetch } = useLogs(
    activeLog,
    lineCount,
    { autoRefresh },
  );
  const refreshing = !!data && isFetching;

  const handleDeleteAllLogs = useCallback(async () => {
    if (!deleteArmed) {
      setActionMessage(null);
      armDelete();
      return;
    }
    await confirmDelete(async () => {
      try {
        // The route returns `{ data: { cleared: N } }` (envelope).
        // `safeApiCallData<T>` returns `T | null` (the inner payload
        // directly — no manual `data?.data?.cleared` indirection).
        // Matches the canonical envelope + safeApiCallData shape
        // used by every other read-only fetch on the Logs page.
        const delData = await safeApiCallData<{ cleared?: number }>("/api/logs", {
          method: "DELETE",
        });
        if (!delData) {
          setActionMessage("Delete failed");
          return;
        }
        setActionMessage(
          typeof delData.cleared === "number"
            ? `Cleared ${delData.cleared} log file(s).`
            : "Logs cleared.",
        );
        void refetch();
      } catch (err) {
        setErrorFromCaught(setActionMessage, err, "Delete failed (network error)");
      }
    });
  }, [deleteArmed, armDelete, confirmDelete, refetch]);

  // Auto-set activeLog to first available log when list loads
  useEffect(() => {
    if (!data?.availableLogs?.length) return;
    const ok = data.availableLogs.some((l) => l.name === activeLog);
    if (!ok) {
      setActiveLog(data.availableLogs[0].name);
    }
  }, [data?.availableLogs, activeLog]);

  // Auto-refresh is now owned by the hook (refreshIntervalMs: 5000 above).

  // Auto-scroll to top on new data
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = 0;
    }
  }, [data?.lines, autoScroll]);

  // Open/close sibling pair for the search input. The X button on
  // the visible search input and the "Filter lines" pill form a
  // 2-state toggle. The X path is a 2-setter close (clear the search
  // query AND hide the input); the open path is the 1-setter show.
  // Both promoted to useCallback-wrapped named callbacks following
  // the session 116 P-7 / session 118 P-7 pattern (named open/close
  // siblings next to each other, with the stable `useState` setters
  // listed explicitly in the deps array to satisfy the
  // `react-hooks/exhaustive-deps` rule). The close path used to
  // be an inline 3-line arrow on the X button's `onClick` prop.
  const openSearchInput = useCallback(
    () => setSearchVisible(true),
    [setSearchVisible],
  );
  const closeSearchInput = useCallback(() => {
    setSearch("");
    setSearchVisible(false);
  }, [setSearch, setSearchVisible]);
  // The "Latest lines" pill is a 2-step action: re-enable auto-scroll
  // AND scroll the terminal to the top. The inline 4-line arrow on the
  // button's `onClick` prop is promoted to a named useCallback so the
  // page's intent is named (the inline form was a 5-line body buried
  // in the JSX). The terminalRef read is unconditional — `current` is
  // null only on the first render, in which case the autoScroll state
  // still flips so the next render scrolls correctly.
  const jumpToLatestLines = useCallback(() => {
    setAutoScroll(true);
    if (terminalRef.current) {
      terminalRef.current.scrollTop = 0;
    }
  }, [setAutoScroll, terminalRef]);
  // Dismiss the action message toast. Single-setter close callback
  // following the same useCallback pattern as the sibling open/close
  // callbacks above. Used by the small "×" button on the action
  // message banner.
  const dismissActionMessage = useCallback(
    () => setActionMessage(null),
    [setActionMessage],
  );

  const handleScroll = () => {
    if (!terminalRef.current) return;
    const { scrollTop } = terminalRef.current;
    setAutoScroll(scrollTop < 50);
  };

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Named sibling for the header's auto-refresh pill. Byte-equivalent to
  // the inline `() => setAutoRefresh(!autoRefresh)` arrow it replaces; the
  // captured boolean is listed in the deps array so the
  // `react-hooks/exhaustive-deps` rule is satisfied.
  const toggleAutoRefresh = useCallback(
    () => setAutoRefresh(!autoRefresh),
    [autoRefresh, setAutoRefresh],
  );

  const filteredFiles = useMemo(() => {
    if (!data?.availableLogs) return [];
    const q = fileQuery.trim().toLowerCase();
    if (!q) return data.availableLogs;
    return data.availableLogs.filter((l) => l.name.toLowerCase().includes(q));
  }, [data?.availableLogs, fileQuery]);

  const allLines = useMemo(() => data?.lines || [], [data?.lines]);
  // Pre-normalize the search term once instead of calling
  // `search.toLowerCase()` per-line in the filter (was 200 redundant
  // calls for a 200-line log). Empty search short-circuits the filter.
  const filteredLines = useMemo(() => {
    if (!search) return allLines;
    const needle = search.toLowerCase();
    return allLines.filter((line) => line.toLowerCase().includes(needle));
  }, [allLines, search]);

  const searchMatches = search ? filteredLines.length : 0;

  return (
    <AppPageShell>
      <PageHeader
        icon={Terminal}
        title="System Logs"
        subtitle={
          data
            ? `${data.name}.log — ${data.totalLines} lines (${formatBytes(data.size)})`
            : "Hermes agent and gateway logs"
        }
        color="cyan"
        actions={
          <LogsHeaderActions
            autoRefresh={autoRefresh}
            onToggleAutoRefresh={toggleAutoRefresh}
            lineCount={lineCount}
            onLineCountChange={setLineCount}
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            deleteArmed={deleteArmed}
            onDeleteAll={() => void handleDeleteAllLogs()}
            onCancelDelete={cancelDelete}
          />
        }
      />

      <div className="px-6 py-6 flex-1 flex flex-col min-h-0">
        {loadError && (
          <LoadErrorBanner
            error={loadError}
            onRetry={() => void handleRefresh()}
          />
        )}
        {actionMessage && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-dark-900/50 px-4 py-2 text-xs font-mono text-ps-text-secondary">
            <span>{actionMessage}</span>
            <button
              type="button"
              onClick={dismissActionMessage}
              className="p-1 rounded text-ps-text-muted hover:text-ps-text-secondary"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
          {/* File picker */}
          <LogFilePicker
            files={filteredFiles}
            query={fileQuery}
            onQueryChange={setFileQuery}
            activeLog={activeLog}
            onSelect={setActiveLog}
          />

          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {searchVisible ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="relative flex-1 max-w-md min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ps-text-muted" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter log lines…"
                      autoFocus
                      className="w-full bg-dark-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-neon-cyan/50 transition-colors font-mono"
                    />
                  </div>
                  {search && (
                    <span className="text-xs font-mono text-neon-cyan shrink-0">
                      {searchMatches} matches
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={closeSearchInput}
                    className="p-1.5 rounded-lg text-ps-text-muted hover:text-ps-text-secondary hover:bg-white/5 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openSearchInput}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-ps-text-muted hover:text-ps-text-secondary hover:bg-white/5 font-mono"
                >
                  <Search className="w-3 h-3" />
                  Filter lines
                </button>
              )}

              {!autoScroll && (
                <button
                  type="button"
                  onClick={jumpToLatestLines}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-neon-cyan bg-neon-cyan/10 font-mono"
                >
                  <ChevronDown className="w-3 h-3 rotate-180" />
                  Latest lines
                </button>
              )}
            </div>

            {data && <LogInsights lines={allLines} />}
            {loading && !data ? (
              <LoadingSpinner text="Loading logs..." />
            ) : data ? (
              <LogTerminal
                containerRef={terminalRef}
                onScroll={handleScroll}
                logName={data.name}
                activeLog={activeLog}
                showingLines={data.showingLines}
                totalLines={data.totalLines}
                lines={filteredLines}
                searchTerm={search}
              />
            ) : null}
          </div>
        </div>
      </div>
    </AppPageShell>
  );
}

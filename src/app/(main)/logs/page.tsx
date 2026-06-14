// ═══════════════════════════════════════════════════════════════
// System Logs — Live log viewer for Hermes log files
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Terminal,
  RefreshCw,
  Search,
  ChevronDown,
  FileText,
  X,
  Play,
  Trash2,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import AppPageShell from "@/components/layout/AppPageShell";
import Button from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { safeApiCallData, setErrorFromCaught } from "@/lib/api-fetch";
import { useApiData } from "@/hooks/useApiData";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import type { LogGetData } from "@/app/api/logs/route";
import { formatBytes } from "@/lib/utils";
import { LogRow } from "@/components/logs/LogRow";
import { GROUP_ORDER, GROUP_LABELS } from "@/components/logs/constants";
import LogInsights from "@/components/logs/LogInsights";

type LogData = LogGetData;

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

  const logUrl = useMemo(
    () => `/api/logs?name=${encodeURIComponent(activeLog)}&lines=${lineCount}`,
    [activeLog, lineCount],
  );

  // Auto-refresh is owned by the hook: 5s polling loop, gated by the
  // `autoRefresh` toggle. Eliminates the previous `useInterval` +
  // `setRefreshing` + `useEffect` micro-state trio. `loading` is
  // exposed by the hook for the button's "Refresh" affordance, but
  // we only show the spinner once we already have data (matches the
  // pre-refactor UX: the very first load shows a full-page spinner,
  // a background refresh shows the button spinner).
  const { data, loading, error: loadError, refetch } = useApiData<LogData>(logUrl, {
    refreshIntervalMs: 5000,
    refreshEnabled: autoRefresh,
  });
  // Mirrors the pre-refactor `refreshing` derivation: button spinner
  // only shows when a refresh runs on top of already-loaded data.
  const refreshing = !!data && loading;

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
  // the visible search input (line 308) and the "Filter lines" pill
  // (line 320) form a 2-state toggle. The X path is a 2-setter close
  // (clear the search query AND hide the input); the open path is
  // the 1-setter show. Both promoted to useCallback-wrapped named
  // callbacks following the session 116 P-7 / session 118 P-7 pattern
  // (named open/close siblings next to each other, with the stable
  // `useState` setters listed explicitly in the deps array to satisfy
  // the `react-hooks/exhaustive-deps` rule). The close path used to
  // be an inline 3-line arrow on the X button's `onClick` prop.
  const openSearchInput = useCallback(
    () => setSearchVisible(true),
    [setSearchVisible],
  );
  const closeSearchInput = useCallback(() => {
    setSearch("");
    setSearchVisible(false);
  }, [setSearch, setSearchVisible]);
  // The "Latest lines" pill (line 331) is a 2-step action: re-enable
  // auto-scroll AND scroll the terminal to the top. The inline
  // 4-line arrow on the button's `onClick` prop is promoted to a
  // named useCallback so the page's intent is named (the inline
  // form was a 5-line body buried in the JSX). The terminalRef
  // read is unconditional — `current` is null only on the first
  // render, in which case the autoScroll state still flips so the
  // next render scrolls correctly.
  const jumpToLatestLines = useCallback(() => {
    setAutoScroll(true);
    if (terminalRef.current) {
      terminalRef.current.scrollTop = 0;
    }
  }, [setAutoScroll, terminalRef]);
  // Dismiss the action message toast. Single-setter close callback
  // following the same useCallback pattern as the sibling open/close
  // callbacks above. Used by the small "×" button on the action
  // message banner (line 221).
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all duration-300 ${
                autoRefresh
                  ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 shadow-[0_0_8px_rgba(6,214,214,0.3)]"
                  : "bg-dark-900/50 text-white/40 border border-white/10 hover:text-white/60"
              } ${autoRefresh ? "animate-auto-refresh-tick" : ""}`}
              title={autoRefresh ? "Auto-refresh on (click to disable)" : "Auto-refresh off (click to enable)"}
            >
              {autoRefresh ? (
                <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? "animate-spin-slow" : ""}`} />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>
            <select
              value={lineCount}
              onChange={(e) => {
                // Defensive: `parseInt(value, 10)` returns NaN for empty
                // strings, non-numeric input, or values out of the
                // <select>'s 100/200/500/1000 range. The API route
                // (`src/app/api/logs/route.ts`) handles this with
                // `parseInt(...) + Number.isFinite + Math.min(...,1000) +
                // 200` default — the page mirrors that shape so a future
                // change to a number input (or an empty selection) lands
                // on a stable fallback (200) instead of NaN propagating
                // to the `useApiData` URL builder. Byte-equivalent for the
                // current <select> (all 4 options pass the `>= 1` and
                // `<= 1000` gates).
                const parsed = parseInt(e.target.value, 10);
                setLineCount(Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 1000) : 200);
              }}
              className="bg-dark-900/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono appearance-none cursor-pointer outline-none focus:border-neon-cyan/50"
            >
              <option value={100} className="bg-dark-900">100 lines</option>
              <option value={200} className="bg-dark-900">200 lines</option>
              <option value={500} className="bg-dark-900">500 lines</option>
              <option value={1000} className="bg-dark-900">1000 lines</option>
            </select>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleRefresh()}
              loading={refreshing}
              icon={RefreshCw}
            >
              Refresh
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void handleDeleteAllLogs()}
              icon={Trash2}
            >
              {deleteArmed ? "Confirm Clear" : "Delete All"}
            </Button>
            {deleteArmed && (
              <Button variant="ghost" size="sm" onClick={cancelDelete}>
                Cancel
              </Button>
            )}
          </div>
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
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-dark-900/50 px-4 py-2 text-xs font-mono text-white/70">
            <span>{actionMessage}</span>
            <button
              type="button"
              onClick={dismissActionMessage}
              className="p-1 rounded text-white/40 hover:text-white/70"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
          {/* File picker */}
          <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-2 min-h-0 border border-white/10 rounded-xl bg-dark-900/40 p-3">
            <label className="text-[10px] font-mono uppercase tracking-wide text-white/40">
              Log file
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
              <input
                type="text"
                value={fileQuery}
                onChange={(e) => setFileQuery(e.target.value)}
                placeholder="Filter by name…"
                className="w-full bg-dark-950/80 border border-white/10 rounded-lg pl-8 pr-2 py-2 text-xs text-white placeholder:text-white/25 outline-none focus:border-neon-cyan/40 font-mono"
              />
            </div>
            <div className="flex-1 min-h-[12rem] max-h-[40vh] lg:max-h-[calc(100vh-280px)] overflow-y-auto space-y-3 pr-1">
              {GROUP_ORDER.map((group) => {
                const items = filteredFiles.filter((l) => l.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-white/35 mb-1.5">
                      {GROUP_LABELS[group]}
                    </div>
                    <div className="flex flex-col gap-1">
                      {items.map((log) => (
                        <button
                          key={log.name}
                          type="button"
                          onClick={() => setActiveLog(log.name)}
                          className={`flex items-start gap-2 text-left rounded-lg px-2.5 py-2 text-xs font-mono border transition-colors ${
                            activeLog === log.name
                              ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/35"
                              : "border-transparent text-white/55 hover:bg-white/5 hover:text-white/80"
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-60" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{log.name}.log</span>
                            <span className="block text-[10px] text-white/30 mt-0.5">
                              {formatBytes(log.size)}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredFiles.length === 0 && (
                <p className="text-xs text-white/35 py-4 text-center">No matching log files</p>
              )}
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              {searchVisible ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="relative flex-1 max-w-md min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
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
                    className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openSearchInput}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/60 hover:bg-white/5 font-mono"
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
              <div
                ref={terminalRef}
                onScroll={handleScroll}
                className="rounded-xl border border-white/10 bg-dark-900/50 overflow-hidden flex flex-col flex-1 min-h-0"
              >
                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-dark-800/50 shrink-0">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-xs text-white/40 font-mono ml-2 truncate">
                    {activeLog}.log
                    <span className="text-white/20 ml-2">
                      (showing {data.showingLines}/{data.totalLines})
                    </span>
                  </span>
                </div>

                <div className="px-3 py-2 border-b border-white/5 bg-dark-950/30 shrink-0 hidden sm:grid sm:grid-cols-[minmax(0,9.5rem)_minmax(0,4.5rem)_1fr] gap-x-3 text-[10px] font-mono uppercase tracking-wide text-white/30">
                  <span>Time</span>
                  <span>Level</span>
                  <span>Message</span>
                </div>

                <div className="p-3 sm:p-4 text-xs overflow-auto flex-1 min-h-0 max-h-[calc(100vh-320px)] lg:max-h-none">
                  {filteredLines.length > 0 ? (
                    filteredLines.map((line, i) => (
                      <LogRow
                        key={`${data.name}-${i}`}
                        line={line}
                        searchTerm={search}
                      />
                    ))
                  ) : (
                    <div className="text-center text-white/20 py-8">
                      {search ? "No matching lines" : "Log file is empty"}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppPageShell>
  );
}

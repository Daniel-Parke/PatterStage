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
  AlertCircle,
  FileText,
  X,
  Play,
  Trash2,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import AppPageShell from "@/components/layout/AppPageShell";
import Button from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { safeApiCall } from "@/lib/api-fetch";
import { useApiData } from "@/hooks/useApiData";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import { useInterval } from "@/hooks/useInterval";
import type { LogGetData } from "@/app/api/logs/route";
import { formatBytes } from "@/lib/utils";
import { LogRow } from "@/components/logs/LogRow";
import { GROUP_ORDER, GROUP_LABELS } from "@/components/logs/constants";

type LogData = LogGetData;

export default function LogsPage() {
  const [activeLog, setActiveLog] = useState("agent");
  const [refreshing, setRefreshing] = useState(false);
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

  const { data, loading, error: loadError, refetch } = useApiData<LogData>(logUrl);

  const handleDeleteAllLogs = useCallback(async () => {
    if (!deleteArmed) {
      setActionMessage(null);
      armDelete();
      return;
    }
    await confirmDelete(async () => {
      try {
        const { ok, data: delData, error } = await safeApiCall<{ cleared?: number }>(
          "/api/logs",
          { method: "DELETE" },
        );
        if (!ok || error) {
          setActionMessage(error ?? "Delete failed");
          return;
        }
        setActionMessage(
          typeof delData?.cleared === "number"
            ? `Cleared ${delData.cleared} log file(s).`
            : "Logs cleared.",
        );
        void refetch();
      } catch {
        setActionMessage("Delete failed (network error)");
      }
    });
  }, [deleteArmed, armDelete, confirmDelete, refetch]);

  // handleCancelDelete is a thin wrapper so the JSX can call it without
  // importing the hook's `cancel` directly. This keeps the destructured
  // hook's surface area smaller in this file.
  const handleCancelDelete = useCallback(() => {
    cancelDelete();
  }, [cancelDelete]);

  // Auto-set activeLog to first available log when list loads
  useEffect(() => {
    if (!data?.availableLogs?.length) return;
    const ok = data.availableLogs.some((l) => l.name === activeLog);
    if (!ok) {
      setActiveLog(data.availableLogs[0].name);
    }
  }, [data?.availableLogs, activeLog]);

  // Auto-refresh every 5s (toggleable)
  useInterval(() => { void refetch(); }, { ms: 5000, enabled: autoRefresh });

  // Auto-scroll to top on new data
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = 0;
    }
  }, [data?.lines, autoScroll]);

  const handleScroll = () => {
    if (!terminalRef.current) return;
    const { scrollTop } = terminalRef.current;
    setAutoScroll(scrollTop < 50);
  };

  const handleRefresh = useCallback(() => {
    if (data) setRefreshing(true);
    void refetch();
  }, [data, refetch]);

  useEffect(() => {
    if (refreshing && !loading) setRefreshing(false);
  }, [refreshing, loading]);

  const filteredFiles = useMemo(() => {
    if (!data?.availableLogs) return [];
    const q = fileQuery.trim().toLowerCase();
    if (!q) return data.availableLogs;
    return data.availableLogs.filter((l) => l.name.toLowerCase().includes(q));
  }, [data?.availableLogs, fileQuery]);

  const allLines = data?.lines || [];
  const filteredLines = search
    ? allLines.filter((line) => line.toLowerCase().includes(search.toLowerCase()))
    : allLines;

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
              onChange={(e) => setLineCount(parseInt(e.target.value, 10))}
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
              <Button variant="ghost" size="sm" onClick={handleCancelDelete}>
                Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="px-6 py-6 flex-1 flex flex-col min-h-0">
        {loadError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>{loadError}</div>
          </div>
        )}
        {actionMessage && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-dark-900/50 px-4 py-2 text-xs font-mono text-white/70">
            <span>{actionMessage}</span>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
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
                    onClick={() => {
                      setSearch("");
                      setSearchVisible(false);
                    }}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchVisible(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/60 hover:bg-white/5 font-mono"
                >
                  <Search className="w-3 h-3" />
                  Filter lines
                </button>
              )}

              {!autoScroll && (
                <button
                  type="button"
                  onClick={() => {
                    setAutoScroll(true);
                    if (terminalRef.current) {
                      terminalRef.current.scrollTop = 0;
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-neon-cyan bg-neon-cyan/10 font-mono"
                >
                  <ChevronDown className="w-3 h-3 rotate-180" />
                  Latest lines
                </button>
              )}
            </div>

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

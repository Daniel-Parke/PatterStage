// ═══════════════════════════════════════════════════════════════
// System Logs — Live log viewer for Hermes log files
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { ReactNode } from "react";
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
import type { LogFileGroup, LogFileMeta } from "@/lib/log-files";
import { parseLogLine, type ParsedLogLevel } from "@/lib/log-line-format";
import { formatBytes } from "@/lib/utils";

interface LogData {
  name: string;
  totalLines: number;
  showingLines: number;
  size: number;
  modified: string;
  lines: string[];
  availableLogs: LogFileMeta[];
  error?: string;
}

function levelTextClass(level: ParsedLogLevel): string {
  switch (level) {
    case "error":
      return "text-red-400";
    case "warn":
      return "text-neon-orange";
    case "debug":
      return "text-white/30";
    case "info":
      return "text-white/60";
    default:
      return "text-white/45";
  }
}

const GROUP_ORDER: LogFileGroup[] = ["core", "system", "other"];
const GROUP_LABELS: Record<LogFileGroup, string> = {
  core: "Core",
  system: "System",
  other: "Other",
};

function highlightText(text: string, searchTerm: string): ReactNode {
  if (!searchTerm) return text;
  const idx = text.toLowerCase().indexOf(searchTerm.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-neon-cyan/20 text-neon-cyan">{text.slice(idx, idx + searchTerm.length)}</span>
      {text.slice(idx + searchTerm.length)}
    </>
  );
}

function LogRow({
  line,
  searchTerm,
}: {
  line: string;
  searchTerm: string;
}) {
  const p = parseLogLine(line);
  const isMatch = !!searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase());
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-[minmax(0,9.5rem)_minmax(0,4.5rem)_1fr] gap-x-3 gap-y-0.5 items-baseline text-xs font-mono py-1.5 border-b border-white/[0.06] ${
        isMatch ? "bg-neon-cyan/5 -mx-2 px-2 rounded" : ""
      }`}
    >
      <span className="text-neon-cyan/45 truncate tabular-nums">{p.timestamp ?? "—"}</span>
      <span className={`uppercase tracking-wide text-[10px] ${levelTextClass(p.level)}`}>
        {p.level}
      </span>
      <span className={`min-w-0 break-words ${levelTextClass(p.level)}`}>
        {highlightText(p.message, searchTerm)}
      </span>
    </div>
  );
}

export default function LogsPage() {
  const [data, setData] = useState<LogData | null>(null);
  const [activeLog, setActiveLog] = useState("agent");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lineCount, setLineCount] = useState(200);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<LogData | null>(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const loadLogs = useCallback(async () => {
    const hasData = dataRef.current !== null;
    setLoadError(null);
    if (hasData) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch(
        `/api/logs?name=${encodeURIComponent(activeLog)}&lines=${lineCount}`,
      );
      const json: { data?: LogData; error?: string } = await res.json();
      if (!res.ok || json.error) {
        setLoadError(json.error ?? `Request failed (${res.status})`);
        if (!hasData) setData(null);
        return;
      }
      if (json.data) {
        setData(json.data);
      }
    } catch {
      setLoadError("Network error while loading logs");
      if (!hasData) setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeLog, lineCount]);

  // Stable ref for polling — avoids recreating the interval when loadLogs deps change
  const loadLogsRef = useRef(loadLogs);
  useEffect(() => { loadLogsRef.current = loadLogs; }, [loadLogs]);

  const handleDeleteAllLogs = useCallback(async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setActionMessage(null);
      return;
    }
    setDeleteConfirm(false);
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch("/api/logs", { method: "DELETE" });
      const json: { data?: { cleared?: number }; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || json.error) {
        setActionMessage(json.error ?? "Delete failed");
        return;
      }
      setActionMessage(
        typeof json.data?.cleared === "number"
          ? `Cleared ${json.data.cleared} log file(s).`
          : "Logs cleared.",
      );
      void loadLogs();
    } catch {
      setActionMessage("Delete failed (network error)");
    } finally {
      setLoading(false);
    }
  }, [deleteConfirm, loadLogs]);

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm(false);
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [activeLog, lineCount, loadLogs]);

  useEffect(() => {
    if (!data?.availableLogs?.length) return;
    const ok = data.availableLogs.some((l) => l.name === activeLog);
    if (!ok) {
      setActiveLog(data.availableLogs[0].name);
    }
  }, [data?.availableLogs, activeLog]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void loadLogsRef.current();
    }, 5000);
    return () => {
      clearInterval(id);
    };
  }, [autoRefresh]);

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
              onClick={() => void loadLogs()}
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
              {deleteConfirm ? "Confirm Clear" : "Delete All"}
            </Button>
            {deleteConfirm && (
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
            ) : data?.error && data.lines.length === 0 ? (
              <div className="flex items-center gap-3 text-sm text-white/40 bg-dark-900/50 border border-white/10 rounded-xl px-4 py-6">
                <AlertCircle className="w-5 h-5 text-white/20 shrink-0" />
                <div>
                  <p className="text-white/60">{data.error}</p>
                  <p className="text-xs text-white/30 mt-1">
                    Log files are created when the Hermes gateway or agent runs.
                  </p>
                </div>
              </div>
            ) : (
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
                    {data && (
                      <span className="text-white/20 ml-2">
                        (showing {data.showingLines}/{data.totalLines})
                      </span>
                    )}
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
                        key={`${i}-${line.slice(0, 48)}`}
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
            )}
          </div>
        </div>
      </div>
    </AppPageShell>
  );
}

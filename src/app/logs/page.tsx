// ═══════════════════════════════════════════════════════════════
// System Logs — Live log viewer for all Hermes log files
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Terminal,
  RefreshCw,
  Search,
  ChevronDown,
  AlertCircle,
  FileText,
  X,
  Play,
  Pause,
  Trash2,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface LogData {
  name: string;
  totalLines: number;
  showingLines: number;
  size: number;
  modified: string;
  lines: string[];
  availableLogs: Array<{ name: string; size: number; modified: string }>;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

const TS_RE = /^(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\s*/;

function lineStyle(line: string): string {
  const body = line.replace(TS_RE, "");
  if (body.includes("ERROR") || body.includes("Error")) return "text-red-400";
  if (body.includes("WARN")) return "text-neon-orange";
  if (body.includes("DEBUG")) return "text-white/30";
  if (body.includes("INFO")) return "text-white/60";
  return "text-white/50";
}

function LogLine({ line, index, isSearchMatch, searchTerm }: {
  line: string;
  index: number;
  isSearchMatch: boolean;
  searchTerm: string;
}) {
  const tsMatch = line.match(TS_RE);
  const timestamp = tsMatch ? tsMatch[1] : null;
  const body = timestamp && tsMatch ? line.slice(tsMatch[0].length) : line;

  const highlight = (text: string) => {
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
  };

  return (
    <div
      className={`flex items-baseline gap-3 ${
        isSearchMatch ? "bg-neon-cyan/5 -mx-4 px-4" : ""
      }`}
    >
      <span className="text-white/15 select-none flex-shrink-0 w-8 text-right text-[11px]">
        -{index}
      </span>
      {timestamp && (
        <span className="text-neon-cyan/40 flex-shrink-0 text-[11px] font-mono whitespace-nowrap">
          {timestamp}
        </span>
      )}
      <span className={lineStyle(line)}>
        {highlight(body)}
      </span>
    </div>
  );
}

export default function LogsPage() {
  const [data, setData] = useState<LogData | null>(null);
  const [activeLog, setActiveLog] = useState("agent");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lineCount, setLineCount] = useState(200);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/logs?name=${activeLog}&lines=${lineCount}`
      );
      const json = await res.json();
      setData(json.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeLog, lineCount]);

  const handleDeleteAllLogs = useCallback(async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setLoading(true);
    setDeleteConfirm(false);
    try {
      const res = await fetch("/api/logs", { method: "DELETE" });
      if (res.ok) {
        void loadLogs();
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [deleteConfirm, loadLogs]);

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm(false);
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(loadLogs, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, loadLogs]);

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      // Newest first — scroll to top
      terminalRef.current.scrollTop = 0;
    }
  }, [data?.lines, autoScroll]);

  const handleScroll = () => {
    if (!terminalRef.current) return;
    const { scrollTop } = terminalRef.current;
    // Newest first — auto-scroll when at top
    setAutoScroll(scrollTop < 50);
  };

  const allLines = data?.lines || [];
  const filteredLines = search
    ? allLines.filter((line) =>
        line.toLowerCase().includes(search.toLowerCase())
      )
    : allLines;

  const searchMatches = search ? filteredLines.length : 0;

  return (
    <div className="pl-64 flex flex-col h-full">
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                autoRefresh
                  ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30"
                  : "bg-dark-900/50 text-white/40 border border-white/10 hover:text-white/60"
              }`}
            >
              {autoRefresh ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {autoRefresh ? "Auto-refresh On" : "Auto-refresh Off"}
            </button>
            <select
              value={lineCount}
              onChange={(e) => setLineCount(parseInt(e.target.value))}
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
              onClick={loadLogs}
              loading={loading}
              icon={RefreshCw}
            >
              Refresh
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteAllLogs}
              icon={Trash2}
            >
              {deleteConfirm ? "Confirm Clear" : "Delete All"}
            </Button>
            {deleteConfirm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelDelete}
              >
                Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="px-6 py-6">
        {/* Log file tabs */}
        {data?.availableLogs && data.availableLogs.length > 0 && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
            {data.availableLogs.map((log) => (
              <button
                key={log.name}
                onClick={() => setActiveLog(log.name)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono whitespace-nowrap transition-colors ${
                  activeLog === log.name
                    ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30"
                    : "text-white/40 hover:text-white/60 hover:bg-white/5 border border-transparent"
                }`}
              >
                <FileText className="w-3 h-3" />
                {log.name}.log
                <span className="text-white/20">
                  {formatBytes(log.size)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Search bar */}
        <div className="flex items-center gap-3 mb-4">
          {searchVisible ? (
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter logs..."
                  autoFocus
                  className="w-full bg-dark-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-neon-cyan/50 transition-colors font-mono"
                />
              </div>
              {search && (
                <span className="text-xs font-mono text-neon-cyan">
                  {searchMatches} matches
                </span>
              )}
              <button
                onClick={() => {
                  setSearch("");
                  setSearchVisible(false);
                }}
                className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchVisible(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/60 hover:bg-white/5 font-mono"
            >
              <Search className="w-3 h-3" />
              Filter logs
            </button>
          )}

          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                if (terminalRef.current) {
                  terminalRef.current.scrollTop = 0;
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-neon-cyan bg-neon-cyan/10 font-mono"
            >
              <ChevronDown className="w-3 h-3 rotate-180" />
              Latest logs
            </button>
          )}
        </div>

        {/* Log content */}
        {loading && !data ? (
          <LoadingSpinner text="Loading logs..." />
        ) : data?.error && data.lines.length === 0 ? (
          <div className="flex items-center gap-3 text-sm text-white/40 bg-dark-900/50 border border-white/10 rounded-xl px-4 py-6">
            <AlertCircle className="w-5 h-5 text-white/20" />
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
            className="rounded-xl border border-white/10 bg-dark-900/50 overflow-hidden"
          >
            {/* Terminal chrome */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-dark-800/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs text-white/40 font-mono ml-2">
                {activeLog}.log
                {data && (
                  <span className="text-white/20 ml-2">
                    (showing {data.showingLines}/{data.totalLines})
                  </span>
                )}
              </span>
            </div>

            {/* Log lines */}
            <div className="p-4 font-mono text-xs space-y-0 max-h-[calc(100vh-320px)] overflow-auto">
              {filteredLines.length > 0 ? (
                filteredLines.map((line, i) => (
                  <LogLine
                    key={`${i}-${line.slice(0, 40)}`}
                    line={line}
                    index={i}
                    isSearchMatch={!!search && line.toLowerCase().includes(search.toLowerCase())}
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
  );
}

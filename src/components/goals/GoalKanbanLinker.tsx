// ═══════════════════════════════════════════════════════════════
// GoalKanbanLinker — Search/link kanban tasks to a goal
// ═══════════════════════════════════════════════════════════════
// Search input + results list + linked tasks display.
// Fetches kanban tasks from /api/orchestration/hermes-kanban/board.

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, Link, Unlink, Kanban, ExternalLink, Loader2 } from "lucide-react";

interface KanbanTaskBasic {
  id: string;
  title: string;
  status: string;
  priority: number;
}

interface GoalKanbanLinkerProps {
  /** Currently linked task IDs (from GoalDetail). */
  linkedTaskIds: string[];
  /** Called when a task is linked. */
  onLink: (taskId: string) => void;
  /** Called when a task is unlinked. */
  onUnlink: (taskId: string) => void;
  /** Optional callback to navigate to a kanban task detail. */
  onNavigateToTask?: (taskId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  triage: "text-neon-purple bg-neon-purple/10",
  todo: "text-neon-orange bg-neon-orange/10",
  ready: "text-neon-cyan bg-neon-cyan/10",
  running: "text-neon-green bg-neon-green/10",
  blocked: "text-neon-red bg-neon-red/10",
  done: "text-neon-green/60 bg-neon-green/10",
  archived: "text-white/30 bg-white/10",
};

function getStatusStyle(status: string): string {
  return STATUS_COLORS[status] || "text-white/50 bg-white/10";
}

export default function GoalKanbanLinker({
  linkedTaskIds,
  onLink,
  onUnlink,
  onNavigateToTask,
}: GoalKanbanLinkerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KanbanTaskBasic[]>([]);
  const [loading, setLoading] = useState(false);
  const [allTasks, setAllTasks] = useState<KanbanTaskBasic[]>([]);
  const [fetched, setFetched] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch all kanban tasks once on mount
  useEffect(() => {
    if (fetched) return;
    setLoading(true);
    fetch("/api/orchestration/hermes-kanban/board")
      .then((r) => r.json())
      .then((json) => {
        const tasks = (json.data?.tasks || json.data || []) as KanbanTaskBasic[];
        setAllTasks(tasks);
        setFetched(true);
      })
      .catch(() => {
        // Fail silently — empty state handles it
        setFetched(true);
      })
      .finally(() => setLoading(false));
  }, [fetched]);

  // Filter results based on query
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const q = query.toLowerCase();
    const filtered = allTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q),
    );
    setResults(filtered.slice(0, 20)); // Limit to 20 results
  }, [query, allTasks]);

  const linkedTasks = allTasks.filter((t) => linkedTaskIds.includes(t.id));

  const handleLink = useCallback(
    (taskId: string) => {
      onLink(taskId);
      setQuery("");
      setResults([]);
      inputRef.current?.focus();
    },
    [onLink],
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Kanban className="w-4 h-4 text-neon-purple" />
          Linked Kanban Tasks
          {linkedTaskIds.length > 0 && (
            <span className="text-xs text-white/40 font-mono">
              {linkedTaskIds.length}
            </span>
          )}
        </h3>
        <button
          onClick={() => {
            setExpanded(!expanded);
            if (!expanded) {
              setTimeout(() => inputRef.current?.focus(), 100);
            }
          }}
          className="text-xs font-mono text-neon-cyan hover:text-neon-cyan/80 transition-colors"
        >
          {expanded ? "Close" : "Link Task"}
        </button>
      </div>

      {/* Linked tasks list */}
      {linkedTasks.length > 0 && (
        <div className="space-y-1 mb-3">
          {linkedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/5 hover:bg-white/[0.07] transition-colors group"
            >
              <span className="text-[10px] font-mono text-white/30 uppercase shrink-0">
                #{task.id.slice(0, 8)}
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${getStatusStyle(task.status)}`}
              >
                {task.status}
              </span>
              <span className="text-xs text-white/70 flex-1 min-w-0 truncate">
                {task.title}
              </span>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {onNavigateToTask && (
                  <button
                    onClick={() => onNavigateToTask(task.id)}
                    className="w-6 h-6 flex items-center justify-center rounded text-white/30 hover:text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
                    title="Open task"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => onUnlink(task.id)}
                  className="w-6 h-6 flex items-center justify-center rounded text-white/30 hover:text-neon-red hover:bg-neon-red/10 transition-colors"
                  title="Unlink task"
                >
                  <Unlink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search section (expandable) */}
      {expanded && (
        <div className="space-y-2">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search kanban tasks by title or ID..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 animate-spin" />
            )}
          </div>

          {/* Results */}
          {query.trim() && results.length === 0 && !loading && (
            <p className="text-xs text-white/30 italic px-1">No matching tasks found.</p>
          )}

          {results.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1 border border-white/5 rounded-lg p-1">
              {results
                .filter((t) => !linkedTaskIds.includes(t.id))
                .map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleLink(task.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.06] transition-colors text-left group"
                  >
                    <Link className="w-3 h-3 text-neon-cyan/60 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-[10px] font-mono text-white/30 uppercase shrink-0">
                      #{task.id.slice(0, 8)}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${getStatusStyle(task.status)}`}
                    >
                      {task.status}
                    </span>
                    <span className="text-xs text-white/70 flex-1 min-w-0 truncate">
                      {task.title}
                    </span>
                    <span className="text-[10px] font-mono text-white/30 shrink-0">
                      P{task.priority}
                    </span>
                  </button>
                ))}
            </div>
          )}

          {linkedTasks.length === 0 && query.trim() === "" && (
            <p className="text-xs text-white/30 italic px-1">
              Type to search for kanban tasks to link.
            </p>
          )}
        </div>
      )}

      {/* Empty state when collapsed and no links */}
      {!expanded && linkedTasks.length === 0 && (
        <p className="text-xs text-white/30 italic px-1">No linked tasks. Click &ldquo;Link Task&rdquo; to connect kanban tasks.</p>
      )}
    </div>
  );
}

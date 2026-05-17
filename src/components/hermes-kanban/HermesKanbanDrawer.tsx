// ═══════════════════════════════════════════════════════════════
// Kanban Drawer — Full task detail sliding panel
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Send,
  ArrowRight,
  Ban,
  Archive,
  Play,
  Link2,
  MessageSquare,
  Clock,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { timeAgo } from "@/lib/utils";

interface Comment {
  id: number;
  author: string;
  body: string;
  created_at: number;
}

interface Run {
  id: number;
  profile: string | null;
  outcome: string | null;
  summary: string | null;
  started_at: number;
  ended_at: number | null;
  error: string | null;
}

interface Event {
  id: number;
  kind: string;
  payload: string | null;
  created_at: number;
}

interface KanbanTaskDetail {
  id: string;
  title: string;
  body: string | null;
  assignee: string | null;
  status: string;
  priority: number;
  tenant: string | null;
  created_at: number;
  updated_at: number;
  result: string | null;
  max_runtime_seconds: number | null;
  skills: string | null;
  comments: Comment[];
  parents: string[];
  children: string[];
  runs: Run[];
  events: Event[];
}

interface HermesKanbanDrawerProps {
  task: KanbanTaskDetail | null;
  onClose: () => void;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
}

const priorityColors: Record<number, string> = {
  1: "text-white/40",
  2: "text-white/40",
  3: "text-neon-cyan",
  4: "text-neon-orange",
  5: "text-neon-red",
};

export default function HermesKanbanDrawer({
  task,
  onClose,
  onUpdate,
}: HermesKanbanDrawerProps) {
  const [commentText, setCommentText] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [bodyExpanded, setBodyExpanded] = useState(false);

  // Load assignees for the dropdown
  useEffect(() => {
    if (!task) return;
    fetch("/api/orchestration/hermes-kanban/assignees")
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          setAssignees(res.data.map((a: { profile: string }) => a.profile));
        }
      })
      .catch(() => {});
  }, [task]);

  const handleStatusAction = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      if (!task) return;
      const body = { action, taskId: task.id, ...extra };
      try {
        const res = await fetch("/api/orchestration/hermes-kanban", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          onUpdate(task.id, {});
        }
      } catch {
        // silently fail — the parent will re-fetch
      }
    },
    [task, onUpdate]
  );

  const handleAddComment = useCallback(async () => {
    if (!task || !commentText.trim()) return;
    await handleStatusAction("comment", { text: commentText.trim() });
    setCommentText("");
  }, [task, commentText, handleStatusAction]);

  const handleLinkTask = useCallback(async () => {
    if (!task || !linkInput.trim()) return;
    await handleStatusAction("link", {
      parentId: task.id,
      childId: linkInput.trim(),
    });
    setLinkInput("");
    setShowLinkInput(false);
  }, [task, linkInput, handleStatusAction]);

  const handleAssigneeChange = useCallback(
    async (newAssignee: string) => {
      if (!task) return;
      await handleStatusAction("assign", { assignee: newAssignee });
    },
    [task, handleStatusAction]
  );

  if (!task) return null;

  const shortId = task.id.slice(0, 8);
  const isBlocked = task.status === "blocked";
  const isDone = task.status === "done";
  const isArchived = task.status === "archived";
  const isActive = !isDone && !isArchived;
  const canTransition =
    task.status === "triage" ||
    task.status === "todo" ||
    task.status === "blocked";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-[500px] max-w-full h-full bg-gray-950 border-l border-white/10 shadow-2xl overflow-y-auto">
        {/* Close button */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-gray-950/90 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
              #{shortId}
            </span>
            <span
              className={`text-xs font-mono font-bold ${priorityColors[task.priority] || "text-white/40"}`}
            >
              P{task.priority}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Title */}
          <input
            type="text"
            defaultValue={task.title}
            onBlur={(e) => {
              if (e.target.value !== task.title) {
                // Save title through create action (no dedicated rename)
              }
            }}
            className="w-full bg-transparent text-lg font-semibold text-white outline-none border-b border-transparent focus:border-white/20 transition-colors pb-1"
          />

          {/* Status + Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-white/40 uppercase tracking-wider mr-1">
              Status:
            </span>
            <span className="text-xs font-mono font-semibold text-white bg-white/10 px-2 py-0.5 rounded">
              {task.status}
            </span>

            {isActive && canTransition && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  handleStatusAction(
                    task.status === "blocked" ? "unblock" : "complete"
                  )
                }
              >
                {isBlocked ? "Unblock" : "Complete"}
              </Button>
            )}

            {isActive && task.status !== "blocked" && task.status !== "running" && (
              <Button
                variant="ghost"
                size="sm"
                icon={Ban}
                onClick={() =>
                  handleStatusAction("block", {
                    reason: "Blocked from drawer",
                  })
                }
              >
                Block
              </Button>
            )}

            {isActive && task.status === "blocked" && (
              <Button
                variant="ghost"
                size="sm"
                icon={Play}
                onClick={() => handleStatusAction("unblock")}
              >
                Unblock
              </Button>
            )}

            {isActive && (
              <Button
                variant="ghost"
                size="sm"
                icon={Archive}
                onClick={() => handleStatusAction("archive")}
              >
                Archive
              </Button>
            )}

            {task.status === "triage" && (
              <Button
                variant="ghost"
                size="sm"
                icon={ArrowRight}
                onClick={() =>
                  handleStatusAction("create", {
                    action: "create",
                    title: task.title,
                    body: task.body,
                    assignee: task.assignee,
                    priority: task.priority,
                  })
                }
              >
                → Todo
              </Button>
            )}
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
              Assignee
            </label>
            <select
              value={task.assignee || ""}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-neon-purple/50 transition-colors font-mono cursor-pointer appearance-none"
            >
              <option value="">Unassigned</option>
              {assignees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Tenant */}
          {task.tenant && (
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1">
                Tenant
              </label>
              <span className="text-sm text-white/60 font-mono">
                {task.tenant}
              </span>
            </div>
          )}

          {/* Body */}
          {task.body && (
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
                Description
              </label>
              <div
                className={`text-sm text-white/70 leading-relaxed whitespace-pre-wrap font-mono ${
                  bodyExpanded ? "" : "line-clamp-6"
                }`}
              >
                {task.body}
              </div>
              {task.body.length > 300 && (
                <button
                  onClick={() => setBodyExpanded(!bodyExpanded)}
                  className="text-xs text-neon-cyan/60 hover:text-neon-cyan mt-1 font-mono"
                >
                  {bodyExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}

          {/* Result */}
          {task.result && (
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
                Result
              </label>
              <div className="text-sm text-neon-green/80 leading-relaxed whitespace-pre-wrap font-mono bg-white/5 rounded-lg p-3 border border-white/10">
                {task.result}
              </div>
            </div>
          )}

          {/* Dependencies */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono text-white/40 uppercase tracking-wider">
                Dependencies
              </label>
              <button
                onClick={() => setShowLinkInput(!showLinkInput)}
                className="text-xs text-neon-cyan/60 hover:text-neon-cyan font-mono flex items-center gap-1"
              >
                <Link2 className="w-3 h-3" />
                {showLinkInput ? "Cancel" : "Link"}
              </button>
            </div>

            {showLinkInput && (
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="Task ID to link..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono"
                />
                <button
                  onClick={handleLinkTask}
                  disabled={!linkInput.trim()}
                  className="px-3 py-1.5 bg-neon-cyan/20 border border-neon-cyan/30 rounded-lg text-xs text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-mono"
                >
                  Add
                </button>
              </div>
            )}

            {task.parents.length > 0 && (
              <div className="mb-2">
                <span className="text-xs text-white/40 font-mono">Parents: </span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {task.parents.map((pid) => (
                    <span
                      key={pid}
                      className="text-xs font-mono text-white/60 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded"
                    >
                      #{pid.slice(0, 8)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {task.children.length > 0 && (
              <div>
                <span className="text-xs text-white/40 font-mono">Children: </span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {task.children.map((cid) => (
                    <span
                      key={cid}
                      className="text-xs font-mono text-white/60 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded"
                    >
                      #{cid.slice(0, 8)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {task.parents.length === 0 && task.children.length === 0 && (
              <p className="text-xs text-white/20 italic">No dependencies</p>
            )}
          </div>

          {/* Skills */}
          {task.skills && (
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1">
                Skills
              </label>
              <span className="text-sm text-white/60 font-mono">
                {task.skills}
              </span>
            </div>
          )}

          {/* Max Runtime */}
          {task.max_runtime_seconds && (
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1">
                Max Runtime
              </label>
              <span className="text-sm text-white/60 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {task.max_runtime_seconds}s
              </span>
            </div>
          )}

          {/* Comments */}
          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" />
              Comments ({task.comments.length})
            </label>

            <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
              {task.comments.length === 0 && (
                <p className="text-xs text-white/20 italic">No comments yet</p>
              )}
              {task.comments.map((c) => (
                <div
                  key={c.id}
                  className="bg-white/5 border border-white/10 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-neon-cyan/80 font-semibold">
                      {c.author}
                    </span>
                    <span className="text-[10px] text-white/30 font-mono">
                      {timeAgo(new Date(c.created_at * 1000).toISOString())}
                    </span>
                  </div>
                  <p className="text-sm text-white/70 whitespace-pre-wrap">
                    {c.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                placeholder="Add a comment..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono"
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-neon-purple/20 border border-neon-purple/30 text-neon-purple hover:bg-neon-purple/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Run History */}
          {task.runs.length > 0 && (
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Play className="w-3 h-3" />
                Runs ({task.runs.length})
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {task.runs.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-white/40">
                        #{r.id}
                        {r.profile ? ` — ${r.profile}` : ""}
                      </span>
                      <span
                        className={`text-[10px] font-mono ${
                          r.outcome === "success"
                            ? "text-neon-green"
                            : r.outcome === "error" || r.error
                              ? "text-neon-red"
                              : "text-neon-orange"
                        }`}
                      >
                        {r.outcome || "running"}
                      </span>
                    </div>
                    {r.summary && (
                      <p className="text-xs text-white/50 leading-relaxed line-clamp-2">
                        {r.summary}
                      </p>
                    )}
                    {r.error && (
                      <p className="text-xs text-neon-red/70 leading-relaxed mt-1 font-mono">
                        {r.error}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-white/30 font-mono">
                        {timeAgo(new Date(r.started_at * 1000).toISOString())}
                      </span>
                      {r.ended_at && (
                        <span className="text-[10px] text-white/30 font-mono">
                          ·{" "}
                          {Math.round(
                            (r.ended_at - r.started_at) / 1000
                          )}
                          s
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Event History */}
          {task.events.length > 0 && (
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-2">
                Events ({task.events.length})
              </label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {task.events.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between bg-white/5 rounded px-2 py-1"
                  >
                    <span className="text-xs text-white/50 font-mono">
                      {e.kind}
                    </span>
                    <span className="text-[10px] text-white/30 font-mono">
                      {timeAgo(new Date(e.created_at * 1000).toISOString())}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex items-center justify-between text-[10px] text-white/20 font-mono pt-2 border-t border-white/10">
            <span>
              Created: {timeAgo(new Date(task.created_at * 1000).toISOString())}
            </span>
            <span>
              Updated: {timeAgo(new Date(task.updated_at * 1000).toISOString())}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

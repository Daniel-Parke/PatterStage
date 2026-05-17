// ═══════════════════════════════════════════════════════════════
// Kanban Drawer — Full task detail sliding panel
// ═══════════════════════════════════════════════════════════════
// Title editing, block reason input, reclaim/reassign for running
// tasks, workspace info, metadata viewer, specify for triage,
// dependency unlink, claim info, spawn failures, edit completed.

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, Send, Ban, Archive, Play, Link2, MessageSquare,
  Clock, AlertTriangle, Sparkles, RefreshCw, UserCheck, GitBranch,
  Save,
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
  metadata: string | null;
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
  summary: string | null;
  max_runtime_seconds: number | null;
  skills: string | null;
  created_by: string | null;
  spawn_failures: number;
  consecutive_failures: number;
  max_retries: number | null;
  claim_expires_at: number | null;
  workspace_kind: string | null;
  workspace_path: string | null;
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
  1: "text-white/40", 2: "text-white/40", 3: "text-neon-cyan",
  4: "text-neon-orange", 5: "text-neon-red",
};

const workspaceLabels: Record<string, string> = {
  scratch: "Temporary",
  dir: "Directory",
  worktree: "Git Worktree",
};

interface AssigneeOption {
  profile: string;
  task_count: number;
}

export default function HermesKanbanDrawer({
  task,
  onClose,
  onUpdate,
}: HermesKanbanDrawerProps) {
  // State
  const [commentText, setCommentText] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [bodyExpanded, setBodyExpanded] = useState(false);

  // Edit title state
  const [editTitle, setEditTitle] = useState(false);
  const [titleBuffer, setTitleBuffer] = useState("");

  // Block reason
  const [showBlockReason, setShowBlockReason] = useState(false);
  const [blockReason, setBlockReason] = useState("");

  // Reassign
  const [showReassign, setShowReassign] = useState(false);
  const [reassignProfile, setReassignProfile] = useState("");

  // Specify loading
  const [specifying, setSpecifying] = useState(false);

  // Metadata viewer
  const [expandedRunMeta, setExpandedRunMeta] = useState<number | null>(null);

  // Fetch assignees on mount
  useEffect(() => {
    if (!task) return;
    fetch("/api/orchestration/hermes-kanban/assignees")
      .then((r) => r.json())
      .then((res) => {
        if (res.data) setAssigneeOptions(res.data);
      })
      .catch(() => {});
  }, [task]);

  // ── API helpers ─────────────────────────────────────────────

  const apiCall = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      if (!task) return;
      try {
        const res = await fetch("/api/orchestration/hermes-kanban", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, taskId: task.id, ...extra }),
        });
        if (res.ok) onUpdate(task.id, {});
      } catch {
        // parent re-fetches
      }
    },
    [task, onUpdate],
  );

  // ── Handlers ────────────────────────────────────────────────

  const handleAddComment = useCallback(async () => {
    if (!task || !commentText.trim()) return;
    await apiCall("comment", { text: commentText.trim() });
    setCommentText("");
  }, [task, commentText, apiCall]);

  const handleLinkTask = useCallback(async () => {
    if (!task || !linkInput.trim()) return;
    await apiCall("link", { parentId: task.id, childId: linkInput.trim() });
    setLinkInput("");
    setShowLinkInput(false);
  }, [task, linkInput, apiCall]);

  const handleUnlink = useCallback(
    async (parentId: string, childId: string) => {
      // POST to the unlink endpoint
      if (!task) return;
      try {
        const res = await fetch(
          `/api/orchestration/hermes-kanban/${task.id}/unlink`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parentId, childId }),
          },
        );
        if (res.ok) onUpdate(task.id, {});
      } catch {
        // fail silently
      }
    },
    [task, onUpdate],
  );

  const handleUnlinkParent = useCallback(
    (parentId: string) => {
      if (!task) return;
      handleUnlink(parentId, task.id);
    },
    [task, handleUnlink],
  );

  const handleUnlinkChild = useCallback(
    (childId: string) => {
      if (!task) return;
      handleUnlink(task.id, childId);
    },
    [task, handleUnlink],
  );

  const handleSaveTitle = useCallback(async () => {
    if (!task || !titleBuffer.trim() || titleBuffer === task.title) {
      setEditTitle(false);
      return;
    }
    // Patch the task via edit
    try {
      const res = await fetch(`/api/orchestration/hermes-kanban/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          result: task.result,
          summary: task.summary,
        }),
      });
      if (res.ok) onUpdate(task.id, {});
    } catch {
      // silently fail
    }
    setEditTitle(false);
  }, [task, titleBuffer, onUpdate]);

  const handleBlock = useCallback(async () => {
    if (!task) return;
    const reason = blockReason.trim() || "Blocked from UI";
    await apiCall("block", { reason });
    setShowBlockReason(false);
    setBlockReason("");
  }, [task, blockReason, apiCall]);

  const handleReassign = useCallback(async () => {
    if (!task || !reassignProfile.trim()) return;
    try {
      const res = await fetch(
        `/api/orchestration/hermes-kanban/${task.id}/reassign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newAssignee: reassignProfile, reclaim: true }),
        },
      );
      if (res.ok) onUpdate(task.id, {});
    } catch {
      // fail silently
    }
    setShowReassign(false);
    setReassignProfile("");
  }, [task, reassignProfile, onUpdate]);

  const handleReclaim = useCallback(async () => {
    if (!task) return;
    try {
      const res = await fetch(
        `/api/orchestration/hermes-kanban/${task.id}/reclaim`,
        { method: "POST" },
      );
      if (res.ok) onUpdate(task.id, {});
    } catch {
      // fail silently
    }
  }, [task, onUpdate]);

  const handleSpecify = useCallback(async () => {
    if (!task || specifying) return;
    setSpecifying(true);
    try {
      const res = await fetch(
        `/api/orchestration/hermes-kanban/${task.id}/specify`,
        { method: "POST" },
      );
      if (res.ok) {
        // Re-fetch task detail after specify completes
        setTimeout(() => onUpdate(task.id, {}), 2000);
      }
    } catch {
      // fail silently
    }
    setSpecifying(false);
  }, [task, specifying, onUpdate]);

  if (!task) return null;

  const shortId = task.id.slice(0, 8);
  const isBlocked = task.status === "blocked";
  const isDone = task.status === "done";
  const isArchived = task.status === "archived";
  const isRunning = task.status === "running";
  const isTriage = task.status === "triage";
  const isActive = !isDone && !isArchived;
  const hasFailures = task.spawn_failures > 0 || task.consecutive_failures > 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-[540px] max-w-full h-full bg-gray-950 border-l border-white/10 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-gray-950/90 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
              #{shortId}
            </span>
            <span className={`text-xs font-mono font-bold ${priorityColors[task.priority] || "text-white/40"}`}>
              P{task.priority}
            </span>
            {/* Spawn failures badge */}
            {hasFailures && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-neon-orange bg-neon-orange/10 px-1.5 py-0.5 rounded">
                <AlertTriangle className="w-2.5 h-2.5" />
                {task.spawn_failures} failures
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isTriage && (
              <button
                onClick={handleSpecify}
                disabled={specifying}
                className="flex items-center gap-1 text-[10px] font-mono text-neon-purple bg-neon-purple/10 px-2 py-1 rounded hover:bg-neon-purple/20 disabled:opacity-50 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                {specifying ? "Specifying..." : "Specify"}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Title (editable) */}
          {editTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={titleBuffer}
                onChange={(e) => setTitleBuffer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveTitle();
                  }
                  if (e.key === "Escape") {
                    setEditTitle(false);
                  }
                }}
                className="flex-1 bg-white/5 border border-neon-purple/50 rounded-lg px-3 py-2 text-lg font-semibold text-white outline-none font-mono"
                autoFocus
              />
              <button
                onClick={handleSaveTitle}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-neon-green/20 text-neon-green hover:bg-neon-green/30 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setEditTitle(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white/40 hover:bg-white/20 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div
              className="text-lg font-semibold text-white cursor-pointer hover:text-neon-cyan transition-colors group"
              onClick={() => {
                setTitleBuffer(task.title);
                setEditTitle(true);
              }}
              title="Click to edit title"
            >
              {task.title}
              <span className="ml-2 text-xs text-white/20 opacity-0 group-hover:opacity-100 transition-opacity">
                (click to edit)
              </span>
            </div>
          )}

          {/* Status + Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-white/40 uppercase tracking-wider mr-1">Status:</span>
            <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded
              ${isRunning ? "text-neon-green bg-neon-green/10" : ""}
              ${isBlocked ? "text-neon-red bg-neon-red/10" : ""}
              ${isDone ? "text-neon-green/60 bg-neon-green/10" : ""}
              ${isTriage ? "text-neon-purple bg-neon-purple/10" : ""}
              ${!isRunning && !isBlocked && !isDone && !isTriage ? "text-white bg-white/10" : ""}
            `}>
              {task.status}
            </span>

            {isActive && (task.status === "todo" || task.status === "ready") && (
              <Button variant="ghost" size="sm" onClick={() => apiCall("complete")}>
                Complete
              </Button>
            )}

            {isActive && !isRunning && !isBlocked && (
              <>
                {!showBlockReason ? (
                  <Button variant="ghost" size="sm" icon={Ban} onClick={() => setShowBlockReason(true)}>
                    Block
                  </Button>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Reason..."
                      className="bg-white/5 border border-neon-red/30 rounded px-2 py-1 text-xs text-white placeholder-white/30 outline-none font-mono w-40"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleBlock(); }
                        if (e.key === "Escape") { setShowBlockReason(false); setBlockReason(""); }
                      }}
                    />
                    <button onClick={handleBlock} className="w-6 h-6 flex items-center justify-center rounded bg-neon-red/20 text-neon-red hover:bg-neon-red/30 transition-colors">
                      <Send className="w-3 h-3" />
                    </button>
                    <button onClick={() => { setShowBlockReason(false); setBlockReason(""); }} className="w-6 h-6 flex items-center justify-center rounded bg-white/10 text-white/40 hover:bg-white/20 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </>
            )}

            {isBlocked && (
              <Button variant="ghost" size="sm" icon={Play} onClick={() => apiCall("unblock")}>
                Unblock
              </Button>
            )}

            {isRunning && (
              <>
                <Button variant="ghost" size="sm" icon={RefreshCw} onClick={handleReclaim}>
                  Reclaim
                </Button>
                <Button variant="ghost" size="sm" icon={UserCheck} onClick={() => setShowReassign(true)}>
                  Reassign
                </Button>
              </>
            )}

            {isActive && (
              <Button variant="ghost" size="sm" icon={Archive} onClick={() => apiCall("archive")}>
                Archive
              </Button>
            )}
          </div>

          {/* Reassign input */}
          {showReassign && (
            <div className="flex items-center gap-2">
              <select
                value={reassignProfile}
                onChange={(e) => setReassignProfile(e.target.value)}
                className="flex-1 bg-white/5 border border-neon-cyan/30 rounded-lg px-3 py-1.5 text-sm text-white outline-none font-mono"
              >
                <option value="">Select profile...</option>
                {assigneeOptions.map((a) => (
                  <option key={a.profile} value={a.profile}>
                    {a.profile} ({a.task_count} tasks)
                  </option>
                ))}
              </select>
              <button onClick={handleReassign} disabled={!reassignProfile.trim()} className="px-3 py-1.5 bg-neon-cyan/20 border border-neon-cyan/30 rounded-lg text-xs text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-30 transition-colors font-mono">
                Reassign
              </button>
              <button onClick={() => { setShowReassign(false); setReassignProfile(""); }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white/40 hover:bg-white/20 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Assignee */}
          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">Assignee</label>
            <select
              value={task.assignee || ""}
              onChange={(e) => apiCall("assign", { assignee: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white outline-none focus:border-neon-purple/50 transition-colors font-mono cursor-pointer appearance-none"
            >
              <option value="">Unassigned</option>
              {assigneeOptions.map((a) => (
                <option key={a.profile} value={a.profile}>
                  {a.profile} ({a.task_count} tasks)
                </option>
              ))}
            </select>
          </div>

          {/* Created by + Tenant */}
          {(task.created_by || task.tenant) && (
            <div className="flex items-center gap-4">
              {task.created_by && (
                <div>
                  <label className="block text-[10px] font-mono text-white/40 uppercase tracking-wider mb-0.5">Created by</label>
                  <span className="text-sm text-white/60 font-mono">{task.created_by}</span>
                </div>
              )}
              {task.tenant && (
                <div>
                  <label className="block text-[10px] font-mono text-white/40 uppercase tracking-wider mb-0.5">Tenant</label>
                  <span className="text-sm text-white/60 font-mono">{task.tenant}</span>
                </div>
              )}
            </div>
          )}

          {/* Body */}
          {task.body && (
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">Description</label>
              <div className={`text-sm text-white/70 leading-relaxed whitespace-pre-wrap font-mono ${bodyExpanded ? "" : "line-clamp-6"}`}>
                {task.body}
              </div>
              {task.body.length > 300 && (
                <button onClick={() => setBodyExpanded(!bodyExpanded)} className="text-xs text-neon-cyan/60 hover:text-neon-cyan mt-1 font-mono">
                  {bodyExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}

          {/* Result */}
          {task.result && (
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">Result</label>
              <div className="text-sm text-neon-green/80 leading-relaxed whitespace-pre-wrap font-mono bg-white/5 rounded-lg p-3 border border-white/10">
                {task.result}
              </div>
            </div>
          )}

          {/* Summary */}
          {task.summary && !task.result && (
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">Summary</label>
              <div className="text-sm text-white/70 leading-relaxed font-mono bg-white/5 rounded-lg p-3 border border-white/10">
                {task.summary}
              </div>
            </div>
          )}

          {/* Workspace info */}
          {task.workspace_kind && (
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">Workspace</label>
              <div className="flex items-center gap-2 text-sm text-white/60 font-mono">
                <GitBranch className="w-3.5 h-3.5 text-white/30" />
                <span>{workspaceLabels[task.workspace_kind] || task.workspace_kind}</span>
                {task.workspace_path && (
                  <span className="text-xs text-white/40 truncate">({task.workspace_path})</span>
                )}
              </div>
            </div>
          )}

          {/* Claim info for running tasks */}
          {isRunning && task.claim_expires_at && (
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1">
                <Clock className="w-3 h-3 inline mr-1" />
                Claim expires
              </label>
              <span className="text-sm text-neon-orange font-mono">
                {timeAgo(new Date(task.claim_expires_at * 1000).toISOString())}
              </span>
            </div>
          )}

          {/* Runtime + Retries */}
          <div className="flex items-center gap-4">
            {task.max_runtime_seconds && (
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-wider mb-0.5">Max Runtime</label>
                <span className="text-sm text-white/60 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" />{task.max_runtime_seconds}s
                </span>
              </div>
            )}
            {task.max_retries !== null && task.max_retries !== undefined && (
              <div>
                <label className="block text-[10px] font-mono text-white/40 uppercase tracking-wider mb-0.5">Max Retries</label>
                <span className="text-sm text-white/60 font-mono">{task.max_retries}</span>
              </div>
            )}
          </div>

          {/* Skills */}
          {task.skills && (
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1">Skills</label>
              <div className="flex flex-wrap gap-1">
                {task.skills.split(",").map((s) => (
                  <span key={s.trim()} className="text-[10px] font-mono text-white/60 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                    {s.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono text-white/40 uppercase tracking-wider">Dependencies</label>
              <button onClick={() => setShowLinkInput(!showLinkInput)} className="text-xs text-neon-cyan/60 hover:text-neon-cyan font-mono flex items-center gap-1">
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
                <button onClick={handleLinkTask} disabled={!linkInput.trim()} className="px-3 py-1.5 bg-neon-cyan/20 border border-neon-cyan/30 rounded-lg text-xs text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-mono">
                  Add
                </button>
              </div>
            )}

            {task.parents.length > 0 && (
              <div className="mb-2">
                <span className="text-xs text-white/40 font-mono">Parents: </span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {task.parents.map((pid) => (
                    <span key={pid} className="inline-flex items-center gap-1 text-xs font-mono text-white/60 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                      #{pid.slice(0, 8)}
                      <button onClick={() => handleUnlinkParent(pid)} className="text-white/20 hover:text-neon-red transition-colors" title="Unlink">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {task.children.length > 0 && (
              <div className="mb-2">
                <span className="text-xs text-white/40 font-mono">Children: </span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {task.children.map((cid) => (
                    <span key={cid} className="inline-flex items-center gap-1 text-xs font-mono text-white/60 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                      #{cid.slice(0, 8)}
                      <button onClick={() => handleUnlinkChild(cid)} className="text-white/20 hover:text-neon-red transition-colors" title="Unlink">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {task.parents.length === 0 && task.children.length === 0 && (
              <p className="text-xs text-white/20 italic">No dependencies</p>
            )}
          </div>

          {/* Comments */}
          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" />
              Comments ({task.comments.length})
            </label>

            <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
              {task.comments.length === 0 && (
                <p className="text-xs text-white/20 italic">No comments yet</p>
              )}
              {task.comments.map((c) => (
                <div key={c.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-neon-cyan/80 font-semibold">{c.author}</span>
                    <span className="text-[10px] text-white/30 font-mono">{timeAgo(new Date(c.created_at * 1000).toISOString())}</span>
                  </div>
                  <p className="text-sm text-white/70 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); }
                }}
                placeholder="Add a comment..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono"
              />
              <button onClick={handleAddComment} disabled={!commentText.trim()} className="w-8 h-8 flex items-center justify-center rounded-lg bg-neon-purple/20 border border-neon-purple/30 text-neon-purple hover:bg-neon-purple/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
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
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {task.runs.map((r) => (
                  <div key={r.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-white/40">
                        #{r.id}{r.profile ? ` — ${r.profile}` : ""}
                      </span>
                      <span className={`text-[10px] font-mono ${
                        r.outcome === "success" ? "text-neon-green" :
                        r.outcome === "error" || r.error ? "text-neon-red" :
                        r.outcome === "blocked" ? "text-neon-orange" :
                        r.outcome === "timed_out" ? "text-neon-orange" :
                        "text-neon-orange"
                      }`}>
                        {r.outcome || "running"}
                      </span>
                    </div>
                    {r.summary && (
                      <p className="text-xs text-white/50 leading-relaxed line-clamp-2">{r.summary}</p>
                    )}
                    {r.error && (
                      <p className="text-xs text-neon-red/70 leading-relaxed mt-1 font-mono line-clamp-2">{r.error}</p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/30 font-mono">
                          {timeAgo(new Date(r.started_at * 1000).toISOString())}
                        </span>
                        {r.ended_at && (
                          <span className="text-[10px] text-white/30 font-mono">
                            · {Math.round((r.ended_at - r.started_at) / 1000)}s
                          </span>
                        )}
                      </div>
                      {/* Metadata viewer */}
                      {r.metadata && (
                        <button
                          onClick={() => setExpandedRunMeta(expandedRunMeta === r.id ? null : r.id)}
                          className="text-[10px] font-mono text-neon-cyan/60 hover:text-neon-cyan transition-colors"
                        >
                          {expandedRunMeta === r.id ? "Hide meta" : "Show meta"}
                        </button>
                      )}
                    </div>
                    {/* Metadata JSON viewer */}
                    {r.metadata && expandedRunMeta === r.id && (
                      <div className="mt-2 bg-gray-900 rounded-lg p-2 border border-white/5 max-h-32 overflow-y-auto">
                        <pre className="text-[10px] text-white/50 font-mono whitespace-pre-wrap">
                          {JSON.stringify(tryParseJson(r.metadata), null, 2)}
                        </pre>
                      </div>
                    )}
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
                  <div key={e.id} className="flex items-center justify-between bg-white/5 rounded px-2 py-1">
                    <span className="text-xs text-white/50 font-mono">{e.kind}</span>
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
            <span>Created: {timeAgo(new Date(task.created_at * 1000).toISOString())}</span>
            <span>Updated: {timeAgo(new Date(task.updated_at * 1000).toISOString())}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

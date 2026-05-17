// ═══════════════════════════════════════════════════════════════
// Kanban Create Modal — Create a new task with full options
// ═══════════════════════════════════════════════════════════════
// Supports: title, description, assignee, priority, tenant, triage,
// workspace type, parent task ID, skills, max runtime, created-by.

"use client";

import { useState, useEffect } from "react";
import { X, Plus, Minus } from "lucide-react";
import Button from "@/components/ui/Button";

interface HermesKanbanCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignees: string[];
  onCreate: (data: Record<string, unknown>) => void;
  defaultStatus?: string;
}

export default function HermesKanbanCreateModal({
  isOpen,
  onClose,
  assignees,
  onCreate,
  defaultStatus,
}: HermesKanbanCreateModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState(3);
  const [tenant, setTenant] = useState("");
  const [triage, setTriage] = useState(defaultStatus === "triage" || false);
  const [workspace, setWorkspace] = useState("scratch");
  const [workspacePath, setWorkspacePath] = useState("");
  const [maxRuntime, setMaxRuntime] = useState("");
  const [parentTaskId, setParentTaskId] = useState("");
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setAssignee("");
      setPriority(3);
      setTenant("");
      setTriage(defaultStatus === "triage" || false);
      setWorkspace("scratch");
      setWorkspacePath("");
      setMaxRuntime("");
      setParentTaskId("");
      setSkillTags([]);
      setSkillInput("");
    }
  }, [isOpen, defaultStatus]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const data: Record<string, unknown> = {
      title: title.trim(),
      body: description.trim() || undefined,
      assignee: assignee || undefined,
      priority,
      tenant: tenant.trim() || undefined,
      triage: triage || undefined,
      status: defaultStatus || (triage ? "triage" : undefined),
    };

    // Workspace handling
    if (workspace === "scratch") {
      data.workspace = "scratch";
    } else if (workspace === "dir" && workspacePath.trim()) {
      data.workspace = `dir:${workspacePath.trim()}`;
    } else if (workspace === "worktree" && workspacePath.trim()) {
      data.workspace = `worktree:${workspacePath.trim()}`;
    }

    if (maxRuntime.trim()) {
      data.maxRuntime = parseInt(maxRuntime, 10);
    }
    if (parentTaskId.trim()) {
      data.parent = parentTaskId.trim();
    }
    if (skillTags.length > 0) {
      data.skills = skillTags;
    }

    onCreate(data);
  };

  const addSkill = () => {
    const trimmed = skillInput.trim().toLowerCase();
    if (trimmed && !skillTags.includes(trimmed)) {
      setSkillTags([...skillTags, trimmed]);
    }
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    setSkillTags(skillTags.filter((s) => s !== skill));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-950 border border-white/10 rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-gray-950 z-10">
          <h2 className="text-lg font-semibold text-white">Create Task</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
              Title <span className="text-neon-red">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono"
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional task description..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono resize-none"
            />
          </div>

          {/* Assignee + Priority row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
                Assignee
              </label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-neon-purple/50 transition-colors font-mono cursor-pointer appearance-none"
              >
                <option value="">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-neon-purple/50 transition-colors font-mono cursor-pointer appearance-none"
              >
                <option value={1}>P1 — Lowest</option>
                <option value={2}>P2 — Low</option>
                <option value={3}>P3 — Medium</option>
                <option value={4}>P4 — High</option>
                <option value={5}>P5 — Critical</option>
              </select>
            </div>
          </div>

          {/* Parent task ID */}
          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
              Parent Task ID <span className="text-white/20">(dependency)</span>
            </label>
            <input
              type="text"
              value={parentTaskId}
              onChange={(e) => setParentTaskId(e.target.value)}
              placeholder="e.g. t_abc123..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono"
            />
          </div>

          {/* Triage toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={triage}
                onChange={(e) => setTriage(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-neon-purple focus:ring-neon-purple/50"
              />
              <span className="text-xs font-mono text-white/60 uppercase tracking-wider">
                Create as triage
              </span>
            </label>
          </div>

          {/* Workspace */}
          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
              Workspace
            </label>
            <select
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-neon-purple/50 transition-colors font-mono cursor-pointer appearance-none mb-2"
            >
              <option value="scratch">Scratch (temporary)</option>
              <option value="dir">Directory (persistent)</option>
              <option value="worktree">Git Worktree</option>
            </select>
            {workspace !== "scratch" && (
              <input
                type="text"
                value={workspacePath}
                onChange={(e) => setWorkspacePath(e.target.value)}
                placeholder={workspace === "dir" ? "Absolute directory path..." : "Branch name for worktree..."}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono"
              />
            )}
          </div>

          {/* Max Runtime + Tenant row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
                Max Runtime (s)
              </label>
              <input
                type="number"
                value={maxRuntime}
                onChange={(e) => setMaxRuntime(e.target.value)}
                placeholder="e.g. 300"
                min={1}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
                Tenant
              </label>
              <input
                type="text"
                value={tenant}
                onChange={(e) => setTenant(e.target.value)}
                placeholder="Optional tenant..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono"
              />
            </div>
          </div>

          {/* Skills */}
          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
              Skills <span className="text-white/20">(force-load)</span>
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Add skill..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono"
              />
              <button
                type="button"
                onClick={addSkill}
                disabled={!skillInput.trim()}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-neon-cyan/20 border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {skillTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {skillTags.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 text-[10px] font-mono text-white/60 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="text-white/30 hover:text-neon-red transition-colors"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              color="purple"
              type="submit"
              disabled={!title.trim()}
            >
              Create Task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

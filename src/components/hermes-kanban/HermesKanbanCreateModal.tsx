// ═══════════════════════════════════════════════════════════════
// Kanban Create Modal — Create a new task
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
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

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setDescription("");
      setAssignee("");
      setPriority(3);
      setTenant("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      body: description.trim() || undefined,
      assignee: assignee || undefined,
      priority,
      tenant: tenant.trim() || undefined,
      status: defaultStatus || "triage",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-950 border border-white/10 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
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

          {/* Tenant */}
          <div>
            <label className="block text-xs font-mono text-white/40 uppercase tracking-wider mb-1.5">
              Tenant
            </label>
            <input
              type="text"
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
              placeholder="Optional tenant name..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
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

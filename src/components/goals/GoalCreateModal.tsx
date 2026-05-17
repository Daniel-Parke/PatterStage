// ═══════════════════════════════════════════════════════════════
// GoalCreateModal — Create/edit form for goals
// ═══════════════════════════════════════════════════════════════
// Modal with title, description, priority, category fields +
// inline checkpoint editor. Reusable for both create and edit.

"use client";

import { useState, useCallback, useEffect } from "react";
import { Target, Save } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import GoalCheckpointList from "./GoalCheckpointList";
import type { Goal, GoalCheckpoint } from "@/lib/goals-bridge";

interface GoalCreateModalProps {
  open: boolean;
  onClose: () => void;
  /** If provided, the modal opens in edit mode. */
  goal?: Goal | null;
  /** Called after successful create/update. */
  onSaved: (goal: Goal) => void;
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "Lowest",
  2: "Low",
  3: "Medium",
  4: "High",
  5: "Highest",
};

const STATUS_OPTIONS: Goal["status"][] = [
  "active",
  "in_progress",
  "completed",
  "archived",
];

export default function GoalCreateModal({
  open,
  onClose,
  goal,
  onSaved,
}: GoalCreateModalProps) {
  const isEditing = !!goal;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(3);
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<Goal["status"]>("active");
  const [checkpoints, setCheckpoints] = useState<GoalCheckpoint[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return;
    if (goal) {
      setTitle(goal.title);
      setDescription(goal.description ?? "");
      setPriority(goal.priority);
      setCategory(goal.category ?? "");
      setStatus(goal.status);
      // Checkpoints are not part of base Goal, will be empty for edit too unless we fetch detail
      setCheckpoints([]);
    } else {
      setTitle("");
      setDescription("");
      setPriority(3);
      setCategory("");
      setStatus("active");
      setCheckpoints([]);
    }
    setError("");
  }, [open, goal]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = isEditing
        ? `/api/orchestration/goals/${goal!.id}`
        : "/api/orchestration/goals";
      const method = isEditing ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        category: category.trim() || undefined,
      };
      if (isEditing) {
        body.status = status;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save goal");
      }

      const json = await res.json();
      const savedGoal = json.data as Goal;

      // Add checkpoints if any were created locally (only for new goals)
      if (!isEditing && checkpoints.length > 0) {
        for (const cp of checkpoints) {
          if (cp.completed === 0) {
            // Only add uncompleted checkpoints — these don't have real IDs yet
            await fetch(
              `/api/orchestration/goals/${savedGoal.id}/checkpoints`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: cp.title }),
              },
            ).catch(() => {}); // Best-effort
          }
        }
      }

      onSaved(savedGoal);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [title, description, priority, category, status, isEditing, goal, checkpoints, onSaved, onClose]);

  const handleLocalCheckpointChange = useCallback(
    (next: GoalCheckpoint[]) => {
      setCheckpoints(next);
    },
    [],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit Goal" : "Create Goal"}
      icon={Target}
      iconColor="text-neon-purple"
      size="lg"
      footer={
        <div className="flex items-center gap-3 w-full">
          {error && (
            <p className="text-xs text-neon-red flex-1 truncate">{error}</p>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            color="purple"
            icon={Save}
            loading={saving}
            onClick={handleSave}
          >
            {isEditing ? "Save Changes" : "Create Goal"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-xs font-mono text-white/50 mb-1.5 uppercase tracking-wider">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Goal title..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono"
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-mono text-white/50 mb-1.5 uppercase tracking-wider">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your goal..."
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono resize-none"
          />
        </div>

        {/* Priority + Category row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Priority */}
          <div>
            <label className="block text-xs font-mono text-white/50 mb-1.5 uppercase tracking-wider">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-neon-purple/50 transition-colors font-mono"
            >
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>
                  P{p} — {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-mono text-white/50 mb-1.5 uppercase tracking-wider">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. personal, work"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-neon-purple/50 transition-colors font-mono"
            />
          </div>
        </div>

        {/* Status (edit only) */}
        {isEditing && (
          <div>
            <label className="block text-xs font-mono text-white/50 mb-1.5 uppercase tracking-wider">
              Status
            </label>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                    status === s
                      ? "bg-neon-purple/20 text-neon-purple border-neon-purple/40"
                      : "bg-white/5 text-white/50 border-white/10 hover:border-white/30"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Separator */}
        <div className="border-t border-white/5 pt-4">
          <GoalCheckpointList
            goalId={goal?.id ?? "new"}
            checkpoints={[]}
            onToggle={() => {}}
            onAdd={() => {}}
            onRemove={() => {}}
            readonly
            localCheckpoints={checkpoints}
            onLocalChange={handleLocalCheckpointChange}
          />
        </div>
      </div>
    </Modal>
  );
}

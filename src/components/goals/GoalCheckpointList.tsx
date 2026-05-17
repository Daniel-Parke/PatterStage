// ═══════════════════════════════════════════════════════════════
// GoalCheckpointList — Checklist widget for goal checkpoints
// ═══════════════════════════════════════════════════════════════
// Displays checkpoints as a checklist with toggle, add, remove.
// Used inside GoalDetailPanel and GoalCreateModal.

"use client";

import { useState, useCallback } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import type { GoalCheckpoint } from "@/lib/goals-bridge";

interface GoalCheckpointListProps {
  goalId: string;
  checkpoints: GoalCheckpoint[];
  /** Called when a checkpoint is toggled (completed ↔ incomplete). */
  onToggle: (checkpointId: number) => void;
  /** Called when a new checkpoint is added. */
  onAdd: (title: string) => void;
  /** Called when a checkpoint is removed. */
  onRemove: (checkpointId: number) => void;
  /** If true, disables add/remove toggling (e.g. during create flow). */
  readonly?: boolean;
  /** When readonly, use local state instead of remote toggling. */
  localCheckpoints?: GoalCheckpoint[];
  /** Called when local checkpoints change (for create/edit form state). */
  onLocalChange?: (checkpoints: GoalCheckpoint[]) => void;
}

export default function GoalCheckpointList({
  goalId,
  checkpoints,
  onToggle,
  onAdd,
  onRemove,
  readonly = false,
  localCheckpoints,
  onLocalChange,
}: GoalCheckpointListProps) {
  const [newTitle, setNewTitle] = useState("");

  const activeCheckpoints = localCheckpoints ?? checkpoints;

  const handleAdd = useCallback(() => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    if (readonly && onLocalChange) {
      // Local-only mode for create form
      const next: GoalCheckpoint[] = [
        ...activeCheckpoints,
        {
          id: Date.now(), // temp ID for unpersisted items
          goal_id: goalId,
          title: trimmed,
          completed: 0,
          completed_at: null,
          order_index: activeCheckpoints.length,
        },
      ];
      onLocalChange(next);
    } else {
      onAdd(trimmed);
    }
    setNewTitle("");
  }, [newTitle, readonly, onAdd, onLocalChange, activeCheckpoints, goalId]);

  const handleToggle = useCallback(
    (cp: GoalCheckpoint) => {
      if (readonly && onLocalChange) {
        const next = activeCheckpoints.map((c) =>
          c.id === cp.id
            ? { ...c, completed: c.completed === 1 ? 0 : 1 }
            : c,
        );
        onLocalChange(next);
      } else {
        onToggle(cp.id);
      }
    },
    [readonly, onToggle, onLocalChange, activeCheckpoints],
  );

  const handleRemove = useCallback(
    (cp: GoalCheckpoint) => {
      if (readonly && onLocalChange) {
        const next = activeCheckpoints.filter((c) => c.id !== cp.id);
        onLocalChange(next);
      } else {
        onRemove(cp.id);
      }
    },
    [readonly, onRemove, onLocalChange, activeCheckpoints],
  );

  const completedCount = activeCheckpoints.filter((c) => c.completed === 1).length;
  const totalCount = activeCheckpoints.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Check className="w-4 h-4 text-neon-green" />
          Checkpoints
          {totalCount > 0 && (
            <span className="text-xs text-white/40 font-mono">
              {completedCount}/{totalCount}
            </span>
          )}
        </h3>
      </div>

      {/* List */}
      {activeCheckpoints.length === 0 ? (
        <p className="text-xs text-white/30 italic px-1">No checkpoints yet.</p>
      ) : (
        <ul className="space-y-1">
          {activeCheckpoints
            .sort((a, b) => a.order_index - b.order_index)
            .map((cp) => (
              <li
                key={cp.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group ${
                  cp.completed === 1
                    ? "bg-neon-green/5 border border-neon-green/10"
                    : "bg-white/[0.03] border border-transparent hover:bg-white/[0.06]"
                }`}
              >
                {/* Toggle button */}
                <button
                  onClick={() => handleToggle(cp)}
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                    cp.completed === 1
                      ? "bg-neon-green border-neon-green text-white"
                      : "border-white/30 hover:border-neon-cyan/50 group-hover:border-white/50"
                  }`}
                  title={cp.completed === 1 ? "Mark incomplete" : "Mark complete"}
                >
                  {cp.completed === 1 && <Check className="w-3 h-3" />}
                </button>

                {/* Title */}
                <span
                  className={`text-sm flex-1 min-w-0 truncate ${
                    cp.completed === 1
                      ? "text-white/40 line-through"
                      : "text-white/80"
                  }`}
                >
                  {cp.title}
                </span>

                {/* Remove button */}
                <button
                  onClick={() => handleRemove(cp)}
                  className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-white/30 hover:text-neon-red hover:bg-neon-red/10 transition-all flex-shrink-0"
                  title="Remove checkpoint"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            ))}
        </ul>
      )}

      {/* Add input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add checkpoint..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-neon-cyan/40 transition-colors font-mono"
        />
        <button
          onClick={handleAdd}
          disabled={!newTitle.trim()}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          title="Add checkpoint"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

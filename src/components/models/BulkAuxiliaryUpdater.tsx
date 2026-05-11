// ═══════════════════════════════════════════════════════════════
// BulkAuxiliaryUpdater — inline panel for setting auxiliary defaults
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  TASK_TYPES,
  type TaskType,
} from "@/lib/hermes-providers";

interface BulkAuxiliaryUpdaterProps {
  models: Array<{ id: string; name: string; provider: string; modelId: string }>;
  onChange: (selectedTaskTypes: TaskType[], targetModelId: string) => void;
  disabled?: boolean;
}

const AUXILIARY_TYPES = TASK_TYPES.filter((t) => t !== "agent");

export default function BulkAuxiliaryUpdater({
  models,
  onChange,
  disabled = false,
}: BulkAuxiliaryUpdaterProps) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"all" | "custom">("all");
  const [selected, setSelected] = useState<Set<TaskType>>(new Set(AUXILIARY_TYPES));
  const [targetModelId, setTargetModelId] = useState<string>("");
  const [applying, setApplying] = useState(false);

  const toggleTaskType = useCallback((taskType: TaskType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskType)) {
        next.delete(taskType);
      } else {
        next.add(taskType);
      }
      return next;
    });
  }, []);

  const handleApply = useCallback(async () => {
    if (applying || !targetModelId) return;
    setApplying(true);
    try {
      const taskTypes = mode === "all" ? AUXILIARY_TYPES : Array.from(selected);
      await onChange(taskTypes, targetModelId);
      setExpanded(false);
    } finally {
      setApplying(false);
    }
  }, [applying, mode, selected, targetModelId, onChange]);

  return (
    <div className="rounded-xl border border-white/10 bg-dark-900/50 overflow-hidden">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        disabled={disabled}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/5 transition-colors disabled:opacity-50"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-white/70 uppercase tracking-widest">
            Bulk Set Auxiliaries
          </span>
          <span className="text-[10px] font-mono text-white/30">
            ({AUXILIARY_TYPES.length} slots)
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-white/30" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/30" />
        )}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3">
          {/* Model selector */}
          <div>
            <label className="block text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">
              Target Model
            </label>
            <div className="relative">
              <select
                value={targetModelId}
                onChange={(e) => setTargetModelId(e.target.value)}
                disabled={disabled}
                className="w-full h-9 min-h-9 bg-dark-800 border border-white/10 rounded-lg px-3 pr-8 text-sm text-white font-mono outline-none cursor-pointer transition-colors hover:border-white/20 focus:border-neon-purple/50 disabled:opacity-50 truncate appearance-none"
              >
                <option value="">— Select model —</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.provider}/{m.modelId})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            </div>
          </div>

          {/* Mode selector */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="aux-mode"
                checked={mode === "all"}
                onChange={() => {
                  setMode("all");
                  setSelected(new Set(AUXILIARY_TYPES));
                }}
                disabled={disabled}
                className="accent-neon-purple"
              />
              <span className="text-xs font-mono text-white/70">ALL</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="aux-mode"
                checked={mode === "custom"}
                onChange={() => setMode("custom")}
                disabled={disabled}
                className="accent-neon-purple"
              />
              <span className="text-xs font-mono text-white/70">CUSTOM</span>
            </label>
          </div>

          {/* Task type checkboxes */}
          {mode === "custom" && (
            <div className="grid grid-cols-3 gap-x-4 gap-y-1 pl-1">
              {AUXILIARY_TYPES.map((taskType) => (
                <label
                  key={taskType}
                  className="flex items-center gap-1.5 cursor-pointer hover:bg-white/5 px-2 py-1 rounded transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(taskType)}
                    onChange={() => toggleTaskType(taskType)}
                    disabled={disabled}
                    className="accent-neon-purple w-3 h-3"
                  />
                  <span className="text-xs font-mono text-white/60 truncate">
                    {taskType}
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Apply button */}
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={disabled || applying || !targetModelId}
            className="w-full h-9 bg-neon-purple/10 border border-neon-purple/30 text-neon-purple text-xs font-mono rounded-lg hover:bg-neon-purple/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applying ? "Applying…" : `Apply to ${selected.size} slot${selected.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
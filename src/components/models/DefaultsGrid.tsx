// ═══════════════════════════════════════════════════════════════
// DefaultsGrid — task-slot cards driving model.* + auxiliary.*
// ═══════════════════════════════════════════════════════════════
//
// Each slot maps to an entry in the model_defaults table
// (migration 012), keyed on (framework_id, task_type). Changes
// propagate to ~/.hermes/config.yaml via syncDefaultsToHermesConfig.

"use client";

import { ChevronDown, Zap } from "lucide-react";
import GlowSurface from "@/components/ui/GlowSurface";

import {
  TASK_TYPES,
  type TaskType,
} from "@/lib/hermes-providers";

export interface DefaultsModelOption {
  id: string;
  name: string;
  provider: string;
  modelId: string;
}

export interface DefaultsGridProps {
  defaults: Record<TaskType, string | null>;
  models: DefaultsModelOption[];
  onChange: (taskType: TaskType, modelId: string | null) => void | Promise<void>;
  onSetAllAux?: (taskTypes: TaskType[], targetModelId: string) => void | Promise<void>;
  busyTaskType?: TaskType | null;
}

interface SlotMeta {
  label: string;
  description: string;
}

const SLOT_META: Record<TaskType, SlotMeta> = {
  agent: {
    label: "Agent",
    description: "Primary mission model — drives `hermes chat` dispatch",
  },
  hindsight: {
    label: "Hindsight",
    description: "Memory recall + reflection (knowledge graph bridge)",
  },
  compression: {
    label: "Compression",
    description: "Context-window summary generation",
  },
  vision: {
    label: "Vision",
    description: "Image analysis and screenshot reading",
  },
  web_extract: {
    label: "Web Extract",
    description: "Page-content extraction post-fetch",
  },
  session_search: {
    label: "Session Search",
    description: "Cross-session retrieval and indexing",
  },
  title_generation: {
    label: "Title Generation",
    description: "Auto-naming sessions, threads, and missions",
  },
  skills_hub: {
    label: "Skills Hub",
    description: "Skill discovery + ranking",
  },
  mcp: {
    label: "MCP",
    description: "MCP server tool selection",
  },
  triage_specifier: {
    label: "Triage Specifier",
    description: "Routing requests to the right specialist",
  },
  approval: {
    label: "Approval",
    description: "Auto-approving low-risk commands",
  },
  delegation: {
    label: "Delegation",
    description: "Sub-agent task delegation",
  },
};

export default function DefaultsGrid({
  defaults,
  models,
  onChange,
  onSetAllAux,
  busyTaskType = null,
}: DefaultsGridProps) {
  const auxTypes = TASK_TYPES.filter((t) => t !== "agent");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {TASK_TYPES.map((slot) => {
        const meta = SLOT_META[slot];
        const selected = defaults[slot];
        const isBusy = busyTaskType === slot;
        const isAux = slot !== "agent";
        const modelForSlot = selected ? models.find((m) => m.id === selected) : null;

        const handleQuickSetAll = async () => {
          if (!onSetAllAux || !selected) return;
          // Set all OTHER auxiliary slots to this model
          const others = auxTypes.filter((t) => t !== slot);
          if (others.length === 0) return;
          await onSetAllAux(others, selected);
        };

        return (
          <GlowSurface
            key={slot}
            data-task-slot={slot}
            accent={slot === "agent" ? "orange" : modelForSlot ? "purple" : undefined}
            className="rounded-xl border border-white/10 bg-dark-900/50 p-4 space-y-2 min-h-[120px]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  {meta.label}
                  {isAux && onSetAllAux && modelForSlot && (
                    <button
                      type="button"
                      onClick={() => void handleQuickSetAll()}
                      disabled={isBusy}
                      className="p-0.5 rounded text-neon-purple/40 hover:text-neon-purple hover:bg-neon-purple/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={`Set all auxiliary slots to ${modelForSlot.name}`}
                    >
                      <Zap className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-white/30 font-mono mt-0.5 truncate">
                  {meta.description}
                </p>
              </div>
              <span className="text-[10px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded uppercase tracking-widest flex-shrink-0">
                {slot}
              </span>
            </div>

            <div className="relative">
              <select
                aria-label={`Default model for ${meta.label}`}
                value={selected ?? ""}
                disabled={isBusy}
                onChange={(e) => {
                  const value = e.target.value;
                  void onChange(slot, value === "" ? null : value);
                }}
                className="w-full h-9 min-h-9 bg-dark-900/50 border border-white/10 rounded-lg px-3 pr-8 text-sm text-white outline-none transition-colors font-mono appearance-none cursor-pointer focus:border-neon-purple/50 disabled:opacity-50 truncate"
              >
                <option value="" className="bg-dark-900">
                  — none —
                </option>
                {models.map((m) => (
                  <option key={m.id} value={m.id} className="bg-dark-900">
                    {m.name} ({m.provider}/{m.modelId})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            </div>
          </GlowSurface>
        );
      })}
    </div>
  );
}

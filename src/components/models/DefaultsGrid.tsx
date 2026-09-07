// ═══════════════════════════════════════════════════════════════
// DefaultsGrid — task-slot cards driving model.* + auxiliary.*
// ═══════════════════════════════════════════════════════════════
//
// Each slot maps to an entry in the model_defaults table
// (migration 012), keyed on (task_type, task_type). Changes
// propagate to ~/.hermes/config.yaml via syncDefaultsToHermesConfig.

"use client";

import GlowSurface from "@/components/ui/GlowSurface";
import ModelSelectDropdown from "@/components/models/ModelSelectDropdown";

import { TASK_TYPES, type TaskType } from "@/lib/models/task-types";

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
  busyTaskType = null,
}: DefaultsGridProps) {

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {TASK_TYPES.map((slot) => {
        const meta = SLOT_META[slot];
        const selected = defaults[slot];
        const isBusy = busyTaskType === slot;
        const modelForSlot = selected ? models.find((m) => m.id === selected) : null;

        return (
          <GlowSurface
            key={slot}
            data-task-slot={slot}
            accent={slot === "agent" ? "orange" : modelForSlot ? "purple" : undefined}
            className="rounded-ps-lg border border-ps-edge-hairline bg-ps-surface-panel p-4 space-y-2 min-h-[120px] relative overflow-hidden"
          >
            {/* Left accent bar — matches the glow accent */}
            {slot === "agent" && (
              <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-ps-lg bg-neon-orange" />
            )}
            {slot !== "agent" && modelForSlot && (
              <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-ps-lg bg-neon-purple" />
            )}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {/* Per-slot "set all aux" shortcut removed — the section-level
                    Bulk auxiliary updater is the single control for that. */}
                <div className="text-body font-semibold text-ps-text-primary flex items-center gap-2">
                  {meta.label}
                </div>
                <p className="text-micro text-ps-text-muted font-mono mt-0.5 truncate">
                  {meta.description}
                </p>
              </div>
              <span className="text-micro font-mono text-ps-text-muted bg-ps-surface-raised px-1.5 py-0.5 rounded-ps-sm uppercase tracking-widest flex-shrink-0">
                {slot}
              </span>
            </div>

            <div className="relative">
              <ModelSelectDropdown
                ariaLabel={`Default model for ${meta.label}`}
                value={selected ?? ""}
                disabled={isBusy}
                tone="card"
                placeholder="— none —"
                options={models}
                onChange={(value) => {
                  void onChange(slot, value === "" ? null : value);
                }}
              />
            </div>
          </GlowSurface>
        );
      })}
    </div>
  );
}

"use client";

import { CheckCircle2, Star } from "lucide-react";

import GlowSurface from "@/components/ui/GlowSurface";
import BulkAuxiliaryUpdater from "@/components/models/BulkAuxiliaryUpdater";
import type { DefaultsModelOption } from "@/components/models/DefaultsGrid";
import type { TaskType } from "@/lib/hermes-providers";

import type { ApiModel } from "./types";

interface ModelsAgentDefaultSectionProps {
  models: ApiModel[];
  modelOptions: DefaultsModelOption[];
  defaults: Record<TaskType, string | null>;
  busyTaskType: TaskType | null;
  onBulkAuxiliaryChange: (taskTypes: TaskType[], targetModelId: string) => Promise<void>;
  onSetDefault: (taskType: TaskType, modelId: string | null) => Promise<void>;
}

export default function ModelsAgentDefaultSection({
  models,
  modelOptions,
  defaults,
  busyTaskType,
  onBulkAuxiliaryChange,
  onSetDefault,
}: ModelsAgentDefaultSectionProps) {
  // Hoist the active-model lookup out of JSX (no IIFE wrapper) — the find
  // runs on every render either way, but extracting to a const makes the
  // conditional read more naturally as `activeModel && <div>...</div>`.
  const activeModel = defaults.agent
    ? models.find((m) => m.id === defaults.agent)
    : null;
  return (
    <section data-section="agent-default" className="space-y-4">
      <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
        <Star className="w-4 h-4 text-neon-orange" />
        Agent Default
      </h2>

      <GlowSurface accent="orange">
        <div className="rounded-xl border border-neon-orange/20 bg-dark-900/40 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BulkAuxiliaryUpdater
              models={modelOptions}
              onChange={onBulkAuxiliaryChange}
              disabled={busyTaskType !== null}
            />

            <div className="flex flex-col justify-center gap-3">
              <label className="block text-xs font-mono text-white/50 uppercase tracking-wider">
                Default Model
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  className="flex-shrink-0 w-full max-w-xs bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm h-9 min-w-0 focus:outline-none focus:border-neon-orange/50 transition-colors truncate appearance-none"
                  value={defaults.agent ?? ""}
                  onChange={(e) => {
                    const val = e.target.value || null;
                    void onSetDefault("agent", val);
                  }}
                  disabled={busyTaskType === "agent"}
                  title="Primary model used for all agent missions"
                >
                  <option value="">— None —</option>
                  {modelOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>

                {activeModel && (
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-white/40 font-mono">
                      {" "}
                      {activeModel.provider}/
                      <span className="text-white/60">{activeModel.modelId}</span>
                    </span>
                    {" "}
                    <span className="inline-flex items-center gap-1 text-green-400 text-xs font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active
                    </span>
                  </div>
                )}
                {!defaults.agent && (
                  <span className="text-xs text-white/30 font-mono">No default set</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </GlowSurface>
    </section>
  );
}

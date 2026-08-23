"use client";

import { CheckCircle2, Star } from "lucide-react";

import GlowSurface from "@/components/ui/GlowSurface";
import { Select } from "@/components/ui/field";
import BulkAuxiliaryUpdater from "@/components/models/BulkAuxiliaryUpdater";
import ModelsSectionHeader from "@/components/models/ModelsSectionHeader";
import type { DefaultsModelOption } from "@/components/models/DefaultsGrid";
import type { TaskType } from "@/lib/models/task-types";

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
      <ModelsSectionHeader icon={Star} title="Agent Default" color="orange" />

      <GlowSurface accent="orange">
        <div className="rounded-xl border border-neon-orange/20 bg-dark-900/40 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BulkAuxiliaryUpdater
              models={modelOptions}
              onChange={onBulkAuxiliaryChange}
              disabled={busyTaskType !== null}
            />

            <div className="flex flex-col justify-center gap-3">
              <label className="block text-xs font-mono text-ps-text-muted uppercase tracking-wider">
                Default Model
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-full max-w-xs shrink-0" title="Primary model used for all agent missions">
                  <Select
                    ariaLabel="Default agent model"
                    value={defaults.agent ?? ""}
                    onChange={(v) => void onSetDefault("agent", v || null)}
                    disabled={busyTaskType === "agent"}
                    placeholder="— None —"
                    options={[{ value: "", label: "— None —" }, ...modelOptions.map((m) => ({ value: m.id, label: m.name }))]}
                  />
                </div>

                {activeModel && (
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-ps-text-muted font-mono">
                      {" "}
                      {activeModel.provider}/
                      <span className="text-ps-text-secondary">{activeModel.modelId}</span>
                    </span>
                    {" "}
                    <span className="inline-flex items-center gap-1 text-green-400 text-xs font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active
                    </span>
                  </div>
                )}
                {!defaults.agent && (
                  <span className="text-xs text-ps-text-muted font-mono">No default set</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </GlowSurface>
    </section>
  );
}

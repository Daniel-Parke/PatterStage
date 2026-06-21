"use client";

import { useMemo } from "react";
import { Database, Edit3, Plus } from "lucide-react";

import Button from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/LoadingSpinner";
import GlowSurface from "@/components/ui/GlowSurface";
import ModelSyncButtons from "@/components/models/ModelSyncButtons";
import ModelsSectionHeader from "@/components/models/ModelsSectionHeader";
import PerRowDeleteButton from "@/components/models/PerRowDeleteButton";
import type { ModelEditorRecord } from "@/components/models/ModelEditor";
import { TASK_TYPES, type TaskType } from "@/lib/hermes-providers";
import type { SyncActionResult } from "@/lib/sync-manager";

import { type ApiModel, toModelEditorRecord } from "./types";

interface ModelsTableSectionProps {
  models: ApiModel[];
  defaults: Record<TaskType, string | null>;
  busyTaskType: TaskType | null;
  onAddModel: () => void;
  onEdit: (record: ModelEditorRecord) => void;
  onDelete: (model: ApiModel) => void;
  onPush: (
    modelId: string,
    options?: { pushCredential?: boolean },
  ) => Promise<SyncActionResult>;
  onPull: (
    modelId: string,
    options?: { excluded?: Set<string> },
  ) => Promise<SyncActionResult>;
}

interface ModelRowProps {
  model: ApiModel;
  badges: TaskType[];
  busyTaskType: TaskType | null;
  onEdit: (record: ModelEditorRecord) => void;
  onDelete: (model: ApiModel) => void;
  onPush: (
    modelId: string,
    options?: { pushCredential?: boolean },
  ) => Promise<SyncActionResult>;
  onPull: (
    modelId: string,
    options?: { excluded?: Set<string> },
  ) => Promise<SyncActionResult>;
}

/**
 * One row in the models table. The delete button is delegated to
 * `PerRowDeleteButton` (a shared, per-row arm-confirm component
 * that also serves `FallbackRow` in `FallbackChainList`) so the
 * armed-state styling + aria-label shape stays in lockstep across
 * the two list-style tables. The per-row `useTwoStepConfirm`
 * instance lives inside the button, so each row owns its own
 * armed state — a stale arm on one row cannot fire on another.
 */
function ModelRow({
  model,
  badges,
  busyTaskType,
  onEdit,
  onDelete,
  onPush,
  onPull,
}: ModelRowProps) {
  return (
    <tr
      data-row-id={model.id}
      className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
    >
      <td className="px-4 py-3 font-mono text-white">{model.name}</td>
      <td className="px-4 py-3 font-mono text-white/70">{model.provider}</td>
      <td className="px-4 py-3 font-mono text-white/70">{model.modelId}</td>
      <td className="px-4 py-3">
        {model.apiStyle ? (
          <span
            className="rounded bg-neon-cyan/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-widest text-neon-cyan/80"
            title={`Direct-provider wire protocol: ${model.apiStyle === "anthropic" ? "Anthropic /v1/messages" : "OpenAI /chat/completions"}`}
          >
            {model.apiStyle}
          </span>
        ) : (
          <span className="font-mono text-xs text-white/30" title="Auto-detected from provider/base URL at call time">
            auto
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-white/40">
        {model.contextLength ?? (
          <span title="Context length not set for this model">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {badges.length === 0 ? (
          <span className="text-white/30 font-mono text-xs">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {badges.map((b) => (
              <span
                key={b}
                className="text-[10px] font-mono bg-neon-purple/15 text-neon-purple px-1.5 py-0.5 rounded uppercase tracking-widest"
              >
                {b}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <ModelSyncButtons
            modelId={model.id}
            provider={model.provider}
            modelIdString={model.modelId}
            onPush={onPush}
            onPull={onPull}
            disabled={busyTaskType !== null}
          />

          <button
            type="button"
            onClick={() => onEdit(toModelEditorRecord(model))}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            aria-label={`Edit ${model.name}`}
            title="Edit"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <PerRowDeleteButton
            rowId={model.id}
            rowName={model.name}
            onDelete={() => onDelete(model)}
            disabled={busyTaskType !== null}
          />
        </div>
      </td>
    </tr>
  );
}

export default function ModelsTableSection({
  models,
  defaults,
  busyTaskType,
  onAddModel,
  onEdit,
  onDelete,
  onPush,
  onPull,
}: ModelsTableSectionProps) {
  // Precompute the reverse map `modelId → defaulted task slots` once
  // per render instead of running `TASK_TYPES.filter(...)` inside the
  // per-row map. Pre-refactor: each row re-walked the 12-slot
  // `defaults` record (O(12) per row = O(12N) per render). Post-refactor:
  // single O(12) pass builds a `Map<modelId, TaskType[]>`, and each
  // row does an O(1) `Map.get(...)`. For a registry of N=50 models
  // that drops the per-render work from 600 slot-comparisons to 12.
  // The map's `get()` returns `undefined` for models with no defaulted
  // slot — the row component treats that as "no badges" (the same as
  // the pre-refactor `.filter().length === 0` path).
  const defaultedSlotsByModelId = useMemo(() => {
    const map = new Map<string, TaskType[]>();
    for (const slot of TASK_TYPES) {
      const modelId = defaults[slot];
      if (modelId === null || modelId === undefined) continue;
      const existing = map.get(modelId);
      if (existing) {
        existing.push(slot);
      } else {
        map.set(modelId, [slot]);
      }
    }
    return map;
  }, [defaults]);

  return (
    <section data-section="my-models" className="space-y-4">
      <ModelsSectionHeader icon={Database} title="Models" color="purple" iconTone="muted" />

      {models.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No models yet"
          description="Add your first model to start dispatching missions with custom defaults."
          action={
            <Button
              variant="primary"
              color="purple"
              icon={Plus}
              onClick={onAddModel}
            >
              Add Model
            </Button>
          }
        />
      ) : (
        <GlowSurface accent="purple">
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-dark-900/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-widest text-white/40 border-b border-white/5">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Provider</th>
                  <th className="px-4 py-2">Model ID</th>
                  <th className="px-4 py-2" title="Direct-provider wire protocol (how PatterStage calls this model directly)">Protocol</th>
                  <th className="px-4 py-2" title="Model context window (tokens)">Context</th>
                  <th className="px-4 py-2">Default For</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <ModelRow
                    key={m.id}
                    model={m}
                    badges={defaultedSlotsByModelId.get(m.id) ?? []}
                    busyTaskType={busyTaskType}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onPush={onPush}
                    onPull={onPull}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </GlowSurface>
      )}
    </section>
  );
}

"use client";

import { Database, Edit3, Plus, Trash2 } from "lucide-react";

import Button from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/LoadingSpinner";
import GlowSurface from "@/components/ui/GlowSurface";
import ModelSyncButtons from "@/components/models/ModelSyncButtons";
import type { ModelEditorRecord } from "@/components/models/ModelEditor";
import { TASK_TYPES, type TaskType } from "@/lib/hermes-providers";
import type { SyncActionResult } from "@/lib/sync-manager";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";

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
 * One row in the models table. Owns its own per-row two-step confirm
 * state (via `useTwoStepConfirm` with the per-key variant) so the
 * delete button can be armed and confirmed independently for each
 * row, with auto-dismiss so a stale "armed" state from one row
 * can't accidentally fire when the user clicks a different row's
 * delete button minutes later.
 *
 * Replaces the pre-refactor single global `window.confirm` guard
 * in `useModelsPage.handleDelete` (which had no per-row context
 * — the prompt was a single dialog, not tied to the row that
 * armed it). The per-row variant matches the pattern established
 * in `/config/seed/page.tsx` `agentRestore` (session 138) and the
 * dashboard's per-mission `useTwoStepConfirm` instance.
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
  const deleteConfirm = useTwoStepConfirm({ autoDismissMs: 4000 });

  const handleDeleteClick = () => {
    if (deleteConfirm.isArmedFor(model.id)) {
      void deleteConfirm.confirm(() => onDelete(model));
    } else {
      deleteConfirm.arm(model.id);
    }
  };

  const isArmed = deleteConfirm.isArmedFor(model.id);

  return (
    <tr
      data-row-id={model.id}
      className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
    >
      <td className="px-4 py-3 font-mono text-white">{model.name}</td>
      <td className="px-4 py-3 font-mono text-white/70">{model.provider}</td>
      <td className="px-4 py-3 font-mono text-white/70">{model.modelId}</td>
      <td className="px-4 py-3 font-mono text-white/40">
        {model.contextLength ?? "—"}
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

          <button
            type="button"
            onClick={handleDeleteClick}
            className={`p-1.5 rounded-lg transition-colors ${
              isArmed
                ? "text-red-300 bg-red-500/20 ring-1 ring-red-500/40"
                : "text-white/30 hover:text-red-400 hover:bg-red-500/10"
            }`}
            aria-label={
              isArmed
                ? `Click again to confirm deleting ${model.name}`
                : `Delete ${model.name}`
            }
            title={isArmed ? "Click again to confirm" : "Delete"}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
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
  return (
    <section data-section="my-models" className="space-y-4">
      <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider flex items-center gap-2">
        <Database className="w-4 h-4 text-neon-purple/60" />
        Models
      </h2>

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
                  <th className="px-4 py-2">Context</th>
                  <th className="px-4 py-2">Default For</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => {
                  const badges = TASK_TYPES.filter(
                    (slot) => defaults[slot] === m.id,
                  );
                  return (
                    <ModelRow
                      key={m.id}
                      model={m}
                      badges={badges}
                      busyTaskType={busyTaskType}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onPush={onPush}
                      onPull={onPull}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlowSurface>
      )}
    </section>
  );
}

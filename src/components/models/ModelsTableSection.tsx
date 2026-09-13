"use client";

import { useMemo } from "react";
import { Database, Edit3, Plus, RefreshCw } from "lucide-react";

import Button from "@/components/ui/Button";
import DataList, { type DataListColumn } from "@/components/ui/DataList";
import { EmptyState } from "@/components/ui/EmptyState";
import GlowSurface from "@/components/ui/GlowSurface";
import IconButton from "@/components/ui/IconButton";
import ModelSyncButtons from "@/components/models/ModelSyncButtons";
import ModelsSectionHeader from "@/components/models/ModelsSectionHeader";
import PerRowDeleteButton from "@/components/models/PerRowDeleteButton";
import ConceptHint from "@/components/help/ConceptHint";
import type { ModelEditorRecord } from "@/components/models/ModelEditor";
import { TASK_TYPES, type TaskType } from "@/lib/models/task-types";
import type { SyncActionResult } from "@/lib/models/sync-result";

import { type ApiModel, toModelEditorRecord } from "./types";

interface ModelsTableSectionProps {
  models: ApiModel[];
  defaults: Record<TaskType, string | null>;
  busyTaskType: TaskType | null;
  onAddModel: () => void;
  /** The header's re-import, offered again on the empty state. */
  onReimport?: () => void;
  reimporting?: boolean;
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
 * The registry, as a DataList.
 *
 * At 1024 the table was 898px inside a 774px scroll container, and the part
 * off the edge was ACTIONS - edit and delete - with no scrollbar cue and no
 * shadow to say there was more (T-0125). Below xl the rows stack now, each
 * cell labelled by its column, so the controls are always on screen.
 */
export default function ModelsTableSection({
  models,
  defaults,
  busyTaskType,
  onAddModel,
  onReimport,
  reimporting,
  onEdit,
  onDelete,
  onPush,
  onPull,
}: ModelsTableSectionProps) {
  // One O(12) pass builds `modelId → defaulted task slots`, so each row does
  // an O(1) lookup rather than walking the defaults record itself.
  const defaultedSlotsByModelId = useMemo(() => {
    const map = new Map<string, TaskType[]>();
    for (const slot of TASK_TYPES) {
      const modelId = defaults[slot];
      if (modelId === null || modelId === undefined) continue;
      const existing = map.get(modelId);
      if (existing) existing.push(slot);
      else map.set(modelId, [slot]);
    }
    return map;
  }, [defaults]);

  const columns: DataListColumn<ApiModel>[] = [
    {
      key: "name",
      header: "Name",
      primary: true,
      render: (m) => <span className="font-mono text-ps-text-primary">{m.name}</span>,
    },
    {
      // The column an operator asks about first: who serves this model, and
      // what that costs them.
      key: "provider",
      header: <ConceptHint id="provider">Provider</ConceptHint>,
      render: (m) => <span className="font-mono text-ps-text-secondary">{m.provider}</span>,
    },
    {
      key: "modelId",
      header: "Model ID",
      render: (m) => <span className="font-mono text-ps-text-secondary">{m.modelId}</span>,
    },
    {
      key: "protocol",
      header: <span title="Direct-provider wire protocol (how PatterStage calls this model directly)">Protocol</span>,
      hideBelow: "lg",
      render: (m) =>
        m.apiStyle ? (
          <span
            className="rounded-ps-sm bg-neon-cyan/10 px-1.5 py-0.5 font-mono text-micro uppercase tracking-widest text-neon-cyan/80"
            title={`Direct-provider wire protocol: ${m.apiStyle === "anthropic" ? "Anthropic /v1/messages" : "OpenAI /chat/completions"}`}
          >
            {m.apiStyle}
          </span>
        ) : (
          <span className="font-mono text-micro text-ps-text-muted" title="Auto-detected from provider/base URL at call time">
            auto
          </span>
        ),
    },
    {
      key: "context",
      header: <span title="Model context window (tokens)">Context</span>,
      hideBelow: "md",
      render: (m) => (
        <span className="font-mono text-ps-text-muted">
          {m.contextLength ?? <span title="Context length not set for this model">—</span>}
        </span>
      ),
    },
    {
      key: "defaultFor",
      header: "Default For",
      render: (m) => {
        const badges = defaultedSlotsByModelId.get(m.id) ?? [];
        return badges.length === 0 ? (
          <span className="font-mono text-micro text-ps-text-muted">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {badges.map((b) => (
              <span
                key={b}
                className="rounded-ps-sm bg-neon-purple/15 px-1.5 py-0.5 font-mono text-micro uppercase tracking-widest text-neon-purple"
              >
                {b}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <section data-section="my-models" className="space-y-4">
      <ModelsSectionHeader icon={Database} title="Models" color="purple" iconTone="muted" />

      {models.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No models yet"
          description="Add your first model to start dispatching missions with custom defaults, or bring across the ones your agent's config.yaml already names."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="primary" color="purple" icon={Plus} onClick={onAddModel}>
                Add Model
              </Button>
              {/* The page no longer imports on load (T-0100), so a fresh
                  install needs a way in from the state that shows it. */}
              {onReimport && (
                <Button variant="secondary" color="purple" icon={RefreshCw} onClick={onReimport} disabled={reimporting}>
                  {reimporting ? "Re-importing…" : "Re-import from config"}
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <GlowSurface accent="purple">
          <DataList
            caption="Models"
            columns={columns}
            rows={models}
            rowKey={(m) => m.id}
            rowTestId={(m) => `model-row-${m.id}`}
            collapseBelow="xl"
            actions={(m) => (
              <>
                <ModelSyncButtons
                  modelId={m.id}
                  provider={m.provider}
                  modelIdString={m.modelId}
                  onPush={onPush}
                  onPull={onPull}
                  disabled={busyTaskType !== null}
                />
                <IconButton
                  size="sm"
                  icon={Edit3}
                  label={`Edit ${m.name}`}
                  onClick={() => onEdit(toModelEditorRecord(m))}
                />
                <PerRowDeleteButton
                  rowId={m.id}
                  rowName={m.name}
                  onDelete={() => onDelete(m)}
                  disabled={busyTaskType !== null}
                />
              </>
            )}
          />
        </GlowSurface>
      )}
    </section>
  );
}

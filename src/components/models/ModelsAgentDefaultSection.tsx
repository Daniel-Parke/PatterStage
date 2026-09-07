"use client";

import { CheckCircle2, Star } from "lucide-react";

import GlowSurface from "@/components/ui/GlowSurface";
import { Select } from "@/components/ui/field";
import BulkAuxiliaryUpdater from "@/components/models/BulkAuxiliaryUpdater";
import ModelsSectionHeader from "@/components/models/ModelsSectionHeader";
import type { DefaultsModelOption } from "@/components/models/DefaultsGrid";
import type { TaskType } from "@/lib/models/task-types";
import type { ModelReadiness } from "@/lib/models/model-readiness";

import type { ApiModel } from "./types";

interface ModelsAgentDefaultSectionProps {
  models: ApiModel[];
  modelOptions: DefaultsModelOption[];
  defaults: Record<TaskType, string | null>;
  /**
   * The product's one answer to "do I have a model?" (resolved by
   * GET /api/models/defaults). `null` until it has been read.
   */
  readiness: ModelReadiness | null;
  busyTaskType: TaskType | null;
  onBulkAuxiliaryChange: (taskTypes: TaskType[], targetModelId: string) => Promise<void>;
  onSetDefault: (taskType: TaskType, modelId: string | null) => Promise<void>;
}

export default function ModelsAgentDefaultSection({
  models,
  modelOptions,
  defaults,
  readiness,
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

  // Does the readiness answer name THIS row? `ready` only says the agent's
  // config file names SOME model, and the slot and that file drift apart as a
  // matter of course: detectConfigDrift() reports it as `primaryDiffers`, and
  // PUT /api/models/defaults produces it on purpose whenever the database write
  // lands and the yaml write is refused. So the badge is matched on the model
  // id, which is exactly what config-sync writes into `model.default`.
  //
  // Compared case-insensitively: a hand-edited config.yaml that differs only in
  // case names the same model on every provider we speak to, and the failure
  // that direction (no badge on a model that is running) is the safe one, while
  // the failure this whole comment exists for is the other.
  const runningName = readiness?.ready ? readiness.modelName.trim().toLowerCase() : "";
  const slotIsRunning =
    runningName !== "" && !!activeModel && activeModel.modelId.trim().toLowerCase() === runningName;

  return (
    <section data-section="agent-default" className="space-y-4">
      <ModelsSectionHeader icon={Star} title="Agent Default" color="orange" />

      <GlowSurface accent="orange">
        <div className="rounded-ps-lg border border-neon-orange/20 bg-ps-surface-panel p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BulkAuxiliaryUpdater
              models={modelOptions}
              onChange={onBulkAuxiliaryChange}
              disabled={busyTaskType !== null}
            />

            <div className="flex flex-col justify-center gap-3">
              <label className="block text-micro font-mono text-ps-text-muted uppercase tracking-wider">
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
                    <span className="text-micro text-ps-text-muted font-mono">
                      {" "}
                      {activeModel.provider}/
                      <span className="text-ps-text-secondary">{activeModel.modelId}</span>
                    </span>
                    {" "}
                    {/* Active means the agent is running on THIS model, and
                        only the agent's config file can say that. The badge was
                        drawn from the slot alone once, so a model chosen here
                        and never sent across was stamped Active on a machine
                        where the agent had never seen it; then from `ready`,
                        which says a model is named in that file but not which,
                        so a drifted install stamped Active on gpt-4o while the
                        agent answered on MiniMax-M3. */}
                    {slotIsRunning && (
                      <span className="inline-flex items-center gap-1 text-green-400 text-micro font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active
                      </span>
                    )}
                  </div>
                )}
                {/* "No default set" was true of this slot and false of the
                    product: it appeared on installs whose agent was happily
                    running a model from its config file, while the dashboard
                    named that model on the same install. Both now read the one
                    readiness answer, so the two screens cannot disagree. */}
                {readiness && !readiness.ready && (
                  <p className="basis-full text-body text-neon-orange">{readiness.detail}</p>
                )}
                {/* The model actually answering, on the one screen whose job
                    is to say which that is. Withholding the badge is only half
                    the repair: the drifted install named gpt-4o three times
                    here and never once named the model the dashboard was
                    reporting off the same object. No remedy is spelled out
                    because the drift banner above this section already carries
                    the two buttons (Pull from Hermes, Push to Hermes) that
                    resolve it, and naming a control twice is how the last
                    banner came to name one that did not exist. */}
                {readiness?.ready && activeModel && !slotIsRunning && (
                  <p className="basis-full text-body text-neon-orange">
                    The agent is running {readiness.modelName}, from its own{" "}
                    <code className="text-ps-text-secondary">config.yaml</code>, not the model
                    chosen here.
                  </p>
                )}
                {readiness?.ready && !defaults.agent && (
                  <p className="basis-full text-body text-ps-text-muted">
                    No slot is chosen here. The agent is already running on{" "}
                    {readiness.modelName}, from its own{" "}
                    <code className="text-ps-text-secondary">config.yaml</code>.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </GlowSurface>
    </section>
  );
}

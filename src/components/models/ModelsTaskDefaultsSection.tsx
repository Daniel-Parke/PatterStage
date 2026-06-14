"use client";

import { Settings } from "lucide-react";

import DefaultsGrid from "@/components/models/DefaultsGrid";
import ModelsSectionHeader from "@/components/models/ModelsSectionHeader";
import type { DefaultsModelOption } from "@/components/models/DefaultsGrid";
import type { TaskType } from "@/lib/hermes-providers";

interface ModelsTaskDefaultsSectionProps {
  defaults: Record<TaskType, string | null>;
  modelOptions: DefaultsModelOption[];
  busyTaskType: TaskType | null;
  onChange: (taskType: TaskType, modelId: string | null) => Promise<void>;
  onSetAllAux: (taskTypes: TaskType[], targetModelId: string) => Promise<void>;
}

export default function ModelsTaskDefaultsSection({
  defaults,
  modelOptions,
  busyTaskType,
  onChange,
  onSetAllAux,
}: ModelsTaskDefaultsSectionProps) {
  return (
    <section data-section="defaults" className="space-y-4">
      <ModelsSectionHeader icon={Settings} title="Task Defaults" color="purple" iconTone="muted" />
      <DefaultsGrid
        defaults={defaults}
        models={modelOptions}
        onChange={onChange}
        onSetAllAux={onSetAllAux}
        busyTaskType={busyTaskType}
      />
    </section>
  );
}

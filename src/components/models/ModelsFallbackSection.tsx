"use client";

import CollapsibleSection from "@/components/ui/CollapsibleSection";
import FallbackChainList from "@/components/models/FallbackChainList";
import FallbackConfigPanel from "@/components/models/FallbackConfigPanel";
import type { DefaultsModelOption } from "@/components/models/DefaultsGrid";
import type { TaskType } from "@/lib/models/task-types";
import type { FallbackChainEntry, FallbackConfig } from "@/types/console";

import FallbackUrlEditModal from "@/components/models/FallbackUrlEditModal";

interface ModelsFallbackSectionProps {
  fallbackChain: FallbackChainEntry[];
  fallbackConfig: FallbackConfig;
  modelOptions: DefaultsModelOption[];
  busyTaskType: TaskType | null;
  syncingFallback: boolean;
  fallbackConfigSaving?: boolean;
  fallbackConfigDirty?: boolean;
  fallbackConfigError?: string | null;
  importingFallback: boolean;
  editingFallbackEntry: FallbackChainEntry | null;
  editingFallbackUrl: string;
  savingFallbackUrl: boolean;
  onFallbackConfigChange: (config: FallbackConfig) => void;
  onReorder: (entryId: string, direction: "up" | "down") => Promise<void>;
  onToggle: (entryId: string, enabled: boolean) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
  onEdit: (entry: FallbackChainEntry) => void;
  onAddFromRegistry: (modelId: string) => Promise<void>;
  onAddCustom: (
    name: string,
    provider: string,
    modelIdString: string,
    baseUrl?: string,
  ) => Promise<void>;
  onSyncToHermes: () => Promise<void>;
  onImportFromConfig: () => Promise<void>;
  onFallbackUrlChange: (value: string) => void;
  onCloseFallbackModal: () => void;
  onSaveFallbackUrl: () => Promise<void>;
}

export default function ModelsFallbackSection({
  fallbackChain,
  fallbackConfig,
  modelOptions,
  busyTaskType,
  syncingFallback,
  fallbackConfigSaving = false,
  fallbackConfigDirty = false,
  fallbackConfigError = null,
  importingFallback,
  editingFallbackEntry,
  editingFallbackUrl,
  savingFallbackUrl,
  onFallbackConfigChange,
  onReorder,
  onToggle,
  onDelete,
  onEdit,
  onAddFromRegistry,
  onAddCustom,
  onSyncToHermes,
  onImportFromConfig,
  onFallbackUrlChange,
  onCloseFallbackModal,
  onSaveFallbackUrl,
}: ModelsFallbackSectionProps) {
  return (
    <section data-section="fallback-chain" className="space-y-4">
      <CollapsibleSection
        title="Fallback Chain"
        description="Ordered models tried sequentially when the primary is unavailable."
        badge={fallbackChain.length}
        badgeColor="purple"
      >
        <FallbackChainList
          chain={fallbackChain}
          models={modelOptions}
          onReorder={onReorder}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
          onAddFromRegistry={onAddFromRegistry}
          onAddCustom={onAddCustom}
          disabled={busyTaskType !== null}
        />

        <FallbackConfigPanel
          config={fallbackConfig}
          onUpdate={onFallbackConfigChange}
          onSyncToHermes={onSyncToHermes}
          onImportFromConfig={onImportFromConfig}
          syncing={syncingFallback}
          saving={fallbackConfigSaving}
          dirty={fallbackConfigDirty}
          saveError={fallbackConfigError}
          importing={importingFallback}
        />
      </CollapsibleSection>

      <FallbackUrlEditModal
        entry={editingFallbackEntry}
        url={editingFallbackUrl}
        saving={savingFallbackUrl}
        onUrlChange={onFallbackUrlChange}
        onClose={onCloseFallbackModal}
        onSave={onSaveFallbackUrl}
      />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// useModelsPage — composition root for /config/models
// ═══════════════════════════════════════════════════════════════
//
// Four slices, composed in dependency order:
//   useModelsRegistry        the one read — models, credentials,
//                            defaults, drift, fallback chain + config
//   useModelActions          registry writes: push/pull, save, delete,
//                            the task defaults, refresh
//   useModelFallbackChain    chain CRUD + the URL-override modal
//   useModelFallbackConfig   the debounced settings save + sync
//
// Order is load-bearing: `loadAll` is the refetch every write path calls
// after a successful mutation, so the registry has to exist first. The
// config slice writes `fallbackConfig` back through the registry's
// setter rather than holding a second copy of it.

"use client";

import { useToast } from "@/components/ui/Toast";
import { useModelsRegistry } from "@/hooks/useModelsRegistry";
import { useModelActions } from "@/hooks/useModelActions";
import { useModelFallbackChain } from "@/hooks/useModelFallbackChain";
import { useModelFallbackConfig } from "@/hooks/useModelFallbackConfig";

export function useModelsPage() {
  const { showToast, toastElement } = useToast();

  const registry = useModelsRegistry();

  const actions = useModelActions({
    loadAll: registry.loadAll,
    setDefaults: registry.setDefaults,
    showToast,
  });

  const chain = useModelFallbackChain({
    loadAll: registry.loadAll,
    showToast,
  });

  const fallbackConfig = useModelFallbackConfig({
    fallbackConfig: registry.fallbackConfig,
    setFallbackConfig: registry.setFallbackConfig,
    showToast,
  });

  return {
    models: registry.models,
    credentials: registry.credentials,
    modelOptions: registry.modelOptions,
    credentialOptions: registry.credentialOptions,
    defaults: registry.defaults,
    loading: registry.loading,
    error: registry.error,
    drift: registry.drift,
    refreshing: actions.refreshing,
    busyTaskType: actions.busyTaskType,
    fallbackChain: registry.fallbackChain,
    fallbackConfig: registry.fallbackConfig,
    handleFallbackConfigChange: fallbackConfig.handleFallbackConfigChange,
    fallbackConfigSaving: fallbackConfig.fallbackConfigSaving,
    fallbackConfigDirty: fallbackConfig.fallbackConfigDirty,
    fallbackConfigError: fallbackConfig.fallbackConfigError,
    syncingFallback: fallbackConfig.syncingFallback,
    importingFallback: chain.importingFallback,
    editing: actions.editing,
    setEditing: actions.setEditing,
    editingFallbackEntry: chain.editingFallbackEntry,
    editingFallbackUrl: chain.editingFallbackUrl,
    setEditingFallbackUrl: chain.setEditingFallbackUrl,
    savingFallbackUrl: chain.savingFallbackUrl,
    toastElement,
    handleRefresh: actions.handleRefresh,
    handlePush: actions.handlePush,
    handlePull: actions.handlePull,
    handleSaved: actions.handleSaved,
    handleDelete: actions.handleDelete,
    handleDeleteCredential: actions.handleDeleteCredential,
    busyCredentialId: actions.busyCredentialId,
    handleSetDefault: actions.handleSetDefault,
    handleBulkAuxiliaryChange: actions.handleBulkAuxiliaryChange,
    handleFallbackReorder: chain.handleFallbackReorder,
    handleFallbackToggle: chain.handleFallbackToggle,
    handleFallbackDelete: chain.handleFallbackDelete,
    handleFallbackEdit: chain.handleFallbackEdit,
    handleFallbackEditSave: chain.handleFallbackEditSave,
    handleFallbackAddFromRegistry: chain.handleFallbackAddFromRegistry,
    handleFallbackAddCustom: chain.handleFallbackAddCustom,
    handleSyncFallbackToHermes: fallbackConfig.handleSyncFallbackToHermes,
    handleImportFallbackFromConfig: chain.handleImportFallbackFromConfig,
    setEditingFallbackEntry: chain.setEditingFallbackEntry,
  };
}

// ═══════════════════════════════════════════════════════════════
// useHindsightModels — mental-models tab state + CRUD handlers.
// The list, the two modals and the delete are the shared tab shape
// (useHindsightCrudTab); the refresh is this tab's own.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import type { ToastType } from "@/components/ui/Toast";
import { parseOptionalTagsInput, parseTagsInput } from "@/lib/memory/hindsight-tag-input";
import { runWrite } from "@/lib/api/api-write";
import { useHindsightCrudTab, type HindsightCrudConfig } from "./useHindsightCrudTab";
import type { Tab, MentalModel } from "./types";

const EMPTY_MODEL_FORM = { name: "", query: "", tags: "" };
type ModelForm = typeof EMPTY_MODEL_FORM;

const MODELS_TAB: HindsightCrudConfig<MentalModel, ModelForm> = {
  tab: "mental-models",
  listKey: "models",
  deleteType: "model",
  noun: { title: "Mental model", lower: "mental model" },
  createdMessage: "Mental model created (generating in background)",
  emptyForm: EMPTY_MODEL_FORM,
  readyToCreate: (f) => Boolean(f.name.trim() && f.query.trim()),
  readyToSave: (f) => Boolean(f.name.trim()),
  createBody: (f) => ({
    action: "create-model",
    name: f.name,
    query: f.query,
    tags: parseOptionalTagsInput(f.tags),
  }),
  updateBody: (id, f) => ({
    action: "update-model",
    id,
    name: f.name,
    query: f.query || undefined,
    tags: parseTagsInput(f.tags),
  }),
  formOf: (m) => ({ name: m.name, query: m.source_query, tags: m.tags.join(", ") }),
};

type ShowToast = (message: string, type?: ToastType) => void;

export function useHindsightModels(showToast: ShowToast, activeTab: Tab) {
  const models = useHindsightCrudTab<MentalModel, ModelForm>(showToast, activeTab, MODELS_TAB);
  const [refreshingModelId, setRefreshingModelId] = useState<string | null>(null);

  const handleRefreshModel = async (id: string) => {
    await runWrite({
      setBusy: (busy) => setRefreshingModelId(busy ? id : null),
      showToast,
      url: "/api/memory/hindsight",
      body: { action: "refresh-model", id },
      successMessage: "Mental model refresh started",
      errorMessage: "Failed to refresh mental model",
      onSuccess: models.load,
    });
  };

  return {
    mentalModels: models.items,
    loadingModels: models.loading,
    showModelModal: models.showModal,
    modelForm: models.form,
    setModelForm: models.setForm,
    creatingModel: models.creating,
    editingModel: models.editing,
    editModelForm: models.editForm,
    setEditModelForm: models.setEditForm,
    savingModel: models.saving,
    refreshingModelId,
    loadModels: models.load,
    openModelModal: models.openModal,
    closeModelModal: models.closeModal,
    closeEditModel: models.closeEdit,
    openEditModel: models.openEdit,
    handleCreateModel: models.handleCreate,
    handleRefreshModel,
    handleDeleteModel: models.handleDelete,
    handleSaveModel: models.handleSave,
  };
}

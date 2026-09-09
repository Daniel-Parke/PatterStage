// ═══════════════════════════════════════════════════════════════
// useHindsightModels — mental-models tab state + CRUD handlers.
// Self-gates its load effect on activeTab === "mental-models".
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback, useEffect } from "react";
import type { ToastType } from "@/components/ui/Toast";
import { loadHindsightList } from "@/lib/memory/hindsight-client";
import { parseOptionalTagsInput, parseTagsInput } from "@/lib/memory/hindsight-tag-input";
import { runWrite } from "@/lib/api-write";
import type { Tab, MentalModel } from "./types";

const EMPTY_MODEL_FORM = { name: "", query: "", tags: "" };
type ModelForm = typeof EMPTY_MODEL_FORM;

type ShowToast = (message: string, type?: ToastType) => void;

export function useHindsightModels(showToast: ShowToast, activeTab: Tab) {
  const [mentalModels, setMentalModels] = useState<MentalModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [modelForm, setModelForm] = useState<ModelForm>(EMPTY_MODEL_FORM);
  const [creatingModel, setCreatingModel] = useState(false);
  const [editingModel, setEditingModel] = useState<MentalModel | null>(null);
  const [editModelForm, setEditModelForm] = useState<ModelForm>(EMPTY_MODEL_FORM);
  const [savingModel, setSavingModel] = useState(false);
  const [refreshingModelId, setRefreshingModelId] = useState<string | null>(null);

  const loadModels = useCallback(async () => {
    await loadHindsightList<MentalModel>(
      "mental-models",
      setLoadingModels,
      "models",
      setMentalModels,
      showToast,
    );
  }, [showToast]);

  useEffect(() => {
    if (activeTab === "mental-models") void loadModels();
  }, [activeTab, loadModels]);

  const openModelModal = useCallback(
    () => setShowModelModal(true),
    [setShowModelModal],
  );
  const closeModelModal = useCallback(() => {
    setShowModelModal(false);
    setModelForm(EMPTY_MODEL_FORM);
  }, [setShowModelModal]);
  const closeEditModel = useCallback(
    () => setEditingModel(null),
    [setEditingModel],
  );

  const handleCreateModel = async () => {
    if (!modelForm.name.trim() || !modelForm.query.trim()) return false;
    const created = await runWrite({
      setBusy: setCreatingModel,
      showToast,
      url: "/api/memory/hindsight",
      body: {
        action: "create-model",
        name: modelForm.name,
        query: modelForm.query,
        tags: parseOptionalTagsInput(modelForm.tags),
      },
      successMessage: "Mental model created (generating in background)",
      errorMessage: "Failed to create mental model",
      onSuccess: async () => {
        closeModelModal();
        await loadModels();
      },
    });
    return created !== undefined;
  };

  const handleRefreshModel = async (id: string) => {
    await runWrite({
      setBusy: (busy) => setRefreshingModelId(busy ? id : null),
      showToast,
      url: "/api/memory/hindsight",
      body: { action: "refresh-model", id },
      successMessage: "Mental model refresh started",
      errorMessage: "Failed to refresh mental model",
      onSuccess: loadModels,
    });
  };

  const handleDeleteModel = async (id: string) => {
    await runWrite({
      showToast,
      url: "/api/memory/hindsight",
      method: "DELETE",
      body: { type: "model", id },
      successMessage: "Mental model deleted",
      errorMessage: "Failed to delete mental model",
      onSuccess: () => setMentalModels((prev) => prev.filter((m) => m.id !== id)),
    });
  };

  const openEditModel = (m: MentalModel) => {
    setEditingModel(m);
    setEditModelForm({ name: m.name, query: m.source_query, tags: m.tags.join(", ") });
  };

  const handleSaveModel = async () => {
    if (!editingModel) return false;
    if (!editModelForm.name.trim()) return false;
    const saved = await runWrite({
      setBusy: setSavingModel,
      showToast,
      url: "/api/memory/hindsight",
      body: {
        action: "update-model",
        id: editingModel.id,
        name: editModelForm.name,
        query: editModelForm.query || undefined,
        tags: parseTagsInput(editModelForm.tags),
      },
      successMessage: "Mental model updated",
      errorMessage: "Failed to update mental model",
      onSuccess: async () => {
        setEditingModel(null);
        await loadModels();
      },
    });
    return saved !== undefined;
  };

  return {
    mentalModels,
    loadingModels,
    showModelModal,
    modelForm,
    setModelForm,
    creatingModel,
    editingModel,
    editModelForm,
    setEditModelForm,
    savingModel,
    refreshingModelId,
    loadModels,
    openModelModal,
    closeModelModal,
    closeEditModel,
    openEditModel,
    handleCreateModel,
    handleRefreshModel,
    handleDeleteModel,
    handleSaveModel,
  };
}

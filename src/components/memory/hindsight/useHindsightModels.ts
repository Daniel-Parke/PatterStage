// ═══════════════════════════════════════════════════════════════
// useHindsightModels — mental-models tab state + CRUD handlers.
// Extracted verbatim from HindsightBrowser. Self-gates its load effect
// on activeTab === "mental-models".
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback, useEffect } from "react";
import type { ToastType } from "@/components/ui/Toast";
import { loadHindsightList } from "@/lib/memory/hindsight-client";
import { hindsightMutate } from "@/lib/memory/hindsight-mutate";
import { parseOptionalTagsInput, parseTagsInput } from "@/lib/memory/hindsight-tag-input";
import { runMutation } from "@/lib/run-mutation";
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
    // Sister to `loadDirectives` — same `loadHindsightList` helper, just
    // with the `mental-models` action + `models` key.
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

  const handleCreateModel = () =>
    runMutation(showToast, {
      isValid: () => modelForm.name.trim().length > 0 && modelForm.query.trim().length > 0,
      busy: setCreatingModel,
      build: () => ({
        action: "create-model",
        name: modelForm.name,
        query: modelForm.query,
        tags: parseOptionalTagsInput(modelForm.tags),
      }),
      path: "/api/memory/hindsight",
      successMsg: "Mental model created (generating in background)",
      errorMsg: "Failed to create mental model",
      onSuccess: async () => {
        closeModelModal();
        await loadModels();
      },
    });

  const handleRefreshModel = async (id: string) => {
    setRefreshingModelId(id);
    const result = await hindsightMutate(
      showToast,
      "POST",
      { action: "refresh-model", id },
      "Mental model refresh started",
      "Failed to refresh mental model",
    );
    if (!result.ok) {
      setRefreshingModelId(null);
      return;
    }
    await loadModels();
    setRefreshingModelId(null);
  };

  const handleDeleteModel = async (id: string) => {
    const result = await hindsightMutate(
      showToast,
      "DELETE",
      { type: "model", id },
      "Mental model deleted",
      "Failed to delete mental model",
    );
    if (!result.ok) return;
    setMentalModels(prev => prev.filter(m => m.id !== id));
  };

  const openEditModel = (m: MentalModel) => {
    setEditingModel(m);
    setEditModelForm({ name: m.name, query: m.source_query, tags: m.tags.join(", ") });
  };

  const handleSaveModel = () => {
    if (!editingModel) return false;
    return runMutation(showToast, {
      isValid: () => editModelForm.name.trim().length > 0,
      busy: setSavingModel,
      build: () => ({
        action: "update-model",
        id: editingModel.id,
        name: editModelForm.name,
        query: editModelForm.query || undefined,
        tags: parseTagsInput(editModelForm.tags),
      }),
      path: "/api/memory/hindsight",
      successMsg: "Mental model updated",
      errorMsg: "Failed to update mental model",
      onSuccess: async () => {
        setEditingModel(null);
        await loadModels();
      },
    });
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

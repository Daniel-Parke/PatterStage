// ═══════════════════════════════════════════════════════════════
// useHindsightDirectives — directives tab state + CRUD handlers.
// Extracted verbatim from HindsightBrowser. Self-gates its load effect
// on activeTab === "directives".
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback, useEffect } from "react";
import type { ToastType } from "@/components/ui/Toast";
import { loadHindsightList } from "@/lib/memory/hindsight-client";
import { hindsightMutate } from "@/lib/memory/hindsight-mutate";
import { parseOptionalTagsInput, parseTagsInput } from "@/lib/memory/hindsight-tag-input";
import { runMutation } from "@/lib/run-mutation";
import type { Tab, Directive } from "./types";

// The directive modal resets to these blank values on open, close, and
// successful save — a module constant keeps the 6 reset sites in lockstep.
const EMPTY_DIR_FORM = { name: "", content: "", priority: "0", tags: "" };
type DirForm = typeof EMPTY_DIR_FORM;

type ShowToast = (message: string, type?: ToastType) => void;

export function useHindsightDirectives(showToast: ShowToast, activeTab: Tab) {
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [loadingDirectives, setLoadingDirectives] = useState(false);
  const [showDirectiveModal, setShowDirectiveModal] = useState(false);
  const [dirForm, setDirForm] = useState<DirForm>(EMPTY_DIR_FORM);
  const [creatingDirective, setCreatingDirective] = useState(false);
  const [editingDirective, setEditingDirective] = useState<Directive | null>(null);
  const [editDirForm, setEditDirForm] = useState<DirForm>(EMPTY_DIR_FORM);
  const [savingDirective, setSavingDirective] = useState(false);

  const loadDirectives = useCallback(async () => {
    // Compose the GET fetch + busy-state toggle + server-error toast
    // + empty-state reset via the shared `loadHindsightList` helper.
    await loadHindsightList<Directive>(
      "directives",
      setLoadingDirectives,
      "directives",
      setDirectives,
      showToast,
    );
  }, [showToast]);

  useEffect(() => {
    if (activeTab === "directives") void loadDirectives();
  }, [activeTab, loadDirectives]);

  const openDirectiveModal = useCallback(
    () => setShowDirectiveModal(true),
    [setShowDirectiveModal],
  );
  const closeDirectiveModal = useCallback(() => {
    setShowDirectiveModal(false);
    setDirForm(EMPTY_DIR_FORM);
  }, [setShowDirectiveModal]);
  const closeEditDirective = useCallback(
    () => setEditingDirective(null),
    [setEditingDirective],
  );

  const handleCreateDirective = () =>
    runMutation(showToast, {
      isValid: () => dirForm.name.trim().length > 0 && dirForm.content.trim().length > 0,
      busy: setCreatingDirective,
      build: () => ({
        action: "create-directive",
        name: dirForm.name,
        content: dirForm.content,
        priority: parseInt(dirForm.priority) || 0,
        tags: parseOptionalTagsInput(dirForm.tags),
      }),
      path: "/api/memory/hindsight",
      successMsg: "Directive created",
      errorMsg: "Failed to create directive",
      onSuccess: async () => {
        closeDirectiveModal();
        await loadDirectives();
      },
    });

  const handleToggleDirective = async (directive: Directive) => {
    // Dynamic success message (deactivated vs activated) — `hindsightMutate`
    // forwards the `successMsg: () => string` thunk to `toastFromResult`
    // unchanged, so the directive.is_active state is read at toast time,
    // not at request time. Same semantics as the pre-form inline call.
    const result = await hindsightMutate(
      showToast,
      "POST",
      { action: "update-directive", id: directive.id, is_active: !directive.is_active },
      () => (directive.is_active ? "Directive deactivated" : "Directive activated"),
      "Failed to update directive",
    );
    if (!result.ok) return;
    await loadDirectives();
  };

  const handleDeleteDirective = async (id: string) => {
    const result = await hindsightMutate(
      showToast,
      "DELETE",
      { type: "directive", id },
      "Directive deleted",
      "Failed to delete directive",
    );
    if (!result.ok) return;
    setDirectives(prev => prev.filter(d => d.id !== id));
  };

  const openEditDirective = (d: Directive) => {
    setEditingDirective(d);
    setEditDirForm({ name: d.name, content: d.content, priority: String(d.priority), tags: d.tags.join(", ") });
  };

  const handleSaveDirective = () => {
    if (!editingDirective) return false;
    return runMutation(showToast, {
      isValid: () => editDirForm.name.trim().length > 0 && editDirForm.content.trim().length > 0,
      busy: setSavingDirective,
      build: () => ({
        action: "update-directive",
        id: editingDirective.id,
        name: editDirForm.name,
        content: editDirForm.content,
        priority: parseInt(editDirForm.priority) || 0,
        tags: parseTagsInput(editDirForm.tags),
      }),
      path: "/api/memory/hindsight",
      successMsg: "Directive updated",
      errorMsg: "Failed to update directive",
      onSuccess: async () => {
        setEditingDirective(null);
        await loadDirectives();
      },
    });
  };

  return {
    directives,
    loadingDirectives,
    showDirectiveModal,
    dirForm,
    setDirForm,
    creatingDirective,
    editingDirective,
    editDirForm,
    setEditDirForm,
    savingDirective,
    loadDirectives,
    openDirectiveModal,
    closeDirectiveModal,
    closeEditDirective,
    openEditDirective,
    handleCreateDirective,
    handleToggleDirective,
    handleDeleteDirective,
    handleSaveDirective,
  };
}

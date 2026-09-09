// ═══════════════════════════════════════════════════════════════
// useHindsightDirectives — directives tab state + CRUD handlers.
// Extracted verbatim from HindsightBrowser. Self-gates its load effect
// on activeTab === "directives".
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback, useEffect } from "react";
import type { ToastType } from "@/components/ui/Toast";
import { loadHindsightList } from "@/lib/memory/hindsight-client";
import { parseOptionalTagsInput, parseTagsInput } from "@/lib/memory/hindsight-tag-input";
import { runWrite } from "@/lib/api-write";
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

  const handleCreateDirective = async () => {
    if (!dirForm.name.trim() || !dirForm.content.trim()) return false;
    const created = await runWrite({
      setBusy: setCreatingDirective,
      showToast,
      url: "/api/memory/hindsight",
      body: {
        action: "create-directive",
        name: dirForm.name,
        content: dirForm.content,
        priority: parseInt(dirForm.priority) || 0,
        tags: parseOptionalTagsInput(dirForm.tags),
      },
      successMessage: "Directive created",
      errorMessage: "Failed to create directive",
      onSuccess: async () => {
        closeDirectiveModal();
        await loadDirectives();
      },
    });
    return created !== undefined;
  };

  const handleToggleDirective = async (directive: Directive) => {
    await runWrite({
      showToast,
      url: "/api/memory/hindsight",
      body: { action: "update-directive", id: directive.id, is_active: !directive.is_active },
      successMessage: directive.is_active ? "Directive deactivated" : "Directive activated",
      errorMessage: "Failed to update directive",
      onSuccess: loadDirectives,
    });
  };

  const handleDeleteDirective = async (id: string) => {
    await runWrite({
      showToast,
      url: "/api/memory/hindsight",
      method: "DELETE",
      body: { type: "directive", id },
      successMessage: "Directive deleted",
      errorMessage: "Failed to delete directive",
      onSuccess: () => setDirectives((prev) => prev.filter((d) => d.id !== id)),
    });
  };

  const openEditDirective = (d: Directive) => {
    setEditingDirective(d);
    setEditDirForm({ name: d.name, content: d.content, priority: String(d.priority), tags: d.tags.join(", ") });
  };

  const handleSaveDirective = async () => {
    if (!editingDirective) return false;
    if (!editDirForm.name.trim() || !editDirForm.content.trim()) return false;
    const saved = await runWrite({
      setBusy: setSavingDirective,
      showToast,
      url: "/api/memory/hindsight",
      body: {
        action: "update-directive",
        id: editingDirective.id,
        name: editDirForm.name,
        content: editDirForm.content,
        priority: parseInt(editDirForm.priority) || 0,
        tags: parseTagsInput(editDirForm.tags),
      },
      successMessage: "Directive updated",
      errorMessage: "Failed to update directive",
      onSuccess: async () => {
        setEditingDirective(null);
        await loadDirectives();
      },
    });
    return saved !== undefined;
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

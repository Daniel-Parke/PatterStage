// ═══════════════════════════════════════════════════════════════
// useHindsightDirectives — directives tab state + CRUD handlers.
// The list, the two modals and the delete are the shared tab shape
// (useHindsightCrudTab); the activate/deactivate toggle is this
// tab's own.
// ═══════════════════════════════════════════════════════════════

"use client";

import type { ToastType } from "@/components/ui/Toast";
import { parseOptionalTagsInput, parseTagsInput } from "@/lib/memory/hindsight-tag-input";
import { runWrite } from "@/lib/api/api-write";
import { useHindsightCrudTab, type HindsightCrudConfig } from "./useHindsightCrudTab";
import type { Tab, Directive } from "./types";

// The directive modal resets to these blank values on open, close, and
// successful save — a module constant keeps the reset sites in lockstep.
const EMPTY_DIR_FORM = { name: "", content: "", priority: "0", tags: "" };
type DirForm = typeof EMPTY_DIR_FORM;

const DIRECTIVES_TAB: HindsightCrudConfig<Directive, DirForm> = {
  tab: "directives",
  listKey: "directives",
  deleteType: "directive",
  noun: { title: "Directive", lower: "directive" },
  createdMessage: "Directive created",
  emptyForm: EMPTY_DIR_FORM,
  readyToCreate: (f) => Boolean(f.name.trim() && f.content.trim()),
  readyToSave: (f) => Boolean(f.name.trim() && f.content.trim()),
  createBody: (f) => ({
    action: "create-directive",
    name: f.name,
    content: f.content,
    priority: parseInt(f.priority) || 0,
    tags: parseOptionalTagsInput(f.tags),
  }),
  updateBody: (id, f) => ({
    action: "update-directive",
    id,
    name: f.name,
    content: f.content,
    priority: parseInt(f.priority) || 0,
    tags: parseTagsInput(f.tags),
  }),
  formOf: (d) => ({
    name: d.name,
    content: d.content,
    priority: String(d.priority),
    tags: d.tags.join(", "),
  }),
};

type ShowToast = (message: string, type?: ToastType) => void;

export function useHindsightDirectives(showToast: ShowToast, activeTab: Tab) {
  const dirs = useHindsightCrudTab<Directive, DirForm>(showToast, activeTab, DIRECTIVES_TAB);

  const handleToggleDirective = async (directive: Directive) => {
    await runWrite({
      showToast,
      url: "/api/memory/hindsight",
      body: { action: "update-directive", id: directive.id, is_active: !directive.is_active },
      successMessage: directive.is_active ? "Directive deactivated" : "Directive activated",
      errorMessage: "Failed to update directive",
      onSuccess: dirs.load,
    });
  };

  return {
    directives: dirs.items,
    loadingDirectives: dirs.loading,
    showDirectiveModal: dirs.showModal,
    dirForm: dirs.form,
    setDirForm: dirs.setForm,
    creatingDirective: dirs.creating,
    editingDirective: dirs.editing,
    editDirForm: dirs.editForm,
    setEditDirForm: dirs.setEditForm,
    savingDirective: dirs.saving,
    loadDirectives: dirs.load,
    openDirectiveModal: dirs.openModal,
    closeDirectiveModal: dirs.closeModal,
    closeEditDirective: dirs.closeEdit,
    openEditDirective: dirs.openEdit,
    handleCreateDirective: dirs.handleCreate,
    handleToggleDirective,
    handleDeleteDirective: dirs.handleDelete,
    handleSaveDirective: dirs.handleSave,
  };
}

// ═══════════════════════════════════════════════════════════════
// useHindsightCrudTab — the shape the directives and mental-models
// tabs share: a list loaded when its tab is showing, a create modal,
// an edit modal, and a delete. The two public hooks keep their own
// names and their own extras (a refresh, a toggle) on top of it.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback, useEffect } from "react";
import type { ToastType } from "@/components/ui/Toast";
import { loadHindsightList } from "@/lib/memory/hindsight-client";
import { runWrite } from "@/lib/api/api-write";
import type { Tab } from "./types";

type ShowToast = (message: string, type?: ToastType) => void;

const HINDSIGHT_URL = "/api/memory/hindsight";

/** What one tab is, said once: its endpoint, its subject, its payloads. */
export interface HindsightCrudConfig<TItem, TForm> {
  /** The tab's own id: the list action to GET, and the gate on the load. */
  tab: Exclude<Tab, "memories">;
  /** The key the list payload answers under. */
  listKey: "directives" | "models";
  /** The `type` a DELETE carries. */
  deleteType: string;
  /** The subject, as a sentence opens it and as a sentence continues it. */
  noun: { title: string; lower: string };
  /** What a create says: a mental model adds that it is still generating. */
  createdMessage: string;
  /** The blank form the modal opens and closes on. */
  emptyForm: TForm;
  /** Whether the create form carries enough to send. */
  readyToCreate: (form: TForm) => boolean;
  /** Whether the edit form carries enough to send. */
  readyToSave: (form: TForm) => boolean;
  createBody: (form: TForm) => Record<string, unknown>;
  updateBody: (id: string, form: TForm) => Record<string, unknown>;
  /** The edit form an item opens with. */
  formOf: (item: TItem) => TForm;
}

export function useHindsightCrudTab<TItem extends { id: string }, TForm>(
  showToast: ShowToast,
  activeTab: Tab,
  config: HindsightCrudConfig<TItem, TForm>,
) {
  const { tab, listKey, deleteType, noun, emptyForm } = config;

  const [items, setItems] = useState<TItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<TForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TItem | null>(null);
  const [editForm, setEditForm] = useState<TForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    await loadHindsightList<TItem>(tab, setLoading, listKey, setItems, showToast);
  }, [tab, listKey, showToast]);

  useEffect(() => {
    if (activeTab === tab) void load();
  }, [activeTab, tab, load]);

  const openModal = useCallback(() => setShowModal(true), [setShowModal]);
  const closeModal = useCallback(() => {
    setShowModal(false);
    setForm(emptyForm);
  }, [setShowModal, emptyForm]);
  const closeEdit = useCallback(() => setEditing(null), [setEditing]);

  const openEdit = (item: TItem) => {
    setEditing(item);
    setEditForm(config.formOf(item));
  };

  const handleCreate = async () => {
    if (!config.readyToCreate(form)) return false;
    const created = await runWrite({
      setBusy: setCreating,
      showToast,
      url: HINDSIGHT_URL,
      body: config.createBody(form),
      successMessage: config.createdMessage,
      errorMessage: `Failed to create ${noun.lower}`,
      onSuccess: async () => {
        closeModal();
        await load();
      },
    });
    return created !== undefined;
  };

  const handleSave = async () => {
    if (!editing) return false;
    if (!config.readyToSave(editForm)) return false;
    const saved = await runWrite({
      setBusy: setSaving,
      showToast,
      url: HINDSIGHT_URL,
      body: config.updateBody(editing.id, editForm),
      successMessage: `${noun.title} updated`,
      errorMessage: `Failed to update ${noun.lower}`,
      onSuccess: async () => {
        setEditing(null);
        await load();
      },
    });
    return saved !== undefined;
  };

  const handleDelete = async (id: string) => {
    await runWrite({
      showToast,
      url: HINDSIGHT_URL,
      method: "DELETE",
      body: { type: deleteType, id },
      successMessage: `${noun.title} deleted`,
      errorMessage: `Failed to delete ${noun.lower}`,
      onSuccess: () => setItems((prev) => prev.filter((one) => one.id !== id)),
    });
  };

  return {
    items,
    loading,
    showModal,
    form,
    setForm,
    creating,
    editing,
    editForm,
    setEditForm,
    saving,
    load,
    openModal,
    closeModal,
    closeEdit,
    openEdit,
    handleCreate,
    handleSave,
    handleDelete,
  };
}

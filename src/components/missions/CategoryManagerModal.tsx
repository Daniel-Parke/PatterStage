"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { CATEGORY_COLOR_CLASSES } from "@/lib/missions/mission-categories";

export interface ManagedCategory {
  id: string;
  name: string;
  color: string;
  seedKey?: string | null;
  missionCount: number;
  templateCount: number;
}

export interface CategoryManagerModalProps {
  open: boolean;
  onClose: () => void;
  categories: ManagedCategory[];
  categoriesLoadError?: string | null;
  onRefresh: () => void;
  onCreateCategory: (name: string, color?: string) => Promise<string | null>;
  /** Answers whether the write landed; a refused rename leaves the editor open. */
  onUpdate: (
    id: string,
    patch: { name?: string; color?: string },
  ) => Promise<boolean>;
  onDelete: (id: string, reassignToId: string | null) => Promise<boolean>;
}

const COLORS = ["cyan", "purple", "pink", "green", "orange", "blue", "red"];

export default function CategoryManagerModal({
  open,
  onClose,
  categories,
  categoriesLoadError = null,
  onRefresh,
  onCreateCategory,
  onUpdate,
  onDelete,
}: CategoryManagerModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("cyan");
  const [reassignId, setReassignId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("cyan");
  const [creating, setCreating] = useState(false);

  const startEdit = (c: ManagedCategory) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditColor(c.color);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    // Only close what succeeded. A failed rename leaves the typed name in the
    // input to retry, which is the difference between a silent no-op and a
    // failure (T-0104, D71).
    if (!(await onUpdate(editingId, { name: editName, color: editColor }))) return;
    setEditingId(null);
    onRefresh();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (!(await onDelete(deleteTarget, reassignId))) return;
    setDeleteTarget(null);
    setReassignId(null);
    onRefresh();
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const id = await onCreateCategory(name, newColor);
      if (id) {
        setNewName("");
        setNewColor("cyan");
        onRefresh();
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Manage categories" size="lg">
      <div className="mb-4 p-3 rounded-lg border border-white/10 bg-dark-900/50 space-y-2">
        <label className="text-xs text-ps-text-muted font-mono block">
          New category
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="Category name" aria-label="New category name"
            className="flex-1 min-w-[140px] h-9 px-3 text-sm font-mono bg-dark-950 border border-white/10 rounded-lg text-ps-text-primary"
          />
          <select aria-label="Category colour"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-9 px-2 text-xs font-mono bg-dark-950 border border-white/10 rounded-lg"
          >
            {COLORS.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!newName.trim() || creating}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-mono border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            Create category
          </button>
        </div>
      </div>

      {categoriesLoadError && (
        <div className="mb-4 p-3 rounded-lg border border-neon-orange/30 bg-neon-orange/5 text-xs font-mono text-neon-orange/90">
          {categoriesLoadError}
          <button
            type="button"
            onClick={() => onRefresh()}
            className="ml-2 text-neon-cyan underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {categories.length === 0 && !categoriesLoadError && (
          <p className="text-xs font-mono text-ps-text-muted py-4 text-center">
            No categories yet. Create one above, or run{" "}
            <code className="text-neon-cyan">npm run db:migrate</code> if you
            upgraded from an older install.
          </p>
        )}
        {categories.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2 p-2 rounded-lg border border-white/10 bg-dark-900/50"
          >
            {editingId === c.id ? (
              <div className="flex-1 flex flex-wrap gap-2 items-center">
                <input aria-label="Category name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 min-w-[120px] px-2 py-1 text-xs font-mono bg-dark-950 border border-white/10 rounded"
                />
                <select aria-label="Category colour"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="px-2 py-1 text-xs font-mono bg-dark-950 border border-white/10 rounded"
                >
                  {COLORS.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  className="text-xs font-mono text-neon-cyan"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-xs font-mono text-ps-text-muted"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    CATEGORY_COLOR_CLASSES[c.color]?.split(" ")[0] ??
                    "bg-neon-cyan/30"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono text-ps-text-primary truncate">
                    {c.name}
                    {c.seedKey ? (
                      <span className="text-ps-text-muted ml-1">(default)</span>
                    ) : null}
                  </div>
                  <div className="text-xs font-mono text-ps-text-muted">
                    {c.missionCount} missions · {c.templateCount} templates
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Rename category ${c.name}`}
                  onClick={() => startEdit(c)}
                  className="p-1 text-ps-text-muted hover:text-neon-cyan"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete category ${c.name}`}
                  onClick={() => {
                    setDeleteTarget(c.id);
                    setReassignId(null);
                  }}
                  className="p-1 text-ps-text-muted hover:text-red-400"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
              </>
            )}
          </div>
        ))}
      </div>

      {deleteTarget && (
        <div className="mt-4 p-3 rounded-lg border border-red-500/30 bg-red-500/5">
          <p className="text-xs font-mono text-ps-text-secondary mb-2">
            Reassign missions and templates before deleting:
          </p>
          <select aria-label="Reassign missions to category"
            value={reassignId ?? ""}
            onChange={(e) =>
              setReassignId(e.target.value === "" ? null : e.target.value)
            }
            className="w-full mb-2 px-2 py-1.5 text-xs font-mono bg-dark-950 border border-white/10 rounded"
          >
            <option value="">Uncategorized</option>
            {categories
              .filter((c) => c.id !== deleteTarget)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void confirmDelete()}
              className="px-3 py-1.5 text-xs font-mono bg-red-500/20 text-red-300 rounded"
            >
              Delete category
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-3 py-1.5 text-xs font-mono text-ps-text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import IconButton from "@/components/ui/IconButton";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import Modal from "@/components/ui/Modal";
import { InlineSelect } from "@/components/ui/Select";
import { Input } from "@/components/ui/field";
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
const COLOR_OPTIONS = COLORS.map((col) => ({ value: col, label: col }));

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
      <Card padding="sm" className="mb-4 space-y-2">
        <label className="text-micro text-ps-text-muted font-mono block">
          New category
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="Category name"
            aria-label="New category name"
            className="flex-1 min-w-[140px] font-mono"
          />
          <InlineSelect
            ariaLabel="Category colour"
            value={newColor}
            onChange={setNewColor}
            options={COLOR_OPTIONS}
            className="w-32"
          />
          <Button
            variant="primary"
            color="cyan"
            icon={Plus}
            onClick={() => void handleCreate()}
            disabled={!newName.trim() || creating}
          >
            Create category
          </Button>
        </div>
      </Card>

      {categoriesLoadError && (
        <LoadErrorBanner error={categoriesLoadError} onRetry={onRefresh} />
      )}

      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {categories.length === 0 && !categoriesLoadError && (
          <p className="text-micro font-mono text-ps-text-muted py-4 text-center">
            No categories yet. Create one above, or run{" "}
            <code className="text-neon-cyan">npm run db:migrate</code> if you
            upgraded from an older install.
          </p>
        )}
        {categories.map((c) => (
          <Card key={c.id} padding="none" className="flex items-center gap-2 p-2">
            {editingId === c.id ? (
              <div className="flex-1 flex flex-wrap gap-2 items-center">
                <Input
                  aria-label="Category name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 min-w-[120px] font-mono"
                />
                <InlineSelect
                  ariaLabel="Category colour"
                  value={editColor}
                  onChange={setEditColor}
                  options={COLOR_OPTIONS}
                  className="w-32"
                />
                <Button variant="ghost" size="sm" onClick={() => void saveEdit()}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
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
                  <div className="text-body font-mono text-ps-text-primary truncate">
                    {c.name}
                    {c.seedKey ? (
                      <span className="text-ps-text-muted ml-1">(default)</span>
                    ) : null}
                  </div>
                  <div className="text-micro font-mono text-ps-text-muted">
                    {c.missionCount} missions · {c.templateCount} templates
                  </div>
                </div>
                <IconButton
                  icon={Pencil}
                  label={`Rename category ${c.name}`}
                  size="sm"
                  onClick={() => startEdit(c)}
                />
                <IconButton
                  icon={Trash2}
                  label={`Delete category ${c.name}`}
                  size="sm"
                  onClick={() => {
                    setDeleteTarget(c.id);
                    setReassignId(null);
                  }}
                />
              </>
            )}
          </Card>
        ))}
      </div>

      {deleteTarget && (
        <Card padding="sm" className="mt-4 space-y-2">
          <p className="text-micro font-mono text-status-fail">
            Reassign missions and templates before deleting:
          </p>
          <InlineSelect
            ariaLabel="Reassign missions to category"
            value={reassignId ?? ""}
            onChange={(v) => setReassignId(v === "" ? null : v)}
            options={[
              { value: "", label: "Uncategorized" },
              ...categories
                .filter((c) => c.id !== deleteTarget)
                .map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={() => void confirmDelete()}>
              Delete category
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}
    </Modal>
  );
}

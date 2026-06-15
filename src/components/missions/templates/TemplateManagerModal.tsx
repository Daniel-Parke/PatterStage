// ═══════════════════════════════════════════════════════════════
// TemplateManagerModal — the "Edit Templates" manager (grouped list +
// per-row two-step delete). Extracted verbatim from TemplateModals.tsx.
// ═══════════════════════════════════════════════════════════════

"use client";

import { Edit3, Layers, Plus, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import CategoryAccordion from "@/components/ui/CategoryAccordion";
import Modal from "@/components/ui/Modal";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import {
  groupTemplatesByCategory,
  type CategoryLike,
} from "@/lib/mission-categories";
import type { MissionTemplate } from "./types";

interface TemplateManagerModalProps {
  open: boolean;
  onClose: () => void;
  templates: MissionTemplate[];
  categories: CategoryLike[];
  categoryFilter: string;
  onEditTemplate: (t: MissionTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onCreateTemplate: () => void;
}

// ── Per-Template Row (owns its own two-step delete confirm) ──
//
// Each row has its own `useTwoStepConfirm({ autoDismissMs: 4000 })` instance
// so a stale "armed" state from one row cannot fire when the user later
// clicks a different row's delete button. By the time onDelete runs, the
// user has already confirmed in the leaf. Sister to the per-row confirms in
// MissionEditorPanel + PerRowDeleteButton.
function TemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: MissionTemplate;
  onEdit: (t: MissionTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const deleteConfirm = useTwoStepConfirm({ autoDismissMs: 4000 });
  const isArmed = deleteConfirm.isArmedFor(template.id);
  const handleDeleteClick = () => {
    if (!isArmed) {
      deleteConfirm.arm(template.id);
      return;
    }
    void deleteConfirm.confirm(() => onDelete(template.id));
  };
  return (
    <div
      className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 bg-dark-800/30 hover:border-white/10 transition-colors group"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="text-sm text-white/80 truncate">{template.name}</div>
        {!template.isCustom && (
          <span className="text-[9px] font-mono text-white/15 flex-shrink-0">
            built-in
          </span>
        )}
      </div>
      {template.isCustom && (
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(template)}
            className="p-1.5 rounded text-white/40 hover:text-neon-cyan hover:bg-cyan-500/10 transition-colors"
            title="Edit"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDeleteClick}
            className={`p-1.5 rounded transition-colors ${
              isArmed
                ? "text-neon-red bg-neon-red/15 ring-1 ring-neon-red/40"
                : "text-white/40 hover:text-red-400 hover:bg-red-500/10"
            }`}
            title={isArmed ? "Click again to confirm" : "Delete"}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function TemplateManagerModal({
  open,
  onClose,
  templates,
  categories,
  categoryFilter,
  onEditTemplate,
  onDeleteTemplate,
  onCreateTemplate,
}: TemplateManagerModalProps) {
  const grouped = groupTemplatesByCategory(templates, categories);
  const isEmpty = templates.length === 0 || grouped.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Templates"
      icon={Layers}
      iconColor="text-neon-cyan"
      size="lg"
      footer={
        <div className="flex flex-wrap gap-2 justify-end w-full">
          <Button variant="secondary" onClick={onCreateTemplate}>
            <Plus className="w-3.5 h-3.5" />
            New template
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        {isEmpty && (
          <div className="py-8 text-center space-y-3">
            <p className="text-xs font-mono text-white/40">
              No templates to show. Built-in templates load from the server —
              if this stays empty, check the browser console and restart Control
              Hub after <code className="text-neon-cyan">npm run db:migrate</code>.
            </p>
            <Button onClick={onCreateTemplate}>
              <Plus className="w-3.5 h-3.5" />
              New custom template
            </Button>
          </div>
        )}
        {grouped.map((group) => {
          const filterKey = group.categoryId ?? "__uncategorized__";
          const color = group.color;
          return (
            <CategoryAccordion
              key={filterKey}
              name={group.label}
              count={group.items.length}
              color={color}
              defaultOpen={
                categoryFilter === "all"
                  ? group.items.some((t) => t.isCustom)
                  : categoryFilter === filterKey
              }
            >
                <div className="space-y-1.5">
                  {group.items.map((t) => (
                    <TemplateRow
                      key={t.id}
                      template={t}
                      onEdit={onEditTemplate}
                      onDelete={onDeleteTemplate}
                    />
                  ))}
                </div>
              </CategoryAccordion>
            );
          })}
      </div>
    </Modal>
  );
}

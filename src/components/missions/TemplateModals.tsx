// ═══════════════════════════════════════════════════════════════
// TemplateModals — Template Manager & Template Editor modals
// Extracted from missions/page.tsx for modularity.
// ═══════════════════════════════════════════════════════════════

"use client";

import {
  Edit3,
  Layers,
  Plus,
  Save,
  Trash2,
  X,
  Zap,
  Search,
  Bug,
  GitPullRequest,
  Wrench,
  PenTool,
  Rocket,
  Cpu,
  Activity,
  Shield,
  Terminal,
  Database,
  Globe,
  Code,
  FileText,
  Bot,
  RefreshCw,
} from "lucide-react";
import AutoTextarea from "@/components/ui/AutoTextarea";
import Button from "@/components/ui/Button";
import CategoryAccordion from "@/components/ui/CategoryAccordion";
import Modal from "@/components/ui/Modal";
import AgentRuntimeDefaultsCard from "@/components/missions/AgentRuntimeDefaultsCard";
import CategoryCombobox, {
  type CategoryOption,
} from "@/components/missions/CategoryCombobox";
import LocalDirRow from "@/components/missions/LocalDirRow";
import { useTwoStepConfirm } from "@/hooks/useTwoStepConfirm";
import { inputFieldClasses } from "@/lib/theme";
import {
  groupTemplatesByCategory,
  type CategoryLike,
} from "@/lib/mission-categories";
import type { LocalDirEntry } from "@/types/hermes";
import { commitLocalDirDraft } from "@/lib/local-dir-entry";

// ── Types ─────────────────────────────────────────────────────

export interface MissionTemplate {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: string;
  profile: string;
  description: string;
  instruction: string;
  context: string;
  goals: string[];
  suggestedSkills: string[];
  suggestedToolsets?: string[];
  localDirs?: LocalDirEntry[];
  references?: string[];
  isCustom?: boolean;
  dispatchMode?: string;
  schedule?: string;
  defaultModel?: string;
  defaultProvider?: string;
  timeoutMinutes?: number;
  outputFormat?: string;
  constraints?: string;
}

// ── Constants (mirrored from missions/page.tsx) ────────────────

const TEMPLATE_ICONS = [
  "Search",
  "Bug",
  "GitPullRequest",
  "Wrench",
  "PenTool",
  "Zap",
  "Rocket",
  "Cpu",
  "Activity",
  "Shield",
  "Terminal",
  "Database",
  "Globe",
  "Code",
  "FileText",
  "Layers",
  "Bot",
  "RefreshCw",
] as const;

const TEMPLATE_COLORS = ["cyan", "purple", "pink", "green", "orange"] as const;

export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Search,
  Bug,
  GitPullRequest,
  Wrench,
  PenTool,
  Zap,
  Rocket,
  Cpu,
  Activity,
  Shield,
  Terminal,
  Database,
  Globe,
  Code,
  FileText,
  Layers,
  Bot,
  RefreshCw,
};

// ── Template Manager Modal Props ───────────────────────────────

export interface TemplateManagerModalProps {
  open: boolean;
  onClose: () => void;
  templates: MissionTemplate[];
  categories: CategoryLike[];
  categoryFilter: string;
  onEditTemplate: (t: MissionTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onCreateTemplate: () => void;
}

// ── Template Editor Modal Props ────────────────────────────────

export interface TemplateEditorModalProps {
  open: boolean;
  onClose: () => void;
  onCancel: () => void;
  editingTemplateId: string | null;
  templateName: string;
  onTemplateNameChange: (v: string) => void;
  templateDescription: string;
  onTemplateDescriptionChange: (v: string) => void;
  templateIcon: string;
  onTemplateIconChange: (v: string) => void;
  templateColor: string;
  onTemplateColorChange: (v: string) => void;
  templateSaving: boolean;
  onSave: () => void;
  categories?: CategoryOption[];
  categoryId?: string | null;
  onCategoryChange?: (id: string | null) => void;
  onCreateCategory?: (name: string) => Promise<string | null>;

  // Mission form state (shared with create/edit form)
  newInstruction: string;
  onNewInstructionChange: (v: string) => void;
  newContext: string;
  onNewContextChange: (v: string) => void;
  newGoals: string;
  onNewGoalsChange: (v: string) => void;
  newProfile: string;
  onNewProfileChange: (v: string) => void;
  newModel: string;
  newProvider: string;
  onModelChange: (mid: string, prov: string) => void;
  newMissionTime: number;
  onNewMissionTimeChange: (v: number) => void;
  newTimeout: number;
  onNewTimeoutChange: (v: number) => void;
  newLocalDirs: LocalDirEntry[];
  onNewLocalDirsChange: (
    updater: LocalDirEntry[] | ((prev: LocalDirEntry[]) => LocalDirEntry[]),
  ) => void;
  localDirDraft: LocalDirEntry;
  onLocalDirDraftChange: (v: LocalDirEntry) => void;
  newReferences: string[];
  onNewReferencesChange: (
    updater: string[] | ((prev: string[]) => string[]),
  ) => void;
  referenceInput: string;
  onReferenceInputChange: (v: string) => void;
  newSkills: string[];
  onNewSkillsChange: (v: string[]) => void;
}

// ── Per-Template Row (owns its own two-step delete confirm) ──

/**
 * Single template row in the manager modal. The pre-session 207
 * form had the row rendered inline inside the `grouped.map(...)`
 * block, with the per-row delete button calling
 * `onDeleteTemplate(t.id)` directly. The confirm guard
 * (`if (!confirm("Delete this template?")) return;`) lived inside
 * the `useMissionsPage.handleDeleteTemplate` hook callback — a
 * single global `window.confirm` dialog with no per-row context.
 *
 * Lifting the confirm into this leaf sub-component gives each
 * template row its own `useTwoStepConfirm({ autoDismissMs: 4000 })`
 * instance so a stale "armed" state from one row cannot
 * accidentally fire when the user clicks a different row's delete
 * button minutes later. The hook callback
 * (`useMissionsPage.handleDeleteTemplate`) no longer needs to know
 * about confirm-state — by the time it is called, the user has
 * already confirmed in the leaf.
 *
 * Sister to the per-row `useTwoStepConfirm` in
 * `MissionEditorPanel` (delete + cancel for the per-mission
 * actions) and to the `PerRowDeleteButton` extracted in session
 * 207 for the Models table + FallbackChainList.
 */
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

// ── Template Manager Modal ─────────────────────────────────────

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

// ── Template Editor Modal ──────────────────────────────────────

export function TemplateEditorModal({
  open,
  onClose,
  onCancel,
  editingTemplateId,
  templateName,
  onTemplateNameChange,
  templateDescription,
  onTemplateDescriptionChange,
  templateIcon,
  onTemplateIconChange,
  templateColor,
  onTemplateColorChange,
  templateSaving,
  onSave,
  categories = [],
  categoryId = null,
  onCategoryChange,
  onCreateCategory,
  newInstruction,
  onNewInstructionChange,
  newContext,
  onNewContextChange,
  newGoals,
  onNewGoalsChange,
  newProfile,
  onNewProfileChange,
  newModel,
  newProvider,
  onModelChange,
  newMissionTime,
  onNewMissionTimeChange,
  newTimeout,
  onNewTimeoutChange,
  newLocalDirs,
  onNewLocalDirsChange,
  localDirDraft,
  onLocalDirDraftChange,
  newReferences,
  onNewReferencesChange,
  referenceInput,
  onReferenceInputChange,
  newSkills,
  onNewSkillsChange,
}: TemplateEditorModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingTemplateId ? "Edit Template" : "Save as Template"}
      icon={editingTemplateId ? Edit3 : Save}
      iconColor="text-neon-cyan"
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            color="cyan"
            onClick={onSave}
            disabled={!templateName.trim()}
            loading={templateSaving}
          >
            Save Template
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {categories.length > 0 && onCategoryChange && (
          <CategoryCombobox
            categories={categories}
            value={categoryId}
            onChange={onCategoryChange}
            onCreateCategory={onCreateCategory}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/40 font-mono block mb-1">
              Template Name
            </label>
            <input
              value={templateName}
              onChange={(e) => onTemplateNameChange(e.target.value)}
              placeholder="e.g., My Custom Review"
              className={inputFieldClasses("cyan")}
            />
          </div>
          <div>
            <label className="text-xs text-white/40 font-mono block mb-1">
              Description
            </label>
            <input
              value={templateDescription}
              onChange={(e) => onTemplateDescriptionChange(e.target.value)}
              placeholder="What this template does"
              className={inputFieldClasses("cyan")}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-white/40 font-mono block mb-1">
            Instruction Prompt
          </label>
          <AutoTextarea
            value={newInstruction}
            onChange={onNewInstructionChange}
            minRows={4}
            maxRows={12}
            placeholder="The agent's task instructions - role, approach, step-by-step process..."
          />
        </div>
        <div>
          <label className="text-xs text-white/40 font-mono block mb-1">
            Context Prompt <span className="text-white/20">(optional)</span>
          </label>
          <AutoTextarea
            value={newContext}
            onChange={onNewContextChange}
            minRows={2}
            maxRows={6}
            placeholder="Hint for what the user should add (e.g., 'Topic to research:')"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 font-mono block mb-1">
            Goals (one per line)
          </label>
          <AutoTextarea
            value={newGoals}
            onChange={onNewGoalsChange}
            minRows={2}
            maxRows={6}
            placeholder="Step 1&#10;Step 2&#10;Step 3"
          />
        </div>
        <AgentRuntimeDefaultsCard
          profileId={newProfile}
          onProfileChange={onNewProfileChange}
          missionTimeMinutes={newMissionTime}
          onMissionTimeChange={onNewMissionTimeChange}
          timeoutMinutes={newTimeout}
          onTimeoutChange={onNewTimeoutChange}
          modelId={newModel}
          provider={newProvider}
          onModelChange={onModelChange}
          modelPickerId="template-model-picker"
          timeoutHeading="Timeout"
          skills={newSkills}
          onSkillsChange={onNewSkillsChange}
        />
        <div>
          <label className="text-xs text-white/40 font-mono block mb-1">
            Local Directories{" "}
            <span className="text-white/20">(optional)</span>
          </label>
          <div className="space-y-2">
            <LocalDirRow
              mode="draft"
              entry={localDirDraft}
              onChange={onLocalDirDraftChange}
              onAdd={() => {
                const result = commitLocalDirDraft(localDirDraft, newLocalDirs);
                if (!result) return;
                onNewLocalDirsChange(result.nextEntries);
                onLocalDirDraftChange(result.emptyDraft);
              }}
            />
            {newLocalDirs.map((dir, i) => (
              <div
                key={`tmpl-${dir.path}-${i}`}
                className="rounded-lg border border-neon-cyan/15 bg-dark-800/30 px-2 py-2"
              >
                <LocalDirRow
                  mode="saved"
                  entry={dir}
                  onChange={(next) =>
                    onNewLocalDirsChange((d) =>
                      d.map((x, j) => (j === i ? next : x)),
                    )
                  }
                  onDelete={() =>
                    onNewLocalDirsChange((d) => d.filter((_, j) => j !== i))
                  }
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-white/40 font-mono block mb-1">
            Key References{" "}
            <span className="text-white/20">(optional)</span>
          </label>
          <div className="space-y-1.5">
            {newReferences.map((ref, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-dark-800/50 border border-neon-pink/20 rounded-lg px-3 py-1.5"
              >
                <span className="text-xs font-mono text-neon-pink truncate flex-1">
                  {ref}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onNewReferencesChange((r) => r.filter((_, j) => j !== i))
                  }
                  className="text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={referenceInput}
                onChange={(e) => onReferenceInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (referenceInput.trim()) {
                      onNewReferencesChange((r) => [
                        ...r,
                        referenceInput.trim(),
                      ]);
                      onReferenceInputChange("");
                    }
                  }
                }}
                placeholder="URL or file path…"
                className={`flex-1 ${inputFieldClasses("pink")} py-1.5 text-xs`}
              />
              <button
                type="button"
                onClick={() => {
                  if (referenceInput.trim()) {
                    onNewReferencesChange((r) => [
                      ...r,
                      referenceInput.trim(),
                    ]);
                    onReferenceInputChange("");
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-neon-pink/10 border border-neon-pink/30 text-xs text-neon-pink hover:bg-neon-pink/20 font-mono transition-colors"
              >
                + Add
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/40 font-mono block mb-1">
              Icon
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_ICONS.map((icon) => {
                const Icon = ICON_MAP[icon] || Zap;
                return (
                  <button
                    key={icon}
                    onClick={() => onTemplateIconChange(icon)}
                    className={`p-1.5 rounded border transition-colors ${
                      templateIcon === icon
                        ? "border-neon-cyan/50 bg-cyan-500/10"
                        : "border-white/10 hover:border-white/20"
                    }`}
                    title={icon}
                  >
                    <Icon
                      className={`w-4 h-4 ${templateIcon === icon ? "text-neon-cyan" : "text-white/40"}`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/40 font-mono block mb-1">
              Color
            </label>
            <div className="flex gap-1.5">
              {TEMPLATE_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onTemplateColorChange(color)}
                  className={`w-8 h-8 rounded-lg border-2 transition-colors ${
                    templateColor === color
                      ? "border-white"
                      : "border-transparent"
                  } ${
                    color === "cyan"
                      ? "bg-neon-cyan/30"
                      : color === "purple"
                        ? "bg-neon-purple/30"
                        : color === "pink"
                          ? "bg-neon-pink/30"
                          : color === "green"
                            ? "bg-neon-green/30"
                            : "bg-neon-orange/30"
                  }`}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

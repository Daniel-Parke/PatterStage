// ═══════════════════════════════════════════════════════════════
// TemplateModals — Template Manager & Template Editor modals
// Extracted from missions/page.tsx for modularity.
// ═══════════════════════════════════════════════════════════════

"use client";

import {
  Edit3,
  Layers,
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
import LocalDirRow from "@/components/missions/LocalDirRow";
import type { LocalDirEntry } from "@/types/hermes";

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
  localDirs?: LocalDirEntry[];
  references?: string[];
  isCustom?: boolean;
  dispatchMode?: string;
  schedule?: string;
  defaultModel?: string;
  defaultProvider?: string;
  timeoutMinutes?: number;
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

export const CATEGORY_ORDER = [
  "Business - Operations",
  "Engineering",
  "Engineering - QA",
  "Engineering - DevOps",
  "Engineering - Software",
  "Engineering - Data",
  "Engineering - Data Science",
  "Business - Creative",
  "Support",
  "Custom",
];

export const CATEGORY_COLORS: Record<string, string> = {
  "Engineering": "cyan",
  "Engineering - QA": "pink",
  "Engineering - DevOps": "cyan",
  "Engineering - Software": "purple",
  "Engineering - Data": "green",
  "Engineering - Data Science": "orange",
  "Business - Operations": "cyan",
  "Business - Creative": "orange",
  Support: "blue",
  Custom: "purple",
};

export function groupTemplates(
  templates: MissionTemplate[],
): [string, MissionTemplate[]][] {
  const grouped: Record<string, MissionTemplate[]> = {};
  for (const t of templates) {
    const cat = t.isCustom ? "Custom" : t.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  }
  const knownOrder = new Set(CATEGORY_ORDER);
  const extra = Object.keys(grouped).filter((c) => !knownOrder.has(c));
  return [...CATEGORY_ORDER, ...extra].filter((c) => grouped[c]).map((cat) => [
    cat,
    grouped[cat],
  ]);
}

// ── Template Manager Modal Props ───────────────────────────────

export interface TemplateManagerModalProps {
  open: boolean;
  onClose: () => void;
  templates: MissionTemplate[];
  categoryFilter: string;
  onEditTemplate: (
    t: MissionTemplate & {
      isCustom?: boolean;
      instruction?: string;
      context?: string;
      dispatchMode?: string;
      schedule?: string;
    },
  ) => void;
  onDeleteTemplate: (id: string) => void;
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

// ── Template Manager Modal ─────────────────────────────────────

export function TemplateManagerModal({
  open,
  onClose,
  templates,
  categoryFilter,
  onEditTemplate,
  onDeleteTemplate,
}: TemplateManagerModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Templates"
      icon={Layers}
      iconColor="text-neon-cyan"
      size="lg"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-2">
        {(() => {
          const grouped = groupTemplates(templates);
          return grouped.map(([cat, items]) => {
            const color = CATEGORY_COLORS[cat] || "cyan";
            const isExtra = !CATEGORY_ORDER.includes(cat);
            return (
              <CategoryAccordion
                key={cat}
                name={cat}
                count={items.length}
                color={isExtra ? "cyan" : color}
                defaultOpen={
                  categoryFilter === "all"
                    ? cat === "Custom"
                    : categoryFilter === cat
                }
              >
                <div className="space-y-1.5">
                  {items.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-white/5 bg-dark-800/30 hover:border-white/10 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="text-sm text-white/80 truncate">
                          {t.name}
                        </div>
                        {!t.isCustom && (
                          <span className="text-[9px] font-mono text-white/15 flex-shrink-0">
                            built-in
                          </span>
                        )}
                      </div>
                      {t.isCustom && (
                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onEditTemplate(t)}
                            className="p-1.5 rounded text-white/40 hover:text-neon-cyan hover:bg-cyan-500/10 transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteTemplate(t.id)}
                            className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CategoryAccordion>
            );
          });
        })()}
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/40 font-mono block mb-1">
              Template Name
            </label>
            <input
              value={templateName}
              onChange={(e) => onTemplateNameChange(e.target.value)}
              placeholder="e.g., My Custom Review"
              className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-cyan/50 font-mono"
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
              className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-cyan/50 font-mono"
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
                const p = localDirDraft.path.trim();
                if (!p) return;
                if (newLocalDirs.some((d) => d.path === p)) return;
                onNewLocalDirsChange([
                  ...newLocalDirs,
                  { path: p, branch: localDirDraft.branch || null },
                ]);
                onLocalDirDraftChange({ path: "", branch: null });
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
                className="flex-1 bg-dark-800/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-neon-pink/50 font-mono"
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

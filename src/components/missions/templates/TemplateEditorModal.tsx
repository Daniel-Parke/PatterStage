// ═══════════════════════════════════════════════════════════════
// TemplateEditorModal — the "Save as Template" / "Edit Template" form.
// The icon/color pickers (TEMPLATE_ICONS / TEMPLATE_COLORS / ICON_MAP) are
// only used here, so they're module-local rather than exported.
// ═══════════════════════════════════════════════════════════════

"use client";

import {
  Edit3, Save, X, Zap, Search, Bug, GitPullRequest, Wrench, PenTool,
  Rocket, Cpu, Activity, Shield, Terminal, Database, Globe, Code,
  FileText, Layers, Bot, RefreshCw,
} from "lucide-react";
import AutoTextarea from "@/components/ui/AutoTextarea";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import IconButton from "@/components/ui/IconButton";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/field";
import AgentRuntimeDefaultsCard from "@/components/missions/AgentRuntimeDefaultsCard";
import CategoryCombobox, {
  type CategoryOption,
} from "@/components/missions/CategoryCombobox";
import LocalDirRow from "@/components/missions/LocalDirRow";
import type { LocalDirEntry } from "@/types/console";
import { commitLocalDirDraft } from "@/lib/fs/local-dir-entry";

// ── Icon / colour pickers (module-local) ───────────────────────

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

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
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

interface TemplateEditorModalProps {
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
  const addReference = () => {
    if (!referenceInput.trim()) return;
    onNewReferencesChange((r) => [...r, referenceInput.trim()]);
    onReferenceInputChange("");
  };

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
            <label className="text-micro text-ps-text-muted font-mono block mb-1">
              Template Name
            </label>
            <Input
              value={templateName}
              onChange={(e) => onTemplateNameChange(e.target.value)}
              placeholder="e.g., My Custom Review"
              aria-label="Template name"
              className="font-mono"
            />
          </div>
          <div>
            <label className="text-micro text-ps-text-muted font-mono block mb-1">
              Description
            </label>
            <Input
              value={templateDescription}
              onChange={(e) => onTemplateDescriptionChange(e.target.value)}
              placeholder="What this template does"
              aria-label="Template description"
              className="font-mono"
            />
          </div>
        </div>
        <div>
          <label className="text-micro text-ps-text-muted font-mono block mb-1">
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
          <label className="text-micro text-ps-text-muted font-mono block mb-1">
            Context Prompt <span className="text-ps-text-faint">(optional)</span>
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
          <label className="text-micro text-ps-text-muted font-mono block mb-1">
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
          <label className="text-micro text-ps-text-muted font-mono block mb-1">
            Local Directories{" "}
            <span className="text-ps-text-faint">(optional)</span>
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
              <Card key={`tmpl-${dir.path}-${i}`} variant="raised" padding="none" className="px-2 py-2">
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
              </Card>
            ))}
          </div>
        </div>
        <div>
          <label className="text-micro text-ps-text-muted font-mono block mb-1">
            Key References{" "}
            <span className="text-ps-text-faint">(optional)</span>
          </label>
          <div className="space-y-1.5">
            {newReferences.map((ref, i) => (
              <Card
                key={i}
                variant="raised"
                padding="none"
                className="flex items-center gap-2 px-3 py-1.5"
              >
                <span className="text-micro font-mono text-neon-pink truncate flex-1">
                  {ref}
                </span>
                <IconButton
                  icon={X}
                  label={`Remove reference ${ref}`}
                  size="sm"
                  onClick={() =>
                    onNewReferencesChange((r) => r.filter((_, j) => j !== i))
                  }
                />
              </Card>
            ))}
            <div className="flex gap-2">
              <Input
                value={referenceInput}
                onChange={(e) => onReferenceInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addReference();
                  }
                }}
                placeholder="URL or file path…"
                aria-label="Reference to add"
                className="flex-1 font-mono"
              />
              <Button variant="primary" color="pink" onClick={addReference}>
                + Add
              </Button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-micro text-ps-text-muted font-mono block mb-1">
              Icon
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_ICONS.map((icon) => (
                <IconButton
                  key={icon}
                  icon={ICON_MAP[icon] || Zap}
                  label={icon}
                  size="sm"
                  variant={templateIcon === icon ? "primary" : "secondary"}
                  onClick={() => onTemplateIconChange(icon)}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-micro text-ps-text-muted font-mono block mb-1">
              Color
            </label>
            <div className="flex gap-1.5">
              {TEMPLATE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onTemplateColorChange(color)}
                  className={`w-8 h-8 rounded-ps-md border-2 transition-colors ${
                    templateColor === color
                      ? "border-ps-edge-emphasis"
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

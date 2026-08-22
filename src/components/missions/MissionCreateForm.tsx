"use client";

import { Send, Save } from "lucide-react";

import Button from "@/components/ui/Button";
import AutoTextarea from "@/components/ui/AutoTextarea";
import SchedulePicker from "@/components/schedule/SchedulePicker";
import LocalDirRow from "@/components/missions/LocalDirRow";
import AgentRuntimeDefaultsCard from "@/components/missions/AgentRuntimeDefaultsCard";
import CategoryCombobox, {
  type CategoryOption,
} from "@/components/missions/CategoryCombobox";
import MissionPromptPreview from "@/components/missions/MissionPromptPreview";
import SkillSelector from "@/components/ui/SkillSelector";
import ToolsetSelector from "@/components/ui/ToolsetSelector";
import {
  ComposerAccordion,
  ComposerFieldLabel,
} from "@/components/missions/MissionComposerLayout";
import type { LocalDirEntry } from "@/types/console";
import { commitLocalDirDraft } from "@/lib/fs/local-dir-entry";
import {
  isMissionDraft,
  isMissionQueuedForRun,
} from "@/lib/missions/mission-board";

export interface MissionFormState {
  newName: string;
  newInstruction: string;
  newContext: string;
  newGoals: string;
  newOutputFormat: string;
  newConstraints: string;
  newDispatch: "save" | "now" | "cron" | "queue";
  newSchedule: string;
  newMissionTime: number;
  newTimeout: number;
  newProfile: string;
  newModel: string;
  newProvider: string;
  newLocalDirs: LocalDirEntry[];
  localDirDraft: LocalDirEntry;
  newReferences: string[];
  referenceInput: string;
  newSkills: string[];
  newToolsets: string[];
}

export interface MissionCreateFormProps {
  embedded?: boolean;
  editingId: string | null;
  missions: {
    id: string;
    name: string;
    status: string;
    queuedForRun?: boolean;
    cronJobId?: string;
  }[];
  formState: MissionFormState;
  setFormField: <K extends keyof MissionFormState>(
    field: K,
    value: MissionFormState[K],
  ) => void;
  categories: CategoryOption[];
  categoryId: string | null;
  onCategoryChange: (id: string | null) => void;
  onCreateCategory?: (name: string) => Promise<string | null>;
  onManageCategories?: () => void;
  categoriesLoadError?: string | null;
  onRetryCategories?: () => void;
  onSubmit: () => void;
  onSaveAsTemplate: () => void;
  onClose: () => void;
  dispatching: boolean;
  dispatchAcknowledged?: boolean;
  onDispatchOpenChange?: (open: boolean) => void;
}

export const DISPATCH_MODES = [
  { id: "save" as const, label: "Save" },
  { id: "queue" as const, label: "Queue" },
  { id: "now" as const, label: "Run now" },
  { id: "cron" as const, label: "Schedule" },
] as const;

/**
 * Resolve the submit-button label for a given dispatch mode + edit context.
 *
 * Two of the four context branches (`isDraftEdit` and the default) share the
 * same dispatch→label mapping ("Save draft" / "Queue mission" / "Dispatch now"
 * / "Schedule mission"). The `isQueuedEdit` branch only differs in two of
 * the four dispatch slots ("Move to drafts" / "Update queue" — the other two
 * match the default). The shared mapping lives in `DEFAULT_DISPATCH_LABEL`
 * so the 3 default slots are written once; the 2 divergent slots in the
 * queued branch override it via a small per-slot table.
 */
const DEFAULT_DISPATCH_LABEL: Record<
  MissionFormState["newDispatch"],
  string
> = {
  save: "Save draft",
  queue: "Queue mission",
  now: "Dispatch now",
  cron: "Schedule mission",
};

/** Queued-edit dispatch→label overrides for the 2 divergent slots. */
const QUEUED_EDIT_OVERRIDES: Partial<
  Record<MissionFormState["newDispatch"], string>
> = {
  save: "Move to drafts",
  queue: "Update queue",
};

/**
 * Edit-context derived from the optional `editingId` + missions list.
 * Returned by the local `resolveEditContext` helper below — the 4 booleans
 * (`isReDispatch` / `isRunningEdit` / `isDraftEdit` / `isQueuedEdit`) are
 * used in BOTH `MissionComposerActions` (for the submit label) AND the
 * default-exported `MissionCreateForm` (for the 4 status banners), so the
 * derivation was duplicated 1× per export. This helper centralises it.
 */
export interface EditContext {
  isReDispatch: boolean;
  isRunningEdit: boolean;
  isDraftEdit: boolean;
  isQueuedEdit: boolean;
}

function resolveEditContext(
  editingId: string | null,
  missions: MissionCreateFormProps["missions"],
): EditContext {
  const existing = editingId
    ? missions.find((m) => m.id === editingId)
    : null;
  return {
    isReDispatch:
      !!existing &&
      (existing.status === "successful" || existing.status === "failed"),
    isRunningEdit: existing?.status === "dispatched",
    isDraftEdit: existing ? isMissionDraft(existing) : false,
    isQueuedEdit: existing ? isMissionQueuedForRun(existing) : false,
  };
}

export function dispatchSubmitLabel(
  dispatch: MissionFormState["newDispatch"],
  options: {
    isReDispatch?: boolean;
    isRunningEdit?: boolean;
    isDraftEdit?: boolean;
    isQueuedEdit?: boolean;
  } = {},
): string {
  if (options.isReDispatch) return "Re-Dispatch Now";
  if (options.isRunningEdit) return "Update Mission";
  if (options.isDraftEdit) return DEFAULT_DISPATCH_LABEL[dispatch];
  if (options.isQueuedEdit) {
    return QUEUED_EDIT_OVERRIDES[dispatch] ?? DEFAULT_DISPATCH_LABEL[dispatch];
  }
  return DEFAULT_DISPATCH_LABEL[dispatch];
}

export function MissionComposerActions({
  editingId,
  missions,
  formState,
  onSubmit,
  onSaveAsTemplate,
  onClose,
  dispatching,
  dispatchAcknowledged = true,
}: Pick<
  MissionCreateFormProps,
  | "editingId"
  | "missions"
  | "formState"
  | "onSubmit"
  | "onSaveAsTemplate"
  | "onClose"
  | "dispatching"
  | "dispatchAcknowledged"
>) {
  const editingCtx = resolveEditContext(editingId, missions);

  const submitLabel = dispatchSubmitLabel(formState.newDispatch, {
    isReDispatch: editingCtx.isReDispatch,
    isRunningEdit: editingCtx.isRunningEdit,
    isDraftEdit: editingCtx.isDraftEdit,
    isQueuedEdit: editingCtx.isQueuedEdit,
  });

  const needsDispatchAck = !editingId && !dispatchAcknowledged;

  return (
    <div className="space-y-2">
      {needsDispatchAck && (
        <p className="text-xs font-mono text-neon-orange/80">
          Open <strong className="text-neon-cyan/90">Dispatch</strong> to choose
          how this mission runs before submitting.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={onSubmit}
          disabled={
            !formState.newName.trim() ||
            !formState.newInstruction.trim() ||
            dispatching ||
            needsDispatchAck
          }
          loading={dispatching}
        >
          <Send className="w-3.5 h-3.5" />
          {submitLabel}
        </Button>
        {formState.newInstruction.trim() && (
          <Button variant="secondary" onClick={onSaveAsTemplate}>
            <Save className="w-3.5 h-3.5" /> Save as Template
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function MissionCreateForm({
  embedded = false,
  editingId,
  missions,
  formState,
  setFormField,
  categories,
  categoryId,
  onCategoryChange,
  onCreateCategory,
  onManageCategories,
  categoriesLoadError = null,
  onRetryCategories,
  onSubmit,
  onSaveAsTemplate,
  onClose,
  dispatching,
  dispatchAcknowledged = false,
  onDispatchOpenChange,
}: MissionCreateFormProps) {
  const editingCtx = resolveEditContext(editingId, missions);
  const { isReDispatch, isRunningEdit, isDraftEdit, isQueuedEdit } = editingCtx;

  // Helper: commit the current `localDirDraft` to `newLocalDirs` and
  // clear the draft. The 4-line "trim → dedupe-by-path → push → reset"
  // sequence used to be inline in the LocalDirRow onClick. Now extracted
  // to a named callback (mirrors the `addReferenceFromInput` pattern for
  // references, line 265). The actual dedupe + push logic is delegated
  // to `commitLocalDirDraft` in `@/lib/local-dir-entry`, which is shared
  // with the template editor (TemplateModals.tsx) — same call site, same
  // helper. Returns early on the no-op cases (empty path, duplicate)
  // without touching state.
  const addLocalDirFromDraft = () => {
    const result = commitLocalDirDraft(
      formState.localDirDraft,
      formState.newLocalDirs,
    );
    if (!result) return;
    setFormField("newLocalDirs", result.nextEntries);
    setFormField("localDirDraft", result.emptyDraft);
  };

  // Helper: append the current `referenceInput` (trimmed) to
  // `newReferences`, then clear the input. The 3-line sequence appears
  // twice below — once in the input's onKeyDown (Enter-to-add) and once
  // in the "+ Add" button's onClick. Both call sites are guarded by
  // `referenceInput.trim()` (the onKeyDown in the predicate, the onClick
  // in an `if`); the helper does the trim and the early-return so each
  // callsite can stay a one-liner. The two callsites are now identical
  // and easy to keep in lockstep if a future "dedup by path" or "cap
  // at N references" extension lands.
  const addReferenceFromInput = () => {
    const trimmed = formState.referenceInput.trim();
    if (!trimmed) return;
    setFormField("newReferences", [...formState.newReferences, trimmed]);
    setFormField("referenceInput", "");
  };

  const inner = (
    <div className="space-y-4">
      {editingId && isReDispatch && (
        <div className="rounded-lg bg-neon-cyan/5 border border-neon-cyan/20 p-3 text-xs text-neon-cyan/80 font-mono">
          A new mission will be created and dispatched immediately with your
          changes. The previous mission record will be kept for history.
        </div>
      )}
      {editingId && isRunningEdit && (
        <div className="rounded-lg bg-neon-orange/5 border border-neon-orange/20 p-3 text-xs text-neon-orange/80 font-mono">
          Updates apply to this running mission. Linked cron jobs sync when
          schedule, profile, model, or prompt fields change.
        </div>
      )}
      {editingId && isDraftEdit && (
        <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-xs text-white/50 font-mono">
          This mission is a draft. Choose how to run it in Dispatch — save,
          queue for when the agent is idle, run now, or schedule.
        </div>
      )}
      {editingId && isQueuedEdit && (
        <div className="rounded-lg bg-neon-orange/5 border border-neon-orange/20 p-3 text-xs text-neon-orange/80 font-mono">
          This mission is waiting in the queue. You can update fields, dispatch
          immediately, or move it back to drafts.
        </div>
      )}

      {(categoriesLoadError || categories.length === 0) && (
        <p className="text-xs font-mono text-neon-orange/80 bg-neon-orange/5 border border-neon-orange/20 rounded-lg px-3 py-2">
          {categoriesLoadError ??
            "No categories loaded — run npm run db:migrate or restart PatterStage, then"}{" "}
          {onRetryCategories && (
            <button
              type="button"
              onClick={onRetryCategories}
              className="text-neon-cyan underline"
            >
              retry
            </button>
          )}
          {onRetryCategories && onManageCategories ? " · " : null}
          {onManageCategories ? (
            <button
              type="button"
              onClick={onManageCategories}
              className="text-neon-cyan underline"
            >
              manage categories
            </button>
          ) : null}
          {!categoriesLoadError && !onManageCategories ? "." : null}
        </p>
      )}

      <CategoryCombobox
        categories={categories}
        value={categoryId}
        onChange={onCategoryChange}
        onCreateCategory={onCreateCategory}
        onManageCategories={onManageCategories}
      />

      <div>
        <ComposerFieldLabel>Mission Name</ComposerFieldLabel>
        <input
          value={formState.newName}
          onChange={(e) => setFormField("newName", e.target.value)}
          placeholder="e.g., Research quantum computing trends"
          className="w-full h-9 bg-dark-800/50 border border-white/10 rounded-lg px-3 text-sm text-white placeholder-white/20 outline-none focus:border-neon-cyan/50 font-mono"
        />
      </div>

      <div>
        <ComposerFieldLabel>Instruction</ComposerFieldLabel>
        <AutoTextarea
          value={formState.newInstruction}
          onChange={(v) => setFormField("newInstruction", v)}
          minRows={4}
          maxRows={16}
          placeholder="The agent's task instructions..."
        />
      </div>

      <div>
        <ComposerFieldLabel>Goals</ComposerFieldLabel>
        <AutoTextarea
          value={formState.newGoals}
          onChange={(v) => setFormField("newGoals", v)}
          minRows={2}
          maxRows={8}
          placeholder="Gather data&#10;Analyze findings&#10;Write report"
        />
        <p className="text-[10px] text-white/25 font-mono mt-1.5">
          One goal per line — checklist the agent completes alongside the task.
        </p>
      </div>

      <ComposerAccordion
        title="Mission parameters"
        description="Directories, references, skills, context, output, and constraints"
        defaultOpen={false}
        step={1}
        accent="cyan"
      >
        <div>
          <ComposerFieldLabel>Working directories</ComposerFieldLabel>
          <div className="space-y-2">
            <LocalDirRow
              mode="draft"
              entry={formState.localDirDraft}
              onChange={(next) => setFormField("localDirDraft", next)}
              onAdd={addLocalDirFromDraft}
            />
            {formState.newLocalDirs.map((dir, i) => (
              <div
                key={`${dir.path}-${i}`}
                className="rounded-lg border border-neon-cyan/15 bg-dark-800/30 px-2 py-2"
              >
                <LocalDirRow
                  mode="saved"
                  entry={dir}
                  onChange={(next) =>
                    setFormField(
                      "newLocalDirs",
                      formState.newLocalDirs.map((x, j) =>
                        j === i ? next : x,
                      ),
                    )
                  }
                  onDelete={() =>
                    setFormField(
                      "newLocalDirs",
                      formState.newLocalDirs.filter((_, j) => j !== i),
                    )
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <ComposerFieldLabel>References</ComposerFieldLabel>
          <div className="space-y-1.5">
            {formState.newReferences.map((ref, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-dark-800/50 border border-neon-pink/20 rounded-lg px-3 py-1.5 h-9"
              >
                <span className="text-xs font-mono text-neon-pink truncate flex-1">
                  {ref}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setFormField(
                      "newReferences",
                      formState.newReferences.filter((_, j) => j !== i),
                    )
                  }
                  className="text-white/30 hover:text-red-400 text-xs"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                value={formState.referenceInput}
                onChange={(e) =>
                  setFormField("referenceInput", e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addReferenceFromInput();
                  }
                }}
                placeholder="URL, doc path..."
                className="flex-1 h-9 bg-dark-800/50 border border-white/10 rounded-lg px-3 text-xs text-white placeholder-white/20 outline-none focus:border-neon-pink/50 font-mono"
              />
              <button
                type="button"
                onClick={addReferenceFromInput}
                className="h-9 px-3 rounded-lg bg-neon-pink/10 border border-neon-pink/30 text-xs text-neon-pink font-mono shrink-0"
              >
                + Add
              </button>
            </div>
          </div>
        </div>

        <div>
          <ComposerFieldLabel>Recommend agent skills</ComposerFieldLabel>
          <SkillSelector
            value={formState.newSkills}
            onChange={(skills) => setFormField("newSkills", skills)}
            profileId={formState.newProfile}
            max={10}
          />
        </div>

        <div>
          <ComposerFieldLabel>Recommend Hermes toolsets</ComposerFieldLabel>
          <ToolsetSelector
            value={formState.newToolsets}
            onChange={(toolsets) => setFormField("newToolsets", toolsets)}
            profileId={formState.newProfile}
            max={10}
          />
        </div>

        <div>
          <ComposerFieldLabel>Additional context</ComposerFieldLabel>
          <AutoTextarea
            value={formState.newContext}
            onChange={(v) => setFormField("newContext", v)}
            minRows={2}
            maxRows={8}
            placeholder="Background the agent should know before starting..."
          />
        </div>

        <div>
          <ComposerFieldLabel>Output format</ComposerFieldLabel>
          <AutoTextarea
            value={formState.newOutputFormat}
            onChange={(v) => setFormField("newOutputFormat", v)}
            minRows={2}
            maxRows={6}
            placeholder="e.g. Markdown report with summary and list of changed files"
          />
        </div>

        <div>
          <ComposerFieldLabel>Constraints</ComposerFieldLabel>
          <AutoTextarea
            value={formState.newConstraints}
            onChange={(v) => setFormField("newConstraints", v)}
            minRows={2}
            maxRows={6}
            placeholder="e.g. Do not modify tests/; max 3 files per commit"
          />
        </div>
      </ComposerAccordion>

      <ComposerAccordion
        title="Runtime"
        description="Profile, model, scope, and timeout"
        defaultOpen={false}
        step={2}
        accent="purple"
      >
        <AgentRuntimeDefaultsCard
          variant="embedded"
          profileId={formState.newProfile}
          onProfileChange={(id) => setFormField("newProfile", id)}
          missionTimeMinutes={formState.newMissionTime}
          onMissionTimeChange={(v) => setFormField("newMissionTime", v)}
          timeoutMinutes={formState.newTimeout}
          onTimeoutChange={(v) => setFormField("newTimeout", v)}
          modelId={formState.newModel}
          provider={formState.newProvider}
          onModelChange={(mid, prov) => {
            setFormField("newModel", mid);
            setFormField("newProvider", prov);
          }}
          timeoutHeading="Timeout"
        />
      </ComposerAccordion>

      <ComposerAccordion
        title="Assembled agent prompt"
        description="Preview of the mission prompt sent to the agent"
        defaultOpen={false}
        step={3}
        accent="pink"
      >
        <MissionPromptPreview
          instruction={formState.newInstruction}
          context={formState.newContext}
          goals={formState.newGoals}
          outputFormat={formState.newOutputFormat}
          constraints={formState.newConstraints}
          localDirs={formState.newLocalDirs}
          references={formState.newReferences}
          skills={formState.newSkills}
          toolsets={formState.newToolsets}
          missionTimeMinutes={formState.newMissionTime}
          timeoutMinutes={formState.newTimeout}
        />
      </ComposerAccordion>

      <ComposerAccordion
        title="Dispatch"
        description="When and how this mission runs"
        defaultOpen={false}
        step={4}
        accent="green"
        onOpenChange={(open) => {
          if (open) onDispatchOpenChange?.(true);
        }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DISPATCH_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setFormField("newDispatch", mode.id)}
              className={`h-9 px-3 rounded-lg text-xs font-mono border transition-colors ${
                formState.newDispatch === mode.id
                  ? "border-neon-cyan/50 bg-cyan-500/10 text-neon-cyan"
                  : "border-white/10 text-white/40 hover:text-white/60"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-white/30 font-mono">
          The button below runs the selected dispatch mode.
        </p>
        {formState.newDispatch === "cron" && (
          <SchedulePicker
            value={formState.newSchedule}
            onChange={(s) => setFormField("newSchedule", s)}
          />
        )}
      </ComposerAccordion>

      {!embedded && (
        <MissionComposerActions
          editingId={editingId}
          missions={missions}
          formState={formState}
          onSubmit={onSubmit}
          onSaveAsTemplate={onSaveAsTemplate}
          onClose={onClose}
          dispatching={dispatching}
          dispatchAcknowledged={dispatchAcknowledged}
        />
      )}
    </div>
  );

  if (embedded) {
    return inner;
  }

  return (
    <div className="rounded-xl border border-neon-cyan/20 bg-dark-900/50 p-4 mb-6">
      <h3 className="text-sm font-mono text-neon-cyan uppercase tracking-widest mb-4">
        {editingId ? "Edit Mission" : "New Mission"}
      </h3>
      {inner}
    </div>
  );
}

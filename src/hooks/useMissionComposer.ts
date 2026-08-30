// ═══════════════════════════════════════════════════════════════
// useMissionComposer — mission-creation/edit form state container
// ═══════════════════════════════════════════════════════════════
//
// Extracted from useMissionsPage (god-hook split). Owns the composer
// form state (every `new*` field), the typed field-setter map, the
// dispatch payload builder, and the three composer-local effects
// (profile skills/toolsets prune, last-category restore, default-agent
// model autofill). Plus the two form-population helpers
// (applyTemplateToForm / populateFormFromMission) that are pure form
// mutations.
//
// The composer does NOT own the create-sheet visibility (`showCreate`/
// `editingId`) — those stay in useMissionsPage and are passed in so the
// two visibility-gated effects can read them. useMissionsPage
// destructures the returned bag, so every handler body that reads
// `newName`/`dispatchPayload`/etc. and the hook's public return shape
// are unchanged.

"use client";

import { useState, useEffect, useCallback } from "react";

import { apiFetch, safeApiCallData } from "@/lib/api-fetch";
import type { LocalDirEntry, Mission } from "@/types/console";
import { normalizeLocalDirsInput } from "@/lib/fs/local-dir-entry";
import { parseMissionPrompt } from "@/lib/missions/build-mission-prompt";
import type { MissionFormState } from "@/components/missions/MissionCreateForm";
import type { MissionTemplate } from "@/components/missions/TemplateModals";
import { splitGoals } from "@/lib/missions/mission-form-utils";
import { scheduleForDispatch } from "@/lib/dispatch-mode";
import { isMissionQueuedForRun } from "@/lib/missions/mission-board";
import {
  getCategoryIdFromTemplate,
  rememberLastCategory,
  readLastCategory,
} from "@/lib/missions/mission-composer-utils";

export interface UseMissionComposerArgs {
  /** Whether the create/edit sheet is open (owned by useMissionsPage). */
  showCreate: boolean;
  /** The mission id being edited, or null for fresh-create. */
  editingId: string | null;
}

/**
 * The schedule a new mission starts with.
 *
 * Named rather than repeated because it is now used in three places: the
 * initial state, the reset that clears the form, and the reset that runs when
 * the composer is populated from an existing mission. It was a literal in two
 * of them and absent from the third, which is how a schedule survived a form
 * reset and reappeared on the next mission (T-0051).
 */
const DEFAULT_SCHEDULE = "every 5m";

export function useMissionComposer({ showCreate, editingId }: UseMissionComposerArgs) {
  const [newName, setNewName] = useState("");
  const [newInstruction, setNewInstruction] = useState("");
  const [newContext, setNewContext] = useState("");
  const [newGoals, setNewGoals] = useState("");
  const [newOutputFormat, setNewOutputFormat] = useState("");
  const [newConstraints, setNewConstraints] = useState("");
  const [dispatchAcknowledged, setDispatchAcknowledged] = useState(false);
  const [newDispatch, setNewDispatch] = useState<"save" | "now" | "cron" | "queue">(
    "save",
  );
  const [newSchedule, setNewSchedule] = useState(DEFAULT_SCHEDULE);
  // Deliberately NOT part of MissionFormState: it is not a field the operator
  // fills, it is the picker telling us its draft cannot be parsed. Putting it in
  // the form state would ripple through the mapped setter map for no reason.
  const [scheduleDraftError, setScheduleDraftError] = useState<string | null>(null);
  const [newMissionTime, setNewMissionTime] = useState(15);
  const [newTimeout, setNewTimeout] = useState(10);
  const [newProfile, setNewProfile] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newProvider, setNewProvider] = useState("");
  const [newLocalDirs, setNewLocalDirs] = useState<LocalDirEntry[]>([]);
  const [localDirDraft, setLocalDirDraft] = useState<LocalDirEntry>({
    path: "",
    branch: null,
  });
  const [newReferences, setNewReferences] = useState<string[]>([]);
  const [newSkills, setNewSkills] = useState<string[]>([]);
  const [newToolsets, setNewToolsets] = useState<string[]>([]);
  const [referenceInput, setReferenceInput] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null);

  const formState: MissionFormState = {
    newName,
    newInstruction,
    newContext,
    newGoals,
    newOutputFormat,
    newConstraints,
    newDispatch,
    newSchedule,
    newMissionTime,
    newTimeout,
    newProfile,
    newModel,
    newProvider,
    newLocalDirs,
    localDirDraft,
    newReferences,
    referenceInput,
    newSkills,
    newToolsets,
  };

  // Typed map from form field → setter. The mapped type
  // `{ [P in keyof MissionFormState]: (v: MissionFormState[P]) => void }`
  // preserves each setter's per-field parameter type, so calling
  // `setters[field](value)` requires no `as` cast.
  // `newDispatch` has a side effect (also acknowledges the dispatch warning),
  // so it gets a custom wrapper.
  const setFormField = useCallback(
    <K extends keyof MissionFormState>(field: K, value: MissionFormState[K]) => {
      const setters: { [P in keyof MissionFormState]: (v: MissionFormState[P]) => void } = {
        newName: (v) => setNewName(v),
        newInstruction: (v) => setNewInstruction(v),
        newContext: (v) => setNewContext(v),
        newGoals: (v) => setNewGoals(v),
        newOutputFormat: (v) => setNewOutputFormat(v),
        newConstraints: (v) => setNewConstraints(v),
        newDispatch: (v) => {
          setNewDispatch(v);
          setDispatchAcknowledged(true);
        },
        newSchedule: (v) => setNewSchedule(v),
        newMissionTime: (v) => setNewMissionTime(v),
        newTimeout: (v) => setNewTimeout(v),
        newProfile: (v) => setNewProfile(v),
        newModel: (v) => setNewModel(v),
        newProvider: (v) => setNewProvider(v),
        newLocalDirs: (v) => setNewLocalDirs(v),
        localDirDraft: (v) => setLocalDirDraft(v),
        newReferences: (v) => setNewReferences(v),
        referenceInput: (v) => setReferenceInput(v),
        newSkills: (v) => setNewSkills(v),
        newToolsets: (v) => setNewToolsets(v),
      };
      setters[field](value);
    },
    [],
  );

  // Builds the JSON payload for `POST /api/missions` (dispatch, promote,
  // update) from the current form state. The `schedule` field is derived
  // internally via `scheduleForDispatch(newDispatch, newSchedule)`.
  const dispatchPayload = useCallback(
    (overrides: Record<string, unknown> = {}): Record<string, unknown> => {
      // The EFFECTIVE mode, not the form's. `schedule` is derived, so deriving
      // it from state while the caller overrides the mode produces a payload
      // that contradicts itself: the re-dispatch branch calls
      // `dispatchPayload({ dispatchMode: "now" })`, and with the form left in
      // cron mode that used to send a schedule alongside "now" (T-0051).
      const mode = (overrides.dispatchMode as typeof newDispatch) ?? newDispatch;
      return {
      instruction: newInstruction.trim(),
      context: newContext.trim() || undefined,
      outputFormat: newOutputFormat.trim() || undefined,
      constraints: newConstraints.trim() || undefined,
      categoryId: newCategoryId,
      goals: splitGoals(newGoals),
      profileName: newProfile || undefined,
      modelId: newModel || undefined,
      provider: newProvider || undefined,
      missionTimeMinutes: newMissionTime,
      timeoutMinutes: newTimeout,
      schedule: scheduleForDispatch(mode, newSchedule),
      localDirs: newLocalDirs,
      references: newReferences,
      skills: newSkills,
      suggestedToolsets: newToolsets,
      ...overrides,
      };
    },
    [
      newInstruction, newContext, newOutputFormat, newConstraints, newCategoryId, newGoals,
      newProfile, newModel, newProvider, newMissionTime, newTimeout,
      newDispatch, newSchedule,
      newLocalDirs, newReferences, newSkills, newToolsets,
    ],
  );

  // `newModel` and `newProvider` are always set together (a model id
  // implies its provider). Centralise the pair so callers don't have to
  // remember to update both.
  const setModelAndProvider = useCallback(
    (modelId: string, provider: string) => {
      setNewModel(modelId);
      setNewProvider(provider);
    },
    [],
  );

  // Clears the mission-creation form fields shared between resetForm and
  // handleCreateNewTemplate. Does NOT touch the dispatch-acknowledgement
  // flag or the visibility of the create sheet — callers decide those.
  const clearMissionFormFields = useCallback(() => {
    setScheduleDraftError(null);
    setNewName("");
    setNewInstruction("");
    setNewContext("");
    setNewGoals("");
    setNewOutputFormat("");
    setNewConstraints("");
    setModelAndProvider("", "");
    setNewLocalDirs([]);
    setLocalDirDraft({ path: "", branch: null });
    setNewReferences([]);
    setNewSkills([]);
    setNewToolsets([]);
    // The schedule is a form field like the rest of them. It was left out, so
    // the next New Mission opened holding the previous mission's cron, and a
    // schedule nobody chose is a mission dispatched on a cadence nobody chose
    // (T-0051).
    setNewSchedule(DEFAULT_SCHEDULE);
  }, [setModelAndProvider]);

  const setCategoryId = useCallback((id: string | null) => {
    setNewCategoryId(id);
    rememberLastCategory(id);
  }, []);

  // When a profile is selected, prune the form's skills/toolsets to those
  // the profile actually has enabled.
  useEffect(() => {
    if (!newProfile) return;
    const controller = new AbortController();
    const slug = encodeURIComponent(newProfile);
    Promise.all([
      apiFetch<{ data: { skills?: Array<{ name: string; enabled: boolean }> } }>(`/api/skills?profile=${slug}`, { signal: controller.signal }),
      apiFetch<{ data: { unifiedEnabled?: string[] } }>(`/api/agent/profiles/${slug}/toolsets`, { signal: controller.signal }),
    ])
      .then(([skillsResult, toolsetsResult]) => {
        const enabled = new Set(
          (skillsResult.data?.skills ?? [])
            .filter((s) => s.enabled)
            .map((s) => s.name),
        );
        // `unifiedEnabled` is the same union, computed server-side by the route
        // (api/agent/profiles/[id]/toolsets/route.ts:42).
        const toolsetIds = new Set(toolsetsResult.data?.unifiedEnabled ?? []);
        setNewSkills((prev) => prev.filter((s) => enabled.has(s)));
        setNewToolsets((prev) => prev.filter((t) => toolsetIds.has(t)));
      })
      .catch((err) => {
        if (err instanceof Error && err.name !== "AbortError") {
          console.warn("[useMissionComposer] failed to load profile skills/toolsets:", err.message);
        }
      });
    return () => controller.abort();
  }, [newProfile]);

  // Restore the user's last-used category when opening a fresh-create
  // composer (not edit, and only if no category is already selected).
  useEffect(() => {
    if (showCreate && !editingId) {
      const last = readLastCategory();
      if (last && !newCategoryId) setNewCategoryId(last);
    }
  }, [showCreate, editingId, newCategoryId]);

  /**
   * Populate form state from a mission template.
   * Used by handleTemplateSelect, handleTemplateEdit, and fetchData.
   */
  const applyTemplateToForm = useCallback(
    (
      t: MissionTemplate & {
        instruction?: string;
        context?: string;
        dispatchMode?: string;
        schedule?: string;
        name?: string;
      },
      categoryIdOverride?: string | null,
    ) => {
      setNewName(t.name ?? "");
      setNewInstruction(t.instruction || "");
      setNewContext(t.context || "");
      setNewGoals((t.goals || []).join("\n"));
      setNewOutputFormat(t.outputFormat ?? "");
      setNewConstraints(t.constraints ?? "");
      setNewProfile(t.profile || "");
      setModelAndProvider(t.defaultModel || "", t.defaultProvider || "");
      setNewLocalDirs(normalizeLocalDirsInput(t.localDirs));
      setLocalDirDraft({ path: "", branch: null });
      setNewReferences(t.references ?? []);
      setNewSkills(t.suggestedSkills || []);
      setNewToolsets(t.suggestedToolsets ?? []);
      setNewCategoryId(
        categoryIdOverride !== undefined
          ? categoryIdOverride
          : getCategoryIdFromTemplate(t)
      );
      const tm = t.timeoutMinutes;
      if (typeof tm === "number" && Number.isFinite(tm)) {
        setNewTimeout(tm);
      }
      if (t.dispatchMode) {
        setNewDispatch(t.dispatchMode as "save" | "now" | "cron" | "queue");
      }
      if (t.schedule) setNewSchedule(t.schedule);
    },
    [setModelAndProvider],
  );

  /**
   * Populate form state from a mission.
   * Used by both handleEdit (in-place edit) and handleDuplicateMission.
   * Reads only base `Mission` fields, so callers can pass the richer
   * MissionRow (which extends Mission) without a cast.
   */
  const populateFormFromMission = useCallback(
    (m: Mission, opts: { editing: boolean; namePrefix?: string }) => {
    const parsed = parseMissionPrompt(m.prompt);
    setNewName(opts.namePrefix ? `${m.name} ${opts.namePrefix}` : m.name);
    setNewInstruction(parsed.instruction);
    setNewContext(parsed.context);
    setNewOutputFormat(m.outputFormat ?? parsed.outputFormat ?? "");
    setNewConstraints(m.constraints ?? parsed.constraints ?? "");
    setNewGoals(m.goals?.join("\n") ?? "");
    setDispatchAcknowledged(opts.editing);
    setNewLocalDirs(normalizeLocalDirsInput(m.localDirs));
    setLocalDirDraft({ path: "", branch: null });
    setNewReferences(m.references ?? []);
    setNewSkills(m.skills ?? []);
    setNewCategoryId(m.categoryId ?? null);
    setModelAndProvider(m.modelId || m.model || "", m.provider || "");
    if (m.profileName) setNewProfile(m.profileName);
    if (typeof m.missionTimeMinutes === "number") setNewMissionTime(m.missionTimeMinutes);
    if (typeof m.timeoutMinutes === "number") setNewTimeout(m.timeoutMinutes);
    if (m.schedule) {
      setNewSchedule(m.schedule);
    } else {
      setNewSchedule(DEFAULT_SCHEDULE);
    }
    if (opts.editing) {
      if (m.status === "successful" || m.status === "failed") {
        setNewDispatch("now");
      } else if (isMissionQueuedForRun(m)) {
        setNewDispatch("queue");
      } else if (m.status === "queued") {
        setNewDispatch("save");
      } else if (m.cronJobId) {
        setNewDispatch("cron");
      } else if (m.status === "dispatched") {
        setNewDispatch("now");
      }
    }
  }, [setModelAndProvider]);

  // Default-agent model autofill: on opening a fresh-create composer with
  // no model chosen, prefill the registry's default-agent model.
  useEffect(() => {
    if (!showCreate || editingId) return;
    if (newModel.trim()) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const [defaults, models] = await Promise.all([
          safeApiCallData<{ defaults?: { agent?: string | null } }>(
            "/api/models/defaults",
            { signal: controller.signal },
          ),
          safeApiCallData<{ models?: Array<{ id: string; modelId: string; provider: string }> }>(
            "/api/models",
            { signal: controller.signal },
          ),
        ]);
        if (!defaults || !models) return;

        const agentRegistryId = defaults.defaults?.agent;
        if (!agentRegistryId) return;

        const match = models.models?.find((m) => m.id === agentRegistryId);
        if (!match) return;

        setModelAndProvider(match.modelId, match.provider);
      } catch {
        /* aborted or network */
      }
    })();

    return () => controller.abort();
  }, [showCreate, editingId, newModel, setModelAndProvider]);

  return {
    // raw fields + setters
    newName, setNewName,
    newInstruction, setNewInstruction,
    newContext, setNewContext,
    newGoals, setNewGoals,
    newOutputFormat, setNewOutputFormat,
    newConstraints, setNewConstraints,
    dispatchAcknowledged, setDispatchAcknowledged,
    newDispatch, setNewDispatch,
    newSchedule, setNewSchedule,
    scheduleDraftError, setScheduleDraftError,
    newMissionTime, setNewMissionTime,
    newTimeout, setNewTimeout,
    newProfile, setNewProfile,
    newModel, setNewModel,
    newProvider, setNewProvider,
    newLocalDirs, setNewLocalDirs,
    localDirDraft, setLocalDirDraft,
    newReferences, setNewReferences,
    newSkills, setNewSkills,
    newToolsets, setNewToolsets,
    referenceInput, setReferenceInput,
    newCategoryId, setNewCategoryId,
    // derived + helpers
    formState,
    setFormField,
    dispatchPayload,
    setModelAndProvider,
    setCategoryId,
    clearMissionFormFields,
    applyTemplateToForm,
    populateFormFromMission,
  };
}

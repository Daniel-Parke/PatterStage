import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useToast } from "@/components/ui/Toast";
import { useMissionsApi } from "@/hooks/useMissionsApi";
import { safeApiCall, apiFetch } from "@/lib/api-fetch";
import type { LocalDirEntry, Mission } from "@/types/hermes";
import { normalizeLocalDirsInput } from "@/lib/local-dir-entry";
import { parseMissionPrompt } from "@/lib/build-mission-prompt";
import { unionToolsetsFromPlatforms } from "@/lib/hermes-toolset-unify";
import type { PlatformToolsets } from "@/lib/profile-config-builder";
import type { MissionFormState } from "@/components/missions/MissionCreateForm";
import type { MissionTemplate } from "@/components/missions/TemplateModals";
import {
  categoryFilterPills,
  groupTemplatesByCategory,
} from "@/lib/mission-categories";
import type { ManagedCategory } from "@/components/missions/CategoryManagerModal";
import { buildTemplatePayload, splitGoals } from "@/lib/mission-form-utils";
import {
  isMissionActive,
  isMissionDraft,
  isMissionQueuedForRun,
  missionBoardColumn,
} from "@/lib/mission-board";

function submitToastForDispatch(mode: "save" | "now" | "cron" | "queue"): string {
  if (mode === "save") return "Saving draft...";
  if (mode === "queue") return "Queueing mission...";
  if (mode === "cron") return "Scheduling mission...";
  return "Dispatching mission...";
}

export type MissionRow = Mission & {
  cronJob?: {
    state: string;
    enabled: boolean;
    lastRun: string | null;
    lastStatus: string | null;
  };
  latestSession?: { id: string; modified: string } | null;
  /** API may return results as plural field for backward compatibility */
  results?: string;
  /** Runtime error state (not persisted in schema) */
  error?: string;
};

export interface MissionDetail {
  mission: MissionRow;
  cronJob: {
    id: string;
    name: string;
    state: string;
    enabled: boolean;
    lastRun: string | null;
    nextRun: string | null;
    lastStatus: string | null;
    schedule: string;
  } | null;
  sessions: Array<{ id: string; modified: string; size: number }>;
}

export function useMissionsPage() {
  const {
    fetchMissions,
    fetchTemplates,
    fetchMissionDetail,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useMissionsApi();
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [promptCollapsed, setPromptCollapsed] = useState(true);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({
    successful: true,
    failed: true,
  });
  const { showToast, toastElement } = useToast();
  const templateApplied = useRef(false);
  const expandedIdRef = useRef<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateIcon, setTemplateIcon] = useState("Zap");
  const [templateColor, setTemplateColor] = useState("cyan");
  const [templateSaving, setTemplateSaving] = useState(false);

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
  const [newSchedule, setNewSchedule] = useState("every 5m");
  const [scheduleType, setScheduleType] = useState<"interval" | "wall-clock" | "post-run">("interval");
  const [scheduleStartTime, setScheduleStartTime] = useState("00:00");
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
  const [dispatching, setDispatching] = useState(false);
  const [cancellingMissionId, setCancellingMissionId] = useState<string | null>(
    null,
  );
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [missionCategoryFilter, setMissionCategoryFilter] = useState("all");
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [categoriesLoadError, setCategoriesLoadError] = useState<string | null>(
    null,
  );
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const LAST_CATEGORY_KEY = "ch-last-mission-category";

  const formState: MissionFormState = {
    newName,
    newInstruction,
    newContext,
    newGoals,
    newOutputFormat,
    newConstraints,
    newDispatch,
    newSchedule,
    scheduleType,
    scheduleStartTime,
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

  const setFormField = <K extends keyof MissionFormState>(
    field: K,
    value: MissionFormState[K],
  ) => {
    const updaters: Record<keyof MissionFormState, (v: MissionFormState[keyof MissionFormState]) => void> = {
      newName: (v) => setNewName(v as string),
      newInstruction: (v) => setNewInstruction(v as string),
      newContext: (v) => setNewContext(v as string),
      newGoals: (v) => setNewGoals(v as string),
      newOutputFormat: (v) => setNewOutputFormat(v as string),
      newConstraints: (v) => setNewConstraints(v as string),
      newDispatch: (v) => {
        setNewDispatch(v as "save" | "now" | "cron" | "queue");
        setDispatchAcknowledged(true);
      },
      newSchedule: (v) => setNewSchedule(v as string),
      scheduleType: (v) => setScheduleType(v as "interval" | "wall-clock" | "post-run"),
      newMissionTime: (v) => setNewMissionTime(v as number),
      newTimeout: (v) => setNewTimeout(v as number),
      newProfile: (v) => setNewProfile(v as string),
      newModel: (v) => setNewModel(v as string),
      newProvider: (v) => setNewProvider(v as string),
      newLocalDirs: (v) => setNewLocalDirs(v as LocalDirEntry[]),
      localDirDraft: (v) => setLocalDirDraft(v as LocalDirEntry),
      newReferences: (v) => setNewReferences(v as string[]),
      referenceInput: (v) => setReferenceInput(v as string),
      newSkills: (v) => setNewSkills(v as string[]),
      newToolsets: (v) => setNewToolsets(v as string[]),
      scheduleStartTime: (v) => setScheduleStartTime(v as string),
    };
    updaters[field]?.(value);
  };

  function dispatchPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
      localDirs: newLocalDirs,
      references: newReferences,
      skills: newSkills,
      suggestedToolsets: newToolsets,
      ...overrides,
    };
  }

  function resetForm() {
    setNewName("");
    setNewInstruction("");
    setNewContext("");
    setNewGoals("");
    setNewOutputFormat("");
    setNewConstraints("");
    setDispatchAcknowledged(false);
    setNewDispatch("save");
    setNewModel("");
    setNewProvider("");
    setNewLocalDirs([]);
    setLocalDirDraft({ path: "", branch: null });
    setNewReferences([]);
    setNewSkills([]);
    setNewToolsets([]);
    setShowCreate(false);
  }

  useEffect(() => {
    if (!newProfile) return;
    const controller = new AbortController();
    const slug = encodeURIComponent(newProfile);
    Promise.all([
      apiFetch<{ data: { skills?: Array<{ name: string; enabled: boolean }> } }>(`/api/skills?profile=${slug}`, { signal: controller.signal }),
      apiFetch<{ data: { platformToolsets?: PlatformToolsets } }>(`/api/agent/profiles/${slug}/toolsets`, { signal: controller.signal }),
    ])
      .then(([skillsResult, toolsetsResult]) => {
        const enabled = new Set(
          (skillsResult.data?.skills ?? [])
            .filter((s) => s.enabled)
            .map((s) => s.name),
        );
        const toolsetIds = new Set(
          unionToolsetsFromPlatforms(
            toolsetsResult.data?.platformToolsets ?? {},
          ),
        );
        setNewSkills((prev) => prev.filter((s) => enabled.has(s)));
        setNewToolsets((prev) => prev.filter((t) => toolsetIds.has(t)));
      })
      .catch((err) => {
        if (err instanceof Error && err.name !== "AbortError") {
          console.warn("[useMissionsPage] failed to load profile skills/toolsets:", err.message);
        }
      });
    return () => controller.abort();
  }, [newProfile]);

  const loadCategories = useCallback(async () => {
    try {
      const list = await fetchCategories();
      setCategories(list);
      setCategoriesLoadError(null);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to load categories";
      console.error("Failed to load categories:", error);
      setCategoriesLoadError(msg);
      showToast(msg, "error");
    }
  }, [fetchCategories, showToast]);

  const handleCreateCategory = useCallback(
    async (name: string, color?: string): Promise<string | null> => {
      try {
        const cat = await createCategory(name, color);
        if (cat?.id) {
          await loadCategories();
          showToast(`Category "${name}" created`, "success");
          return cat.id as string;
        }
        showToast("Could not create category", "error");
      } catch (error) {
        console.error("Failed to create category:", error);
        const msg =
          error instanceof Error ? error.message : "Failed to create category";
        showToast(msg, "error");
      }
      return null;
    },
    [createCategory, loadCategories, showToast],
  );

  const handleUpdateCategory = useCallback(
    async (id: string, patch: { name?: string; color?: string }) => {
      await updateCategory(id, patch);
      await loadCategories();
    },
    [updateCategory, loadCategories],
  );

  const handleDeleteCategory = useCallback(
    async (id: string, reassignToId: string | null) => {
      await deleteCategory(id, reassignToId);
      await loadCategories();
      await fetchMissions().then(setMissions);
      const loaded = await fetchTemplates();
      setTemplates(loaded);
    },
    [deleteCategory, loadCategories, fetchMissions, fetchTemplates],
  );

  const setCategoryId = useCallback((id: string | null) => {
    setNewCategoryId(id);
    if (id) {
      try {
        localStorage.setItem(LAST_CATEGORY_KEY, id);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (showCreate && !editingId) {
      try {
        const last = localStorage.getItem(LAST_CATEGORY_KEY);
        if (last && !newCategoryId) setNewCategoryId(last);
      } catch {
        // ignore
      }
    }
  }, [showCreate, editingId, newCategoryId]);

  // ── Shared form population helpers ─────────────────────────────────

  /**
   * Populate form state from a mission template.
   * Used by handleTemplateSelect, handleTemplateEdit, and fetchData.
   */
  const applyTemplateToForm = (
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
    setNewOutputFormat(
      (t as MissionTemplate & { outputFormat?: string }).outputFormat ?? "",
    );
    setNewConstraints(
      (t as MissionTemplate & { constraints?: string }).constraints ?? "",
    );
    setNewProfile(t.profile || "");
    setNewModel(t.defaultModel || "");
    setNewProvider(t.defaultProvider || "");
    setNewLocalDirs(
      normalizeLocalDirsInput(
        (t as MissionTemplate & { localDirs?: unknown }).localDirs,
      ),
    );
    setLocalDirDraft({ path: "", branch: null });
    setNewReferences(
      (t as MissionTemplate & { references?: string[] }).references ?? [],
    );
    setNewSkills(t.suggestedSkills || []);
    setNewToolsets(
      (t as MissionTemplate & { suggestedToolsets?: string[] }).suggestedToolsets ?? [],
    );
    setNewCategoryId(
      categoryIdOverride !== undefined
        ? categoryIdOverride
        : (t as MissionTemplate & { categoryId?: string }).categoryId ?? null
    );
    const tm = (t as MissionTemplate & { timeoutMinutes?: number }).timeoutMinutes;
    if (typeof tm === "number" && Number.isFinite(tm)) {
      setNewTimeout(tm);
    }
    if (t.dispatchMode) {
      setNewDispatch(t.dispatchMode as "save" | "now" | "cron" | "queue");
    }
    if (t.schedule) setNewSchedule(t.schedule);
  };

  const fetchData = useCallback(async () => {
    try {
      const list = await fetchMissions();
      setMissions(list);
    } catch (error) {
      console.error("Failed to load missions:", error);
    }

    await loadCategories();

    try {
      const loaded = await fetchTemplates();
      setTemplates(loaded);
      if (!templateApplied.current && loaded.length > 0) {
        const url = new URL(window.location.href);
        const templateId = url.searchParams.get("template");
        if (templateId) {
          const t = loaded.find(
            (tmpl: MissionTemplate) => tmpl.id === templateId,
          );
          if (t) {
            const cid = (t as MissionTemplate & { categoryId?: string }).categoryId ?? null;
            applyTemplateToForm(t, cid);
            if (cid) {
              try {
                localStorage.setItem(LAST_CATEGORY_KEY, cid);
              } catch {
                // ignore
              }
            }
            setShowCreate(true);
            templateApplied.current = true;
            showToast(`Template loaded: ${t.name}`, "success");
            window.history.replaceState({}, "", "/orchestration/missions");
          }
        }
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
      showToast("Failed to load templates", "error");
    }
  }, [fetchMissions, fetchTemplates, showToast, loadCategories]);

  const fetchDetail = useCallback(
    (id: string, showLoading = true) => {
      if (showLoading) setDetailLoading(true);
      fetchMissionDetail(id)
        .then((data) => {
          if (data) setDetail(data);
        })
        .catch((error) => {
          console.error("Failed to load mission detail:", error);
        })
        .finally(() => {
          if (showLoading) setDetailLoading(false);
        });
    },
    [fetchMissionDetail],
  );

  useEffect(() => {
    expandedIdRef.current = expandedId;
  }, [expandedId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchData().finally(() => {
      if (!cancelled) setLoading(false);
    });
    const interval = setInterval(() => {
      void fetchData();
      const id = expandedIdRef.current;
      if (id) fetchDetail(id, false);
    }, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchData, fetchDetail]);

  useEffect(() => {
    if (expandedId) {
      setPromptCollapsed(true);
      fetchDetail(expandedId, true);
    } else {
      setDetail(null);
    }
  }, [expandedId, fetchDetail]);

  const handleCreate = async () => {
    if (!newName.trim() || !newInstruction.trim()) return;
    if (!editingId && !dispatchAcknowledged) {
      showToast("Open Dispatch to choose how this mission runs.", "error");
      return;
    }
    if (dispatching) return;
    setDispatching(true);

    try {
      if (editingId) {
        const existingMission = missions.find((m) => m.id === editingId);
        const isCompleted =
          existingMission &&
          (existingMission.status === "successful" ||
            existingMission.status === "failed");
        const isRunning = existingMission?.status === "dispatched";
        const isPromotable =
          existingMission &&
          (isMissionDraft(existingMission) || isMissionQueuedForRun(existingMission));

        if (isRunning) {
          showToast("Updating mission...", "info");
          const { ok, error } = await safeApiCall("/api/missions", {
            method: "POST",
            body: {
              action: "update",
              missionId: editingId,
              name: newName,
              ...dispatchPayload({
                schedule: newDispatch === "cron" ? newSchedule : undefined,
              }),
            },
          });
          if (ok) {
            showToast("Mission updated", "success");
            setEditingId(null);
            setShowCreate(false);
            fetchData();
            if (expandedId === editingId) fetchDetail(editingId);
          } else {
            showToast(error || "Failed to update mission", "error");
          }
          setDispatching(false);
          return;
        }

        if (isPromotable) {
          showToast(submitToastForDispatch(newDispatch), "info");
          const { ok, error } = await safeApiCall<{ data?: { mission?: object } }>("/api/missions", {
            method: "POST",
            body: {
              action: "promote",
              missionId: editingId,
              name: newName,
              ...dispatchPayload({
                dispatchMode: newDispatch,
                schedule: newDispatch === "cron" ? newSchedule : undefined,
              }),
            },
          });
          if (ok) {
            if (newDispatch === "save") {
              showToast("Mission saved as draft", "success");
            } else if (newDispatch === "queue") {
              showToast("Mission saved to queue", "success");
            } else if (newDispatch === "now") {
              showToast("Mission dispatched", "success");
            } else {
              showToast(`Mission scheduled: ${newSchedule}`, "success");
            }
            setEditingId(null);
            setShowCreate(false);
            resetForm();
            await fetchData();
            if (expandedId === editingId) fetchDetail(editingId);
          } else {
            showToast(error || "Failed to update mission", "error");
          }
          setDispatching(false);
          return;
        }

        if (!isCompleted) {
          setDispatching(false);
          return;
        }

        setEditingId(null);

        const { ok, error, data } = await safeApiCall<{ data?: { mission?: { id: string } } }>("/api/missions", {
          method: "POST",
          body: {
            action: "dispatch",
            name: newName,
            ...dispatchPayload({ dispatchMode: "now" }),
          },
        });

        if (ok) {
          const body = data;
          showToast("Mission re-dispatched", "success");
          setDispatching(false);
          await fetchData();
          if (body?.data?.mission?.id) {
            setExpandedId(body.data.mission.id);
            void fetchDetail(body.data.mission.id);
          }
        } else {
          showToast(error || "Failed to re-dispatch mission", "error");
          setDispatching(false);
        }
        return;
      }

      showToast(submitToastForDispatch(newDispatch), "info");

      const { ok, error, data } = await safeApiCall<{ data?: { mission?: { id: string } } }>("/api/missions", {
        method: "POST",
        body: {
          action: "dispatch",
          name: newName,
          ...dispatchPayload({
            dispatchMode: newDispatch,
            schedule: newDispatch === "cron" ? newSchedule : undefined,
          }),
        },
      });

      if (ok) {
        if (newDispatch === "save" || newDispatch === "queue") {
          showToast(
            newDispatch === "save"
              ? "Mission saved as draft"
              : "Mission saved to queue",
            "success",
          );
          resetForm();
          fetchData();
          setDispatching(false);
        } else if (newDispatch === "now") {
          const body = data;
          showToast("Mission dispatched", "success");
          setDispatching(false);
          await fetchData();
          if (body?.data?.mission?.id) {
            setExpandedId(body.data.mission.id);
            void fetchDetail(body.data.mission.id);
          }
        } else {
          showToast(`Mission scheduled: ${newSchedule}`, "success");
          setDispatching(false);
          await fetchData();
        }
      } else {
        showToast(error || "Failed to create mission", "error");
        setDispatching(false);
      }
    } catch {
      showToast("Network error — please try again", "error");
      setDispatching(false);
    }
  };

  // ── Shared form population helpers ─────────────────────────────────

  /**
   * Populate form state from a mission.
   * Used by both handleEdit (in-place edit) and handleDuplicateMission.
   */
  function populateFormFromMission(
    m: MissionRow,
    opts: { editing: boolean; namePrefix?: string },
  ) {
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
    setNewModel(m.modelId || m.model || "");
    setNewProvider(m.provider || "");
    if (m.profileName) setNewProfile(m.profileName);
    if (typeof m.missionTimeMinutes === "number") setNewMissionTime(m.missionTimeMinutes);
    if (typeof m.timeoutMinutes === "number") setNewTimeout(m.timeoutMinutes);
    if (m.schedule) {
      setNewSchedule(m.schedule);
      const s = m.schedule.trim();
      setScheduleType(s.includes("*") || /^\d/.test(s) ? "wall-clock" : "interval");
    } else {
      setNewSchedule("every 5m");
      setScheduleType("interval");
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
  }

  // ── Mission handlers ───────────────────────────────────────────────

  const handleEdit = (m: MissionRow) => {
    setEditingId(m.id);
    populateFormFromMission(m, { editing: true });
    setShowCreate(true);
  };

  const handleDuplicateMission = (m: MissionRow) => {
    setEditingId(null);
    populateFormFromMission(m, { editing: false, namePrefix: "(copy)" });
    setNewDispatch("save");
    setShowCreate(true);
    showToast("Mission duplicated as draft", "success");
  };

  const handleSaveAsTemplate = async () => {
    if (!newInstruction.trim()) return;

    const name = newName.trim() || "Untitled Template";

    // Check if we're overwriting an existing template
    const existingTemplate = editingTemplateId
      ? templates.find((t) => t.id === editingTemplateId)
      : templates.find(
          (t) =>
            t.name === name &&
            (t as MissionTemplate & { isCustom?: boolean }).isCustom !== false,
        );

    if (existingTemplate) {
      const confirmed = window.confirm(
        `Overwrite template "${existingTemplate.name}"?`,
      );
      if (!confirmed) return;
    }

    setTemplateSaving(true);
    try {
      const payload = buildTemplatePayload({
        action: existingTemplate ? "update" : "create",
        templateId: existingTemplate?.id,
        name,
        icon: templateIcon,
        color: templateColor,
        description: templateDescription,
        instruction: newInstruction,
        context: newContext,
        outputFormat: newOutputFormat,
        constraints: newConstraints,
        goals: newGoals,
        localDirs: newLocalDirs,
        references: newReferences,
        suggestedSkills: newSkills,
        suggestedToolsets: newToolsets,
        profile: newProfile,
        defaultModel: newModel,
        defaultProvider: newProvider,
        timeoutMinutes: newTimeout,
        categoryId: newCategoryId,
      });

      const res = await safeApiCall("/api/templates", {
        method: "POST",
        body: payload,
      });

      if (res.ok) {
        showToast(
          existingTemplate ? "Template updated!" : "Template saved!",
          "success",
        );
        setEditingTemplateId(null);
        fetchData();
      } else {
        showToast(res.error || "Failed to save template", "error");
      }
    } catch {
      showToast("Failed to save template", "error");
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleCreateNewTemplate = useCallback(() => {
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateDescription("");
    setTemplateIcon("Zap");
    setTemplateColor("cyan");
    setNewInstruction("");
    setNewContext("");
    setNewGoals("");
    setNewOutputFormat("");
    setNewConstraints("");
    setNewLocalDirs([]);
    setLocalDirDraft({ path: "", branch: null });
    setNewReferences([]);
    setNewSkills([]);
    setNewToolsets([]);
    setShowTemplateManager(false);
    setShowTemplateEditor(true);
  }, []);

  const handleTemplateSave = async () => {
    if (!templateName.trim()) return;
    setTemplateSaving(true);
    try {
      const payload = buildTemplatePayload({
        action: editingTemplateId ? "update" : "create",
        templateId: editingTemplateId ?? undefined,
        name: templateName,
        icon: templateIcon,
        color: templateColor,
        description: templateDescription,
        instruction: newInstruction,
        context: newContext,
        outputFormat: newOutputFormat,
        constraints: newConstraints,
        goals: newGoals,
        localDirs: newLocalDirs,
        references: newReferences,
        suggestedSkills: newSkills,
        suggestedToolsets: newToolsets,
        profile: newProfile,
        defaultModel: newModel,
        defaultProvider: newProvider,
        timeoutMinutes: newTimeout,
        categoryId: newCategoryId ?? null,
        dispatchMode: editingTemplateId ? undefined : newDispatch,
        schedule: editingTemplateId ? undefined : newSchedule,
      });

      const res = await safeApiCall("/api/templates", {
        method: "POST",
        body: payload,
      });
      if (res.ok) {
        showToast(
          editingTemplateId ? "Template updated!" : "Template saved!",
          "success",
        );
        setShowTemplateEditor(false);
        setEditingTemplateId(null);
        fetchData();
      } else {
        showToast(res.error || "Failed to save template", "error");
      }
    } catch {
      showToast("Failed to save template", "error");
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleEditTemplate = (
    t: MissionTemplate & {
      isCustom?: boolean;
      instruction?: string;
      context?: string;
      dispatchMode?: string;
      schedule?: string;
    },
  ) => {
    setEditingTemplateId(t.id);
    setTemplateName(t.name);
    setTemplateDescription(t.description || "");
    setTemplateIcon(t.icon);
    setTemplateColor(t.color);
    applyTemplateToForm(t);
    setShowTemplateManager(false);
    setShowTemplateEditor(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Delete this template?")) return;
    const { ok, error } = await safeApiCall("/api/templates", {
      method: "POST",
      body: { action: "delete", templateId },
    });
    if (ok) {
      showToast("Template deleted", "success");
      setShowTemplateManager(false);
      fetchData();
    } else {
      showToast(error || "Failed to delete template", "error");
    }
  };
  const handleTemplateSelect = (t: MissionTemplate) => {
    applyTemplateToForm(t);
    setShowCreate(true);
    showToast(`Template loaded: ${t.name}`, "success");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this mission and its cron job?")) return;
    const { ok, error } = await safeApiCall("/api/missions", {
      method: "POST",
      body: { action: "delete", missionId: id },
    });
    if (ok) {
      showToast("Mission deleted", "success");
      if (expandedId === id) setExpandedId(null);
      fetchData();
    } else {
      showToast(error || "Failed to delete mission", "error");
    }
  };

  const handleCancel = async (id: string) => {
    if (
      !confirm(
        "Cancel this mission? The running agent (and any subagents) will be stopped, and linked cron jobs will be paused.",
      )
    )
      return;

    const previousMission = missions.find((m) => m.id === id);
    setCancellingMissionId(id);
    showToast("Cancelling mission…", "info");
    setMissions((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, status: "failed" as const, result: "Cancelled by user" }
          : m,
      ),
    );

    try {
      const { ok, error } = await safeApiCall("/api/missions", {
        method: "POST",
        body: { action: "cancel", missionId: id },
      });
      if (ok) {
        showToast("Mission cancelled", "success");
        await fetchData();
        if (expandedId === id) void fetchDetail(id);
      } else {
        if (previousMission) {
          setMissions((prev) =>
            prev.map((m) => (m.id === id ? previousMission : m)),
          );
        }
        showToast(error || "Failed to cancel mission", "error");
      }
    } catch {
      if (previousMission) {
        setMissions((prev) =>
          prev.map((m) => (m.id === id ? previousMission : m)),
        );
      }
      showToast("Network error — could not cancel mission", "error");
    } finally {
      setCancellingMissionId(null);
    }
  };

  const filtered = useMemo(
    () =>
      missions.filter((m) => {
        if (filter !== "all") {
          const column = missionBoardColumn(m);
          if (filter !== column) return false;
        }
        if (missionCategoryFilter !== "all") {
          if (missionCategoryFilter === "__uncategorized__") {
            if (m.categoryId) return false;
          } else if (m.categoryId !== missionCategoryFilter) {
            return false;
          }
        }
        if (
          search &&
          !m.name.toLowerCase().includes(search.toLowerCase()) &&
          !m.prompt.toLowerCase().includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [missions, filter, search, missionCategoryFilter],
  );

  const missionCounts = useMemo(
    () => ({
      active: missions.filter((m) => isMissionActive(m)).length,
      completed: missions.filter((m) => m.status === "successful").length,
      failed: missions.filter((m) => m.status === "failed").length,
      drafts: missions.filter((m) => isMissionDraft(m)).length,
      queued: missions.filter((m) => isMissionQueuedForRun(m)).length,
    }),
    [missions],
  );

  useEffect(() => {
    if (!showCreate || editingId) return;
    if (newModel.trim()) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const [defaultsRes, modelsRes] = await Promise.all([
          safeApiCall<{ defaults?: { agent?: string | null } }>("/api/models/defaults", { signal: controller.signal }),
          safeApiCall<{ models?: Array<{ id: string; modelId: string; provider: string }> }>("/api/models", { signal: controller.signal }),
        ]);
        if (!defaultsRes.ok || !modelsRes.ok) return;

        const agentRegistryId = defaultsRes.data?.defaults?.agent;
        if (!agentRegistryId) return;

        const match = modelsRes.data?.models?.find((m) => m.id === agentRegistryId);
        if (!match) return;

        setNewModel(match.modelId);
        setNewProvider(match.provider);
      } catch {
        /* aborted or network */
      }
    })();

    return () => controller.abort();
  }, [showCreate, editingId, newModel]);

  const templateCategoryPills = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of templates) {
      const cid =
        (t as MissionTemplate & { categoryId?: string }).categoryId ??
        "general";
      counts[cid] = (counts[cid] ?? 0) + 1;
    }
    return categoryFilterPills(categories, counts, false, 0);
  }, [templates, categories]);

  const missionCategoryPills = useMemo(() => {
    const counts: Record<string, number> = {};
    let uncategorized = 0;
    for (const m of missions) {
      if (!m.categoryId) {
        uncategorized += 1;
      } else {
        counts[m.categoryId] = (counts[m.categoryId] ?? 0) + 1;
      }
    }
    return categoryFilterPills(categories, counts, true, uncategorized);
  }, [missions, categories]);

  const filteredGrouped = useMemo(() => {
    const grouped = groupTemplatesByCategory(
      templates as Array<MissionTemplate & { categoryId?: string }>,
      categories,
    );
    if (categoryFilter === "all") return grouped;
    return grouped.filter((g) => {
      if (categoryFilter === "__uncategorized__") {
        return g.categoryId === null;
      }
      return g.categoryId === categoryFilter;
    });
  }, [templates, categoryFilter, categories]);

  return {
    toastElement,
    loading,
    missions,
    templates,
    fetchData,
    missionCounts,
    showCreate,
    setShowCreate,
    editingId,
    setEditingId,
    filter,
    setFilter,
    search,
    setSearch,
    expandedId,
    setExpandedId,
    detail,
    detailLoading,
    promptCollapsed,
    setPromptCollapsed,
    collapsedColumns,
    setCollapsedColumns,
    categoryFilter,
    setCategoryFilter,
    missionCategoryFilter,
    setMissionCategoryFilter,
    categories,
    categoriesLoadError,
    newCategoryId,
    setNewCategoryId,
    showCategoryManager,
    setShowCategoryManager,
    loadCategories,
    handleCreateCategory,
    handleCreateNewTemplate,
    handleUpdateCategory,
    handleDeleteCategory,
    setCategoryId,
    templateCategoryPills,
    missionCategoryPills,
    filteredGrouped,
    filtered,
    formState,
    setFormField,
    handleCreate,
    handleSaveAsTemplate,
    dispatching,
    cancellingMissionId,
    handleTemplateSelect,
    setShowTemplateManager,
    showTemplateManager,
    handleEditTemplate,
    handleDeleteTemplate,
    showTemplateEditor,
    setShowTemplateEditor,
    editingTemplateId,
    setEditingTemplateId,
    templateName,
    setTemplateName,
    templateDescription,
    setTemplateDescription,
    templateIcon,
    setTemplateIcon,
    templateColor,
    setTemplateColor,
    templateSaving,
    handleTemplateSave,
    newInstruction,
    setNewInstruction,
    newContext,
    setNewContext,
    newGoals,
    setNewGoals,
    newOutputFormat,
    setNewOutputFormat,
    newConstraints,
    setNewConstraints,
    dispatchAcknowledged,
    setDispatchAcknowledged,
    newProfile,
    setNewProfile,
    newModel,
    newProvider,
    setNewModel,
    setNewProvider,
    newMissionTime,
    setNewMissionTime,
    newTimeout,
    setNewTimeout,
    newLocalDirs,
    setNewLocalDirs,
    localDirDraft,
    setLocalDirDraft,
    newReferences,
    setNewReferences,
    referenceInput,
    setReferenceInput,
    newSkills,
    setNewSkills,
    handleEdit,
    handleDelete,
    handleCancel,
    handleDuplicateMission,
  };
}

export type MissionsPageViewModel = ReturnType<typeof useMissionsPage>;

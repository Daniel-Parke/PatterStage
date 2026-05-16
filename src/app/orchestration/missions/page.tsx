"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Zap,
  ChevronRight,
  X,
  ExternalLink,
  StopCircle,
  RefreshCw,
  Edit3,
  Layers,
} from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { StatusDot } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import CategoryAccordion from "@/components/ui/CategoryAccordion";
import TemplateCard from "@/components/ui/TemplateCard";
import { timeAgo, titleCase } from "@/lib/utils";
import { useMissionsApi } from "@/hooks/useMissionsApi";
import type { LocalDirEntry, Mission } from "@/types/hermes";
import { normalizeLocalDirsInput } from "@/lib/local-dir-entry";
import { buildMissionPrompt, stripPromptSections } from "@/lib/build-mission-prompt";

import MissionCreateForm from "@/components/missions/MissionCreateForm";
import type { MissionFormState } from "@/components/missions/MissionCreateForm";
import {
  TemplateManagerModal,
  TemplateEditorModal,
  MissionTemplate,
  CATEGORY_ORDER,
  CATEGORY_COLORS,
  groupTemplates,
} from "@/components/missions/TemplateModals";

type MissionRow = Mission & {
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

interface MissionDetail {
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

// ── Unified status configuration ─────────────────────────────────
interface StatusConfig {
  dot: "online" | "warning" | "error" | "idle";
  bg: string;
  text: string;
  icon: React.ReactNode;
  columnDot: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  queued: {
    dot: "warning", bg: "bg-neon-orange/10", text: "text-neon-orange",
    icon: <Clock className="w-3.5 h-3.5 text-neon-orange" />,
    columnDot: "bg-neon-orange",
  },
  dispatched: {
    dot: "online", bg: "bg-neon-cyan/10", text: "text-neon-cyan",
    icon: <Loader2 className="w-3.5 h-3.5 text-neon-cyan animate-spin" />,
    columnDot: "bg-neon-cyan",
  },
  successful: {
    dot: "online", bg: "bg-neon-green/10", text: "text-neon-green",
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-neon-green" />,
    columnDot: "bg-neon-green",
  },
  failed: {
    dot: "error", bg: "bg-red-500/10", text: "text-red-400",
    icon: <XCircle className="w-3.5 h-3.5 text-red-400" />,
    columnDot: "bg-red-400",
  },
};

// ── Category filter button active styles ──────────────────────
const CATEGORY_ACTIVE_CLASSES: Record<string, string> = {
  cyan: "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40",
  purple: "bg-neon-purple/20 text-neon-purple border border-neon-purple/40",
  pink: "bg-neon-pink/20 text-neon-pink border border-neon-pink/40",
  green: "bg-neon-green/20 text-neon-green border border-neon-green/40",
  orange: "bg-neon-orange/20 text-neon-orange border border-neon-orange/40",
};

export default function MissionsPage() {
  const { fetchMissions, fetchTemplates, fetchMissionDetail } =
    useMissionsApi();
  const router = useRouter();
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

  // Create form state
  const [newName, setNewName] = useState("");
  const [newInstruction, setNewInstruction] = useState("");
  const [newContext, setNewContext] = useState("");
  const [newGoals, setNewGoals] = useState("");
  const [newDispatch, setNewDispatch] = useState<"save" | "now" | "cron" | "queue">(
    "now",
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
  const [referenceInput, setReferenceInput] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Form state bridge for MissionCreateForm
  const formState: MissionFormState = {
    newName,
    newInstruction,
    newContext,
    newGoals,
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
  };

  const setFormField = <K extends keyof MissionFormState>(
    field: K,
    value: MissionFormState[K],
  ) => {
    switch (field) {
      case "newName": setNewName(value as string); break;
      case "newInstruction": setNewInstruction(value as string); break;
      case "newContext": setNewContext(value as string); break;
      case "newGoals": setNewGoals(value as string); break;
      case "newDispatch": setNewDispatch(value as "save" | "now" | "cron" | "queue"); break;
      case "newSchedule": setNewSchedule(value as string); break;
      case "scheduleType": setScheduleType(value as "interval" | "wall-clock" | "post-run"); break;
      case "newMissionTime": setNewMissionTime(value as number); break;
      case "newTimeout": setNewTimeout(value as number); break;
      case "newProfile": setNewProfile(value as string); break;
      case "newModel": setNewModel(value as string); break;
      case "newProvider": setNewProvider(value as string); break;
      case "newLocalDirs": setNewLocalDirs(value as LocalDirEntry[]); break;
      case "localDirDraft": setLocalDirDraft(value as LocalDirEntry); break;
      case "newReferences": setNewReferences(value as string[]); break;
      case "referenceInput": setReferenceInput(value as string); break;
      case "newSkills": setNewSkills(value as string[]); break;
      case "scheduleStartTime": setScheduleStartTime(value as string); break;
    }
  };

  const fetchData = useCallback(() => {
    fetchMissions()
      .then((list) => setMissions(list))
      .catch((error) => {
        console.error("Failed to load missions:", error);
      });

    fetchTemplates()
      .then((loaded) => {
        setTemplates(loaded);
        if (!templateApplied.current && loaded.length > 0) {
          // Same-origin URL — host/port come from the browser; no hardcoded Control Hub port.
          const url = new URL(window.location.href);
          const templateId = url.searchParams.get("template");
          if (templateId) {
            const t = loaded.find(
              (tmpl: MissionTemplate) => tmpl.id === templateId,
            );
            if (t) {
              setNewName(t.name);
              setNewInstruction(t.instruction);
              setNewContext(t.context);
              setNewGoals(t.goals.join("\n"));
              if (t.profile) setNewProfile(t.profile);
              if (t.defaultModel) setNewModel(t.defaultModel);
              if (t.defaultProvider) setNewProvider(t.defaultProvider);
              setNewLocalDirs(
                normalizeLocalDirsInput(
                  (t as MissionTemplate & { localDirs?: unknown }).localDirs,
                ),
              );
              setNewReferences(
                (t as MissionTemplate & { references?: string[] }).references ??
                  [],
              );
              setNewSkills(t.suggestedSkills || []);
              setShowCreate(true);
              templateApplied.current = true;
              window.history.replaceState({}, "", "/missions");
            }
          }
        }
      })
      .catch((error) => {
        console.error("Failed to load templates:", error);
      });
  }, [fetchMissions, fetchTemplates]);

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
    fetchData();
    setLoading(false);
    const interval = setInterval(() => {
      fetchData();
      const id = expandedIdRef.current;
      if (id) fetchDetail(id, false);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData, fetchDetail]);

  // Load detail once when expanded (with loading spinner)
  useEffect(() => {
    if (expandedId) {
      setPromptCollapsed(true);
      fetchDetail(expandedId, true);
    } else {
      setDetail(null);
    }
  }, [expandedId, fetchDetail]);

  // Build final prompt using shared utility
  const buildPrompt = useCallback(() => {
    return buildMissionPrompt({
      instruction: newInstruction,
      localDirs: newLocalDirs,
      references: newReferences,
      skills: newSkills,
      context: newContext,
    });
  }, [newInstruction, newLocalDirs, newReferences, newSkills, newContext]);

  const handleCreate = async () => {
    if (!newName.trim() || !newInstruction.trim()) return;
    if (dispatching) return; // Prevent double-submit
    setDispatching(true);

    const fullPrompt = buildPrompt();

    try {
      // Update existing mission (only for active missions with a live cron job)
      if (editingId) {
        const existingMission = missions.find((m) => m.id === editingId);
        const isActive =
          existingMission &&
          (existingMission.status === "queued" ||
            existingMission.status === "dispatched");

        if (isActive) {
          // Active mission - update and sync to cron job
          showToast("Updating mission...", "info");
          const res = await fetch("/api/missions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "update",
              missionId: editingId,
              name: newName,
              instruction: fullPrompt,
              goals: newGoals.split("\n").filter((g) => g.trim()),
              profile: newProfile || undefined,
              profileName: newProfile || undefined,
              modelId: newModel || undefined,
              provider: newProvider || undefined,
              missionTimeMinutes: newMissionTime,
              timeoutMinutes: newTimeout,
              schedule: newDispatch === "cron" ? newSchedule : undefined,
              localDirs: newLocalDirs,
              references: newReferences,
              skills: newSkills,
            }),
          });
          if (res.ok) {
            showToast("Mission updated - cron job prompt synced", "success");
            setEditingId(null);
            setShowCreate(false);
            fetchData();
            if (expandedId === editingId) fetchDetail(editingId);
          } else {
            showToast("Failed to update mission", "error");
          }
          setDispatching(false);
          return;
        }

        // Completed/failed mission - create a NEW dispatch (re-dispatch)
        setEditingId(null);

        const res = await fetch("/api/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "dispatch",
            name: newName,
            instruction: fullPrompt,
            goals: newGoals.split("\n").filter((g) => g.trim()),
            dispatchMode: "now",
            profile: newProfile || undefined,
            profileName: newProfile || undefined,
            modelId: newModel || undefined,
            provider: newProvider || undefined,
            missionTimeMinutes: newMissionTime,
            timeoutMinutes: newTimeout,
            localDirs: newLocalDirs,
            references: newReferences,
            skills: newSkills,
          }),
        });

        if (res.ok) {
          showToast(
            "Mission re-dispatched! Returning to dashboard...",
            "success",
          );
          setDispatching(false);
          setTimeout(() => router.push("/"), 2000);
        } else {
          showToast("Failed to re-dispatch mission", "error");
          setDispatching(false);
        }
        return;
      }

      // Create new mission
      showToast("Dispatching mission...", "info");

      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dispatch",
          name: newName,
          instruction: fullPrompt,
          goals: newGoals.split("\n").filter((g) => g.trim()),
          dispatchMode: newDispatch,
          schedule: newDispatch === "cron" ? newSchedule : undefined,
          profile: newProfile || undefined,
          profileName: newProfile || undefined,
          modelId: newModel || undefined,
          provider: newProvider || undefined,
          missionTimeMinutes: newMissionTime,
          timeoutMinutes: newTimeout,
          localDirs: newLocalDirs,
          references: newReferences,
          skills: newSkills,
        }),
      });

      if (res.ok) {
        if (newDispatch === "save") {
          showToast("Mission saved as draft", "success");
          setNewName("");
          setNewInstruction("");
          setNewContext("");
          setNewGoals("");
          setNewModel("");
          setNewProvider("");
          setNewLocalDirs([]);
          setLocalDirDraft({ path: "", branch: null });
          setNewReferences([]);
          setNewSkills([]);
          setShowCreate(false);
          fetchData();
          setDispatching(false);
        } else if (newDispatch === "queue") {
          showToast("Mission queued — visible on the board", "success");
          setNewName("");
          setNewInstruction("");
          setNewContext("");
          setNewGoals("");
          setNewModel("");
          setNewProvider("");
          setNewLocalDirs([]);
          setLocalDirDraft({ path: "", branch: null });
          setNewReferences([]);
          setNewSkills([]);
          setShowCreate(false);
          fetchData();
          setDispatching(false);
        } else if (newDispatch === "now") {
          showToast("Mission dispatched! Returning to dashboard...", "success");
          setDispatching(false);
          setTimeout(() => router.push("/"), 2000);
        } else {
          showToast(`Mission scheduled - ${newSchedule}`, "success");
          setDispatching(false);
          setTimeout(() => router.push("/"), 2000);
        }
      } else {
        showToast("Failed to create mission", "error");
        setDispatching(false);
      }
    } catch {
      showToast("Network error — please try again", "error");
      setDispatching(false);
    }
  };

  const handleEdit = (m: MissionRow) => {
    setEditingId(m.id);
    setNewName(m.name);
    // Split prompt back into instruction + context using shared utility
    const { instruction, context } = stripPromptSections(m.prompt);
    setNewInstruction(instruction);
    setNewContext(context);
    setNewGoals(m.goals?.join("\n") ?? "");
    setNewLocalDirs(normalizeLocalDirsInput(m.localDirs));
    setLocalDirDraft({ path: "", branch: null });
    setNewReferences(m.references ?? []);
    setNewSkills(m.skills ?? []);

    // Restore mission runtime settings (migration 013 — may be null on old missions)
    setNewModel(m.modelId || m.model || "");
    setNewProvider(m.provider || "");
    if (m.profileName) setNewProfile(m.profileName);
    if (typeof m.missionTimeMinutes === "number") setNewMissionTime(m.missionTimeMinutes);
    if (typeof m.timeoutMinutes === "number") setNewTimeout(m.timeoutMinutes);
    if (m.schedule) {
      setNewSchedule(m.schedule);
      // Detect schedule format: cron expressions contain "*" or start with digits
      const s = m.schedule.trim();
      if (s.includes("*") || /^\d/.test(s)) {
        setScheduleType("wall-clock");
      } else {
        // "every N" format covers both interval and post-run (can't distinguish without stored scheduleType)
        setScheduleType("interval");
      }
    } else {
      setNewSchedule("every 5m");
      setScheduleType("interval");
    }

    // Auto-set dispatch mode to "now" for completed/failed missions (re-dispatch)
    if (m.status === "successful" || m.status === "failed") {
      setNewDispatch("now");
    }
    setShowCreate(true);
  };

  const handleSaveAsTemplate = () => {
    if (!newInstruction.trim()) return;
    setTemplateName(newName || "");
    setTemplateDescription("");
    setTemplateIcon("Zap");
    setTemplateColor("cyan");
    setShowTemplateEditor(true);
  };

  const handleTemplateSave = async () => {
    if (!templateName.trim()) return;
    setTemplateSaving(true);
    try {
      const payload: Record<string, unknown> = editingTemplateId
        ? { action: "update", templateId: editingTemplateId }
        : { action: "create" };

      payload.name = templateName;
      payload.icon = templateIcon;
      payload.color = templateColor;
      payload.description = templateDescription;

      // Always include instruction/context/goals
      payload.instruction = newInstruction;
      payload.context = newContext;
      payload.goals = newGoals.split("\n").filter((g) => g.trim());
      payload.localDirs = newLocalDirs;
      payload.references = newReferences;
      payload.suggestedSkills = newSkills;
      payload.profile = newProfile;
      payload.defaultModel =
        typeof newModel === "string" && newModel.trim() !== ""
          ? newModel.trim()
          : undefined;
      payload.defaultProvider =
        typeof newProvider === "string" && newProvider.trim() !== ""
          ? newProvider.trim()
          : undefined;
      payload.timeoutMinutes = newTimeout;
      if (!editingTemplateId) {
        payload.dispatchMode = newDispatch;
        payload.schedule = newSchedule;
      }

      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        showToast("Failed to save template", "error");
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

  // Shared helper to fill mission form fields from a template.
  const applyTemplateToForm = (
    t: MissionTemplate & {
      instruction?: string;
      context?: string;
      dispatchMode?: string;
      schedule?: string;
    },
  ) => {
    setNewInstruction(t.instruction || "");
    setNewContext(t.context || "");
    setNewGoals((t.goals || []).join("\n"));
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
    const tm = (t as MissionTemplate & { timeoutMinutes?: number }).timeoutMinutes;
    if (typeof tm === "number" && Number.isFinite(tm)) {
      setNewTimeout(tm);
    }
    if (t.dispatchMode)
      setNewDispatch(t.dispatchMode as "save" | "now" | "cron");
    if (t.schedule) setNewSchedule(t.schedule);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Delete this template?")) return;
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", templateId }),
    });
    if (res.ok) {
      showToast("Template deleted", "success");
      setShowTemplateManager(false);
      fetchData();
    } else {
      const body = await res.json().catch(() => null);
      showToast(body?.error || "Failed to delete template", "error");
    }
  };
  const handleTemplateSelect = (t: MissionTemplate) => {
    setNewName(t.name);
    applyTemplateToForm(t);
    setShowCreate(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this mission and its cron job?")) return;
    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", missionId: id }),
    });
    if (res.ok) {
      showToast("Mission deleted", "success");
      if (expandedId === id) setExpandedId(null);
      fetchData();
    } else {
      const body = await res.json().catch(() => null);
      showToast(body?.error || "Failed to delete mission", "error");
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this mission? The cron job will be paused.")) return;
    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", missionId: id }),
    });
    if (res.ok) {
      showToast("Mission cancelled", "success");
      fetchData();
      if (expandedId === id) fetchDetail(id);
    } else {
      const body = await res.json().catch(() => null);
      showToast(body?.error || "Failed to cancel mission", "error");
    }
  };

  const filtered = useMemo(
    () =>
      missions.filter((m) => {
        if (filter !== "all" && m.status !== filter) return false;
        if (
          search &&
          !m.name.toLowerCase().includes(search.toLowerCase()) &&
          !m.prompt.toLowerCase().includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [missions, filter, search],
  );

  const missionCounts = useMemo(
    () => ({
      active: missions.filter((m) => m.status === "queued" || m.status === "dispatched").length,
      completed: missions.filter((m) => m.status === "successful").length,
      failed: missions.filter((m) => m.status === "failed").length,
    }),
    [missions],
  );

  // ── Template category computation (extracted from inline IIFEs) ──

  const allCategories = useMemo(() => {
    const knownSet = new Set(CATEGORY_ORDER);
    const extra = templates
      .map((t) => (t.isCustom ? "Custom" : t.category || "Other"))
      .filter((c) => !knownSet.has(c));
    return [...CATEGORY_ORDER, ...extra];
  }, [templates]);

  const filteredGrouped = useMemo(() => {
    const grouped = groupTemplates(templates);
    return categoryFilter === "all"
      ? grouped
      : grouped.filter(([cat]) => cat === categoryFilter);
  }, [templates, categoryFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 grid-bg flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-neon-cyan animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 grid-bg relative scanlines">
      {toastElement}

      <PageHeader
        icon={Rocket}
        title="Missions"
        subtitle="Dispatch and track agent missions"
        color="cyan"
        actions={
          <>
            <button
              type="button"
              onClick={fetchData}
              className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
              aria-label="Refresh missions"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <Button onClick={() => setShowCreate(true)} size="sm">
              <Plus className="w-3.5 h-3.5" /> New Mission
            </Button>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total", value: missions.length, border: "border-white/10", text: "text-white" },
            { label: "Active", value: missionCounts.active, border: "border-neon-orange/20", text: "text-neon-orange" },
            { label: "Completed", value: missionCounts.completed, border: "border-neon-green/20", text: "text-neon-green" },
            { label: "Failed", value: missionCounts.failed, border: "border-red-500/20", text: "text-red-400" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-lg border ${stat.border} bg-dark-900/50 p-3`}>
              <div className={`text-[10px] font-mono ${stat.text} uppercase`}>
                {stat.label}
              </div>
              <div className={`text-xl font-bold font-mono ${stat.text}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Deploy Templates */}
        {!showCreate && (
          <div className="mb-6" data-testid="missions-quick-templates">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-mono text-white/40 uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-3 h-3 text-neon-cyan" />
                Quick Deploy - Choose a Template
              </h2>
              <button
                onClick={() => setShowTemplateManager(true)}
                className="text-[10px] font-mono text-white/30 hover:text-neon-cyan flex items-center gap-1 transition-colors"
              >
                <Layers className="w-3 h-3" />
                Edit Templates
              </button>
            </div>
            {/* Category Filter Buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                  categoryFilter === "all"
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40"
                    : "text-white/40 border border-white/10 hover:text-white/60 hover:border-white/20"
                }`}
              >
                All
              </button>
              {allCategories.map((cat) => {
                const color = CATEGORY_COLORS[cat] || "cyan";
                const active = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                      active
                        ? CATEGORY_ACTIVE_CLASSES[color] || CATEGORY_ACTIVE_CLASSES.cyan
                        : "text-white/40 border border-white/10 hover:text-white/60 hover:border-white/20"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            {/* Category Accordion */}
            <div className="space-y-2">
              {filteredGrouped.map(([cat, items]) => {
                return (
                  <CategoryAccordion
                    key={cat}
                    name={cat}
                    count={items.length}
                    color="cyan"
                    expandable={true}
                    defaultOpen={
                      categoryFilter !== "all"
                        ? true
                        : allCategories.length <= 3
                    }
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((t) => (
                        <TemplateCard
                          key={t.id}
                          id={t.id}
                          name={t.name}
                          icon={t.icon}
                          color={t.color}
                          description={t.description}
                          isCustom={t.isCustom}
                          compact
                          onSelect={() => handleTemplateSelect(t)}
                        />
                      ))}
                    </div>
                  </CategoryAccordion>
                );
              })}
            </div>
          </div>
        )}

        {/* Create Form */}
        <MissionCreateForm
          open={showCreate}
          onClose={() => {
            setShowCreate(false);
            setEditingId(null);
          }}
          editingId={editingId}
          missions={missions}
          formState={formState}
          setFormField={setFormField}
          onSubmit={handleCreate}
          onSaveAsTemplate={handleSaveAsTemplate}
          dispatching={dispatching}
        />

        {/* Filter & Search */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-1 bg-dark-900/50 rounded-lg border border-white/10 p-1">
            {["all", "queued", "dispatched", "successful", "failed"].map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-mono capitalize transition-colors ${
                    filter === f
                      ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                      : "text-white/30 hover:text-white/50 border border-transparent"
                  }`}
                >
                  {f}
                </button>
              ),
            )}
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search missions..."
              className="w-full bg-dark-900/50 border border-white/10 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-neon-cyan/50 font-mono"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-white/30 hover:text-white/60 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Missions Kanban Board */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Rocket className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <div className="text-sm text-white/30">
              {missions.length === 0
                ? "No missions yet - create one to get started"
                : "No missions match your filter"}
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4 overflow-x-auto pb-2">
            {/* Kanban columns — one per status */}
            {(["queued", "dispatched", "successful", "failed"] as const).map(
              (status) => {
                const columnMissions = filtered.filter(
                  (m) => m.status === status,
                );
                const sc = STATUS_CONFIG[status];
                const isCollapsible = (status === "successful" || status === "failed") && columnMissions.length > 5;
                const visibleMissions = isCollapsible && collapsedColumns[status]
                  ? columnMissions.slice(0, 5)
                  : columnMissions;
                if (filter !== "all" && filter !== status) return null;
                return (
                  <div
                    key={status}
                    className="flex-1 min-w-[240px] flex flex-col"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between mb-3 px-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${STATUS_CONFIG[status]?.columnDot || "bg-white/20"}`}
                        />
                        <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">
                          {status === "successful"
                            ? "Completed"
                            : status === "failed"
                              ? "Failed"
                              : titleCase(status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(status === "successful" || status === "failed") && columnMissions.length > 5 && (
                          <button
                            onClick={() => setCollapsedColumns(prev => ({ ...prev, [status]: !prev[status] }))}
                            className="text-[9px] font-mono text-white/25 hover:text-neon-cyan transition-colors"
                          >
                            {collapsedColumns[status] ? "Show all" : "Collapse"}
                          </button>
                        )}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${sc?.bg} ${sc?.text}`}
                        >
                          {columnMissions.length}
                        </span>
                      </div>
                    </div>
                    {/* Column Cards */}
                    <div className="space-y-2 flex-1">
                      {columnMissions.length === 0 ? (
                        <div
                          className={`rounded-xl border border-dashed border-white/5 bg-dark-900/20 p-4 text-center text-[10px] font-mono text-white/20`}
                        >
                          No missions
                        </div>
                      ) : (
                        <div className="contents">
                        {visibleMissions.map((mission) => {
                          const sc =
                            STATUS_CONFIG[mission.status] || { dot: "idle" as const, bg: "bg-white/5", text: "text-white/40" };
                          const isExpanded = expandedId === mission.id;
                          return (
                            <div
                              key={mission.id}
                              className="rounded-xl border border-white/10 bg-dark-900/50 overflow-hidden"
                            >
                              {/* Card row — clickable to expand */}
                              <button
                                onClick={() =>
                                  setExpandedId(isExpanded ? null : mission.id)
                                }
                                className="w-full text-left p-3 hover:bg-white/[0.02] transition-colors"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                      <StatusDot
                                        status={sc.dot}
                                        pulse={mission.status === "dispatched"}
                                      />
                                      <span className="text-xs font-semibold text-white truncate">
                                        {mission.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono text-white/25 flex-wrap">
                                      <span className="flex items-center gap-0.5">
                                        <Clock className="w-2.5 h-2.5" />
                                        {timeAgo(mission.createdAt)}
                                      </span>
                                      {mission.status !== "queued" && mission.cronJob?.lastStatus && (
                                        <span
                                          className={
                                            mission.cronJob.lastStatus === "ok"
                                              ? "text-neon-green"
                                              : "text-red-400"
                                          }
                                        >
                                          {mission.cronJob.lastStatus}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {STATUS_CONFIG[mission.status]?.icon ?? null}
                                    <ChevronRight
                                      className={`w-3.5 h-3.5 text-white/20 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                    />
                                  </div>
                                </div>
                              </button>

                              {/* Expanded detail panel */}
                              {isExpanded && (
                                <div className="border-t border-white/10 px-3 py-3 bg-dark-800/30">
                                  {detailLoading ? (
                                    <div className="flex items-center justify-center py-4">
                                      <Loader2 className="w-4 h-4 text-neon-cyan animate-spin" />
                                    </div>
                                  ) : detail ? (
                                    <div className="space-y-3">
                                      {/* ── Metadata grid ── */}
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono">
                                        <div className="flex justify-between">
                                          <span className="text-white/30">Agent</span>
                                          <span className="text-white/70 truncate ml-2 text-right">
                                            {detail.mission.profileName || detail.mission.profileId || "—"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-white/30">Model</span>
                                          <span className="text-white/70 truncate ml-2 text-right">
                                            {detail.mission.modelId || detail.mission.model || "—"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-white/30">Provider</span>
                                          <span className="text-white/70 truncate ml-2 text-right">
                                            {detail.mission.provider || "—"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-white/30">Scope</span>
                                          <span className="text-white/70 ml-2 text-right">
                                            {detail.mission.missionTimeMinutes ? `${detail.mission.missionTimeMinutes}m` : "—"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-white/30">Timeout</span>
                                          <span className="text-white/70 ml-2 text-right">
                                            {detail.mission.timeoutMinutes ? `${detail.mission.timeoutMinutes}m` : "—"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-white/30">Elapsed</span>
                                          <span className="text-white/70 ml-2 text-right">
                                            {(() => {
                                              const created = new Date(detail.mission.createdAt).getTime();
                                              const now = Date.now();
                                              const elapsed = Math.floor((now - created) / 1000);
                                              if (elapsed < 60) return `${elapsed}s`;
                                              if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
                                              const h = Math.floor(elapsed / 3600);
                                              const m = Math.floor((elapsed % 3600) / 60);
                                              return `${h}h ${m}m`;
                                            })()}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-white/30">Schedule</span>
                                          <span className="text-white/70 truncate ml-2 text-right">
                                            {detail.mission.schedule || "One-shot"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-white/30">Skills</span>
                                          <span className="text-white/70 truncate ml-2 text-right">
                                            {(detail.mission.skills?.length ?? 0) > 0
                                              ? `${detail.mission.skills!.length} attached`
                                              : "—"}
                                          </span>
                                        </div>
                                      </div>

                                      {/* ── Prompt (collapsible) ── */}
                                      <div>
                                        <button
                                          onClick={() =>
                                            setPromptCollapsed(!promptCollapsed)
                                          }
                                          className="w-full flex items-center justify-between mb-1 hover:opacity-80 transition-opacity"
                                        >
                                          <div className="text-[10px] font-mono text-white/30 uppercase flex items-center gap-1.5">
                                            <Edit3 className="w-3 h-3" />
                                            Full Template Details
                                          </div>
                                          <div className="flex items-center gap-1 text-[10px] font-mono text-white/30">
                                            <span>
                                              {promptCollapsed
                                                ? "show"
                                                : "hide"}
                                            </span>
                                            <ChevronRight
                                              className={`w-3 h-3 transition-transform ${promptCollapsed ? "" : "rotate-90"}`}
                                            />
                                          </div>
                                        </button>
                                        <div
                                          className={`overflow-hidden transition-all duration-200 ${promptCollapsed ? "max-h-20" : "max-h-none"}`}
                                        >
                                          <div className="text-[10px] text-white/50 font-mono whitespace-pre-wrap bg-dark-900/50 rounded-lg p-2 border border-white/5">
                                            {detail.mission.prompt}
                                          </div>
                                        </div>
                                      </div>

                                      {/* ── Goals ── */}
                                      {(detail.mission.goals?.length ?? 0) > 0 && (
                                        <div>
                                          <div className="text-[10px] font-mono text-white/30 uppercase mb-1">
                                            Goals
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {detail.mission.goals
                                              ?.slice(0, 3)
                                              ?.map((goal, i) => (
                                                <span
                                                  key={i}
                                                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/5"
                                                >
                                                  {goal}
                                                </span>
                                              ))}
                                            {(detail.mission.goals?.length ?? 0) >
                                              3 && (
                                              <span className="text-[9px] font-mono text-white/25">
                                                +
                                                {(detail.mission.goals?.length ?? 0) -
                                                  3}{" "}
                                                more
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* ── Cron Job Status ── */}
                                      {detail.cronJob && (
                                        <div className="rounded-lg border border-neon-orange/20 bg-dark-900/50 p-2">
                                          <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-1">
                                              <Zap className="w-3 h-3 text-neon-orange" />
                                              <span className="text-[10px] font-mono text-white/60">
                                                Cron Job
                                              </span>
                                            </div>
                                            <Link
                                              href="/orchestration/cron"
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                              className="text-[9px] font-mono text-neon-orange hover:underline flex items-center gap-0.5"
                                            >
                                              view{" "}
                                              <ExternalLink className="w-2.5 h-2.5" />
                                            </Link>
                                          </div>
                                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] font-mono">
                                            <div className="flex justify-between">
                                              <span className="text-white/20">
                                                State
                                              </span>
                                              <span
                                                className={
                                                  detail.cronJob.enabled
                                                    ? "text-neon-green"
                                                    : "text-white/40"
                                                }
                                              >
                                                {detail.cronJob.enabled
                                                  ? titleCase(
                                                      detail.cronJob.state,
                                                    )
                                                  : "Disabled"}
                                              </span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-white/20">
                                                Last
                                              </span>
                                              <span className="text-white/50">
                                                {detail.cronJob.lastRun
                                                  ? timeAgo(
                                                      detail.cronJob.lastRun,
                                                    )
                                                  : "Never"}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* ── Results ── */}
                                      {detail.mission.results && (
                                        <div>
                                          <div className="text-[10px] font-mono text-white/30 uppercase mb-1">
                                            Results
                                          </div>
                                          <div className="text-[10px] text-white/50 font-mono whitespace-pre-wrap bg-dark-900/50 rounded-lg p-2 border border-white/5 max-h-16 overflow-y-auto">
                                            {detail.mission.results}
                                          </div>
                                        </div>
                                      )}

                                      {/* ── Error ── */}
                                      {detail.mission.error && (
                                        <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-2">
                                          <div className="text-[10px] font-mono text-red-400 uppercase mb-0.5">
                                            Error
                                          </div>
                                          <div className="text-[10px] font-mono text-red-400/60">
                                            {detail.mission.error}
                                          </div>
                                        </div>
                                      )}

                                      {/* ── Actions ── */}
                                      <div className="flex gap-1.5 pt-1">
                                        {(mission.status === "queued" ||
                                          mission.status === "successful" ||
                                          mission.status === "failed") && (
                                          <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => handleEdit(mission)}
                                          >
                                            <Edit3 className="w-3 h-3" />{" "}
                                            Re-dispatch
                                          </Button>
                                        )}
                                        {(mission.status === "queued" ||
                                          mission.status === "dispatched") && (
                                          <Button
                                            variant="danger"
                                            size="sm"
                                            onClick={() =>
                                              handleCancel(mission.id)
                                            }
                                          >
                                            <StopCircle className="w-3 h-3" />{" "}
                                            Cancel
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            handleDelete(mission.id)
                                          }
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-white/30 text-center py-3">
                                      Failed to load details
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {isCollapsible && collapsedColumns[status] && columnMissions.length > 5 && (
                          <button
                            onClick={() => setCollapsedColumns(prev => ({ ...prev, [status]: false }))}
                            className="w-full text-[10px] font-mono text-neon-cyan/60 hover:text-neon-cyan py-2 text-center border border-dashed border-white/5 rounded-lg transition-colors mt-2"
                          >
                            Show all {columnMissions.length} missions →
                          </button>
                        )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>

      <TemplateManagerModal
        open={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        templates={templates}
        categoryFilter={categoryFilter}
        onEditTemplate={handleEditTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />

      <TemplateEditorModal
        open={showTemplateEditor}
        onClose={() => setShowTemplateEditor(false)}
        onCancel={() => {
          setShowTemplateEditor(false);
          setEditingTemplateId(null);
        }}
        editingTemplateId={editingTemplateId}
        templateName={templateName}
        onTemplateNameChange={setTemplateName}
        templateDescription={templateDescription}
        onTemplateDescriptionChange={setTemplateDescription}
        templateIcon={templateIcon}
        onTemplateIconChange={setTemplateIcon}
        templateColor={templateColor}
        onTemplateColorChange={setTemplateColor}
        templateSaving={templateSaving}
        onSave={handleTemplateSave}
        newInstruction={newInstruction}
        onNewInstructionChange={setNewInstruction}
        newContext={newContext}
        onNewContextChange={setNewContext}
        newGoals={newGoals}
        onNewGoalsChange={setNewGoals}
        newProfile={newProfile}
        onNewProfileChange={setNewProfile}
        newModel={newModel}
        newProvider={newProvider}
        onModelChange={(mid, prov) => {
          setNewModel(mid);
          setNewProvider(prov);
        }}
        newMissionTime={newMissionTime}
        onNewMissionTimeChange={setNewMissionTime}
        newTimeout={newTimeout}
        onNewTimeoutChange={setNewTimeout}
        newLocalDirs={newLocalDirs}
        onNewLocalDirsChange={setNewLocalDirs}
        localDirDraft={localDirDraft}
        onLocalDirDraftChange={setLocalDirDraft}
        newReferences={newReferences}
        onNewReferencesChange={setNewReferences}
        referenceInput={referenceInput}
        onReferenceInputChange={setReferenceInput}
        newSkills={newSkills}
        onNewSkillsChange={setNewSkills}
      />
    </div>
  );
}

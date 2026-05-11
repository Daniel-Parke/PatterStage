"use client";

// Force client-side rendering so hooks (useState, useEffect, useCallback)
// resolve correctly on first render without SSR hydration timing issues.
export const dynamic = "force-dynamic";

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
  Send,
  ExternalLink,
  StopCircle,
  RefreshCw,
  Bug,
  GitPullRequest,
  Wrench,
  PenTool,
  Edit3,
  Save,
  Cpu,
  Activity,
  Shield,
  Terminal,
  Database,
  Globe,
  Code,
  FileText,
  Layers,
} from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import Card, { StatusDot } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import AutoTextarea from "@/components/ui/AutoTextarea";
import Modal from "@/components/ui/Modal";
import MissionTimeSelector from "@/components/ui/MissionTimeSelector";
import TimeoutSelector from "@/components/ui/TimeoutSelector";
import IntervalSelector from "@/components/ui/IntervalSelector";
import ProfileSelector from "@/components/ui/ProfileSelector";
import SkillSelector from "@/components/ui/SkillSelector";
import CategoryAccordion from "@/components/ui/CategoryAccordion";
import TemplateCard from "@/components/ui/TemplateCard";
import { timeAgo, titleCase } from "@/lib/utils";
import { useMissionsApi } from "@/hooks/useMissionsApi";
import type { LocalDirEntry, Mission } from "@/types/hermes";
import { formatLocalDirEntryLine, normalizeLocalDirsInput } from "@/lib/local-dir-entry";
import ModelPicker from "@/components/missions/ModelPicker";
import LocalDirRow from "@/components/missions/LocalDirRow";

// Available icons for templates
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
] as const;

const TEMPLATE_COLORS = ["cyan", "purple", "pink", "green", "orange"] as const;

type MissionRow = Mission & {
  cronJob?: {
    state: string;
    enabled: boolean;
    lastRun: string | null;
    lastStatus: string | null;
  };
  latestSession?: { id: string; modified: string } | null;
};

interface MissionTemplate {
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
  /** Per-template default model id (e.g. anthropic/claude-sonnet-4). */
  defaultModel?: string;
  /** Per-template default provider (matches Hermes CLI --provider choices). */
  defaultProvider?: string;
  timeoutMinutes?: number;
}

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

// ── Module-level constants (avoid re-creation on every render) ──

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
};

const CATEGORY_ORDER = [
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

const CATEGORY_COLORS: Record<string, string> = {
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

function groupTemplates(
  templates: MissionTemplate[],
): [string, MissionTemplate[]][] {
  const grouped: Record<string, MissionTemplate[]> = {};
  for (const t of templates) {
    const cat = t.isCustom ? "Custom" : t.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  }
  // Preserve hardcoded category order, then append any categories
  // discovered from templates that aren't in the hardcoded list.
  const knownOrder = new Set(CATEGORY_ORDER);
  const extra = Object.keys(grouped).filter((c) => !knownOrder.has(c));
  return [...CATEGORY_ORDER, ...extra].filter((c) => grouped[c]).map((cat) => [
    cat,
    grouped[cat],
  ]);
}

const statusColors: Record<
  string,
  { dot: "online" | "warning" | "error" | "idle"; bg: string; text: string }
> = {
  queued: { dot: "warning", bg: "bg-neon-orange/10", text: "text-neon-orange" },
  dispatched: { dot: "online", bg: "bg-neon-cyan/10", text: "text-neon-cyan" },
  successful: { dot: "online", bg: "bg-neon-green/10", text: "text-neon-green" },
  failed: { dot: "error", bg: "bg-red-500/10", text: "text-red-400" },
};

const defaultStatusColor = {
  dot: "idle" as const,
  bg: "bg-white/5",
  text: "text-white/40",
};

interface AgentRuntimeDefaultsCardProps {
  profileId: string;
  onProfileChange: (id: string) => void;
  missionTimeMinutes: number;
  onMissionTimeChange: (v: number) => void;
  timeoutMinutes: number;
  onTimeoutChange: (v: number) => void;
  modelId: string;
  provider: string;
  onModelChange: (mid: string, prov: string) => void;
  modelPickerId?: string;
  timeoutHeading: string;
}

function AgentRuntimeDefaultsCard({
  profileId,
  onProfileChange,
  missionTimeMinutes,
  onMissionTimeChange,
  timeoutMinutes,
  onTimeoutChange,
  modelId,
  provider,
  onModelChange,
  modelPickerId,
  timeoutHeading,
}: AgentRuntimeDefaultsCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-dark-800/30 p-3 sm:p-4 space-y-4">
      <div className="space-y-1">
        <h3 className="text-[11px] font-mono text-white/50 uppercase tracking-wider">
          {"Agent & runtime defaults"}
        </h3>
        <p className="text-[10px] text-white/25 font-mono leading-relaxed">
          These fields feed the mission prompt and dispatch configuration.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-white/40 font-mono block">Agent profile</label>
        <ProfileSelector
          value={profileId}
          onChange={onProfileChange}
          subtitle="tooltip"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
        <div className="flex flex-col gap-1.5 min-h-[3.25rem]">
          <label className="text-xs text-white/40 font-mono block">Mission scope</label>
          <div className="flex-1 flex flex-col justify-center">
            <MissionTimeSelector
              value={missionTimeMinutes}
              onChange={onMissionTimeChange}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 min-h-[3.25rem]">
          <label className="text-xs text-white/40 font-mono block">
            {timeoutHeading}{" "}
            <span className="text-white/25 font-normal normal-case">
              — Inactivity kill switch
            </span>
          </label>
          <div className="flex-1 flex flex-col justify-center">
            <TimeoutSelector
              value={timeoutMinutes}
              onChange={onTimeoutChange}
              showSubtitle={false}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-white/40 font-mono block">Model</label>
        <ModelPicker
          id={modelPickerId}
          modelId={modelId}
          provider={provider}
          onChange={onModelChange}
          helperPlacement="tooltip"
        />
      </div>
    </div>
  );
}

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
  const [newDispatch, setNewDispatch] = useState<"save" | "now" | "cron">(
    "now",
  );
  const [newSchedule, setNewSchedule] = useState("every 5m");
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

  // Build final prompt from instruction + context
  const buildPrompt = () => {
    const parts: string[] = [];

    // 1. WORKING DIRECTORIES — highest priority
    const dirsNorm = normalizeLocalDirsInput(newLocalDirs);
    if (dirsNorm.length > 0) {
      parts.push(
        "## Working Directories\n" +
        "Focus all work within the following directories:\n" +
        dirsNorm.map((d) => formatLocalDirEntryLine(d)).join("\n") +
        "\n"
      );
    }

    // 2. KEY REFERENCES
    if (newReferences.length > 0) {
      parts.push(
        "## Key References\n" +
        "Consult and prioritise the following sources:\n" +
        newReferences.map((r) => `  - ${r}`).join("\n") +
        "\n"
      );
    }

    // 3. RECOMMENDED SKILLS
    if (newSkills.length > 0) {
      parts.push(
        "## Recommended Skills\n" +
        "Apply expertise from the following skills where relevant:\n" +
        newSkills.map((s) => `  - ${s}`).join("\n") +
        "\n"
      );
    }

    // 4. CORE INSTRUCTION
    parts.push(newInstruction.trim());

    // 5. ADDITIONAL CONTEXT
    if (newContext.trim()) {
      const cleanContext = newContext
        .trim()
        .replace(/(?:## Additional Context\n\n?)+/g, "")
        .trim();
      if (cleanContext) {
        parts.push("", "---", "", "## Additional Context", "", cleanContext);
      }
    }
    return parts.join("\n");
  };

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
        const _res = await res.json();
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
    // Split prompt back into instruction + context (best effort)
    // The stored prompt has injected sections from buildMissionPrompt:
    // Working Directories, Key References, Recommended Skills, Goals tracking header, MISSION SCOPE, SAFETY LIMITS
    let rawPrompt = m.prompt;

    // Remove ## Working Directories section
    rawPrompt = rawPrompt.replace(
      /^## Working Directories\n[\s\S]*?(?=\n## |\n\n---|,?\n[A-Z])/m,
      ""
    );
    // Remove ## Key References section
    rawPrompt = rawPrompt.replace(
      /^## Key References\n[\s\S]*?(?=\n## |\n\n---|,?\n[A-Z])/m,
      ""
    );
    // Remove ## Recommended Skills section
    rawPrompt = rawPrompt.replace(
      /^## Recommended Skills\n[\s\S]*?(?=\n## |\n\n---|,?\n[A-Z])/m,
      ""
    );
    // Remove ## Goals (complete each in order) block
    rawPrompt = rawPrompt.replace(
      /^## Goals \(complete each in order\)\n[\s\S]*?Mark each goal as done.*\n\n---\n\n/m,
      ""
    );
    // Remove ## MISSION SCOPE section (injected by buildMissionPrompt)
    rawPrompt = rawPrompt.replace(
      /## MISSION SCOPE\n[\s\S]*?(?=\n## |\n\n---|,?\n[A-Z])/m,
      "\n"
    );
    // Remove ## SAFETY LIMITS section (injected by buildMissionPrompt)
    rawPrompt = rawPrompt.replace(
      /## SAFETY LIMITS\n[\s\S]*?(?=\n## |\n\n---|,?\n[A-Z])/m,
      "\n"
    );

    const parts = rawPrompt.split("\n---\n");
    setNewInstruction(parts[0]?.trim() || rawPrompt);
    setNewContext(
      parts.length > 1
        ? parts[parts.length - 1]
            .replace(/(?:## Additional Context\n\n?)+/g, "")
            .trim()
        : "",
    );
    setNewGoals(m.goals?.join("\n") ?? "");
    setNewLocalDirs(normalizeLocalDirsInput(m.localDirs));
    setLocalDirDraft({ path: "", branch: null });
    setNewReferences(m.references ?? []);
    setNewSkills(m.skills ?? []);
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
    setNewInstruction(t.instruction || "");
    setNewContext(t.context || "");
    setNewGoals((t.goals || []).join("\n"));
    if (t.dispatchMode)
      setNewDispatch(t.dispatchMode as "save" | "now" | "cron");
    if (t.schedule) setNewSchedule(t.schedule);
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
    setShowTemplateManager(false);
    setShowTemplateEditor(true);
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
    setNewInstruction(t.instruction);
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

  const activeCount = useMemo(
    () =>
      missions.filter((m) => m.status === "queued" || m.status === "dispatched")
        .length,
    [missions],
  );
  const completedCount = useMemo(
    () => missions.filter((m) => m.status === "successful").length,
    [missions],
  );
  const failedCount = useMemo(
    () => missions.filter((m) => m.status === "failed").length,
    [missions],
  );

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
          <div className="rounded-lg border border-white/10 bg-dark-900/50 p-3">
            <div className="text-[10px] font-mono text-white/40 uppercase">
              Total
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {missions.length}
            </div>
          </div>
          <div className="rounded-lg border border-neon-orange/20 bg-dark-900/50 p-3">
            <div className="text-[10px] font-mono text-neon-orange uppercase">
              Active
            </div>
            <div className="text-xl font-bold font-mono text-neon-orange">
              {activeCount}
            </div>
          </div>
          <div className="rounded-lg border border-neon-green/20 bg-dark-900/50 p-3">
            <div className="text-[10px] font-mono text-neon-green uppercase">
              Completed
            </div>
            <div className="text-xl font-bold font-mono text-neon-green">
              {completedCount}
            </div>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-dark-900/50 p-3">
            <div className="text-[10px] font-mono text-red-400 uppercase">
              Failed
            </div>
            <div className="text-xl font-bold font-mono text-red-400">
              {failedCount}
            </div>
          </div>
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
              {(() => {
                const knownSet = new Set(CATEGORY_ORDER);
                const extra = templates
                  .map((t) => (t.isCustom ? "Custom" : t.category || "Other"))
                  .filter((c) => !knownSet.has(c));
                const allCats = [...CATEGORY_ORDER, ...extra];
                return allCats.map((cat) => {
                  const color = CATEGORY_COLORS[cat] || "cyan";
                  const active = categoryFilter === cat;
                  const activeClasses: Record<string, string> = {
                    cyan: "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40",
                    purple: "bg-neon-purple/20 text-neon-purple border border-neon-purple/40",
                    pink: "bg-neon-pink/20 text-neon-pink border border-neon-pink/40",
                    green: "bg-neon-green/20 text-neon-green border border-neon-green/40",
                    orange: "bg-neon-orange/20 text-neon-orange border border-neon-orange/40",
                  };
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${
                        active
                          ? activeClasses[color] || activeClasses.cyan
                          : "text-white/40 border border-white/10 hover:text-white/60 hover:border-white/20"
                      }`}
                    >
                      {cat}
                    </button>
                  );
                });
              })()}
            </div>
            {/* Category Accordion */}
            <div className="space-y-2">
              {(() => {
                const grouped = groupTemplates(templates);
                // Apply category filter
                const filteredGrouped =
                  categoryFilter === "all"
                    ? grouped
                    : grouped.filter(([cat]) => cat === categoryFilter);
                return filteredGrouped.map(([cat, items]) => {
                  const color = CATEGORY_COLORS[cat] || "cyan";
                  return (
                    <CategoryAccordion
                      key={cat}
                      name={cat}
                      count={items.length}
                      color={color}
                      expandable={cat === "Custom" && items.length > 6}
                      defaultOpen={categoryFilter !== "all"}
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
                });
              })()}
            </div>
          </div>
        )}

        {/* Create Form */}
        {showCreate && (
          <Card className="mb-6 glow-cyan" padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-mono text-neon-cyan uppercase tracking-widest">
                {(() => {
                  const existing = editingId
                    ? missions.find((m) => m.id === editingId)
                    : null;
                  if (
                    existing &&
                    (existing.status === "successful" ||
                      existing.status === "failed")
                  ) {
                    return `Re-Dispatch: ${existing.name}`;
                  }
                  if (editingId) return "Edit Mission";
                  return "New Mission";
                })()}
              </h3>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setEditingId(null);
                }}
                className="text-white/30 hover:text-white/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {editingId &&
                (() => {
                  const existing = missions.find((m) => m.id === editingId);
                  if (
                    existing &&
                    (existing.status === "successful" ||
                      existing.status === "failed")
                  ) {
                    return (
                      <div className="rounded-lg bg-neon-cyan/5 border border-neon-cyan/20 p-3 text-xs text-neon-cyan/80 font-mono">
                        A new mission will be created and dispatched immediately
                        with your changes. The previous mission record will be
                        kept for history.
                      </div>
                    );
                  }
                  return null;
                })()}
              <div>
                <label className="text-xs text-white/40 font-mono block mb-1">
                  Mission Name
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Research quantum computing trends"
                  className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-cyan/50 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 font-mono block mb-1">
                  Instruction Prompt
                </label>
                <AutoTextarea
                  value={newInstruction}
                  onChange={setNewInstruction}
                  minRows={4}
                  maxRows={16}
                  placeholder="The agent's task instructions - what to do and how to do it..."
                />
                <p className="text-[10px] text-white/20 font-mono mt-0.5">
                  Defines the agent&apos;s role, approach, and step-by-step
                  process. Templates pre-fill this.
                </p>
              </div>
              <div>
                <label className="text-xs text-white/40 font-mono block mb-1">
                  Context Prompt{" "}
                  <span className="text-white/20">(optional)</span>
                </label>
                <AutoTextarea
                  value={newContext}
                  onChange={setNewContext}
                  minRows={2}
                  maxRows={8}
                  placeholder="Additional context, specifics, or direction for this particular run..."
                />
                <p className="text-[10px] text-white/20 font-mono mt-0.5">
                  Added below the instructions as &quot;Additional
                  Context&quot;. Use for topic, URL, code path, or specific
                  requirements.
                </p>
              </div>

              {/* Local Directories */}
              <div>
                <label className="text-xs text-white/40 font-mono block mb-1">
                  Local Directories{" "}
                  <span className="text-white/20">(optional)</span>
                </label>
                <div className="space-y-2">
                  <LocalDirRow
                    mode="draft"
                    entry={localDirDraft}
                    onChange={setLocalDirDraft}
                    onAdd={() => {
                      const p = localDirDraft.path.trim();
                      if (!p) return;
                      if (newLocalDirs.some((d) => d.path === p)) return;
                      setNewLocalDirs((d) => [
                        ...d,
                        {
                          path: p,
                          branch: localDirDraft.branch || null,
                        },
                      ]);
                      setLocalDirDraft({ path: "", branch: null });
                    }}
                  />
                  {newLocalDirs.length > 0 && (
                    <div className="text-[10px] text-white/30 font-mono uppercase tracking-wider">
                      Added directories
                    </div>
                  )}
                  {newLocalDirs.map((dir, i) => (
                    <div
                      key={`${dir.path}-${i}`}
                      className="rounded-lg border border-neon-cyan/15 bg-dark-800/30 px-2 py-2"
                    >
                      <LocalDirRow
                        mode="saved"
                        entry={dir}
                        onChange={(next) =>
                          setNewLocalDirs((d) =>
                            d.map((x, j) => (j === i ? next : x)),
                          )
                        }
                        onDelete={() =>
                          setNewLocalDirs((d) => d.filter((_, j) => j !== i))
                        }
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-white/20 font-mono mt-0.5">
                  Directories the agent should focus work within. Injected as
                  highest-priority section in the mission prompt. Use Browse to
                  pick a path under allowed workspace roots.
                </p>
              </div>

              {/* Key References */}
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
                          setNewReferences((r) =>
                            r.filter((_, j) => j !== i)
                          )
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
                      onChange={(e) => setReferenceInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (referenceInput.trim()) {
                            setNewReferences((r) => [
                              ...r,
                              referenceInput.trim(),
                            ]);
                            setReferenceInput("");
                          }
                        }
                      }}
                      placeholder="www.example.com, docs/spec.md, README.md..."
                      className="flex-1 bg-dark-800/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-neon-pink/50 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (referenceInput.trim()) {
                          setNewReferences((r) => [
                            ...r,
                            referenceInput.trim(),
                          ]);
                          setReferenceInput("");
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-neon-pink/10 border border-neon-pink/30 text-xs text-neon-pink hover:bg-neon-pink/20 font-mono transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-white/20 font-mono mt-0.5">
                  File names, URLs, or resources the agent should prioritise.
                  Added as &quot;Key References&quot; in the prompt.
                </p>
              </div>

              {/* Skills */}
              <div>
                <label className="text-xs text-white/40 font-mono block mb-1">
                  Attached Skills{" "}
                  <span className="text-white/20">(optional, max 10)</span>
                </label>
                <SkillSelector
                  value={newSkills}
                  onChange={setNewSkills}
                  profileId={newProfile}
                  max={10}
                />
                <p className="text-[10px] text-white/20 font-mono mt-0.5">
                  Showing only skills enabled for this profile. Added as
                  &quot;Recommended Skills&quot; in the prompt.
                </p>
              </div>

              <div>
                <label className="text-xs text-white/40 font-mono block mb-1">
                  Goals (one per line)
                </label>
                <AutoTextarea
                  value={newGoals}
                  onChange={setNewGoals}
                  minRows={2}
                  maxRows={8}
                  placeholder="Gather data&#10;Analyze findings&#10;Write report"
                />
              </div>
              {/* Mission Settings — agent & runtime card */}
              <AgentRuntimeDefaultsCard
                profileId={newProfile}
                onProfileChange={setNewProfile}
                missionTimeMinutes={newMissionTime}
                onMissionTimeChange={setNewMissionTime}
                timeoutMinutes={newTimeout}
                onTimeoutChange={setNewTimeout}
                modelId={newModel}
                provider={newProvider}
                onModelChange={(mid, prov) => {
                  setNewModel(mid);
                  setNewProvider(prov);
                }}
                timeoutHeading="Timeout (Advanced)"
              />
              <div className="flex items-center gap-3">
                <label className="text-xs text-white/40 font-mono">
                  Dispatch:
                </label>
                {(["save", "now", "cron"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setNewDispatch(mode)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono border transition-colors ${
                      newDispatch === mode
                        ? "border-neon-cyan/50 bg-cyan-500/10 text-neon-cyan"
                        : "border-white/10 text-white/40 hover:text-white/60"
                    }`}
                  >
                    {mode === "save"
                      ? "Save Draft"
                      : mode === "now"
                        ? "Run Now"
                        : "Recurring"}
                  </button>
                ))}
              </div>
              {newDispatch === "now" && (
                <div className="text-[10px] text-white/30 font-mono bg-dark-800/50 rounded-lg px-3 py-2 border border-white/5">
                  ⚡ Creates a one-shot cron job that fires within ~60 seconds.
                  Results delivered to Discord.
                </div>
              )}
              {newDispatch === "cron" && (
                <div className="space-y-2">
                  <label className="text-xs text-white/40 font-mono block">
                    Schedule
                  </label>
                  <IntervalSelector
                    value={newSchedule}
                    onChange={setNewSchedule}
                  />
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleCreate}
                  disabled={
                    !newName.trim() || !newInstruction.trim() || dispatching
                  }
                  loading={dispatching}
                >
                  <Send className="w-3.5 h-3.5" />
                  {(() => {
                    const existing = editingId
                      ? missions.find((m) => m.id === editingId)
                      : null;
                    const isReDispatch =
                      existing &&
                      (existing.status === "successful" ||
                        existing.status === "failed");
                    if (isReDispatch) return "Re-Dispatch Now";
                    if (newDispatch === "save") return "Save Mission";
                    if (newDispatch === "now") return "Dispatch Now";
                    return "Schedule Mission";
                  })()}
                </Button>
                {newInstruction.trim() && (
                  <Button variant="secondary" onClick={handleSaveAsTemplate}>
                    <Save className="w-3.5 h-3.5" /> Save as Template
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowCreate(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

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
                const sc = statusColors[status];
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
                          className={`w-2 h-2 rounded-full ${
                            status === "queued"
                              ? "bg-neon-orange"
                              : status === "dispatched"
                                ? "bg-neon-cyan"
                                : status === "successful"
                                  ? "bg-neon-green"
                                  : "bg-red-400"
                          }`}
                        />
                        <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">
                          {status === "successful"
                            ? "Completed"
                            : status === "failed"
                              ? "Failed"
                              : titleCase(status)}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${sc?.bg} ${sc?.text}`}
                      >
                        {columnMissions.length}
                      </span>
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
                        columnMissions.map((mission) => {
                          const sc =
                            statusColors[mission.status] || defaultStatusColor;
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
                                    <div className="text-[10px] text-white/40 font-mono line-clamp-1">
                                      {mission.prompt}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono text-white/25 flex-wrap">
                                      <span className="flex items-center gap-0.5">
                                        <Clock className="w-2.5 h-2.5" />
                                        {timeAgo(mission.createdAt)}
                                      </span>
                                      {mission.cronJob?.lastStatus && (
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
                                    {mission.status === "successful" && (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-neon-green" />
                                    )}
                                    {mission.status === "failed" && (
                                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                                    )}
                                    {mission.status === "dispatched" && (
                                      <Loader2 className="w-3.5 h-3.5 text-neon-cyan animate-spin" />
                                    )}
                                    {mission.status === "queued" && (
                                      <Clock className="w-3.5 h-3.5 text-neon-orange" />
                                    )}
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
                                      {/* Prompt */}
                                      <div>
                                        <button
                                          onClick={() =>
                                            setPromptCollapsed(!promptCollapsed)
                                          }
                                          className="w-full flex items-center justify-between mb-1 hover:opacity-80 transition-opacity"
                                        >
                                          <div className="text-[10px] font-mono text-white/30 uppercase">
                                            Prompt
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

                                      {/* Goals */}
                                      {detail.mission.goals.length > 0 && (
                                        <div>
                                          <div className="text-[10px] font-mono text-white/30 uppercase mb-1">
                                            Goals
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {detail.mission.goals
                                              .slice(0, 3)
                                              .map((goal, i) => (
                                                <span
                                                  key={i}
                                                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/5"
                                                >
                                                  {goal}
                                                </span>
                                              ))}
                                            {detail.mission.goals.length >
                                              3 && (
                                              <span className="text-[9px] font-mono text-white/25">
                                                +
                                                {detail.mission.goals.length -
                                                  3}{" "}
                                                more
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Cron Job Status */}
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
                                              href="/cron"
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

                                      {/* Results */}
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

                                      {/* Error */}
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

                                      {/* Actions */}
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
                        })
                      )}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>

      {/* Template Manager Modal */}
      {showTemplateManager && (
        <Modal
          open
          onClose={() => setShowTemplateManager(false)}
          title="Edit Templates"
          icon={Layers}
          iconColor="text-neon-cyan"
          size="lg"
          footer={
            <Button
              variant="ghost"
              onClick={() => setShowTemplateManager(false)}
            >
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
                    defaultOpen={categoryFilter === "all" ? cat === "Custom" : categoryFilter === cat}
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
                                onClick={() => handleEditTemplate(t)}
                                className="p-1.5 rounded text-white/40 hover:text-neon-cyan hover:bg-cyan-500/10 transition-colors"
                                title="Edit"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTemplate(t.id)}
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
      )}

      {/* Save/Edit Template Modal */}
      {showTemplateEditor && (
        <Modal
          open
          onClose={() => setShowTemplateEditor(false)}
          title={editingTemplateId ? "Edit Template" : "Save as Template"}
          icon={editingTemplateId ? Edit3 : Save}
          iconColor="text-neon-cyan"
          size="xl"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowTemplateEditor(false);
                  setEditingTemplateId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                color="cyan"
                onClick={handleTemplateSave}
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
                  onChange={(e) => setTemplateName(e.target.value)}
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
                  onChange={(e) => setTemplateDescription(e.target.value)}
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
                onChange={setNewInstruction}
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
                onChange={setNewContext}
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
                onChange={setNewGoals}
                minRows={2}
                maxRows={6}
                placeholder="Step 1&#10;Step 2&#10;Step 3"
              />
            </div>
            <AgentRuntimeDefaultsCard
              profileId={newProfile}
              onProfileChange={setNewProfile}
              missionTimeMinutes={newMissionTime}
              onMissionTimeChange={setNewMissionTime}
              timeoutMinutes={newTimeout}
              onTimeoutChange={setNewTimeout}
              modelId={newModel}
              provider={newProvider}
              onModelChange={(mid, prov) => {
                setNewModel(mid);
                setNewProvider(prov);
              }}
              modelPickerId="template-model-picker"
              timeoutHeading="Timeout"
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
                  onChange={setLocalDirDraft}
                  onAdd={() => {
                    const p = localDirDraft.path.trim();
                    if (!p) return;
                    if (newLocalDirs.some((d) => d.path === p)) return;
                    setNewLocalDirs((d) => [
                      ...d,
                      { path: p, branch: localDirDraft.branch || null },
                    ]);
                    setLocalDirDraft({ path: "", branch: null });
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
                        setNewLocalDirs((d) =>
                          d.map((x, j) => (j === i ? next : x)),
                        )
                      }
                      onDelete={() =>
                        setNewLocalDirs((d) => d.filter((_, j) => j !== i))
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
                        setNewReferences((r) => r.filter((_, j) => j !== i))
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
                    onChange={(e) => setReferenceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (referenceInput.trim()) {
                          setNewReferences((r) => [...r, referenceInput.trim()]);
                          setReferenceInput("");
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
                        setNewReferences((r) => [...r, referenceInput.trim()]);
                        setReferenceInput("");
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-neon-pink/10 border border-neon-pink/30 text-xs text-neon-pink hover:bg-neon-pink/20 font-mono transition-colors"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 font-mono block mb-1">
                Attached Skills{" "}
                <span className="text-white/20">(optional, max 10)</span>
              </label>
              <SkillSelector
                value={newSkills}
                onChange={setNewSkills}
                profileId={newProfile}
                max={10}
              />
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
                        onClick={() => setTemplateIcon(icon)}
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
                      onClick={() => setTemplateColor(color)}
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
      )}
    </div>
  );
}

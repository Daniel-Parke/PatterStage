// ═══════════════════════════════════════════════════════════════
// Hindsight Memory Browser — Browse, search, and store memories
// ═══════════════════════════════════════════════════════════════
// Memories are fetched only when the user clicks Recall (action=recall), not on mount.
// Sub-components extracted for maintainability:
//   - MemoryTab, DirectivesTab, MentalModelsTab
//   - HealthBanner, AddMemoryModal, DirectiveModal, MentalModelModal
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Search, Plus, Sparkles, List, FileText,
  Settings, RefreshCw,
} from "lucide-react";
import { SearchInput } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { safeApiCall } from "@/lib/api-fetch";
import { parseOptionalTagsInput, parseTagsInput } from "@/lib/hindsight-tag-input";
import { parseReflectResponse } from "./hindsight/utils";
import type { Tab, Memory, Directive, MentalModel, HealthState } from "./hindsight/types";
import HealthBanner from "./hindsight/HealthBanner";
import MemoryTab from "./hindsight/MemoryTab";
import DirectivesTab from "./hindsight/DirectivesTab";
import MentalModelsTab from "./hindsight/MentalModelsTab";
import { AddMemoryModal, DirectiveModal, MentalModelModal } from "./hindsight/Modals";
import { runMutation } from "@/lib/run-mutation";

// ── Default form state ─────────────────────────────────────────
//
// The directive + mental-model modals all reset to these blank
// values on initial open, on close, and on successful save. Pulling
// them into module constants means a future "I added a `description`
// field to the directive modal" lands in one place — the inline form
// literal was previously duplicated 3x per modal (6 sites total) and
// the session-35 lesson was that those 6 sites tend to drift.
const EMPTY_DIR_FORM = { name: "", content: "", priority: "0", tags: "" };
type DirForm = typeof EMPTY_DIR_FORM;

const EMPTY_MODEL_FORM = { name: "", query: "", tags: "" };
type ModelForm = typeof EMPTY_MODEL_FORM;


export default function HindsightBrowser() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("memories");
  const [reflectResult, setReflectResult] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState(false);

  // Add memory modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");
  const [adding, setAdding] = useState(false);

  // Health
  const [health, setHealth] = useState<HealthState | null>(null);

  // Directives state
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [loadingDirectives, setLoadingDirectives] = useState(false);
  const [showDirectiveModal, setShowDirectiveModal] = useState(false);
  const [dirForm, setDirForm] = useState<DirForm>(EMPTY_DIR_FORM);
  const [creatingDirective, setCreatingDirective] = useState(false);
  const [editingDirective, setEditingDirective] = useState<Directive | null>(null);
  const [editDirForm, setEditDirForm] = useState<DirForm>(EMPTY_DIR_FORM);
  const [savingDirective, setSavingDirective] = useState(false);

  // Mental models state
  const [mentalModels, setMentalModels] = useState<MentalModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [modelForm, setModelForm] = useState<ModelForm>(EMPTY_MODEL_FORM);
  const [creatingModel, setCreatingModel] = useState(false);
  const [editingModel, setEditingModel] = useState<MentalModel | null>(null);
  const [editModelForm, setEditModelForm] = useState<ModelForm>(EMPTY_MODEL_FORM);
  const [savingModel, setSavingModel] = useState(false);
  const [refreshingModelId, setRefreshingModelId] = useState<string | null>(null);

  const { showToast, toastElement } = useToast();

  // ── Health ───────────────────────────────────────────────

  const fetchHealthOnly = useCallback(async () => {
    const { data, error } = await safeApiCall<{ data?: HealthState }>("/api/memory/hindsight?action=health");
    if (data?.data) {
      setHealth(data.data);
    } else {
      setHealth({ available: false, mode: "unknown", message: error || "No response" });
    }
  }, []);

  // ── Memories ────────────────────────────────────────────

  const loadRecentMemories = useCallback(async () => {
    setLoadingInitial(true);
    const { data, error } = await safeApiCall<{ data?: { memories?: Memory[]; mode?: string; error?: string } }>("/api/memory/hindsight?action=list&limit=50");
    if (error || data?.data?.error) {
      void fetchHealthOnly();
    } else {
      const payload = data?.data;
      setMemories(payload?.memories || []);
      if (payload && !payload.error) {
        setHealth({ available: true, mode: typeof payload.mode === "string" ? payload.mode : "ok" });
      }
    }
    setLoadingInitial(false);
  }, [fetchHealthOnly]);

  useEffect(() => {
    void loadRecentMemories();
  }, [loadRecentMemories]);

  const runRecall = useCallback(async () => {
    const q = search.trim();
    if (!q) {
      showToast("Enter a search query first", "info");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await safeApiCall<{ data?: { memories?: Memory[]; available?: boolean; mode?: string; message?: string; error?: string } }>(`/api/memory/hindsight?action=recall&query=${encodeURIComponent(q)}`);
      if (error) {
        showToast(error, "error");
        await fetchHealthOnly();
        return;
      }
      const payload = data?.data;
      setMemories(payload?.memories || []);
      const backendSaysDown = payload?.available === false || (typeof payload?.error === "string" && payload.error.length > 0);
      if (!backendSaysDown) {
        setHealth({ available: true, mode: typeof payload?.mode === "string" ? payload.mode : "ok", message: typeof payload?.message === "string" ? payload.message : undefined });
      } else {
        await fetchHealthOnly();
      }
    } finally {
      setLoading(false);
    }
  }, [search, showToast, fetchHealthOnly]);

  const handleRefreshMemories = () => {
    if (search.trim()) {
      void runRecall();
    } else {
      void loadRecentMemories();
    }
  };

  const handleReflect = async () => {
    if (!search.trim()) return;
    setReflecting(true);
    setReflectResult(null);
    const { data, error } = await safeApiCall<{ data?: { response?: string } }>(`/api/memory/hindsight?action=reflect&query=${encodeURIComponent(search)}`);
    setReflecting(false);
    if (error) {
      showToast(error, "error");
    } else {
      setReflectResult(data?.data?.response || "No reflection generated");
    }
  };

  const handleAdd = () =>
    runMutation(showToast, {
      isValid: () => newContent.trim().length > 0,
      busy: setAdding,
      build: () => ({
        content: newContent,
        tags: parseOptionalTagsInput(newTags),
      }),
      path: "/api/memory/hindsight",
      successMsg: "Memory stored",
      errorMsg: "Failed to store memory",
      onSuccess: async () => {
        setShowAddModal(false);
        setNewContent("");
        setNewTags("");
        if (search.trim()) await runRecall();
        else await loadRecentMemories();
      },
    });

  // ── Directives ──────────────────────────────────────────

  const loadDirectives = useCallback(async () => {
    setLoadingDirectives(true);
    const { data, error } = await safeApiCall<{ data?: { directives?: Directive[]; error?: string } }>("/api/memory/hindsight?action=directives");
    setLoadingDirectives(false);
    if (error || data?.data?.error) {
      showToast(error || data?.data?.error || "Failed to load directives", "error");
      setDirectives([]);
      return;
    }
    setDirectives(data?.data?.directives || []);
  }, [showToast]);

  useEffect(() => {
    if (activeTab === "directives") void loadDirectives();
  }, [activeTab, loadDirectives]);

  const handleCreateDirective = () =>
    runMutation(showToast, {
      isValid: () => dirForm.name.trim().length > 0 && dirForm.content.trim().length > 0,
      busy: setCreatingDirective,
      build: () => ({
        action: "create-directive",
        name: dirForm.name,
        content: dirForm.content,
        priority: parseInt(dirForm.priority) || 0,
        tags: parseOptionalTagsInput(dirForm.tags),
      }),
      path: "/api/memory/hindsight",
      successMsg: "Directive created",
      errorMsg: "Failed to create directive",
      onSuccess: async () => {
        setShowDirectiveModal(false);
        setDirForm(EMPTY_DIR_FORM);
        await loadDirectives();
      },
    });

  const handleToggleDirective = async (directive: Directive) => {
    const { ok, error } = await safeApiCall("/api/memory/hindsight", {
      method: "POST",
      body: { action: "update-directive", id: directive.id, is_active: !directive.is_active },
    });
    if (!ok) {
      showToast(error ?? "Failed to update directive", "error");
      return;
    }
    showToast(directive.is_active ? "Directive deactivated" : "Directive activated", "success");
    await loadDirectives();
  };

  const handleDeleteDirective = async (id: string) => {
    const { ok, error } = await safeApiCall("/api/memory/hindsight", {
      method: "DELETE",
      body: { type: "directive", id },
    });
    if (!ok) {
      showToast(error ?? "Failed to delete directive", "error");
      return;
    }
    showToast("Directive deleted", "success");
    setDirectives(prev => prev.filter(d => d.id !== id));
  };

  const openEditDirective = (d: Directive) => {
    setEditingDirective(d);
    setEditDirForm({ name: d.name, content: d.content, priority: String(d.priority), tags: d.tags.join(", ") });
  };

  const handleSaveDirective = () => {
    if (!editingDirective) return false;
    return runMutation(showToast, {
      isValid: () => editDirForm.name.trim().length > 0 && editDirForm.content.trim().length > 0,
      busy: setSavingDirective,
      build: () => ({
        action: "update-directive",
        id: editingDirective.id,
        name: editDirForm.name,
        content: editDirForm.content,
        priority: parseInt(editDirForm.priority) || 0,
        tags: parseTagsInput(editDirForm.tags),
      }),
      path: "/api/memory/hindsight",
      successMsg: "Directive updated",
      errorMsg: "Failed to update directive",
      onSuccess: async () => {
        setEditingDirective(null);
        await loadDirectives();
      },
    });
  };

  // ── Mental Models ───────────────────────────────────────

  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    const { data, error } = await safeApiCall<{ data?: { models?: MentalModel[]; error?: string } }>("/api/memory/hindsight?action=mental-models");
    setLoadingModels(false);
    if (error || data?.data?.error) {
      showToast(error || data?.data?.error || "Failed to load mental models", "error");
      setMentalModels([]);
      return;
    }
    setMentalModels(data?.data?.models || []);
  }, [showToast]);

  useEffect(() => {
    if (activeTab === "mental-models") void loadModels();
  }, [activeTab, loadModels]);

  const handleCreateModel = () =>
    runMutation(showToast, {
      isValid: () => modelForm.name.trim().length > 0 && modelForm.query.trim().length > 0,
      busy: setCreatingModel,
      build: () => ({
        action: "create-model",
        name: modelForm.name,
        query: modelForm.query,
        tags: parseOptionalTagsInput(modelForm.tags),
      }),
      path: "/api/memory/hindsight",
      successMsg: "Mental model created (generating in background)",
      errorMsg: "Failed to create mental model",
      onSuccess: async () => {
        setShowModelModal(false);
        setModelForm(EMPTY_MODEL_FORM);
        await loadModels();
      },
    });

  const handleRefreshModel = async (id: string) => {
    setRefreshingModelId(id);
    const { ok, error } = await safeApiCall("/api/memory/hindsight", {
      method: "POST",
      body: { action: "refresh-model", id },
    });
    if (!ok) {
      showToast(error ?? "Failed to refresh mental model", "error");
      setRefreshingModelId(null);
      return;
    }
    showToast("Mental model refresh started", "success");
    await loadModels();
    setRefreshingModelId(null);
  };

  const handleDeleteModel = async (id: string) => {
    const { ok, error } = await safeApiCall("/api/memory/hindsight", {
      method: "DELETE",
      body: { type: "model", id },
    });
    if (!ok) {
      showToast(error ?? "Failed to delete mental model", "error");
      return;
    }
    showToast("Mental model deleted", "success");
    setMentalModels(prev => prev.filter(m => m.id !== id));
  };

  const openEditModel = (m: MentalModel) => {
    setEditingModel(m);
    setEditModelForm({ name: m.name, query: m.source_query, tags: m.tags.join(", ") });
  };

  // Field setters for the directive + mental-model modals. Each modal
  // exposes 3-4 separate `onNameChange` / `onContentChange` / etc. props
  // and the inline setter body is the same shape every time. `setField`
  // builds a partial-update setter for one key, so the JSX collapses to
  // `onNameChange={setField(setDirForm, "name")}`.
  const setField = <S,>(setter: React.Dispatch<React.SetStateAction<S>>, key: keyof S) =>
    (v: S[keyof S]) => setter((p) => ({ ...p, [key]: v }));

  const handleSaveModel = () => {
    if (!editingModel) return false;
    return runMutation(showToast, {
      isValid: () => editModelForm.name.trim().length > 0,
      busy: setSavingModel,
      build: () => ({
        action: "update-model",
        id: editingModel.id,
        name: editModelForm.name,
        query: editModelForm.query || undefined,
        tags: parseTagsInput(editModelForm.tags),
      }),
      path: "/api/memory/hindsight",
      successMsg: "Mental model updated",
      errorMsg: "Failed to update mental model",
      onSuccess: async () => {
        setEditingModel(null);
        await loadModels();
      },
    });
  };

  // ── Render ──

  const tabs: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "memories", label: "Memories", icon: List },
    { id: "directives", label: "Directives", icon: FileText },
    { id: "mental-models", label: "Mental Models", icon: Settings },
  ];

  return (
    <div className="pt-2">
      {toastElement}

      {health !== null && (
        <HealthBanner
          health={health}
          loadingInitial={loadingInitial}
          onRetry={() => { void loadRecentMemories(); void fetchHealthOnly(); }}
        />
      )}

      {/* Search Bar */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 flex flex-col gap-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Search memories (semantic search)..." accentColor="pink" />
          <p className="text-xs text-white/30 pl-1">Press Enter to search</p>
        </div>
        <Button variant="secondary" color="pink" size="sm" icon={Search} onClick={() => void runRecall()} disabled={!search.trim() || loading}>
          Recall
        </Button>
        <Button variant="secondary" color="purple" size="sm" icon={Sparkles} onClick={() => void handleReflect()} disabled={reflecting || !search.trim()}>
          {reflecting ? "Reflecting..." : "Reflect"}
        </Button>
        <Button variant="primary" color="pink" size="sm" icon={Plus} onClick={() => setShowAddModal(true)}>
          Add Memory
        </Button>
      </div>

      {/* Reflect Result */}
      {reflectResult && (
        <div className="mb-6 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-purple-300">Reflection</span>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">{parseReflectResponse(reflectResult)}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === tab.id ? "bg-pink-500/20 text-pink-300" : "text-white/40 hover:text-white/60"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" icon={RefreshCw} onClick={handleRefreshMemories} disabled={loading || loadingInitial}
          title={search.trim() ? "Run the same search again" : "Reload recent memories"}>
          Refresh
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === "memories" && <MemoryTab memories={memories} loading={loading} loadingInitial={loadingInitial} />}
      {activeTab === "directives" && (
        <DirectivesTab
          directives={directives} loading={loadingDirectives}
          onCreateClick={() => setShowDirectiveModal(true)} onRefresh={loadDirectives}
          onEdit={openEditDirective} onToggle={handleToggleDirective} onDelete={handleDeleteDirective}
        />
      )}
      {activeTab === "mental-models" && (
        <MentalModelsTab
          models={mentalModels} loading={loadingModels} refreshingModelId={refreshingModelId}
          onCreateClick={() => setShowModelModal(true)} onRefresh={loadModels}
          onEdit={openEditModel} onRefreshModel={handleRefreshModel} onDelete={handleDeleteModel}
        />
      )}

      {/* Modals */}
      <AddMemoryModal
        open={showAddModal} onClose={() => setShowAddModal(false)}
        content={newContent} tags={newTags} adding={adding}
        onContentChange={setNewContent} onTagsChange={setNewTags} onSave={handleAdd}
      />
      <DirectiveModal
        open={showDirectiveModal} onClose={() => { setShowDirectiveModal(false); setDirForm(EMPTY_DIR_FORM); }}
        isEdit={false}
        name={dirForm.name} content={dirForm.content} priority={dirForm.priority} tags={dirForm.tags}
        saving={creatingDirective}
        onNameChange={setField(setDirForm, "name")}
        onContentChange={setField(setDirForm, "content")}
        onPriorityChange={setField(setDirForm, "priority")}
        onTagsChange={setField(setDirForm, "tags")}
        onSave={handleCreateDirective}
      />
      <DirectiveModal
        open={!!editingDirective} onClose={() => setEditingDirective(null)} isEdit={true}
        name={editDirForm.name} content={editDirForm.content} priority={editDirForm.priority} tags={editDirForm.tags}
        saving={savingDirective}
        onNameChange={setField(setEditDirForm, "name")}
        onContentChange={setField(setEditDirForm, "content")}
        onPriorityChange={setField(setEditDirForm, "priority")}
        onTagsChange={setField(setEditDirForm, "tags")}
        onSave={handleSaveDirective}
      />
      <MentalModelModal
        open={showModelModal} onClose={() => { setShowModelModal(false); setModelForm(EMPTY_MODEL_FORM); }}
        isEdit={false}
        name={modelForm.name} query={modelForm.query} tags={modelForm.tags}
        saving={creatingModel}
        onNameChange={setField(setModelForm, "name")}
        onQueryChange={setField(setModelForm, "query")}
        onTagsChange={setField(setModelForm, "tags")}
        onSave={handleCreateModel}
      />
      <MentalModelModal
        open={!!editingModel} onClose={() => setEditingModel(null)} isEdit={true}
        name={editModelForm.name} query={editModelForm.query} tags={editModelForm.tags}
        saving={savingModel}
        onNameChange={setField(setEditModelForm, "name")}
        onQueryChange={setField(setEditModelForm, "query")}
        onTagsChange={setField(setEditModelForm, "tags")}
        onSave={handleSaveModel}
      />
    </div>
  );
}
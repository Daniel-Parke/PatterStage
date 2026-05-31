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
import { parseReflectResponse } from "./hindsight/utils";
import type { Tab, Memory, Directive, MentalModel, HealthState } from "./hindsight/types";
import HealthBanner from "./hindsight/HealthBanner";
import MemoryTab from "./hindsight/MemoryTab";
import DirectivesTab from "./hindsight/DirectivesTab";
import MentalModelsTab from "./hindsight/MentalModelsTab";
import { AddMemoryModal, DirectiveModal, MentalModelModal } from "./hindsight/Modals";

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
  const [dirForm, setDirForm] = useState({ name: "", content: "", priority: "0", tags: "" });
  const [creatingDirective, setCreatingDirective] = useState(false);
  const [editingDirective, setEditingDirective] = useState<Directive | null>(null);
  const [editDirForm, setEditDirForm] = useState({ name: "", content: "", priority: "0", tags: "" });
  const [savingDirective, setSavingDirective] = useState(false);

  // Mental models state
  const [mentalModels, setMentalModels] = useState<MentalModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [modelForm, setModelForm] = useState({ name: "", query: "", tags: "" });
  const [creatingModel, setCreatingModel] = useState(false);
  const [editingModel, setEditingModel] = useState<MentalModel | null>(null);
  const [editModelForm, setEditModelForm] = useState({ name: "", query: "", tags: "" });
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

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setAdding(true);
    try {
      const tags = newTags.split(",").map(t => t.trim()).filter(Boolean);
      const { ok, error } = await safeApiCall("/api/memory/hindsight", {
        method: "POST",
        body: { content: newContent, tags: tags.length > 0 ? tags : undefined },
      });
      if (!ok) {
        showToast(error ?? "Failed to store memory", "error");
        return;
      }
      showToast("Memory stored", "success");
      setShowAddModal(false);
      setNewContent("");
      setNewTags("");
      void (search.trim() ? runRecall() : loadRecentMemories());
    } catch {
      showToast("Failed to store memory", "error");
    } finally {
      setAdding(false);
    }
  };

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

  const handleCreateDirective = async () => {
    if (!dirForm.name.trim() || !dirForm.content.trim()) return;
    setCreatingDirective(true);
    try {
      const tags = dirForm.tags.split(",").map(t => t.trim()).filter(Boolean);
      const { ok, error } = await safeApiCall("/api/memory/hindsight", {
        method: "POST",
        body: { action: "create-directive", name: dirForm.name, content: dirForm.content, priority: parseInt(dirForm.priority) || 0, tags: tags.length > 0 ? tags : undefined },
      });
      if (!ok) {
        showToast(error ?? "Failed to create directive", "error");
        return;
      }
      showToast("Directive created", "success");
      setShowDirectiveModal(false);
      setDirForm({ name: "", content: "", priority: "0", tags: "" });
      await loadDirectives();
    } catch {
      showToast("Failed to create directive", "error");
    } finally {
      setCreatingDirective(false);
    }
  };

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

  const handleSaveDirective = async () => {
    if (!editingDirective || !editDirForm.name.trim() || !editDirForm.content.trim()) return;
    setSavingDirective(true);
    try {
      const tags = editDirForm.tags.split(",").map(t => t.trim()).filter(Boolean);
      const { ok, error } = await safeApiCall("/api/memory/hindsight", {
        method: "POST",
        body: { action: "update-directive", id: editingDirective.id, name: editDirForm.name, content: editDirForm.content, priority: parseInt(editDirForm.priority) || 0, tags },
      });
      if (!ok) {
        showToast(error ?? "Failed to update directive", "error");
        return;
      }
      showToast("Directive updated", "success");
      setEditingDirective(null);
      await loadDirectives();
    } catch {
      showToast("Failed to update directive", "error");
    } finally {
      setSavingDirective(false);
    }
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

  const handleCreateModel = async () => {
    if (!modelForm.name.trim() || !modelForm.query.trim()) return;
    setCreatingModel(true);
    try {
      const tags = modelForm.tags.split(",").map(t => t.trim()).filter(Boolean);
      const { ok, error } = await safeApiCall("/api/memory/hindsight", {
        method: "POST",
        body: { action: "create-model", name: modelForm.name, query: modelForm.query, tags: tags.length > 0 ? tags : undefined },
      });
      if (!ok) {
        showToast(error ?? "Failed to create mental model", "error");
        return;
      }
      showToast("Mental model created (generating in background)", "success");
      setShowModelModal(false);
      setModelForm({ name: "", query: "", tags: "" });
      await loadModels();
    } catch {
      showToast("Failed to create mental model", "error");
    } finally {
      setCreatingModel(false);
    }
  };

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

  const handleSaveModel = async () => {
    if (!editingModel || !editModelForm.name.trim()) return;
    setSavingModel(true);
    try {
      const tags = editModelForm.tags.split(",").map(t => t.trim()).filter(Boolean);
      const { ok, error } = await safeApiCall("/api/memory/hindsight", {
        method: "POST",
        body: { action: "update-model", id: editingModel.id, name: editModelForm.name, query: editModelForm.query || undefined, tags },
      });
      if (!ok) {
        showToast(error ?? "Failed to update mental model", "error");
        return;
      }
      showToast("Mental model updated", "success");
      setEditingModel(null);
      await loadModels();
    } catch {
      showToast("Failed to update mental model", "error");
    } finally {
      setSavingModel(false);
    }
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
        open={showDirectiveModal} onClose={() => { setShowDirectiveModal(false); setDirForm({ name: "", content: "", priority: "0", tags: "" }); }}
        isEdit={false}
        name={dirForm.name} content={dirForm.content} priority={dirForm.priority} tags={dirForm.tags}
        saving={creatingDirective}
        onNameChange={(v) => setDirForm(p => ({ ...p, name: v }))}
        onContentChange={(v) => setDirForm(p => ({ ...p, content: v }))}
        onPriorityChange={(v) => setDirForm(p => ({ ...p, priority: v }))}
        onTagsChange={(v) => setDirForm(p => ({ ...p, tags: v }))}
        onSave={handleCreateDirective}
      />
      <DirectiveModal
        open={!!editingDirective} onClose={() => setEditingDirective(null)} isEdit={true}
        name={editDirForm.name} content={editDirForm.content} priority={editDirForm.priority} tags={editDirForm.tags}
        saving={savingDirective}
        onNameChange={(v) => setEditDirForm(p => ({ ...p, name: v }))}
        onContentChange={(v) => setEditDirForm(p => ({ ...p, content: v }))}
        onPriorityChange={(v) => setEditDirForm(p => ({ ...p, priority: v }))}
        onTagsChange={(v) => setEditDirForm(p => ({ ...p, tags: v }))}
        onSave={handleSaveDirective}
      />
      <MentalModelModal
        open={showModelModal} onClose={() => { setShowModelModal(false); setModelForm({ name: "", query: "", tags: "" }); }}
        isEdit={false}
        name={modelForm.name} query={modelForm.query} tags={modelForm.tags}
        saving={creatingModel}
        onNameChange={(v) => setModelForm(p => ({ ...p, name: v }))}
        onQueryChange={(v) => setModelForm(p => ({ ...p, query: v }))}
        onTagsChange={(v) => setModelForm(p => ({ ...p, tags: v }))}
        onSave={handleCreateModel}
      />
      <MentalModelModal
        open={!!editingModel} onClose={() => setEditingModel(null)} isEdit={true}
        name={editModelForm.name} query={editModelForm.query} tags={editModelForm.tags}
        saving={savingModel}
        onNameChange={(v) => setEditModelForm(p => ({ ...p, name: v }))}
        onQueryChange={(v) => setEditModelForm(p => ({ ...p, query: v }))}
        onTagsChange={(v) => setEditModelForm(p => ({ ...p, tags: v }))}
        onSave={handleSaveModel}
      />
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════
// Hindsight Memory Browser — Browse, search, and store memories
// ═══════════════════════════════════════════════════════════════
// Memories are fetched only when the user clicks Recall (action=recall), not on mount.

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Brain, Search, Plus, Sparkles, List, FileText,
  Settings, RefreshCw, Clock, Tag, Trash2, ToggleLeft, ToggleRight, Zap, Pencil,
} from "lucide-react";
import { SearchInput } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { LoadingSpinner, EmptyState, ErrorBanner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import { timeAgo } from "@/lib/utils";

interface Memory {
  id?: string;
  content: string;
  type?: string;
  score?: number;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

/** Parse the raw Python repr string from the Hindsight API into clean fields */
function parseMemoryContent(raw: string): { text: string; type: string; tags: string[] } {
  // The content is a Python dict string from PostgreSQL, e.g.:
  // {'id': '...', 'text': 'Memory content here.', 'context': '', 'fact_type': 'observation', 'tags': [], ...}
  // Keys use colon + space separator: 'text': '...'
  const textMatch = raw.match(/'text':\s*'((?:[^'\\]|\\.)*)'/);
  const typeMatch =
    raw.match(/'fact_type':\s*'([^']*)'/) || raw.match(/(?:^|[^'])type='([^']*)'/);
  // Tags: `tags=[...]` (legacy repr) or `'tags': [...]` (PostgreSQL dict)
  const tagsMatch =
    raw.match(/tags=\[(.*?)\]/) || raw.match(/'tags':\s*\[(.*?)\]/);
  const text = textMatch ? textMatch[1] : raw;
  const type = typeMatch ? typeMatch[1] : "unknown";
  const tags = tagsMatch
    ? tagsMatch[1]
        .split(",")
        .map((t) => t.trim().replace(/^'|'$/g, ""))
        .filter(Boolean)
    : [];
  return { text, type, tags };
}

/** Badge colour for Hindsight `fact_type` / parsed type (aligned with holographic memory styling). */
function hindsightFactTypeBadgeColor(
  t: string,
): "cyan" | "purple" | "orange" | "green" | "gray" {
  const n = t.toLowerCase();
  if (n === "observation") return "cyan";
  if (n === "world") return "purple";
  if (n === "directive") return "orange";
  if (n === "experience") return "green";
  return "gray";
}

/** Parse the reflect response Python repr — extract text='...' from the repr string */
function parseReflectResponse(raw: string): string {
  // Format: "text='...' based_on=None structured_output=None usage=TokenUsage(...) trace=None"
  const match = raw.match(/^text='((?:[^'\\]|\\.)*)'/);
  return match ? match[1] : raw;
}

interface Directive {
  id: string;
  name: string;
  content: string;
  priority: number;
  is_active: boolean;
  tags: string[];
  created_at: string;
}

interface MentalModel {
  id: string;
  name: string;
  source_query: string;
  content: string;
  tags: string[];
  created_at: string;
  last_refreshed_at: string;
}

type Tab = "memories" | "directives" | "mental-models";

export default function HindsightBrowser() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [, setHasRecalled] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("memories");
  const [reflectResult, setReflectResult] = useState<string | null>(null);
  const [reflecting, setReflecting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");
  const [adding, setAdding] = useState(false);
  const [health, setHealth] = useState<{ available: boolean; mode: string; message?: string; error?: string } | null>(null);

  // Directives state
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [loadingDirectives, setLoadingDirectives] = useState(false);
  const [showDirectiveModal, setShowDirectiveModal] = useState(false);
  const [newDirName, setNewDirName] = useState("");
  const [newDirContent, setNewDirContent] = useState("");
  const [newDirPriority, setNewDirPriority] = useState("0");
  const [newDirTags, setNewDirTags] = useState("");
  const [creatingDirective, setCreatingDirective] = useState(false);
  const [editingDirective, setEditingDirective] = useState<Directive | null>(null);
  const [editDirName, setEditDirName] = useState("");
  const [editDirContent, setEditDirContent] = useState("");
  const [editDirPriority, setEditDirPriority] = useState("0");
  const [editDirTags, setEditDirTags] = useState("");
  const [savingDirective, setSavingDirective] = useState(false);

  // Mental models state
  const [mentalModels, setMentalModels] = useState<MentalModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [newModelQuery, setNewModelQuery] = useState("");
  const [newModelTags, setNewModelTags] = useState("");
  const [creatingModel, setCreatingModel] = useState(false);
  const [refreshingModelId, setRefreshingModelId] = useState<string | null>(null);
  const [editingModel, setEditingModel] = useState<MentalModel | null>(null);
  const [editModelName, setEditModelName] = useState("");
  const [editModelQuery, setEditModelQuery] = useState("");
  const [editModelTags, setEditModelTags] = useState("");
  const [savingModel, setSavingModel] = useState(false);
  const { showToast, toastElement } = useToast();

  const fetchHealthOnly = useCallback(async () => {
    try {
      const res = await fetch("/api/memory/hindsight?action=health");
      const data = await res.json();
      setHealth(data.data || { available: false, mode: "unknown", message: "No response" });
    } catch {
      setHealth({ available: false, mode: "error" });
    }
  }, []);

  // Load recent memories on mount
  const loadRecentMemories = useCallback(async () => {
    setLoadingInitial(true);
    try {
      const res = await fetch("/api/memory/hindsight?action=list&limit=50");
      const body = await res.json();
      const payload = body.data;
      setMemories(payload?.memories || []);
      if (payload && !payload.error) {
        setHealth({
          available: true,
          mode: typeof payload.mode === "string" ? payload.mode : "ok",
          message: undefined,
        });
      } else {
        await fetchHealthOnly();
      }
    } catch {
      // Silently swallow initial load errors — the system may still be starting up.
      // fetchHealthOnly() runs in the background to determine actual availability.
      void fetchHealthOnly();
    } finally {
      setLoadingInitial(false);
    }
  }, [fetchHealthOnly]);

  useEffect(() => {
    void loadRecentMemories();
  }, [loadRecentMemories]);

  const applyRecallPayload = useCallback(
    async (
      payload:
        | {
            memories?: Memory[];
            available?: boolean;
            error?: string;
            mode?: string;
            message?: string;
          }
        | undefined
    ) => {
      setMemories(payload?.memories || []);
      const backendSaysDown =
        payload?.available === false ||
        (typeof payload?.error === "string" && payload.error.length > 0);
      if (!backendSaysDown) {
        setHealth({
          available: true,
          mode: typeof payload?.mode === "string" ? payload.mode : "ok",
          message: typeof payload?.message === "string" ? payload.message : undefined,
        });
      } else {
        await fetchHealthOnly();
      }
    },
    [fetchHealthOnly]
  );

  const runRecall = useCallback(async () => {
    const q = search.trim();
    if (!q) {
      showToast("Enter a search query first", "info");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/memory/hindsight?action=recall&query=${encodeURIComponent(q)}`
      );
      const body = await res.json();
      const payload = body.data as
        | {
            memories?: Memory[];
            available?: boolean;
            error?: string;
            mode?: string;
            message?: string;
          }
        | undefined;
      setHasRecalled(true);
      await applyRecallPayload(payload);
    } catch {
      showToast("Recall failed", "error");
      await fetchHealthOnly();
    } finally {
      setLoading(false);
    }
  }, [search, showToast, applyRecallPayload, fetchHealthOnly]);

  const handleSearch = () => {
    void runRecall();
  };

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
    try {
      const res = await fetch(`/api/memory/hindsight?action=reflect&query=${encodeURIComponent(search)}`);
      const data = await res.json();
      setReflectResult(data.data?.response || "No reflection generated");
    } catch {
      showToast("Reflection failed", "error");
    } finally {
      setReflecting(false);
    }
  };

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setAdding(true);
    try {
      const tags = newTags.split(",").map(t => t.trim()).filter(Boolean);
      const res = await fetch("/api/memory/hindsight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent, tags: tags.length > 0 ? tags : undefined }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast("Memory stored", "success");
      setShowAddModal(false);
      setNewContent("");
      setNewTags("");
      if (search.trim()) {
        void runRecall();
      } else {
        void loadRecentMemories();
      }
    } catch {
      showToast("Failed to store memory", "error");
    } finally {
      setAdding(false);
    }
  };

  // ── Directives ──
  const loadDirectives = useCallback(async () => {
    setLoadingDirectives(true);
    try {
      const res = await fetch("/api/memory/hindsight?action=directives");
      const body = (await res.json()) as {
        data?: { directives?: Directive[]; error?: string };
        error?: string;
      };
      if (!res.ok) {
        const msg =
          (typeof body.error === "string" && body.error) ||
          (typeof body.data?.error === "string" && body.data.error) ||
          `Failed to load directives (${res.status})`;
        showToast(msg, "error");
        setDirectives([]);
        return;
      }
      setDirectives(body.data?.directives || []);
    } catch {
      showToast("Failed to load directives", "error");
      setDirectives([]);
    } finally {
      setLoadingDirectives(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeTab === "directives") {
      void loadDirectives();
    }
  }, [activeTab, loadDirectives]);

  const handleCreateDirective = async () => {
    if (!newDirName.trim() || !newDirContent.trim()) return;
    setCreatingDirective(true);
    try {
      const tags = newDirTags.split(",").map(t => t.trim()).filter(Boolean);
      const res = await fetch("/api/memory/hindsight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-directive",
          name: newDirName,
          content: newDirContent,
          priority: parseInt(newDirPriority) || 0,
          tags: tags.length > 0 ? tags : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast("Directive created", "success");
      setShowDirectiveModal(false);
      setNewDirName("");
      setNewDirContent("");
      setNewDirPriority("0");
      setNewDirTags("");
      await loadDirectives();
    } catch {
      showToast("Failed to create directive", "error");
    } finally {
      setCreatingDirective(false);
    }
  };

  const handleToggleDirective = async (directive: Directive) => {
    try {
      const res = await fetch("/api/memory/hindsight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-directive",
          id: directive.id,
          is_active: !directive.is_active,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast(directive.is_active ? "Directive deactivated" : "Directive activated", "success");
      await loadDirectives();
    } catch {
      showToast("Failed to update directive", "error");
    }
  };

  const handleDeleteDirective = async (id: string) => {
    try {
      const res = await fetch("/api/memory/hindsight", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "directive", id }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast("Directive deleted", "success");
      setDirectives(prev => prev.filter(d => d.id !== id));
    } catch {
      showToast("Failed to delete directive", "error");
    }
  };

  // ── Mental Models ──
  const loadModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const res = await fetch("/api/memory/hindsight?action=mental-models");
      const body = (await res.json()) as {
        data?: { models?: MentalModel[]; error?: string };
        error?: string;
      };
      if (!res.ok) {
        const msg =
          (typeof body.error === "string" && body.error) ||
          (typeof body.data?.error === "string" && body.data.error) ||
          `Failed to load mental models (${res.status})`;
        showToast(msg, "error");
        setMentalModels([]);
        return;
      }
      setMentalModels(body.data?.models || []);
    } catch {
      showToast("Failed to load mental models", "error");
      setMentalModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeTab === "mental-models") {
      void loadModels();
    }
  }, [activeTab, loadModels]);

  const handleCreateModel = async () => {
    if (!newModelName.trim() || !newModelQuery.trim()) return;
    setCreatingModel(true);
    try {
      const tags = newModelTags.split(",").map(t => t.trim()).filter(Boolean);
      const res = await fetch("/api/memory/hindsight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-model",
          name: newModelName,
          query: newModelQuery,
          tags: tags.length > 0 ? tags : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast("Mental model created (generating in background)", "success");
      setShowModelModal(false);
      setNewModelName("");
      setNewModelQuery("");
      setNewModelTags("");
      await loadModels();
    } catch {
      showToast("Failed to create mental model", "error");
    } finally {
      setCreatingModel(false);
    }
  };

  const handleRefreshModel = async (id: string) => {
    setRefreshingModelId(id);
    try {
      const res = await fetch("/api/memory/hindsight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh-model", id }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast("Mental model refresh started", "success");
      await loadModels();
    } catch {
      showToast("Failed to refresh mental model", "error");
    } finally {
      setRefreshingModelId(null);
    }
  };

  const handleDeleteModel = async (id: string) => {
    try {
      const res = await fetch("/api/memory/hindsight", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "model", id }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast("Mental model deleted", "success");
      setMentalModels(prev => prev.filter(m => m.id !== id));
    } catch {
      showToast("Failed to delete mental model", "error");
    }
  };

  // ── Edit handlers ──
  const openEditDirective = (d: Directive) => {
    setEditingDirective(d);
    setEditDirName(d.name);
    setEditDirContent(d.content);
    setEditDirPriority(String(d.priority));
    setEditDirTags(d.tags.join(", "));
  };

  const handleSaveDirective = async () => {
    if (!editingDirective || !editDirName.trim() || !editDirContent.trim()) return;
    setSavingDirective(true);
    try {
      const tags = editDirTags.split(",").map(t => t.trim()).filter(Boolean);
      const res = await fetch("/api/memory/hindsight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-directive",
          id: editingDirective.id,
          name: editDirName,
          content: editDirContent,
          priority: parseInt(editDirPriority) || 0,
          tags,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast("Directive updated", "success");
      setEditingDirective(null);
      await loadDirectives();
    } catch {
      showToast("Failed to update directive", "error");
    } finally {
      setSavingDirective(false);
    }
  };

  const openEditModel = (m: MentalModel) => {
    setEditingModel(m);
    setEditModelName(m.name);
    setEditModelQuery(m.source_query);
    setEditModelTags(m.tags.join(", "));
  };

  const handleSaveModel = async () => {
    if (!editingModel || !editModelName.trim()) return;
    setSavingModel(true);
    try {
      const tags = editModelTags.split(",").map(t => t.trim()).filter(Boolean);
      const res = await fetch("/api/memory/hindsight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-model",
          id: editingModel.id,
          name: editModelName,
          query: editModelQuery || undefined,
          tags,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      showToast("Mental model updated", "success");
      setEditingModel(null);
      await loadModels();
    } catch {
      showToast("Failed to update mental model", "error");
    } finally {
      setSavingModel(false);
    }
  };

  return (
    <div className="pt-2">
      {toastElement}
      {/* Health Status */}
      {!loadingInitial && health && !health.available && (
        <div className="mb-4">
          <ErrorBanner
            message={
              health.error?.includes("Redis")
                ? "Redis is not running. Start Redis to enable memory features: redis-server"
                : health.message
                  ? `Hindsight ${health.mode}: ${health.message}`
                  : `Hindsight ${health.mode}: ${health.error || "not responding"}`
            }
          />
        </div>
      )}

      {/* Search Bar */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 flex flex-col gap-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search memories (semantic search)..."
            accentColor="pink"
          />
          <p className="text-xs text-white/30 pl-1">Press Enter to search</p>
        </div>
        <Button
          variant="secondary"
          color="pink"
          size="sm"
          icon={Search}
          onClick={handleSearch}
          disabled={!search.trim() || loading}
        >
          Recall
        </Button>
        <Button
          variant="secondary"
          color="purple"
          size="sm"
          icon={Sparkles}
          onClick={handleReflect}
          disabled={reflecting || !search.trim()}
        >
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
        {([
          { id: "memories" as Tab, label: "Memories", icon: List },
          { id: "directives" as Tab, label: "Directives", icon: FileText },
          { id: "mental-models" as Tab, label: "Mental Models", icon: Settings },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              activeTab === tab.id
                ? "bg-pink-500/20 text-pink-300"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          icon={RefreshCw}
          onClick={handleRefreshMemories}
          disabled={loading || loadingInitial}
          title={search.trim() ? "Run the same search again" : "Reload recent memories"}
        >
          Refresh
        </Button>
      </div>

      {/* Content */}
      {activeTab === "memories" && (
        <>
          {loadingInitial || loading ? (
            <LoadingSpinner text={loading ? "Searching memories..." : "Loading recent memories..."} />
          ) : memories.length === 0 ? (
            <EmptyState
              icon={Brain}
              title="No memories yet"
              description="Hermes will start storing them as you converse. You can also add one with Add Memory above."
            />
          ) : (
            <div className="space-y-3">
              {memories.map((memory, i) => {
                const { text, type, tags } = parseMemoryContent(memory.content);
                return (
                <div
                  key={memory.id || i}
                  className="rounded-xl border border-white/10 bg-dark-900/50 p-4 hover:border-pink-500/20 transition-colors"
                >
                  <p className="text-sm text-white/70 leading-relaxed mb-2">{text}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-white/30">
                    {type && type !== "unknown" && (
                      <Badge color={hindsightFactTypeBadgeColor(type)} size="sm">
                        {type}
                      </Badge>
                    )}
                    {tags.length > 0 &&
                      tags.map((tag) => (
                        <Badge key={tag} color="pink" size="sm">
                          {tag}
                        </Badge>
                      ))}
                    {memory.score !== undefined && (
                      <span>
                        {typeof memory.score === "number" &&
                        memory.score > 0 &&
                        memory.score <= 1
                          ? `Relevance: ${(memory.score * 100).toFixed(0)}%`
                          : `Proof count: ${memory.score}`}
                      </span>
                    )}
                    {memory.created_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(memory.created_at)}
                      </span>
                    )}
                    {memory.metadata && Object.keys(memory.metadata).length > 0 && (
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {Object.keys(memory.metadata).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              )})}
            </div>
          )}
        </>
      )}

      {activeTab === "directives" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <div className="text-xs text-white/30">
              {directives.length} directive{directives.length !== 1 ? "s" : ""} — injected into agent prompts automatically
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" icon={RefreshCw} onClick={loadDirectives} disabled={loadingDirectives}>
                Refresh
              </Button>
              <Button variant="primary" color="pink" size="sm" icon={Plus} onClick={() => setShowDirectiveModal(true)}>
                New Directive
              </Button>
            </div>
          </div>
          {loadingDirectives ? (
            <LoadingSpinner text="Loading directives..." />
          ) : directives.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No directives yet"
              description="Hindsight returned no directives for this bank. Directives are hard rules injected into agent prompts when you add them."
              action={
                <Button
                  variant="primary"
                  color="pink"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowDirectiveModal(true)}
                >
                  Create your first directive
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {directives.map((d) => (
                <div
                  key={d.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    d.is_active
                      ? "border-white/10 bg-dark-900/50 hover:border-pink-500/20"
                      : "border-white/5 bg-dark-900/20 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white/90">{d.name}</span>
                        {d.priority > 0 && (
                          <Badge color="orange" size="sm">P{d.priority}</Badge>
                        )}
                        {!d.is_active && (
                          <Badge color="gray" size="sm">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-white/60 leading-relaxed">{d.content}</p>
                      {d.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {d.tags.map(t => <Badge key={t} color="purple" size="sm">{t}</Badge>)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditDirective(d)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleDirective(d)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
                        title={d.is_active ? "Deactivate" : "Activate"}
                      >
                        {d.is_active ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteDirective(d.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "mental-models" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <div className="text-xs text-white/30">
              {mentalModels.length} mental model{mentalModels.length !== 1 ? "s" : ""} — cached reflect results with auto-refresh
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" icon={RefreshCw} onClick={loadModels} disabled={loadingModels}>
                Refresh
              </Button>
              <Button variant="primary" color="pink" size="sm" icon={Plus} onClick={() => setShowModelModal(true)}>
                New Model
              </Button>
            </div>
          </div>
          {loadingModels ? (
            <LoadingSpinner text="Loading mental models..." />
          ) : mentalModels.length === 0 ? (
            <EmptyState
              icon={Settings}
              title="No mental models yet"
              description="Hindsight returned no mental models for this bank. Models are cached reflect analyses—create one with a source query to generate content."
              action={
                <Button
                  variant="primary"
                  color="pink"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowModelModal(true)}
                >
                  Create your first mental model
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {mentalModels.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-white/10 bg-dark-900/50 p-4 hover:border-pink-500/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white/90">{m.name}</span>
                        {m.content && <Badge color="green" size="sm">Ready</Badge>}
                        {!m.content && <Badge color="orange" size="sm">Generating</Badge>}
                      </div>
                      <p className="text-xs text-white/40 mb-2 font-mono">Query: {m.source_query}</p>
                      {m.content && (
                        <p className="text-sm text-white/60 leading-relaxed line-clamp-3">{m.content}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-white/30">
                        {m.last_refreshed_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Updated {timeAgo(m.last_refreshed_at)}
                          </span>
                        )}
                        {m.tags.length > 0 && (
                          <span className="flex gap-1">
                            {m.tags.map(t => <Badge key={t} color="purple" size="sm">{t}</Badge>)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModel(m)}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRefreshModel(m.id)}
                        disabled={refreshingModelId === m.id}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors disabled:opacity-30"
                        title="Refresh (re-run reflect)"
                      >
                        <Zap className={`w-4 h-4 ${refreshingModelId === m.id ? "animate-pulse text-yellow-400" : ""}`} />
                      </button>
                      <button
                        onClick={() => handleDeleteModel(m.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Memory Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Store New Memory" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/50 mb-1">Memory Content</label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="What should the agent remember?"
              className="w-full h-32 bg-dark-800 border border-white/10 rounded-lg p-3 text-sm text-white/80 resize-none focus:border-pink-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="e.g. user_pref, project, tech"
              className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-pink-500/50 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              color="pink"
              size="sm"
              onClick={handleAdd}
              disabled={adding || !newContent.trim()}
            >
              {adding ? "Storing..." : "Store Memory"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Directive Modal */}
      <Modal open={showDirectiveModal} onClose={() => setShowDirectiveModal(false)} title="Create Directive" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/50 mb-1">Directive Name</label>
            <input
              type="text"
              value={newDirName}
              onChange={(e) => setNewDirName(e.target.value)}
              placeholder="e.g. Always cite sources"
              className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-pink-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">Directive Content</label>
            <textarea
              value={newDirContent}
              onChange={(e) => setNewDirContent(e.target.value)}
              placeholder="The rule to inject into agent prompts..."
              className="w-full h-28 bg-dark-800 border border-white/10 rounded-lg p-3 text-sm text-white/80 resize-none focus:border-pink-500/50 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-white/50 mb-1">Priority</label>
              <input
                type="number"
                value={newDirPriority}
                onChange={(e) => setNewDirPriority(e.target.value)}
                placeholder="0"
                className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-pink-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={newDirTags}
                onChange={(e) => setNewDirTags(e.target.value)}
                placeholder="e.g. safety, behavior"
                className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-pink-500/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowDirectiveModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              color="pink"
              size="sm"
              onClick={handleCreateDirective}
              disabled={creatingDirective || !newDirName.trim() || !newDirContent.trim()}
            >
              {creatingDirective ? "Creating..." : "Create Directive"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create Mental Model Modal */}
      <Modal open={showModelModal} onClose={() => setShowModelModal(false)} title="Create Mental Model" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/50 mb-1">Model Name</label>
            <input
              type="text"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              placeholder="e.g. User Communication Style"
              className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-pink-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">Source Query</label>
            <textarea
              value={newModelQuery}
              onChange={(e) => setNewModelQuery(e.target.value)}
              placeholder="e.g. What are Daniel's communication preferences and working style?"
              className="w-full h-28 bg-dark-800 border border-white/10 rounded-lg p-3 text-sm text-white/80 resize-none focus:border-pink-500/50 focus:outline-none"
            />
            <p className="text-xs text-white/30 mt-1">Hindsight will run reflect with this query to generate the model content.</p>
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={newModelTags}
              onChange={(e) => setNewModelTags(e.target.value)}
              placeholder="e.g. user, preferences"
              className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-pink-500/50 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowModelModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              color="pink"
              size="sm"
              onClick={handleCreateModel}
              disabled={creatingModel || !newModelName.trim() || !newModelQuery.trim()}
            >
              {creatingModel ? "Creating..." : "Create Mental Model"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Directive Modal */}
      <Modal open={!!editingDirective} onClose={() => setEditingDirective(null)} title="Edit Directive" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/50 mb-1">Directive Name</label>
            <input
              type="text"
              value={editDirName}
              onChange={(e) => setEditDirName(e.target.value)}
              className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-pink-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">Directive Content</label>
            <textarea
              value={editDirContent}
              onChange={(e) => setEditDirContent(e.target.value)}
              className="w-full h-28 bg-dark-800 border border-white/10 rounded-lg p-3 text-sm text-white/80 resize-none focus:border-pink-500/50 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-white/50 mb-1">Priority</label>
              <input
                type="number"
                value={editDirPriority}
                onChange={(e) => setEditDirPriority(e.target.value)}
                className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-pink-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={editDirTags}
                onChange={(e) => setEditDirTags(e.target.value)}
                className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-pink-500/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditingDirective(null)}>Cancel</Button>
            <Button
              variant="primary"
              color="pink"
              size="sm"
              onClick={handleSaveDirective}
              disabled={savingDirective || !editDirName.trim() || !editDirContent.trim()}
            >
              {savingDirective ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Mental Model Modal */}
      <Modal open={!!editingModel} onClose={() => setEditingModel(null)} title="Edit Mental Model" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-white/50 mb-1">Model Name</label>
            <input
              type="text"
              value={editModelName}
              onChange={(e) => setEditModelName(e.target.value)}
              className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-pink-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">Source Query</label>
            <textarea
              value={editModelQuery}
              onChange={(e) => setEditModelQuery(e.target.value)}
              className="w-full h-28 bg-dark-800 border border-white/10 rounded-lg p-3 text-sm text-white/80 resize-none focus:border-pink-500/50 focus:outline-none"
            />
            <p className="text-xs text-white/30 mt-1">Changing the query won&apos;t re-generate content. Use Refresh to re-run reflect.</p>
          </div>
          <div>
            <label className="block text-sm text-white/50 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={editModelTags}
              onChange={(e) => setEditModelTags(e.target.value)}
              className="w-full bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-pink-500/50 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditingModel(null)}>Cancel</Button>
            <Button
              variant="primary"
              color="pink"
              size="sm"
              onClick={handleSaveModel}
              disabled={savingModel || !editModelName.trim()}
            >
              {savingModel ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

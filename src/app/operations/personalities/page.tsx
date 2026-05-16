// ═══════════════════════════════════════════════════════════════
// Personality Manager — CRUD for agent.personalities
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Plus,
  Trash2,
  Edit3,
  Check,
  Loader2,
  AlertCircle,
  Sparkles,
  Copy,
  MoreVertical,
} from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Input";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import Modal from "@/components/ui/Modal";
import {
  getPersonalityEmoji,
} from "@/lib/personalities";

interface Personality {
  name: string;
  prompt: string;
}

function PersonalityCard({
  personality,
  onEdit,
  onDelete,
  onActivate,
  isActive,
}: {
  personality: Personality;
  onEdit: (p: Personality) => void;
  onDelete: (name: string) => void;
  onActivate: (name: string) => void;
  isActive: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDelete = async () => {
    if (!deleting) {
      setDeleting(true);
      return;
    }
    await onDelete(personality.name);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(personality.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const preview =
    personality.prompt.length > 120
      ? personality.prompt.slice(0, 120) + "..."
      : personality.prompt;

  return (
    <div
      className={`rounded-xl border transition-all ${
        isActive
          ? "border-neon-cyan/50 bg-neon-cyan/5 shadow-[0_0_20px_rgb(var(--ch-rgb-neon-cyan)_/_0.15)] animate-pulse"
          : "border-white/10 bg-dark-900/50 hover:border-white/20"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">{getPersonalityEmoji(personality.name)}</span>
              <h3 className="font-semibold text-white truncate font-mono">
                {personality.name}
              </h3>
              {isActive && (
                <span className="text-[10px] font-mono bg-neon-cyan/15 text-neon-cyan px-1.5 py-0.5 rounded">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-white/40 leading-relaxed">
              {expanded ? personality.prompt : preview}
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-white/30 hover:bg-white/5 transition-colors"
              title={copied ? "Copied!" : "Copy prompt"}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-neon-green" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            {!isActive && (
              <button
                onClick={() => onActivate(personality.name)}
                className="p-1.5 rounded-lg text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
                title="Set as active"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            )}
            {/* Kebab menu */}
            <div className="relative">
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg text-white/30 hover:bg-white/5 transition-colors"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {expanded && (
                <div className="absolute right-0 top-full mt-1 z-10 bg-dark-800 border border-white/10 rounded-lg shadow-xl py-1 min-w-[120px]">
                  <button
                    onClick={() => { onEdit(personality); setExpanded(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => { handleDelete(); setExpanded(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400/80 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditPersonalityModal({
  personality,
  onClose,
  onSaved,
}: {
  personality: Personality | null; // null = create mode
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(personality?.name || "");
  const [prompt, setPrompt] = useState(personality?.prompt || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = personality !== null;

  const handleSubmit = async () => {
    if (!name.trim() || !prompt.trim()) {
      setError("Name and prompt are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/personalities", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: isEdit
          ? JSON.stringify({ originalName: personality.name, name: name.trim(), prompt: prompt.trim() })
          : JSON.stringify({ name: name.trim(), prompt: prompt.trim() }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || `Failed to ${isEdit ? "update" : "create"} personality`);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit: ${personality.name}` : "New Personality"}
      icon={isEdit ? Edit3 : Plus}
      iconColor="text-neon-purple"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            color="purple"
            onClick={handleSubmit}
            loading={saving}
            icon={saving ? Loader2 : Check}
          >
            {isEdit ? "Save Changes" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">Personality Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. pirate, teacher, creative"
            disabled={false}
            className="w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-purple/50 transition-colors font-mono"
          />
          <p className="text-xs text-white/30 font-mono">
            Lowercase identifier — used in config.yaml and CLI personality switch
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-white/70">System Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            placeholder="You are a helpful assistant who..."
            className="w-full bg-dark-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neon-purple/50 transition-colors font-mono resize-y"
          />
          <p className="text-xs text-white/30 font-mono">
            {prompt.length} characters — this prompt is prepended to the agent&apos;s system prompt
          </p>
        </div>

        {/* Live preview */}
        {prompt.trim() && (
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-white/30 uppercase tracking-widest">
              Preview
            </label>
            <div className="bg-dark-800/50 border border-white/5 rounded-lg p-3 text-sm text-white/60 font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">
              {prompt}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function PersonalitiesPage() {
  const [personalities, setPersonalities] = useState<Personality[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activePersonality, setActivePersonality] = useState<string>("");
  const [editing, setEditing] = useState<Personality | null | undefined>(undefined);
  const { showToast, toastElement } = useToast();

  const loadPersonalities = useCallback(async () => {
    setLoading(true);
    try {
      const [persRes, configRes] = await Promise.all([
        fetch("/api/personalities"),
        fetch("/api/config"),
      ]);
      const persData = await persRes.json();
      const configData = await configRes.json();

      setPersonalities(persData.data?.personalities || persData.personalities || []);
      setActivePersonality(
        ((configData.data?.display as Record<string, unknown>)?.personality as string) || ""
      );
    } catch {
      showToast("Failed to load personalities", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadPersonalities();
  }, [loadPersonalities]);

  const handleDelete = async (name: string) => {
    try {
      const res = await fetch(`/api/personalities?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to delete");
      }
      showToast(`Deleted personality: ${name}`, "success");
      if (activePersonality === name) {
        // Clear active if we deleted it
        await fetch("/api/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section: "display", values: { personality: "" } }),
        });
      }
      loadPersonalities();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  const handleActivate = async (name: string) => {
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "display",
          values: { personality: activePersonality === name ? "" : name },
        }),
      });
      if (!res.ok) throw new Error("Failed to set active personality");
      setActivePersonality(activePersonality === name ? "" : name);
      showToast(
        activePersonality === name
          ? "Cleared active personality"
          : `Activated: ${name}`,
        "success"
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Activation failed", "error");
    }
  };

  const handleSaved = () => {
    setEditing(undefined);
    loadPersonalities();
    showToast("Personality saved!", "success");
  };

  const filtered = personalities.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.prompt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppPageShell>
      <PageHeader
        title="Personalities"
        subtitle="Manage agent personality presets — custom system prompts for different behaviours"
        icon={Brain}
        color="purple"
      />

      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search personalities..."
              accentColor="purple"
            />
          </div>
          <Button
            variant="primary"
            color="purple"
            icon={Plus}
            onClick={() => setEditing(null)}
          >
            New
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <LoadingSpinner text="Loading personalities..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Brain}
            title={search ? "No matches" : "No personalities yet"}
            description={
              search
                ? "Try a different search term"
                : "Create your first personality preset to customise agent behaviour"
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <PersonalityCard
                key={p.name}
                personality={p}
                onEdit={(personality) => setEditing(personality)}
                onDelete={handleDelete}
                onActivate={handleActivate}
                isActive={activePersonality === p.name}
              />
            ))}
          </div>
        )}

        {/* Info */}
        <div className="mt-8 p-4 rounded-xl border border-white/5 bg-dark-900/30">
          <h3 className="text-xs font-mono text-white/30 uppercase tracking-widest mb-2">
            How Personalities Work
          </h3>
          <ul className="space-y-1.5 text-xs text-white/40 font-mono">
            <li>• Each personality is a custom system prompt stored in config.yaml</li>
            <li>• Click ✨ to set as the active personality (display.personality)</li>
            <li>• Use <code className="text-neon-purple bg-white/5 px-1 rounded">/personality</code> in CLI to switch at runtime</li>
            <li>• Active personality is prepended to the agent&apos;s system prompt each message</li>
          </ul>
        </div>
      </div>

      {/* Edit/Create Modal */}
      {editing !== undefined && (
        <EditPersonalityModal
          personality={editing}
          onClose={() => setEditing(undefined)}
          onSaved={handleSaved}
        />
      )}

      {toastElement}
    </AppPageShell>
  );
}

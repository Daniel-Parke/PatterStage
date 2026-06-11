// ═══════════════════════════════════════════════════════════════
// Personality Manager — profile SOUL.md identity editor
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Brain,
  Plus,
  Edit3,
  Check,
  Loader2,
  AlertCircle,
  Sparkles,
  Copy,
  ChevronDown,
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
import { apiFetch, setErrorFromCaught, toastError } from "@/lib/api-fetch";
import { runSyncAction } from "@/lib/operation-sync-action";
import { filterByCaseInsensitiveSubstring } from "@/lib/list-search";

interface Personality {
  name: string;
  prompt: string;
}

function PersonalityCard({
  personality,
  onEdit,
  onActivate,
  isActive,
}: {
  personality: Personality;
  onEdit: (p: Personality) => void;
  onActivate: (name: string) => void;
  isActive: boolean;
}) {
  const [textExpanded, setTextExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    navigator.clipboard.writeText(personality.prompt);
    setCopied(true);
    copiedTimerRef.current = setTimeout(() => {
      copiedTimerRef.current = null;
      setCopied(false);
    }, 2000);
  };

  const preview =
    personality.prompt.length > 120
      ? personality.prompt.slice(0, 120) + "..."
      : personality.prompt;

  return (
    <div
      className={`rounded-xl border transition-all ${
        isActive
          ? "border-neon-cyan/50 bg-neon-cyan/5"
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
              {textExpanded ? personality.prompt : preview}
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setTextExpanded(!textExpanded)}
              className={`p-1.5 rounded-lg text-white/30 hover:bg-white/5 transition-colors ${textExpanded ? "bg-white/5" : ""}`}
              title={textExpanded ? "Collapse" : "Expand prompt"}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${textExpanded ? "" : "rotate-90"}`} />
            </button>
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
            <button
              onClick={() => onEdit(personality)}
              className="p-1.5 rounded-lg text-white/30 hover:bg-white/5 transition-colors"
              title="Edit personality"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
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
      await apiFetch("/api/personalities", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify({ profile: name.trim(), prompt: prompt.trim() }),
      });
      onSaved();
    } catch (err) {
      setErrorFromCaught(setError, err, "Unknown error");
    } finally {
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
  const [editTarget, setEditTarget] = useState<Personality | null | undefined>(undefined);
  const { showToast, toastElement } = useToast();

  const loadPersonalities = useCallback(async () => {
    setLoading(true);
    try {
      const [persData, configData] = await Promise.all([
        apiFetch("/api/personalities"),
        apiFetch("/api/config"),
      ]);
      setPersonalities(persData?.data?.personalities ?? []);
      const displaySection = configData?.data?.display;
      const personalityValue = (displaySection as { personality?: unknown } | null)?.personality;
      setActivePersonality(typeof personalityValue === "string" ? personalityValue : "");
    } catch (err) {
      toastError(showToast, err, "Failed to load personalities");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadPersonalities();
  }, [loadPersonalities]);

  // closeEdit — the Edit/Create Personality modal has 2 single-setter
  // close sites that both do the same thing: `() => setEditTarget(undefined)`.
  //   1. The modal's `onClose` (X-button / overlay click)
  //   2. The first line of `handleSaved`'s 3-setter success path
  // Centralising into a `useCallback` with empty deps (useState setters
  // are stable) keeps the 2 sites in lockstep if a future "clear
  // toast on close" or "reset edit-form state" extension lands — a
  // single edit here updates both. The pattern mirrors the A3
  // single-setter close callbacks that session 100's discriminated
  // audit established (e.g. `closeSkillEditor` in operations/skills,
  // `closeDelete` in operations/agents) and the `closeCreate` /
  // `closeComposer` setters from session 100/101. The remaining
  // `setEditTarget(...)` sites (the New button + the card's
  // onEdit) are OPEN sites that pass different values
  // (null = create, Personality = edit) — left inline as direct
  // setters, not duplicates of close.
  const closeEdit = useCallback(() => setEditTarget(undefined), []);

  const handleActivate = (name: string) => {
    const next = activePersonality === name ? "" : name;
    // No busy state for activation — the no-op setter keeps the helper
    // happy without adding a UI spinner for a sub-100ms action.
    return runSyncAction({
      setBusy: () => undefined,
      showToast,
      url: "/api/config",
      method: "PUT",
      body: { section: "display", values: { personality: next } },
      successMessage: next ? `Activated: ${next}` : "Cleared active personality",
      errorMessage: "Activation failed",
      onSuccess: () => {
        setActivePersonality(next);
      },
    });
  };

  const handleSaved = () => {
    closeEdit();
    loadPersonalities();
    showToast("Personality saved!", "success");
  };

  const sortedPersonalities = useMemo(
    () =>
      [...personalities].sort((a, b) => {
        if (a.name === activePersonality) return -1;
        if (b.name === activePersonality) return 1;
        return a.name.localeCompare(b.name);
      }),
    [personalities, activePersonality],
  );

  const filtered = useMemo(
    () =>
      filterByCaseInsensitiveSubstring(
        sortedPersonalities,
        search,
        [(p) => p.name, (p) => p.prompt],
        (p) => p.name === activePersonality,
      ),
    [sortedPersonalities, search, activePersonality],
  );

  return (
    <AppPageShell>
      <PageHeader
        title="Personalities"
        subtitle="Hermes identities are SOUL.md files. Edit profile identity from Agents or this page."
        icon={Brain}
        color="purple"
      />

      <div className="max-w-4xl mx-auto px-6 py-6">
        {activePersonality && (
          <p className="text-xs font-mono text-neon-cyan/80 mb-4">
            Active: <span className="text-white">{activePersonality}</span>
          </p>
        )}

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
            onClick={() => setEditTarget(null)}
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
                : "No profile SOUL identities found yet"
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <PersonalityCard
                key={p.name}
                personality={p}
                onEdit={(personality) => setEditTarget(personality)}
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
            <li>• Hermes identity is stored in SOUL.md for Bob and each profile</li>
            <li>• Control Hub stores SOUL.md in SQLite and pushes it to Hermes on save</li>
            <li>• config.yaml is used for runtime policy such as skills.disabled and platform_toolsets</li>
          </ul>
        </div>
      </div>

      {/* Edit/Create Modal */}
      {editTarget !== undefined && (
        <EditPersonalityModal
          key={editTarget?.name ?? 'new'}
          personality={editTarget}
          onClose={closeEdit}
          onSaved={handleSaved}
        />
      )}

      {toastElement}
    </AppPageShell>
  );
}

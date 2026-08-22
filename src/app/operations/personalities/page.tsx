// ═══════════════════════════════════════════════════════════════
// Personality Manager — profile SOUL.md identity editor
//
// Thin page shell: data loading, activation and the edit-modal
// lifecycle live here; the row and the modal are presentational
// components under src/components/personalities/.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Brain } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/Input";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import { apiFetch, toastError } from "@/lib/api-fetch";
import { runSyncAction } from "@/lib/operation-sync-action";
import { filterByCaseInsensitiveSubstring } from "@/lib/list-search";
import PersonalitiesInsights from "@/components/personalities/PersonalitiesInsights";
import PersonalityCard, { type Personality } from "@/components/personalities/PersonalityCard";
import EditPersonalityModal from "@/components/personalities/EditPersonalityModal";

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
    // No busy state for activation — activation is a sub-100ms PUT so
    // showing a spinner would be UI noise. Session 170 made
    // `runSyncAction`'s `setBusy` parameter optional (defaulting to
    // a no-op), so this caller simply omits the key.
    return runSyncAction({
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
        subtitle="A personality is a profile's SOUL.md voice. Edit an existing profile's identity here; create profiles on the Agents page."
        icon={Brain}
        color="purple"
      />

      <div className="max-w-4xl mx-auto px-6 py-6">
        {!loading && <PersonalitiesInsights personalities={personalities} activeName={activePersonality} />}

        {activePersonality && (
          <p className="text-xs font-mono text-neon-cyan/80 mb-4">
            Active: <span className="text-white">{activePersonality}</span>
          </p>
        )}

        {/* Toolbar — no "New": a personality IS a profile's identity, so new
            ones come from creating a profile on the Agents page. */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search profiles..."
              accentColor="purple"
            />
          </div>
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
            <li>• PatterStage stores SOUL.md in SQLite and pushes it to Hermes on save</li>
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

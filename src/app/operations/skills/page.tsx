// ══════════════════════════════════════════════════════════════════════════════
// Skills Manager — Active / Inactive two-section layout with live toggle
// ══════════════════════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, ToggleRight, ToggleLeft, Edit3, Save, RotateCcw } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/Input";
import { LoadingSpinner, EmptyState } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import ProfileSelector from "@/components/ui/ProfileSelector";
import SkillsInsights from "@/components/skills/SkillsInsights";
import { SkillSection } from "@/components/skills/SkillSection";
import { SkillCategoryGrid } from "@/components/skills/SkillCategoryGrid";
import { apiFetch, toastError } from "@/lib/api-fetch";
import { runSyncAction } from "@/lib/operation-sync-action";
import {
  effectiveSkillEnabled,
  filterBySearch,
  groupCategories,
} from "@/lib/skills-page-helpers";
import { pluralise } from "@/lib/utils";
import type { Skill, SkillsData } from "@/types/console";

// Presentational subcomponents (SkillSection / SkillCategoryGrid / SkillCard /
// CategoryLabel) live in src/components/skills/. The pure derivations
// (effectiveSkillEnabled / filterBySearch / groupCategories) live in
// src/lib/skills-page-helpers.ts.

export default function SkillsPage() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState("default");

  // Per-category collapse state — default collapsed (value is true when collapsed)
  const [categoryCollapsed, setCategoryCollapsed] = useState<Record<string, boolean>>({});
  // Per-section collapse state — Active open by default
  const [activeCollapsed, setActiveCollapsed] = useState(false);
  const [inactiveCollapsed, setInactiveCollapsed] = useState(true);

  // toggleActiveCollapsed / toggleInactiveCollapsed — the 2 section
  // collapse headers (Active, Inactive) each have a 1-setter toggle
  // inline arrow of the form `() => setXCollapsed((v) => !v)` passed
  // as the `onToggleCollapse` prop on the sibling `<SkillSection>`
  // (lines 385 + 430). Pre-refactor the inline form was repeated at
  // both sites with byte-equivalent semantics (a single boolean
  // flip of the section's `useState` setter, default value
  // preserved). Extracting to `useCallback` siblings matches the
  // A3 single-setter close-callback pattern that session 100/103
  // established for `closeDelete` / `closeEditor` / `closeSkillEditor`
  // and the `closeEdit` extraction in operations/personalities
  // (session 100). The deps array is `[]` per session 119 P-3
  // codebase convention (useState setters are stable). A future
  // "also reset section search on collapse" or "track which
  // section is open for keyboard navigation" extension lands in
  // one place, keeping the 2 call sites in lockstep. The category
  // collapse toggle (`toggleCategory`, below) takes an argument
  // (the category key) and is a different shape — left as a
  // direct arrow, not part of this 1-setter family.
  const toggleActiveCollapsed = useCallback(
    () => setActiveCollapsed((v) => !v),
    [],
  );
  const toggleInactiveCollapsed = useCallback(
    () => setInactiveCollapsed((v) => !v),
    [],
  );

  const toggleCategory = (cat: string) =>
    setCategoryCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  // Per-section search
  const [activeSearch, setActiveSearch] = useState("");
  const [inactiveSearch, setInactiveSearch] = useState("");

  // Expanded skill for content preview
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState<string>("");

  // Per-skill editor
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editOriginal, setEditOriginal] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // closeSkillEditor — the Edit Skill modal has 4 single-setter
  // close sites that all do the same thing: `() => setEditingSkill(null)`.
  //   1. Modal `onClose` (X-button / overlay click)
  //   2. Modal Cancel button (footer)
  //   3. The load-failure path in openSkillEditor's catch block
  //      (if the GET to fetch the skill's content fails, dismiss
  //      the modal rather than leaving it open with empty fields)
  //   4. saveSkillEdit's success path (dismiss the modal after a
  //      successful PUT; the conditional `if (expandedSkill ===
  //      editingSkill) setSkillContent(...)` is a sibling update
  //      for the in-page preview, not part of the close)
  // Centralising into a `useCallback` with empty deps (useState setters
  // are stable) keeps the 4 sites in lockstep if a future "clear
  // editContent on close" or "reset editOriginal" extension lands.
  // This is the A3 single-setter close pattern that session 100's
  // discriminated-close audit established: a 1-setter callback is
  // worth extracting when it has 3+ identical call sites.
  const closeSkillEditor = useCallback(() => setEditingSkill(null), []);

  // Optimistic toggle state — key: skillName, value: the effective (pending) enabled state
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);

  const { showToast, toastElement } = useToast();

  // Shared URL builder for skill API calls (GET and PUT)
  const skillApiUrl = (name: string) =>
    `/api/skills/${encodeURIComponent(name)}?profile=${selectedProfile}`;

  const importSkillsFromHermes = () =>
    runSyncAction({
      setBusy: setImporting,
      showToast,
      url: "/api/agent/profiles/sync/import",
      body: { importSkills: true },
      successMessage: "Skills catalog imported from Hermes disk",
      errorMessage: "Import failed",
      onSuccess: loadSkills,
    });

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch(`/api/skills?profile=${selectedProfile}`);
      setData(d.data);
      // Seed all categories as collapsed on first load
      const cats = Object.keys(d.data.categories || {});
      setCategoryCollapsed(Object.fromEntries(cats.map((c) => [c, true])));
    } catch (err) {
      toastError(showToast, err, "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, [selectedProfile, showToast]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  // Derive active/inactive from the skills + pending toggles in a single pass.
  const { activeSkills, inactiveSkills } = (data?.skills ?? []).reduce<{
    activeSkills: Skill[];
    inactiveSkills: Skill[];
  }>(
    (acc, s) => {
      const isActive = effectiveSkillEnabled(s, toggling);
      (isActive ? acc.activeSkills : acc.inactiveSkills).push(s);
      return acc;
    },
    { activeSkills: [], inactiveSkills: [] },
  );

  // ── Toggle — fires API immediately, optimistic update, reverts on failure ───

  const toggleSkill = useCallback(
    async (skillName: string, currentEnabled: boolean) => {
      const next = !currentEnabled;
      // Optimistic
      setToggling((prev) => ({ ...prev, [skillName]: next }));
      const prevData = data; // Snapshot for revert on failure
      setData((prev) =>
        prev
          ? {
              ...prev,
              skills: prev.skills.map((s) =>
                s.name === skillName ? { ...s, enabled: next } : s,
              ),
            }
          : prev,
      );
      try {
        await apiFetch(`/api/skills/${encodeURIComponent(skillName)}/toggle`, {
          method: "PUT",
          body: JSON.stringify({ profile: selectedProfile, enabled: next }),
        });
        showToast(
          next ? `${skillName} enabled` : `${skillName} disabled`,
          "success",
        );
      } catch (err) {
        // Revert the optimistic data on failure (toggling is cleared
        // by the finally block below, so we only need to revert data
        // here).
        if (prevData) {
          setData(prevData);
        }
        toastError(showToast, err, "Failed to update skill");
      } finally {
        // Always clear the pending toggle, regardless of success or
        // failure — single source of truth for the toggling-map
        // cleanup. Was previously duplicated in the success and
        // failure branches (3 lines × 2 = 6 lines).
        setToggling((prev) => {
          const next2 = { ...prev };
          delete next2[skillName];
          return next2;
        });
      }
    },
    [data, selectedProfile, showToast],
  );

  // handleToggleSkill — centralises the (skill, fallback) → toggle
  // dispatch shape used by both the Active and Inactive section
  // grids. The pre-refactor code inlined the same
  // `(skill) => toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling, <fallback>))`
  // callback at 2 sites (the Active section's `onToggleSkill`
  // prop on line ~414 and the Inactive section's on line ~459).
  // The 2 sites are byte-equivalent except for the fallback:
  //   - Active section: uses the default `skill.enabled` (the
  //     `effectiveSkillEnabled` helper's default param value, so
  //     the caller doesn't pass a 2nd argument).
  //   - Inactive section: passes `!skill.enabled` because the
  //     Inactive grid is the negation of the active state — a
  //     skill in the Inactive list has `enabled === false`, so the
  //     "current enabled" that `toggleSkill` reads must be the
  //     inversion (otherwise the toggle would no-op on the wrong
  //     current state).
  // The helper defaults the fallback to `skill.enabled` so the
  // Active call site is `onToggleSkill={handleToggleSkill}` (no
  // args) and the Inactive call site is
  // `onToggleSkill={(skill) => handleToggleSkill(skill, !skill.enabled)}`.
  // Same byte-equivalent semantics, but the dispatch shape lives
  // in one place — a future "track toggle analytics" or
  // "throttle double-clicks" extension lands in one place instead
  // of having to update 2 inline arrows.
  const handleToggleSkill = useCallback(
    (skill: Skill, fallback: boolean = skill.enabled) => {
      return toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling, fallback));
    },
    [toggleSkill, toggling],
  );

  // ── Skill content preview ───────────────────────────────────────────────────

  const openSkillEditor = async (skill: Skill) => {
    setEditingSkill(skill.name);
    setEditContent("");
    setEditOriginal("");
    try {
      const d = await apiFetch(skillApiUrl(skill.name));
      const content = d.data?.content || "";
      setEditContent(content);
      setEditOriginal(content);
    } catch (err) {
      toastError(showToast, err, "Failed to load skill");
      closeSkillEditor();
    }
  };

  const saveSkillEdit = async () => {
    if (!editingSkill || savingEdit) return;
    setSavingEdit(true);
    try {
      await apiFetch(skillApiUrl(editingSkill), {
        method: "PUT",
        body: JSON.stringify({ content: editContent }),
      });
      setEditOriginal(editContent);
      showToast(`${editingSkill} saved`, "success");
      if (expandedSkill === editingSkill) {
        setSkillContent(editContent);
      }
      closeSkillEditor();
    } catch (err) {
      toastError(showToast, err, "Failed to save skill");
    } finally {
      setSavingEdit(false);
    }
  };

  const viewSkill = async (skill: Skill) => {
    if (expandedSkill === skill.name) {
      setExpandedSkill(null);
      setSkillContent("");
      return;
    }
    setExpandedSkill(skill.name);
    try {
      const d = await apiFetch(skillApiUrl(skill.name));
      setSkillContent(d.data?.content || "// No content");
    } catch (err) {
      // Surface the real error to the user via the toast — the inline
      // "// Failed to load content" placeholder only says "something
      // broke" without telling the user WHY (e.g. "API returned
      // invalid JSON (HTTP 500)"). This is the canonical "feature is
      // not working" exception that session 142 explicitly permits:
      // users see the real diagnostic message, not a static
      // placeholder. The inline placeholder is still set so the
      // expand panel renders a meaningful fallback if the user
      // dismisses the toast and the panel is still open — `setSkillContent`
      // is the panel's source of truth, the toast is the
      // acknowledgement. Pattern mirrors the sibling
      // `openSkillEditor` (line 232-234) which already uses
      // `toastError` for the same catch path.
      setSkillContent("// Failed to load content");
      toastError(showToast, err, "Failed to load skill content");
    }
  };

  // ── Section counts ─────────────────────────────────────────────────────────

  const total = data?.skills.length || 0;
  const activeFiltered = filterBySearch(activeSkills, activeSearch);
  const inactiveFiltered = filterBySearch(inactiveSkills, inactiveSearch);

  return (
    <AppPageShell>
      {toastElement}
      <PageHeader
        icon={FileText}
        title="Skills Manager"
        subtitle={`${total} skill${pluralise(total)} — active = catalog minus skills.disabled for ${selectedProfile}`}
        color="green"
        actions={
          <ProfileSelector
            value={selectedProfile}
            onChange={(id) => setSelectedProfile(id)}
            compact={false}
          />
        }
      />

      <div className="px-6 py-4">
        <p className="text-xs text-white/40 font-mono mb-4 max-w-3xl">
          Hermes uses a <strong className="text-white/60">denylist</strong> (
          <code className="text-white/50">skills.disabled</code> in config.yaml). Short names in YAML
          are matched to catalog paths (e.g. <code className="text-white/50">apple-notes</code> →{" "}
          <code className="text-white/50">apple/apple-notes</code>). If you edited disk config,
          use <strong className="text-white/60">Operations → Agents → Pull</strong> for that profile
          before toggling skills here.
        </p>
        {!loading && total > 0 && <SkillsInsights skills={data?.skills ?? []} activeCount={activeSkills.length} />}
        {loading ? (
          <LoadingSpinner text="Loading skills..." />
        ) : total === 0 ? (
          <EmptyState
            icon={FileText}
            title="No skills in catalog"
            description="Import the global skills tree from ~/.hermes/skills into PatterStage SQLite, then push to sync disk."
            action={
              <Button
                variant="primary"
                color="green"
                onClick={() => void importSkillsFromHermes()}
                disabled={importing}
              >
                {importing ? "Importing…" : "Import skills from Hermes"}
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-6">
            {/* ── Active Skills ── */}
            <SkillSection
              title="Active"
              icon={ToggleRight}
              iconColor="text-neon-green"
              count={activeFiltered.length}
              ofTotal={activeSkills.length}
              collapsed={activeCollapsed}
              onToggleCollapse={toggleActiveCollapsed}
              search={
                <SearchInput
                  value={activeSearch}
                  onChange={setActiveSearch}
                  placeholder="Search active skills..."
                  accentColor="green"
                />
              }
            >
              {activeFiltered.length === 0 ? (
                <EmptyState
                  icon={ToggleRight}
                  title="No active skills"
                  description={
                    activeSearch
                      ? "No active skills match your search"
                      : "Toggle skills below to enable them"
                  }
                />
              ) : (
                <SkillCategoryGrid
                  categories={groupCategories(activeFiltered)}
                  categoryCollapsed={categoryCollapsed}
                  onToggleCategory={toggleCategory}
                  accentColor="text-neon-green/50"
                  enabled
                  expandedSkill={expandedSkill}
                  skillContent={skillContent}
                  toggling={toggling}
                  onToggleSkill={handleToggleSkill}
                  onViewSkill={viewSkill}
                  onEditSkill={openSkillEditor}
                />
              )}
            </SkillSection>

            {/* ── Inactive Skills ── */}
            <SkillSection
              title="Inactive"
              icon={ToggleLeft}
              iconColor="text-white/30"
              count={inactiveFiltered.length}
              ofTotal={inactiveSkills.length}
              collapsed={inactiveCollapsed}
              onToggleCollapse={toggleInactiveCollapsed}
              search={
                <SearchInput
                  value={inactiveSearch}
                  onChange={setInactiveSearch}
                  placeholder="Search inactive skills..."
                  accentColor="white"
                />
              }
            >
              {inactiveFiltered.length === 0 ? (
                <EmptyState
                  icon={ToggleLeft}
                  title="No inactive skills"
                  description={
                    inactiveSearch
                      ? "No inactive skills match your search"
                      : "All skills are currently active"
                  }
                />
              ) : (
                <SkillCategoryGrid
                  categories={groupCategories(inactiveFiltered)}
                  categoryCollapsed={categoryCollapsed}
                  onToggleCategory={toggleCategory}
                  accentColor="text-white/30"
                  enabled={false}
                  expandedSkill={expandedSkill}
                  skillContent={skillContent}
                  toggling={toggling}
                  onToggleSkill={(skill) => handleToggleSkill(skill, !skill.enabled)}
                  onViewSkill={viewSkill}
                  onEditSkill={openSkillEditor}
                />
              )}
            </SkillSection>
          </div>
        )}
      </div>

      <Modal
        open={editingSkill !== null}
        onClose={closeSkillEditor}
        title={editingSkill ? `Edit: ${editingSkill}` : "Edit skill"}
        icon={Edit3}
        iconColor="text-neon-green"
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={RotateCcw}
              onClick={() => setEditContent(editOriginal)}
              disabled={editContent === editOriginal}
            >
              Reset
            </Button>
            <Button variant="ghost" size="sm" onClick={closeSkillEditor}>
              Cancel
            </Button>
            <Button
              variant="primary"
              color="green"
              size="sm"
              icon={Save}
              onClick={saveSkillEdit}
              disabled={savingEdit || editContent === editOriginal}
              loading={savingEdit}
            >
              Save
            </Button>
          </>
        }
      >
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="w-full min-h-[320px] bg-dark-800 border border-white/10 rounded-lg p-4 text-sm text-white/80 font-mono resize-y focus:border-neon-green/50 focus:outline-none"
          spellCheck={false}
        />
      </Modal>
    </AppPageShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Skills Manager — Active / Inactive two-section layout with live toggle
// ══════════════════════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import ProfileSelector from "@/components/ui/ProfileSelector";
import SkillsInsights from "@/components/skills/SkillsInsights";
import SkillsSections from "@/components/skills/SkillsSections";
import SkillsDenylistNote from "@/components/skills/SkillsDenylistNote";
import SkillsCatalogEmpty from "@/components/skills/SkillsCatalogEmpty";
import SkillEditorModal from "@/components/skills/SkillEditorModal";
import { apiFetch, toastError } from "@/lib/api-fetch";
import { runSyncAction } from "@/lib/operation-sync-action";
import {
  effectiveSkillEnabled,
  filterBySearch,
} from "@/lib/skills-page-helpers";
import { pluralise } from "@/lib/utils";
import type { Skill, SkillsData } from "@/types/console";

// Presentational subcomponents (SkillsSections / SkillSection /
// SkillCategoryGrid / SkillCard / CategoryLabel / SkillEditorModal) live in
// src/components/skills/. The pure derivations (effectiveSkillEnabled /
// filterBySearch / groupCategories) live in src/lib/skills-page-helpers.ts.

export default function SkillsPage() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState("default");

  // Per-category collapse state — default collapsed (value is true when collapsed)
  const [categoryCollapsed, setCategoryCollapsed] = useState<Record<string, boolean>>({});
  // Per-section collapse state — Active open by default
  const [activeCollapsed, setActiveCollapsed] = useState(false);
  const [inactiveCollapsed, setInactiveCollapsed] = useState(true);

  // toggleActiveCollapsed / toggleInactiveCollapsed — one per section
  // header, handed to <SkillsSections> as onToggleActiveCollapsed /
  // onToggleInactiveCollapsed. Both were inline
  // `() => setXCollapsed((v) => !v)` arrows repeated at the two call
  // sites; extracting them as `useCallback` siblings matches the A3
  // single-setter pattern session 100/103 established (`closeDelete`,
  // `closeEditor`, `closeSkillEditor`, `closeEdit` in
  // operations/personalities). Empty deps per session 119 P-3: useState
  // setters are stable. The category collapse toggle (`toggleCategory`,
  // below) takes the category key and is a different shape, so it is
  // not part of this 1-setter family.
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

  // closeSkillEditor — the Edit Skill modal has 4 single-setter close
  // sites that all do `() => setEditingSkill(null)`: the modal's
  // onClose and its Cancel button (both now inside SkillEditorModal),
  // openSkillEditor's catch (dismiss rather than leave the modal open
  // with empty fields) and saveSkillEdit's success path (the
  // conditional `setSkillContent` beside it updates the in-page
  // preview and is not part of the close). One `useCallback` with
  // empty deps keeps the 4 in lockstep. A3 single-setter close
  // pattern, session 100's discriminated-close audit: extract a
  // 1-setter callback once it has 3+ identical call sites.
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

  // handleToggleSkill — the one (skill, fallback) → toggle dispatch
  // shape for both section grids, replacing the same inline
  // `(skill) => toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling, <fallback>))`
  // arrow written twice. The fallback defaults to `skill.enabled`,
  // which is what the Active grid wants; the Inactive grid passes
  // `!skill.enabled` (see the note in SkillsSections, which owns both
  // call sites now). A future "track toggle analytics" or "throttle
  // double-clicks" extension lands here instead of in two arrows.
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
        <SkillsDenylistNote />
        {!loading && total > 0 && <SkillsInsights skills={data?.skills ?? []} activeCount={activeSkills.length} />}
        {loading ? (
          <LoadingSpinner text="Loading skills..." />
        ) : total === 0 ? (
          <SkillsCatalogEmpty
            importing={importing}
            onImport={() => void importSkillsFromHermes()}
          />
        ) : (
          <SkillsSections
            activeSkills={activeFiltered}
            activeTotal={activeSkills.length}
            activeSearch={activeSearch}
            onActiveSearchChange={setActiveSearch}
            activeCollapsed={activeCollapsed}
            onToggleActiveCollapsed={toggleActiveCollapsed}
            inactiveSkills={inactiveFiltered}
            inactiveTotal={inactiveSkills.length}
            inactiveSearch={inactiveSearch}
            onInactiveSearchChange={setInactiveSearch}
            inactiveCollapsed={inactiveCollapsed}
            onToggleInactiveCollapsed={toggleInactiveCollapsed}
            categoryCollapsed={categoryCollapsed}
            onToggleCategory={toggleCategory}
            expandedSkill={expandedSkill}
            skillContent={skillContent}
            toggling={toggling}
            onToggleSkill={handleToggleSkill}
            onViewSkill={viewSkill}
            onEditSkill={openSkillEditor}
          />
        )}
      </div>

      <SkillEditorModal
        skillName={editingSkill}
        content={editContent}
        original={editOriginal}
        saving={savingEdit}
        onContentChange={setEditContent}
        onReset={() => setEditContent(editOriginal)}
        onClose={closeSkillEditor}
        onSave={saveSkillEdit}
      />
    </AppPageShell>
  );
}

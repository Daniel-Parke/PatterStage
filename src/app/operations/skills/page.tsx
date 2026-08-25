// ══════════════════════════════════════════════════════════════════════════════
// Skills Manager: collapsed categories, a paged row window, one search box
// ══════════════════════════════════════════════════════════════════════════════
//
// T-0032. This page used to render the entire catalogue on load: every
// category open, every skill a card, both sections at once. Measured at 178
// skills that came to 5,450 DOM nodes, 625 buttons and 35,218 characters of
// body text, seven times the next heaviest page in the app.
//
// Three things hold that down now, and they are separable:
//
//   1. A category is a ROW with a count until someone opens it. Collapsed is
//      the absence of an entry in `expandedCategories`, not a seeded value, so
//      a category nobody anticipated is collapsed like every other one. The
//      old code DID try to seed every category collapsed on load, but it
//      seeded the API's raw category strings ("creative") and the grid read
//      the map back by title-cased display label ("Creative"), so not one
//      lookup ever matched and the whole catalogue rendered open regardless.
//   2. An open category renders ONE page window of rows, not all of them, so
//      node count stops tracking the catalogue size.
//   3. Search runs over the whole catalogue and REPLACES the view with its
//      matches. It does not filter the rendered rows. That distinction is the
//      trap in every list virtualisation: filter the window and the search box
//      quietly starts denying that skills exist because they happen to sit in
//      a category nobody opened. The invariant is pinned in
//      tests/unit/skills-catalogue-restructure.test.tsx.
//
// Presentational subcomponents live in src/components/skills/; the pure
// derivations live in src/lib/skills-page-helpers.ts.

"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { SearchInput } from "@/components/ui/Input";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useToast } from "@/components/ui/Toast";
import ProfileSelector from "@/components/ui/ProfileSelector";
import SkillsInsights from "@/components/skills/SkillsInsights";
import SkillsSections from "@/components/skills/SkillsSections";
import SkillsSearchResults from "@/components/skills/SkillsSearchResults";
import SkillsDenylistNote from "@/components/skills/SkillsDenylistNote";
import SkillsCatalogEmpty from "@/components/skills/SkillsCatalogEmpty";
import SkillEditorModal from "@/components/skills/SkillEditorModal";
import { apiFetch, toastError } from "@/lib/api-fetch";
import { runSyncAction } from "@/lib/operation-sync-action";
import {
  clampPage,
  effectiveSkillEnabled,
  filterBySearch,
} from "@/lib/skills-page-helpers";
import { pluralise } from "@/lib/utils";
import type { Skill, SkillsData } from "@/types/console";

export default function SkillsPage() {
  const [data, setData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState("default");

  // ── View state ─────────────────────────────────────────────────────────────
  //
  // Expanded, not collapsed. The map holds the exceptions a user has opened,
  // so the default for anything not in it is closed, and it stays closed for
  // categories that appear later (a profile switch, a fresh import) without
  // anything having to remember to seed them.
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  // Page index per section-scoped category key.
  const [categoryPage, setCategoryPage] = useState<Record<string, number>>({});
  const [activeCollapsed, setActiveCollapsed] = useState(false);
  const [inactiveCollapsed, setInactiveCollapsed] = useState(false);

  const toggleActiveCollapsed = useCallback(() => setActiveCollapsed((v) => !v), []);
  const toggleInactiveCollapsed = useCallback(() => setInactiveCollapsed((v) => !v), []);

  const toggleCategory = useCallback(
    (stateKey: string) =>
      setExpandedCategories((prev) => ({ ...prev, [stateKey]: !prev[stateKey] })),
    [],
  );

  const changeCategoryPage = useCallback(
    (stateKey: string, page: number) =>
      setCategoryPage((prev) => ({ ...prev, [stateKey]: page })),
    [],
  );

  // ── Catalogue-wide search ──────────────────────────────────────────────────
  //
  // One box, not one per section. Two boxes each searched half the catalogue,
  // so finding a skill meant already knowing whether it was enabled.
  const [search, setSearch] = useState("");
  const [searchPage, setSearchPage] = useState(0);

  const changeSearch = useCallback((value: string) => {
    setSearch(value);
    // A new query is a new result set; page 3 of the old one means nothing.
    setSearchPage(0);
  }, []);

  // Expanded skill for content preview
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState<string>("");

  // Per-skill editor
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editOriginal, setEditOriginal] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // closeSkillEditor. The Edit Skill modal has 4 single-setter close sites
  // that all do `() => setEditingSkill(null)`: the modal's onClose and its
  // Cancel button (both inside SkillEditorModal), openSkillEditor's catch
  // (dismiss rather than leave the modal open with empty fields) and
  // saveSkillEdit's success path. One `useCallback` keeps the 4 in lockstep.
  const closeSkillEditor = useCallback(() => setEditingSkill(null), []);

  // Optimistic toggle state. Key: skillName, value: the effective (pending) enabled state
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);

  const { showToast, toastElement } = useToast();

  // Shared URL builder for skill API calls (GET and PUT)
  const skillApiUrl = (name: string) =>
    `/api/skills/${encodeURIComponent(name)}?profile=${selectedProfile}`;

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch(`/api/skills?profile=${selectedProfile}`);
      setData(d.data);
      // Nothing to seed. Collapsed is the absence of an entry, and a profile
      // switch drops whatever the previous profile's categories were expanded
      // to rather than carrying stale keys across.
      setExpandedCategories({});
      setCategoryPage({});
    } catch (err) {
      toastError(showToast, err, "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, [selectedProfile, showToast]);

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

  useEffect(() => { loadSkills(); }, [loadSkills]);

  // ── Derivations ────────────────────────────────────────────────────────────

  const allSkills = data?.skills ?? [];

  // Derive active/inactive from the skills + pending toggles in a single pass.
  const { activeSkills, inactiveSkills } = allSkills.reduce<{
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

  const searching = search.trim().length > 0;
  // Over allSkills, deliberately. Not over the section lists, not over the
  // rendered window: the catalogue.
  const matches = searching
    ? [...filterBySearch(allSkills, search)].sort((a, b) => a.name.localeCompare(b.name))
    : [];

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
        // Revert the optimistic data on failure (toggling is cleared by the
        // finally block below, so we only need to revert data here).
        if (prevData) {
          setData(prevData);
        }
        toastError(showToast, err, "Failed to update skill");
      } finally {
        // Always clear the pending toggle, regardless of success or failure.
        setToggling((prev) => {
          const next2 = { ...prev };
          delete next2[skillName];
          return next2;
        });
      }
    },
    [data, selectedProfile, showToast],
  );

  // handleToggleSkill. One dispatch shape for every card on the page, whether
  // it is rendered in the Active section, the Inactive section or the search
  // results.
  //
  // It reads the skill's own effective state. The old code passed a
  // section-dependent FALLBACK down instead, and the Inactive section passed
  // the negation: for a skill with enabled === false and no pending toggle
  // that resolved "currently enabled" to TRUE, so clicking a control labelled
  // "Enable skill" sent { enabled: false } and toasted "disabled". The skill
  // never turned on. A mixed search-results list has no section to read a
  // fallback from, which is what made the bug impossible to carry forward.
  const handleToggleSkill = useCallback(
    (skill: Skill) => toggleSkill(skill.name, effectiveSkillEnabled(skill, toggling)),
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
      // Surface the real error via the toast. The inline placeholder only
      // says "something broke" without saying why. The placeholder is still
      // set so the panel renders a meaningful fallback if the user dismisses
      // the toast while the panel is open.
      setSkillContent("// Failed to load content");
      toastError(showToast, err, "Failed to load skill content");
    }
  };

  const total = data?.skills.length || 0;

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
        {!loading && total > 0 && (
          <SkillsInsights skills={allSkills} activeCount={activeSkills.length} />
        )}
        {loading ? (
          <LoadingSpinner text="Loading skills..." />
        ) : total === 0 ? (
          <SkillsCatalogEmpty
            importing={importing}
            onImport={() => void importSkillsFromHermes()}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="max-w-md" data-testid="skills-search">
              <SearchInput
                value={search}
                onChange={changeSearch}
                placeholder={`Search all ${total} skills...`}
                accentColor="green"
              />
            </div>

            {searching ? (
              <SkillsSearchResults
                matches={matches}
                total={total}
                page={clampPage(searchPage, matches.length)}
                onPageChange={setSearchPage}
                toggling={toggling}
                expandedSkill={expandedSkill}
                skillContent={skillContent}
                onToggleSkill={handleToggleSkill}
                onViewSkill={viewSkill}
                onEditSkill={openSkillEditor}
              />
            ) : (
              <SkillsSections
                activeSkills={activeSkills}
                activeCollapsed={activeCollapsed}
                onToggleActiveCollapsed={toggleActiveCollapsed}
                inactiveSkills={inactiveSkills}
                inactiveCollapsed={inactiveCollapsed}
                onToggleInactiveCollapsed={toggleInactiveCollapsed}
                expandedCategories={expandedCategories}
                onToggleCategory={toggleCategory}
                categoryPage={categoryPage}
                onCategoryPageChange={changeCategoryPage}
                expandedSkill={expandedSkill}
                skillContent={skillContent}
                toggling={toggling}
                onToggleSkill={handleToggleSkill}
                onViewSkill={viewSkill}
                onEditSkill={openSkillEditor}
              />
            )}
          </div>
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

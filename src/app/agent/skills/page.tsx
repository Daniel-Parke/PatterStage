// ══════════════════════════════════════════════════════════════════════════════
// Skills: a list of skills, with categories you can fold, and one search box
// ══════════════════════════════════════════════════════════════════════════════
//
// T-0032. This page used to render the entire catalogue on load: every
// category open, every skill a card, both sections at once. Measured at 178
// skills that came to 5,450 DOM nodes, 625 buttons and 35,218 characters of
// body text, seven times the next heaviest page in the app. It answered with
// three things that are kept here and are separable:
//
//   1. A category is a ROW until someone opens it, and an open category
//      renders ONE page window of rows, so node count stops tracking the
//      catalogue size.
//   2. Search runs over the whole catalogue and REPLACES the view with its
//      matches. It does not filter the rendered rows. That distinction is the
//      trap in every list virtualisation: filter the window and the search box
//      quietly starts denying that skills exist because they happen to sit in
//      a category nobody opened. The invariant is pinned in
//      tests/unit/skills-catalogue-restructure.test.tsx.
//
// T-0125 sized the default. Collapsing EVERY category was measured on the
// running product as a first viewport with a strip saying "78" five times and
// twenty closed rows: not one skill name on screen, on the screen whose job
// is to show them. A section small enough to render in full now opens with
// its categories expanded, and a skill is one line rather than a card, so the
// same catalogue costs a fraction of the nodes it did. Above that size the
// categories collapse as before. The strip went with it - Active, Inactive
// and Total were the donut's own arcs and centre - and the subtitle carries
// the four numbers in one line.
//
// Presentational subcomponents live in src/components/skills/; the pure
// derivations live in src/lib/skills/skills-page-helpers.ts.

"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/Input";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import PageLoading, { pendingCount } from "@/components/ui/PageLoading";
import { LastResult, useToast } from "@/components/ui/Toast";
import ProfilePicker from "@/components/ui/ProfilePicker";
import ConceptHint from "@/components/help/ConceptHint";
import SkillsSections from "@/components/skills/SkillsSections";
import SkillsSearchResults from "@/components/skills/SkillsSearchResults";
import SkillEditorModal from "@/components/skills/SkillEditorModal";
import { API_FETCH_BULK_TIMEOUT_MS, apiFetch, toastError } from "@/lib/api/api-fetch";
import { runWrite } from "@/lib/api/api-write";
import {
  clampPage,
  effectiveSkillEnabled,
  filterBySearch,
  groupCategories,
} from "@/lib/skills/skills-page-helpers";
import { pluralise } from "@/lib/utils";
import type { Skill, SkillsData } from "@/types/console";
import { useApiResource } from "@/hooks/useApiResource";
import { useProfiles } from "@/hooks/useProfiles";
import { useSelectedProfile } from "@/hooks/useSelectedProfile";

/** The standing explainer above the skill lists. Static copy, no props. */
function SkillsDenylistNote() {
  return (
    <p className="text-micro text-ps-text-muted font-mono mb-4 max-w-3xl">
      Hermes uses a <strong className="text-ps-text-secondary">denylist</strong> (
      <code className="text-ps-text-muted">skills.disabled</code> in config.yaml). Short names in YAML
      are matched to catalog paths (e.g. <code className="text-ps-text-muted">apple-notes</code> →{" "}
      <code className="text-ps-text-muted">apple/apple-notes</code>). If you edited disk config,
      use <strong className="text-ps-text-secondary">Agent → Agents</strong> and pull that profile
      before toggling <ConceptHint id="skill">skills</ConceptHint> here.
    </p>
  );
}

/** What the page shows with no catalog. The import call itself stays on the page. */
function SkillsCatalogEmpty({ importing, onImport }: { importing: boolean; onImport: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="No skills in catalog"
      // design-lint-disable-next-line hermes-outside-adapter -- empty-state copy for an import button. It tells the operator where the skills are being imported FROM, which is the one thing they need before pressing a button that writes to the catalog.
      description="Import the global skills tree from ~/.hermes/skills into PatterStage SQLite, then push to sync disk."
      action={
        <Button variant="primary" color="green" onClick={onImport} disabled={importing}>
          {importing ? "Importing…" : "Import skills from Hermes"}
        </Button>
      }
    />
  );
}

export default function SkillsPage() {
  // Shared with Agents and Tools, so a profile chosen on one of them is the
  // profile whose skills this page turns on and off (T-0113).
  const [selectedProfile, setSelectedProfile] = useSelectedProfile();
  const { data: profiles } = useProfiles();
  const profileName = profiles?.find((p) => p.id === selectedProfile)?.name ?? selectedProfile;

  // The catalogue, keyed on the profile: a profile switch is a new read with
  // its own first-load state, and a reload after a write keeps the list on
  // screen (C6, T-0143).
  const skills = useApiResource<SkillsData>(`/api/skills?profile=${selectedProfile}`, {
    select: (payload) => payload as SkillsData | undefined,
    errorMessage: "Failed to load skills",
  });
  const data = skills.data;
  const loading = !skills.settled;

  // ── View state ─────────────────────────────────────────────────────────────
  //
  // Overrides, keyed by section-scoped category. A section that opens by
  // default records the categories someone has CLOSED; one that collapses by
  // default records the ones someone has OPENED. Either way an entry is the
  // exception, so a category that appears later (a profile switch, a fresh
  // import) takes the default like every other one.
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  // Page index per section-scoped category key.
  const [categoryPage, setCategoryPage] = useState<Record<string, number>>({});
  const [activeCollapsed, setActiveCollapsed] = useState(false);
  const [inactiveCollapsed, setInactiveCollapsed] = useState(false);

  const toggleActiveCollapsed = useCallback(() => setActiveCollapsed((v) => !v), []);
  const toggleInactiveCollapsed = useCallback(() => setInactiveCollapsed((v) => !v), []);

  const toggleCategory = useCallback(
    (stateKey: string, expandedNow: boolean) =>
      setExpandedCategories((prev) => ({ ...prev, [stateKey]: !expandedNow })),
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

  const closeSkillEditor = useCallback(() => setEditingSkill(null), []);

  // Optimistic toggle state. Key: skillName, value: the effective (pending) enabled state
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);

  const { showToast, toastElement, lastResult } = useToast();

  // Shared URL builder for skill API calls (GET and PUT)
  const skillApiUrl = (name: string) =>
    `/api/skills/${encodeURIComponent(name)}?profile=${selectedProfile}`;

  const { refetch: refetchSkills } = skills;
  const loadSkills = useCallback(async () => {
    await refetchSkills();
  }, [refetchSkills]);

  // Nothing to seed. An override is the exception, and a profile switch drops
  // whatever the previous profile's exceptions were rather than carrying
  // stale keys across.
  useEffect(() => {
    setExpandedCategories({});
    setCategoryPage({});
  }, [selectedProfile]);

  const importSkillsFromHermes = () =>
    runWrite({
      setBusy: setImporting,
      showToast,
      url: "/api/agent/profiles/sync/import",
      // Bulk: work scales with the install, not the request (T-0047).
      timeoutMs: API_FETCH_BULK_TIMEOUT_MS,
      body: { importSkills: true },
      successMessage: "Skills catalog imported from Hermes disk",
      errorMessage: "Import failed",
      onSuccess: loadSkills,
    });

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
  //
  // The pending map IS the optimistic row: every row reads its effective
  // state through it. On success the catalogue is reloaded before the pending
  // entry clears, so the row never flickers back; on failure the entry clears
  // and the row is the catalogue's again.

  const toggleSkill = useCallback(
    async (skillName: string, currentEnabled: boolean) => {
      const next = !currentEnabled;
      setToggling((prev) => ({ ...prev, [skillName]: next }));
      await runWrite({
        // The pending toggle clears whatever the answer was.
        setBusy: (busy) => {
          if (busy) return;
          setToggling((prev) => {
            const rest = { ...prev };
            delete rest[skillName];
            return rest;
          });
        },
        showToast,
        url: `/api/skills/${encodeURIComponent(skillName)}/toggle`,
        method: "PUT",
        body: { profile: selectedProfile, enabled: next },
        successMessage: next ? `${skillName} enabled` : `${skillName} disabled`,
        errorMessage: "Failed to update skill",
        onSuccess: loadSkills,
      });
    },
    [loadSkills, selectedProfile, showToast],
  );

  // One dispatch shape for every row on the page, whether it is rendered in
  // the Active section, the Inactive section or the search results. It reads
  // the skill's own effective state: a section-dependent fallback once made
  // "Enable skill" send { enabled: false } from the Inactive section.
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
    await runWrite({
      setBusy: setSavingEdit,
      showToast,
      url: skillApiUrl(editingSkill),
      method: "PUT",
      body: { content: editContent },
      successMessage: `${editingSkill} saved`,
      errorMessage: "Failed to save skill",
      onSuccess: () => {
        setEditOriginal(editContent);
        if (expandedSkill === editingSkill) {
          setSkillContent(editContent);
        }
        closeSkillEditor();
      },
    });
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
      // says "something broke" without saying why.
      setSkillContent("// Failed to load content");
      toastError(showToast, err, "Failed to load skill content");
    }
  };

  const total = data?.skills.length ?? null;
  // Distinct categories in the catalogue, by the same grouping the rows use
  // (T-0037: a private normalisation here is a second source of truth).
  const categoryCount = groupCategories(allSkills).length;
  const subtitle =
    total === null
      ? "Loading skills…"
      : `${pendingCount(total)} skill${pluralise(total)} in ${categoryCount} categor${categoryCount === 1 ? "y" : "ies"} · ${activeSkills.length} active for ${profileName}`;

  return (
    <AppPageShell
      header={
        <PageHeader
          icon={FileText}
          subtitle={subtitle}
          color="green"
          actions={<ProfilePicker value={selectedProfile} onChange={(id) => setSelectedProfile(id)} />}
        />
      }
    >
      <LastResult result={lastResult} />
      {toastElement}
      <div>
        <SkillsDenylistNote />
        {/* The read contract (T-0096, D22): a failed catalogue read is this,
            with a Retry, and never the empty state under it. */}
        {skills.error && <LoadErrorBanner error={skills.error} onRetry={() => void loadSkills()} />}
        {loading ? (
          <PageLoading label="Loading skills" rows={8} rowClassName="h-11" />
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
                ariaLabel="Search skills"
                accentColor="green"
              />
            </div>

            {searching ? (
              <SkillsSearchResults
                matches={matches}
                total={total ?? 0}
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

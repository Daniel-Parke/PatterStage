// ═══════════════════════════════════════════════════════════════
// Settings — one page (decision 7, T-0125)
//
// This was an index of an index: 32 links and zero settings, 2,814px of card
// chrome leading to 27 pages that averaged three and a half fields each.
// Changing two settings in different sections cost four navigations, and
// "what is the timeout" cost a click and a scroll to find out which card held
// it.
//
// Every section is on this page now, in its group, expanded, with its own Save
// and Reset. A sticky nav down the right names all twenty-seven and the three
// pages that are not sections (Models, Restore, System), and marks the one in
// view. The search stays, because it was the only fast path, and it narrows
// the page rather than a grid of doors. The old section URLs answer 307 to
// their anchor here (next.config.ts), so nothing bookmarked is lost.
//
// The grid is still src/lib/config/config-sections.ts rendered: every section once,
// in its group, so the count in the subtitle is the count on the page.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Settings, UserCog } from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import { SearchInput } from "@/components/ui/Input";
import PageLoading from "@/components/ui/PageLoading";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { ConfigYamlErrorAlert } from "@/components/config/ConfigYamlErrorAlert";
import SettingsNav from "@/components/config/SettingsNav";
import SettingsSection from "@/components/config/SettingsSection";
import { useProfiles } from "@/hooks/useProfiles";
import { useSelectedProfile } from "@/hooks/useSelectedProfile";
import { useSettingsEditor } from "@/hooks/useSettingsEditor";
import { CONFIG_SECTIONS, type FieldDef, type SectionDef } from "@/lib/config/config-schema";
import { SETTINGS_GROUPS, SETTINGS_TOOLS, settingsSectionIds } from "@/lib/config/config-sections";
import { sectionHeadingClasses } from "@/lib/ui/theme";

/**
 * Which agent these settings belong to.
 *
 * Settings edits one file: the config.yaml of the agent at the configured
 * home. Agents, Skills and Tools edit whichever profile is selected. Chapter 3
 * of the quests walks an operator through all four in order, and Settings was
 * the one screen that never named its subject, so an operator who had just
 * given a new profile its skills and its toolsets went on to change "its"
 * settings on a screen that had never heard of it (T-0113).
 *
 * The route cannot write another profile's file, so this does not pretend it
 * can. It names the subject, and when the profile selected elsewhere is a
 * different agent it says so and points at where that profile's own settings
 * live: the Agents screen lists a config.yaml for every profile and opens it.
 *
 * Names come from the same list the pickers read, so the two screens call the
 * same agent by the same name.
 */
function SettingsSubject({ subject }: { subject: string }) {
  const { data: profiles } = useProfiles();
  const [selected] = useSelectedProfile();

  // A slug with no row is still the honest answer: better the id than a name
  // invented for it, and better either than silence about the subject.
  const nameOf = (slug: string) => profiles?.find((p) => p.id === slug)?.name ?? slug;
  const elsewhere = selected !== subject;

  return (
    <Card padding="none" className="flex items-start gap-3 px-4 py-3">
      <UserCog className="mt-0.5 h-4 w-4 shrink-0 text-neon-orange" />
      <div className="min-w-0 text-body">
        <p className="text-ps-text-secondary">These settings belong to {nameOf(subject)}.</p>
        {elsewhere && (
          <>
            <p className="mt-1 text-semantic-warning">
              You have {nameOf(selected)} selected on Agents, Skills and Tools. Nothing on this page
              reaches it: a profile keeps its own settings in its own config.yaml.
            </p>
            <Link href="/agent/profiles" className="mt-1 inline-block text-neon-orange hover:underline">
              Open it on Agents
            </Link>
          </>
        )}
      </div>
    </Card>
  );
}

/** The fields of a section whose label, key or description carry the query. */
function matchingFields(section: SectionDef, q: string): FieldDef[] {
  return section.fields.filter((f) =>
    [f.label, f.key, f.description ?? ""].some((t) => t.toLowerCase().includes(q)),
  );
}

function sectionMatches(section: SectionDef, q: string): boolean {
  if (!q) return true;
  return (
    section.label.toLowerCase().includes(q) ||
    section.id.toLowerCase().includes(q) ||
    section.description.toLowerCase().includes(q) ||
    matchingFields(section, q).length > 0
  );
}

export default function SettingsPage() {
  const editor = useSettingsEditor();
  const { config, isLoading, error, refetch, configError, subject } = editor;
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const sectionCount = settingsSectionIds().length;

  const groups = useMemo(
    () =>
      SETTINGS_GROUPS.map((g) => ({
        label: g.label,
        description: g.description,
        sections: g.sectionIds
          .map((id) => CONFIG_SECTIONS[id])
          .filter((s): s is SectionDef => Boolean(s) && sectionMatches(s, q)),
      })).filter((g) => g.sections.length > 0),
    [q],
  );
  const visibleIds = groups.flatMap((g) => g.sections.map((s) => s.id));
  const nothing = groups.length === 0;
  const loaded = !isLoading || config !== null;

  // The section in view, for the nav. A section that is not on the page (the
  // search hid it) cannot be current.
  useEffect(() => {
    if (!loaded || typeof IntersectionObserver === "undefined") return;
    const sections = visibleIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit) setActiveId(hit.target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );
    for (const el of sections) io.observe(el);
    return () => io.disconnect();
  }, [loaded, visibleIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps -- the joined ids are the dependency; the array is rebuilt every render

  // A bookmarked section arrives as a hash, and the browser's own jump fires
  // before the sections exist. Once they do, land on it.
  useEffect(() => {
    if (!loaded) return;
    const jump = () => {
      const id = window.location.hash.slice(1);
      if (!id || !CONFIG_SECTIONS[id]) return;
      const el = document.getElementById(id);
      if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "start" });
      setActiveId(id);
    };
    jump();
    window.addEventListener("hashchange", jump);
    return () => window.removeEventListener("hashchange", jump);
  }, [loaded]);

  return (
    <AppPageShell
      header={
        <PageHeader
          icon={Settings}
          subtitle={`${sectionCount} sections of config.yaml, edited with a backup each time`}
          color="orange"
        />
      }
    >
      {/* Whose settings these are. Absent while the read is in flight: an
          unknown subject is not a claim worth making (T-0113). */}
      {subject && <SettingsSubject subject={subject} />}

      {error && (
        <LoadErrorBanner
          error={error}
          onRetry={() => void refetch()}
          hint="The sections still render; the values need the file to read."
        />
      )}
      {/* An unparseable config.yaml answers 200 with an empty object, which is
          byte-identical to a fresh install. Said here, above the sections,
          because this page is where an operator comes to fix it. */}
      {configError && (
        <ConfigYamlErrorAlert
          message={configError}
          detail="The sections below read as unconfigured because the file could not be parsed, not because it is empty. Section saves are disabled until it is repaired."
        />
      )}

      <div className="max-w-md">
        <SearchInput
          type="search"
          value={query}
          onChange={setQuery}
          ariaLabel="Search settings"
          placeholder="Find a setting by name, e.g. reasoning, timeout, voice…"
          accentColor="orange"
        />
      </div>

      {/* The nav on the RIGHT, as a table of contents usually is. On the left it
          put every section 224px inside the page's left edge, which is the
          one thing S2 says a screen may not do; here the sections start where
          the h1 does and the nav is the column that gives way. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_12rem] lg:gap-8">
        <div className="lg:order-2">
          <SettingsNav groups={groups} tools={SETTINGS_TOOLS} activeId={activeId} />
        </div>

        <div className="mt-4 space-y-8 lg:order-1 lg:mt-0">
          {!loaded ? (
            <PageLoading label="Loading settings" rows={5} rowClassName="h-40" />
          ) : nothing ? (
            <p className="text-body text-ps-text-muted">
              No setting matches <span className="font-mono text-ps-text-secondary">{query}</span>. Try a
              word from the field&apos;s own name, like reasoning, timeout or voice.
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.label} aria-labelledby={`settings-group-${group.label}`}>
                <h2 id={`settings-group-${group.label}`} className={sectionHeadingClasses}>
                  {group.label}
                </h2>
                <p className="mb-4 text-body text-ps-text-muted">{group.description}</p>
                <div className="space-y-4">
                  {group.sections.map((section) => {
                    const sectionEditor = editor.editorFor(section.id);
                    if (!sectionEditor) return null;
                    const configured =
                      !configError && section.type !== "file" && Boolean(config?.[section.id]);
                    return (
                      <SettingsSection
                        key={section.id}
                        editor={sectionEditor}
                        configured={configured}
                        hits={q ? matchingFields(section, q) : []}
                        saveBlocked={configError}
                      />
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </AppPageShell>
  );
}

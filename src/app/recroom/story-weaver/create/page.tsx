// Story Weaver — Create
//
// The setup form for a story, and since decision 6 (T-0126) the home of the
// two libraries it draws on. Characters and Themes were pages of their own:
// lists this page already read (to load a theme, to import a character) and
// already wrote (Save to Library, Save as theme), each with an editor the form
// could not reach without leaving. They are panels here now, with anchors the
// old addresses redirect to, and each row's editor is a dialog. Importing a
// character went from "From Library, then pick in a modal" to one click on
// the row.
//
// Everything still posts to /api/stories with an `action` field. The library
// reads are the read contract's: a failed list is an error with Retry inside
// its panel, never an empty shelf.
"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FolderOpen, Plus, Save, Sparkles, X } from "lucide-react";

import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import PageLoading from "@/components/ui/PageLoading";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { InlineSelect } from "@/components/ui/Select";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/Toast";
import { useApiResource } from "@/hooks/useApiResource";
import { useModelDefaults, useModels } from "@/hooks/useModels";
import { messageFromError } from "@/lib/api-fetch";
import { runWrite } from "@/lib/api-write";
import { sectionHeadingClasses } from "@/lib/theme";
import CharacterCard from "@/modules/rec-room/components/CharacterCard";
import CharacterEditorDialog, { type SheetValues } from "@/modules/rec-room/components/CharacterEditorDialog";
import CharacterLibraryPanel from "@/modules/rec-room/components/CharacterLibraryPanel";
import GenerateOverlay from "@/modules/rec-room/components/GenerateOverlay";
import { WORD_COUNT_OPTIONS } from "@/modules/rec-room/components/ReaderSettings";
import Tags from "@/modules/rec-room/components/Tags";
import ThemeEditorDialog, {
  THEME_ERAS,
  THEME_GENRES,
  THEME_MOODS,
  type ThemeValues,
} from "@/modules/rec-room/components/ThemeEditorDialog";
import ThemeLibraryPanel from "@/modules/rec-room/components/ThemeLibraryPanel";
import { STORY_TEMPLATES } from "@/modules/rec-room/types";
import type { CharacterSheet, StoryCharacter, StoryTheme } from "@/modules/rec-room/types";

const DEFAULT_SETTINGS = ["Space Station", "Medieval Castle", "Modern City", "Underwater", "Forest", "Desert", "Island", "Train"];
const DRAFT_KEY = "story-weaver-draft";
const HOME = "/recroom/story-weaver";

const EMPTY_CHARACTER: StoryCharacter = { name: "", role: "supporting", description: "" };

/** The label above a control the Field kit does not wrap (the native selects). */
const LABEL = "block text-micro font-medium uppercase tracking-wider text-ps-text-muted";

/** Auto-title an untitled story from its premise (first ~6 words) instead of the
 *  generic "Untitled Story", so the library doesn't fill with indistinguishable rows. */
function deriveTitleFromPremise(premise: string): string {
  const words = premise.trim().split(/\s+/).slice(0, 6).join(" ").replace(/[.,;:!?]+$/, "");
  if (!words) return "Untitled Story";
  return words.length > 60 ? `${words.slice(0, 60)}…` : words;
}

interface Draft {
  title: string;
  premise: string;
  genres: string[];
  era: string;
  moods: string[];
  setting: string;
  pov: string;
  length: string;
  wordCountRange: string;
  /** The registry row id of the model that writes the story; "" = agent default. */
  modelId: string;
  characters: StoryCharacter[];
  savedAt: string;
}

type ThemeEditorState = { open: false } | { open: true; theme: StoryTheme | null; initial?: Partial<ThemeValues> };
type SheetEditorState = { open: false } | { open: true; sheet: CharacterSheet | null };

export default function CreateStoryPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-ps-surface-ground p-6">
          <PageLoading label="Loading the story form" />
        </div>
      }
    >
      <CreateStoryPage />
    </Suspense>
  );
}

function CreateStoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [generating, setGenerating] = useState(false);
  const [genDone, setGenDone] = useState(false);
  const [genStoryId, setGenStoryId] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  // A failed write on this page (a delete, a save) is never swallowed: every
  // one goes through runWrite, which says the server's reason (C6, T-0143).
  const { showToast, toastElement } = useToast();

  const [title, setTitle] = useState("");
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [premise, setPremise] = useState(STORY_TEMPLATES[0].premise);
  const [genres, setGenres] = useState<string[]>([...STORY_TEMPLATES[0].genre]);
  const [era, setEra] = useState(STORY_TEMPLATES[0].era);
  const [moods, setMoods] = useState<string[]>([...STORY_TEMPLATES[0].moods]);
  const [setting, setSetting] = useState(STORY_TEMPLATES[0].setting);
  const [pov, setPov] = useState<string>(STORY_TEMPLATES[0].pov);
  const [length, setLength] = useState<string>(STORY_TEMPLATES[0].length);
  const [wordCountRange, setWordCountRange] = useState("standard");
  // Story Weaver used to write with whatever the gateway happened to default to,
  // which is also why its spend had no model dimension (T-0108, D87).
  const [modelId, setModelId] = useState("");
  const [touchedModel, setTouchedModel] = useState(false);
  const [characters, setCharacters] = useState<StoryCharacter[]>([...STORY_TEMPLATES[0].characters]);
  const [selectedTheme, setSelectedTheme] = useState("cosmic-voyager");
  const [expandedChars, setExpandedChars] = useState<Record<number, boolean>>({});
  const [savedChars, setSavedChars] = useState<Record<number, boolean>>({});
  const [genreOpts, setGenreOpts] = useState([...THEME_GENRES]);
  const [eraOpts, setEraOpts] = useState([...THEME_ERAS]);
  const [moodOpts, setMoodOpts] = useState([...THEME_MOODS]);
  const [settingOpts, setSettingOpts] = useState([...DEFAULT_SETTINGS]);
  const [hasDraft, setHasDraft] = useState(false);

  // The two libraries, each its own read so one failing does not take the
  // other's list away.
  const themesRead = useApiResource<StoryTheme[]>("/api/stories", {
    body: { action: "themes", subAction: "list" },
    select: (d) => (d as { themes?: StoryTheme[] } | null)?.themes ?? [],
    errorMessage: "Failed to load themes",
  });
  const charactersRead = useApiResource<CharacterSheet[]>("/api/stories", {
    body: { action: "characters", subAction: "list" },
    select: (d) => (d as { characters?: CharacterSheet[] } | null)?.characters ?? [],
    errorMessage: "Failed to load characters",
  });
  const savedThemes = themesRead.data ?? [];
  const savedCharacters = charactersRead.data ?? [];
  const [themeEditor, setThemeEditor] = useState<ThemeEditorState>({ open: false });
  const [sheetEditor, setSheetEditor] = useState<SheetEditorState>({ open: false });

  const { data: models } = useModels();
  const { data: modelDefaults } = useModelDefaults();

  // Preselect the agent's own default the first time it arrives, and never
  // again: an operator who chose a model keeps it.
  useEffect(() => {
    if (touchedModel) return;
    if (modelDefaults?.agent) setModelId(modelDefaults.agent);
  }, [modelDefaults, touchedModel]);

  // Theme: sets only premise + tags (NOT characters, NOT params).
  const applyTheme = useCallback((theme: StoryTheme) => {
    setPremise(theme.premise);
    if (theme.genre?.length) setGenres([...theme.genre]);
    if (theme.era) setEra(theme.era);
    if (theme.setting) setSetting(theme.setting);
    if (theme.mood?.length) setMoods([...theme.mood]);
    setSelectedTheme(theme.id);
  }, []);

  // A theme named in the URL is applied on arrival. The Themes page's "Use"
  // used to send people here this way; a bookmark still can.
  const appliedUrlTheme = useRef<string | null>(null);
  useEffect(() => {
    const themeId = searchParams.get("theme");
    if (!themeId || appliedUrlTheme.current === themeId) return;
    setSelectedTheme(themeId);
    const theme = themesRead.data?.find((t) => t.id === themeId);
    if (!theme) return;
    appliedUrlTheme.current = themeId;
    applyTheme(theme);
  }, [searchParams, themesRead.data, applyTheme]);

  useEffect(() => {
    setHasDraft(!!localStorage.getItem(DRAFT_KEY));
  }, []);

  // The two retired pages redirect to #themes and #characters. The browser's
  // own jump to a fragment happens before this client page has rendered its
  // sections, so it lands on nothing; once both libraries are on the page the
  // anchor is honoured by hand (the same fix Settings needed in T-0125).
  useEffect(() => {
    if (!themesRead.settled || !charactersRead.settled) return;
    const id = window.location.hash.replace(/^#/, "");
    if (id !== "themes" && id !== "characters") return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [themesRead.settled, charactersRead.settled]);

  // Auto-save draft
  useEffect(() => {
    if (generating) return;
    const draft: Draft = { title, premise, genres, era, moods, setting, pov, length, wordCountRange, modelId, characters, savedAt: new Date().toISOString() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [title, premise, genres, era, moods, setting, pov, length, wordCountRange, modelId, characters, generating]);

  const loadDraft = () => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const d: Draft = JSON.parse(raw);
      setTitle(d.title);
      setTitleManuallyEdited(!!d.title);
      setPremise(d.premise);
      setGenres(d.genres);
      setEra(d.era);
      setMoods(d.moods);
      setSetting(d.setting);
      setPov(d.pov);
      setLength(d.length);
      setWordCountRange(d.wordCountRange || "standard");
      if (d.modelId) {
        setModelId(d.modelId);
        setTouchedModel(true);
      }
      setCharacters(d.characters);
      setSelectedTheme("");
      setHasDraft(false);
    } catch {}
  };

  // Template: sets everything (theme + characters + params)
  const applyTemplate = (id: string) => {
    setSelectedTheme(id);
    const t = STORY_TEMPLATES.find((tmpl) => tmpl.id === id);
    if (!t) return;
    setPremise(t.premise);
    setGenres([...t.genre]);
    setEra(t.era);
    setMoods([...t.moods]);
    setSetting(t.setting);
    setPov(t.pov);
    setLength(t.length);
    setCharacters(t.characters.map((c) => ({ ...c })));
    setWordCountRange("standard");
    setExpandedChars({});
    if (!titleManuallyEdited) setTitle(t.name);
  };

  const inCast = (cs: CharacterSheet) => characters.some((c) => c.name === cs.name);

  /** One click on a library row. A sheet is a template, not a link: its text is copied. */
  const addFromLibrary = (cs: CharacterSheet) => {
    if (inCast(cs)) return;
    const newChar: StoryCharacter & Record<string, unknown> = {
      name: cs.name,
      role: (cs.role as StoryCharacter["role"]) || "supporting",
      description: cs.description || cs.backstory?.slice(0, 100) || "",
      personality: (cs.personality as string[])?.join(", ") || "",
      appearance: cs.appearance || "",
      backstory: cs.backstory || "",
      speechPatterns: cs.speechPatterns || "",
      relationships: cs.relationships || "",
    };
    setCharacters((prev) => [...prev, newChar as StoryCharacter]);
  };

  const updateCharacter = (idx: number, field: string, value: string) => {
    setCharacters((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        return { ...(c as unknown as Record<string, unknown>), [field]: value } as unknown as StoryCharacter;
      }),
    );
  };

  const removeCharacter = (idx: number) => {
    setCharacters((prev) => prev.filter((_, i) => i !== idx));
    setExpandedChars((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  // Save to Library on a cast card. Always a NEW sheet: this card is a copy.
  const saveCharacter = async (char: StoryCharacter) => {
    if (!char.name.trim() || !char.description.trim()) return;
    // The gate used to read `d.data.id`; the handler answers `{data:{character}}`,
    // so the save always worked and nothing on screen ever said so (T-0108, D94).
    await runWrite({
      showToast,
      url: "/api/stories",
      body: {
        action: "characters",
        subAction: "create",
        name: char.name,
        role: char.role,
        description: char.description,
        personality: char.personality ? [char.personality] : [],
        appearance: char.appearance || "",
        backstory: char.backstory || "",
        speechPatterns: char.speechPatterns || "",
        relationships: char.relationships || "",
        tags: [],
      },
      successMessage: `${char.name} saved to the library`,
      errorMessage: "Could not save that character",
      onSuccess: async () => {
        const idx = characters.indexOf(char);
        setSavedChars((prev) => ({ ...prev, [idx]: true }));
        setTimeout(
          () =>
            setSavedChars((prev) => {
              const n = { ...prev };
              delete n[idx];
              return n;
            }),
          2000,
        );
        await charactersRead.refetch();
      },
    });
  };

  const toggleCharExpand = (idx: number) => {
    setExpandedChars((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // ── the theme library ──────────────────────────────────────────

  /** Save as theme: the editor, opened on what the form holds now. */
  const saveFormAsTheme = () =>
    setThemeEditor({
      open: true,
      theme: null,
      initial: {
        premise,
        genre: genres,
        era,
        setting,
        mood: moods,
        notes: `Characters: ${characters.map((c) => c.name).filter(Boolean).join(", ")}`,
      },
    });

  /**
   * A library save, from either editor. The dialog shows the reason inline and
   * stays open on a failure, so the write answers the reason as well as
   * saying it: a 200 without the row the handler promises (`{data:{theme}}`,
   * `{data:{character}}`, D94) is a failure too, or the save would close a
   * dialog over nothing saved.
   */
  const saveToLibrary = async (
    body: Record<string, unknown>,
    fallback: string,
    saved: string,
    onSaved: () => Promise<void>,
  ): Promise<string | null> => {
    let problem: string | null = null;
    await runWrite<{ data?: unknown }>({
      showToast,
      url: "/api/stories",
      body,
      successMessage: (res) => (res?.data ? saved : { message: fallback, type: "error" }),
      errorMessage: fallback,
      onError: (err) => {
        problem = messageFromError(err, fallback);
      },
      onSuccess: async (res) => {
        if (!res?.data) {
          problem = fallback;
          return;
        }
        await onSaved();
      },
    });
    return problem;
  };

  const saveTheme = (values: ThemeValues, id?: string): Promise<string | null> => {
    const body: Record<string, unknown> = { action: "themes", subAction: id ? "update" : "create", ...values };
    if (id) body.themeId = id;
    return saveToLibrary(body, "Could not save that theme", id ? "Theme updated" : "Theme saved", async () => {
      await themesRead.refetch();
      setThemeEditor({ open: false });
    });
  };

  const deleteTheme = async (id: string) => {
    // The field is `themeId`; this posted `promptId`, the handler 400d, and the
    // catch swallowed it while the row was filtered off the screen anyway, so a
    // theme that was still in the database looked deleted (T-0108, D89). The
    // re-read runs on success only.
    await runWrite({
      showToast,
      url: "/api/stories",
      body: { action: "themes", subAction: "delete", themeId: id },
      successMessage: "Theme deleted",
      errorMessage: "Could not delete that theme",
      onSuccess: () => {
        void themesRead.refetch();
        if (selectedTheme === id) setSelectedTheme("");
      },
    });
  };

  // ── the character library ──────────────────────────────────────

  const saveSheet = (values: SheetValues, id?: string): Promise<string | null> => {
    const body: Record<string, unknown> = { action: "characters", subAction: id ? "update" : "create", ...values };
    if (id) body.charId = id;
    return saveToLibrary(body, "Could not save that character", id ? "Character updated" : "Character saved", async () => {
      await charactersRead.refetch();
      setSheetEditor({ open: false });
    });
  };

  const deleteSheet = async (id: string) => {
    await runWrite({
      showToast,
      url: "/api/stories",
      body: { action: "characters", subAction: "delete", charId: id },
      successMessage: "Character deleted",
      errorMessage: "Could not delete that character",
      onSuccess: () => {
        void charactersRead.refetch();
      },
    });
  };

  // ── the form ───────────────────────────────────────────────────

  const clearAllInputs = () => {
    setSelectedTheme("");
    setTitle("");
    setTitleManuallyEdited(false);
    setPremise("");
    setGenres([]);
    setEra("");
    setMoods([]);
    setSetting("");
    setCharacters([]);
    setPov("first");
    setLength("medium");
    setWordCountRange("standard");
    setExpandedChars({});
  };

  const toggle = (list: string[], set: (v: string[]) => void, tag: string) =>
    set(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);

  const addOpt = (opts: string[], set: (v: string[]) => void, tag: string) => {
    if (!opts.includes(tag)) set([...opts, tag]);
  };

  const handleCreate = useCallback(async () => {
    if (!premise.trim()) return;
    setGenerating(true);
    setGenDone(false);
    setGenStoryId(null);
    setGenError(null);

    const finalTitle = title.trim() || deriveTitleFromPremise(premise);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: finalTitle,
          config: { title: finalTitle, premise, genre: genres.join(", "), era, setting, mood: moods, pov, length, characters, wordCountRange, modelId: modelId || undefined },
        }),
      });
      const d = await res.json().catch(() => null);
      // Surface EVERY failure mode so "Begin Writing" can never silently do
      // nothing: an HTTP error, an error payload, or a success shape missing
      // the new story id all now raise a visible error instead of navigating
      // to /story-weaver/undefined.
      if (!res.ok || !d || d.error) {
        throw new Error((d && d.error) || `Story creation failed (HTTP ${res.status})`);
      }
      const newId = d.data?.id;
      if (!newId) throw new Error("Story was created but no id was returned");

      localStorage.removeItem(DRAFT_KEY);
      setHasDraft(false);
      setGenStoryId(newId);
      setGenDone(true);
    } catch (err) {
      setGenerating(false);
      setGenError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [title, premise, genres, era, setting, moods, pov, length, characters, wordCountRange, modelId]);

  const handleGenComplete = useCallback(() => {
    if (genStoryId) router.push(`${HOME}/${genStoryId}`);
  }, [genStoryId, router]);

  return (
    <AppPageShell
      density="prose"
      variant="scanlines"
      header={
        <PageHeader
          icon={Sparkles}
          color="purple"
          backHref={HOME}
          backLabel="STORY WEAVER"
          actions={
            hasDraft ? (
              <Button variant="ghost" size="sm" color="orange" icon={FolderOpen} onClick={loadDraft}>
                Load draft
              </Button>
            ) : undefined
          }
        />
      }
    >
      <GenerateOverlay title={title || "Your Story"} visible={generating} done={genDone} onComplete={handleGenComplete} />

      {themeEditor.open && (
        <ThemeEditorDialog
          theme={themeEditor.theme}
          initial={themeEditor.initial}
          onClose={() => setThemeEditor({ open: false })}
          onSave={saveTheme}
        />
      )}
      {sheetEditor.open && (
        <CharacterEditorDialog character={sheetEditor.sheet} onClose={() => setSheetEditor({ open: false })} onSave={saveSheet} />
      )}

      <div className="space-y-6">
        {genError && (
          <LoadErrorBanner
            error={`Story generation failed: ${genError}. Your configuration has been saved, so you can retry without re-entering everything.`}
          />
        )}
        {/* ═══ Quick start ═══ */}
        <Card as="section" padding="lg" className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className={`${sectionHeadingClasses} flex-1`}>Quick start</h2>
            <Button variant="ghost" size="sm" icon={X} onClick={clearAllInputs}>
              Clear all inputs
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {STORY_TEMPLATES.map((t) => (
              <Button
                key={t.id}
                variant={selectedTheme === t.id ? "primary" : "secondary"}
                color="purple"
                aria-pressed={selectedTheme === t.id}
                title={t.genre.join(", ")}
                onClick={() => applyTemplate(t.id)}
              >
                {t.name}
              </Button>
            ))}
          </div>
        </Card>

        {/* ═══ Title ═══ */}
        <Card as="section" padding="lg">
          <Field label="Story title" hint="Leave it empty and the first few words of the premise become the name.">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleManuallyEdited(true);
              }}
              placeholder="Give your story a name..."
              // The house register, not the reader's serif: a field is
              // operated, not read, and the serif on this one field alone
              // read as a different product (the review of 2026-09-08, P4).
              className="text-lead font-semibold"
            />
          </Field>
        </Card>

        {/* ═══ Theme: premise + tags ═══ */}
        <Card as="section" padding="lg" className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className={`${sectionHeadingClasses} flex-1`}>Theme</h2>
            <Button variant="ghost" size="sm" color="green" icon={Save} onClick={saveFormAsTheme} disabled={!premise.trim()}>
              Save as theme
            </Button>
          </div>
          <Field label="Premise" hint="What the story is about. This is the field the plan is built from.">
            <Textarea value={premise} onChange={(e) => setPremise(e.target.value)} rows={4} placeholder="Describe your story concept..." />
          </Field>
          <div className="space-y-3">
            <Tags label="Genre" options={genreOpts} selected={genres} onToggle={(t) => toggle(genres, setGenres, t)} onAdd={(t) => addOpt(genreOpts, setGenreOpts, t)} />
            <Tags label="Era" options={eraOpts} selected={[era]} onToggle={(t) => setEra(t === era ? "" : t)} onAdd={(t) => addOpt(eraOpts, setEraOpts, t)} />
            <Tags label="Mood" options={moodOpts} selected={moods} onToggle={(t) => toggle(moods, setMoods, t)} onAdd={(t) => addOpt(moodOpts, setMoodOpts, t)} />
            <Tags label="Setting" options={settingOpts} selected={[setting]} onToggle={(t) => setSetting(t === setting ? "" : t)} onAdd={(t) => addOpt(settingOpts, setSettingOpts, t)} />
          </div>
        </Card>

        <ThemeLibraryPanel
          themes={savedThemes}
          loading={!themesRead.settled}
          error={themesRead.error}
          selectedId={selectedTheme}
          onRetry={() => void themesRead.refetch()}
          onUse={applyTheme}
          onEdit={(theme) => setThemeEditor({ open: true, theme })}
          onDelete={deleteTheme}
          onNew={() => setThemeEditor({ open: true, theme: null })}
        />

        {/* ═══ The cast ═══ */}
        <Card as="section" data-testid="story-cast" padding="lg" className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h2 className={`${sectionHeadingClasses} flex-1`}>Characters ({characters.length})</h2>
            <Button size="sm" color="purple" icon={Plus} onClick={() => setCharacters((prev) => [...prev, { ...EMPTY_CHARACTER }])}>
              Add character
            </Button>
          </div>
          {characters.length === 0 ? (
            <p className="py-4 text-center text-body text-ps-text-faint">
              No characters yet. Add one here, or add one from the library below.
            </p>
          ) : (
            <div className="space-y-2">
              {characters.map((char, i) => (
                <CharacterCard
                  key={i}
                  char={char}
                  index={i}
                  onUpdate={updateCharacter}
                  onRemove={removeCharacter}
                  onSave={saveCharacter}
                  saved={!!savedChars[i]}
                  expanded={!!expandedChars[i]}
                  onToggle={toggleCharExpand}
                />
              ))}
            </div>
          )}
        </Card>

        <CharacterLibraryPanel
          characters={savedCharacters}
          loading={!charactersRead.settled}
          error={charactersRead.error}
          inCast={inCast}
          onRetry={() => void charactersRead.refetch()}
          onAdd={addFromLibrary}
          onEdit={(sheet) => setSheetEditor({ open: true, sheet })}
          onDelete={deleteSheet}
          onNew={() => setSheetEditor({ open: true, sheet: null })}
        />

        {/* ═══ Story parameters ═══ */}
        <Card as="section" padding="lg" className="space-y-4">
          <h2 className={sectionHeadingClasses}>Story parameters</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <span className={LABEL}>Point of view</span>
              <InlineSelect
                ariaLabel="Point of view"
                accentColor="purple"
                value={pov}
                onChange={setPov}
                options={[
                  { value: "first", label: "First Person" },
                  { value: "third-limited", label: "Third Person Limited" },
                  { value: "third-omniscient", label: "Third Person Omniscient" },
                ]}
              />
            </div>
            <div className="space-y-1">
              <span className={LABEL}>Length</span>
              <InlineSelect
                ariaLabel="Length"
                accentColor="purple"
                value={length}
                onChange={setLength}
                options={[
                  { value: "short", label: "Short (3-4 chapters)" },
                  { value: "medium", label: "Medium (5-7 chapters)" },
                  { value: "long", label: "Long (8-12 chapters)" },
                ]}
              />
            </div>
          </div>
          <div className="space-y-1">
            <span className={LABEL}>Writing model</span>
            <InlineSelect
              ariaLabel="Writing model"
              accentColor="purple"
              value={modelId}
              onChange={(v) => {
                setTouchedModel(true);
                setModelId(v);
              }}
              options={[
                { value: "", label: "Agent default model" },
                ...(models ?? []).map((m) => ({ value: m.id, label: `${m.name} · ${m.provider}` })),
              ]}
            />
          </div>
          <div className="space-y-1">
            <span className={LABEL}>Chapter length (words per chapter)</span>
            <SegmentedControl
              label="Chapter length"
              options={WORD_COUNT_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
              value={wordCountRange}
              onChange={setWordCountRange}
              className="flex-wrap"
            />
          </div>
        </Card>

        {/* What this button spends, said before it is pressed.
            Story Weaver used to disclose nothing at all, so the first a person
            heard of the cost was their provider bill. One quiet line, no modal
            and nothing to dismiss: the point is not to frighten anyone off, it
            is that the bill is not a surprise. */}
        <p data-testid="story-spend-before" className="text-body leading-relaxed text-ps-text-faint">
          Writing a story calls a paid model, so it costs money. What it has spent so far is shown while you read it, and in Insights alongside everything else.
        </p>

        <Button
          variant="primary"
          color="purple"
          size="lg"
          icon={Sparkles}
          className="w-full"
          onClick={handleCreate}
          disabled={!premise.trim() || generating}
        >
          Begin Writing
        </Button>
      </div>
      {toastElement}
    </AppPageShell>
  );
}

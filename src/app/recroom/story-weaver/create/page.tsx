// Story Weaver — Create Story V3 (creative workshop: themes, characters, story details)
"use client";
import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Plus, X, Save, FolderOpen, Users, Trash2 } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { STORY_TEMPLATES } from "@/modules/rec-room/types";
import type { StoryCharacter, CharacterSheet, StoryTheme } from "@/modules/rec-room/types";
import GenerateOverlay from "@/modules/rec-room/components/GenerateOverlay";
import { WORD_COUNT_OPTIONS } from "@/modules/rec-room/components/ReaderSettings";
import Tags from "@/modules/rec-room/components/Tags";
import CharacterCard from "@/modules/rec-room/components/CharacterCard";
import LoadErrorBanner from "@/components/ui/LoadErrorBanner";
import { safeApiCall } from "@/lib/api-fetch";
import { useModels, useModelDefaults } from "@/hooks/useModels";

const DEFAULT_GENRES = ["Sci-Fi", "Mystery", "Fantasy", "Romance", "Crime", "Horror", "Adventure", "Historical"];
const DEFAULT_ERAS = ["Ancient", "Medieval", "Modern", "Near Future", "Far Future", "Timeless"];
const DEFAULT_MOODS = ["Tense", "Wonder", "Humorous", "Dark", "Hopeful", "Melancholy", "Suspenseful", "Whimsical"];
const DEFAULT_SETTINGS = ["Space Station", "Medieval Castle", "Modern City", "Underwater", "Forest", "Desert", "Island", "Train"];
const DRAFT_KEY = "story-weaver-draft";

const EMPTY_CHARACTER: StoryCharacter = { name: "", role: "supporting", description: "" };

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

export default function CreateStoryPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-dark-950 flex items-center justify-center"><Sparkles className="w-8 h-8 text-neon-purple animate-spin" /></div>}>
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
  /** A failed write on this page (theme delete, save to library), never swallowed. */
  const [writeError, setWriteError] = useState<string | null>(null);

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
  const [genreOpts, setGenreOpts] = useState([...DEFAULT_GENRES]);
  const [eraOpts, setEraOpts] = useState([...DEFAULT_ERAS]);
  const [moodOpts, setMoodOpts] = useState([...DEFAULT_MOODS]);
  const [settingOpts, setSettingOpts] = useState([...DEFAULT_SETTINGS]);

  // Saved data
  const [savedCharacters, setSavedCharacters] = useState<CharacterSheet[]>([]);
  const [savedThemes, setSavedThemes] = useState<StoryTheme[]>([]);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  const { data: models } = useModels();
  const { data: modelDefaults } = useModelDefaults();

  // Preselect the agent's own default the first time it arrives, and never
  // again: an operator who chose a model keeps it.
  useEffect(() => {
    if (touchedModel) return;
    if (modelDefaults?.agent) setModelId(modelDefaults.agent);
  }, [modelDefaults, touchedModel]);

  // Save as theme
  const [showSaveTheme, setShowSaveTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");

  // Both pickers are dialogs on the shared contract (T-0096, D116).
  const closeCharPicker = useCallback(() => setShowCharPicker(false), []);
  const closeSaveTheme = useCallback(() => setShowSaveTheme(false), []);
  const charPickerRef = useDialogA11y({ open: showCharPicker, onClose: closeCharPicker });
  const saveThemeRef = useDialogA11y({ open: showSaveTheme, onClose: closeSaveTheme });

  // Theme: sets only premise + tags (NOT characters, NOT params).
  // Defined at component level (not inside useEffect) so useCallback can
  // be stable and satisfy React Compiler immutability requirements.
  const applyTheme = useCallback((theme: StoryTheme) => {
    setPremise(theme.premise);
    if (theme.genre?.length) setGenres([...theme.genre]);
    if (theme.era) setEra(theme.era);
    if (theme.setting) setSetting(theme.setting);
    if (theme.mood?.length) setMoods([...theme.mood]);
    setSelectedTheme(theme.id);
  }, [setPremise, setGenres, setEra, setSetting, setMoods, setSelectedTheme]);

  // Restore selected theme from URL search params on page load
  useEffect(() => {
    const themeId = searchParams.get("theme");
    if (themeId) {
      setSelectedTheme(themeId);
      fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "themes", subAction: "list" }),
      }).then(r => r.json()).then(d => {
        const theme = d.data?.themes?.find((t: StoryTheme) => t.id === themeId);
        if (theme) applyTheme(theme);
      }).catch(() => {});
    }
  }, [searchParams, applyTheme]);

  // Load saved data on mount
  useEffect(() => {
    setHasDraft(!!localStorage.getItem(DRAFT_KEY));
    fetch("/api/stories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "characters", subAction: "list" }),
    }).then(r => r.json()).then(d => {
      if (d.data?.characters) setSavedCharacters(d.data.characters);
    }).catch(() => {});
    fetch("/api/stories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "themes", subAction: "list" }),
    }).then(r => r.json()).then(d => {
      if (d.data?.themes) setSavedThemes(d.data.themes);
    }).catch(() => {});
  }, []);

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
      setTitle(d.title); setTitleManuallyEdited(!!d.title);
      setPremise(d.premise); setGenres(d.genres);
      setEra(d.era); setMoods(d.moods);
      setSetting(d.setting); setPov(d.pov);
      setLength(d.length); setWordCountRange(d.wordCountRange || "standard");
    if (d.modelId) { setModelId(d.modelId); setTouchedModel(true); }
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
    setPremise(t.premise); setGenres([...t.genre]); setEra(t.era); setMoods([...t.moods]);
    setSetting(t.setting); setPov(t.pov); setLength(t.length);
    setCharacters(t.characters.map(c => ({ ...c })));
    setWordCountRange("standard");
    setExpandedChars({});
    if (!titleManuallyEdited) setTitle(t.name);
  };

  const importCharacter = (cs: CharacterSheet) => {
    if (characters.some(c => c.name === cs.name)) return;
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
    setCharacters(prev => [...prev, newChar as StoryCharacter]);
    setShowCharPicker(false);
  };

  const updateCharacter = (idx: number, field: string, value: string) => {
    setCharacters(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      return { ...(c as unknown as Record<string, unknown>), [field]: value } as unknown as StoryCharacter;
    }));
  };

  const removeCharacter = (idx: number) => {
    setCharacters(prev => prev.filter((_, i) => i !== idx));
    setExpandedChars(prev => { const next = { ...prev }; delete next[idx]; return next; });
  };

  const saveCharacter = async (char: StoryCharacter) => {
    if (!char.name.trim() || !char.description.trim()) return;
    // The gate used to read `d.data.id`; the handler answers `{data:{character}}`,
    // so the save always worked and nothing on screen ever said so (T-0108, D94).
    const res = await safeApiCall("/api/stories", {
      method: "POST",
      body: {
        action: "characters", subAction: "create",
        name: char.name, role: char.role, description: char.description,
        personality: char.personality ? [char.personality] : [],
        appearance: char.appearance || "",
        backstory: char.backstory || "",
        speechPatterns: char.speechPatterns || "",
        relationships: char.relationships || "",
        tags: [],
      },
    });
    if (!res.ok) { setWriteError(res.error ?? "Could not save that character"); return; }
    setWriteError(null);
    const idx = characters.indexOf(char);
    setSavedChars(prev => ({ ...prev, [idx]: true }));
    setTimeout(() => setSavedChars(prev => { const n = { ...prev }; delete n[idx]; return n; }), 2000);
    const list = await safeApiCall<{ data?: { characters?: CharacterSheet[] } }>("/api/stories", {
      method: "POST",
      body: { action: "characters", subAction: "list" },
    });
    if (list.ok && list.data?.data?.characters) setSavedCharacters(list.data.data.characters);
  };

  const toggleCharExpand = (idx: number) => {
    setExpandedChars(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const saveAsTheme = async () => {
    if (!newThemeName.trim() || !premise.trim()) return;
    // Same gate, same defect: the handler answers `{data:{theme}}` (D94).
    const res = await safeApiCall("/api/stories", {
      method: "POST",
      body: {
        action: "themes", subAction: "create",
        name: newThemeName.trim(), premise, genre: genres, era, setting, mood: moods,
        notes: `Characters: ${characters.map(c => c.name).filter(Boolean).join(", ")}`,
      },
    });
    if (!res.ok) { setWriteError(res.error ?? "Could not save that theme"); return; }
    setWriteError(null);
    const list = await safeApiCall<{ data?: { themes?: StoryTheme[] } }>("/api/stories", {
      method: "POST",
      body: { action: "themes", subAction: "list" },
    });
    if (list.ok && list.data?.data?.themes) setSavedThemes(list.data.data.themes);
    setShowSaveTheme(false);
    setNewThemeName("");
  };

  const deleteTheme = async (id: string) => {
    // The field is `themeId`; this posted `promptId`, the handler 400d, and the
    // catch swallowed it while the row was filtered off the screen anyway, so a
    // theme that was still in the database looked deleted (T-0108, D89). The
    // optimistic filter now runs on success only.
    const res = await safeApiCall("/api/stories", {
      method: "POST",
      body: { action: "themes", subAction: "delete", themeId: id },
    });
    if (!res.ok) { setWriteError(res.error ?? "Could not delete that theme"); return; }
    setWriteError(null);
    setSavedThemes(prev => prev.filter(t => t.id !== id));
    if (selectedTheme === id) setSelectedTheme("");
  };

  const clearAllInputs = () => {
    setSelectedTheme(""); setTitle(""); setTitleManuallyEdited(false);
    setPremise(""); setGenres([]); setEra(""); setMoods([]); setSetting("");
    setCharacters([]); setPov("first"); setLength("medium");
    setWordCountRange("standard"); setExpandedChars({});
  };

  const toggle = (list: string[], set: (v: string[]) => void, tag: string) =>
    set(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);

  const addOpt = (opts: string[], set: (v: string[]) => void, tag: string) =>
    { if (!opts.includes(tag)) set([...opts, tag]); };

  const handleCreate = useCallback(async () => {
    if (!premise.trim()) return;
    setGenerating(true);
    setGenDone(false);
    setGenStoryId(null);
    setGenError(null);

    const finalTitle = title.trim() || deriveTitleFromPremise(premise);
    try {
      const res = await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
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
    if (genStoryId) router.push("/recroom/story-weaver/" + genStoryId);
  }, [genStoryId, router]);

  return (
    <AppPageShell variant="scanlines">
      <GenerateOverlay title={title || "Your Story"} visible={generating} done={genDone} onComplete={handleGenComplete} />

      {/* Error banner */}
      {genError && (
        <div className="sticky top-0 z-50 bg-red-500/10 border-b border-red-500/20 px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-red-300 font-semibold">Story generation failed</p>
            <p className="text-xs text-red-300/60">{genError}</p>
            <p className="text-xs text-red-300/40 mt-1">Your configuration has been saved. You can retry without re-entering everything.</p>
          </div>
          <button onClick={() => setGenError(null)} aria-label="Dismiss this error" className="text-red-400/50 hover:text-red-400"><X className="w-4 h-4" /></button>
        </div>
      )}

      {writeError && <LoadErrorBanner error={writeError} className="mx-4 mt-4" />}

      {/* Character Picker Modal */}
      {showCharPicker && (
        <div className="fixed inset-0 z-[60] bg-dark-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeCharPicker} role="presentation">
          <div
            ref={charPickerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="char-picker-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="bg-dark-900 border border-neon-purple/20 rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 id="char-picker-title" className="text-sm font-semibold text-white">Import character</h3>
              <button type="button" onClick={closeCharPicker} aria-label="Close the character picker" className="text-ps-text-muted hover:text-ps-text-secondary"><X className="w-4 h-4" /></button>
            </div>
            {savedCharacters.length === 0 ? (
              <p className="text-xs text-ps-text-muted">No saved characters. Create some in the Characters page first.</p>
            ) : (
              <div className="space-y-2">
                {savedCharacters.map(cs => (
                  <button key={cs.id} onClick={() => importCharacter(cs)}
                    disabled={characters.some(c => c.name === cs.name)}
                    className="w-full text-left p-3 rounded-lg border border-white/5 hover:border-neon-purple/20 bg-white/[0.02] hover:bg-neon-purple/5 transition-all disabled:opacity-30">
                    <div className="text-xs font-semibold text-ps-text-primary">{cs.name}</div>
                    <div className="text-xs text-ps-text-muted font-mono">{cs.role} — {cs.description?.slice(0, 80)}</div>
                    {cs.personality?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {cs.personality.slice(0, 3).map(p => <span key={p} className="px-1.5 py-0.5 rounded text-xs font-mono border border-white/5 bg-white/[0.02] text-ps-text-faint">{p}</span>)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save as Theme Modal */}
      {showSaveTheme && (
        <div className="fixed inset-0 z-[60] bg-dark-950/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={closeSaveTheme} role="presentation">
          <div
            ref={saveThemeRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-theme-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="bg-dark-900 border border-green-500/20 rounded-xl w-full max-w-md p-6 space-y-4"
          >
            <h3 id="save-theme-title" className="text-sm font-semibold text-white">Save as theme</h3>
            <p className="text-xs text-ps-text-muted">Save your current story concept as a reusable theme.</p>
            <input value={newThemeName} onChange={(e) => setNewThemeName(e.target.value)}
              placeholder="e.g. Salt and starlight" aria-label="Theme name" autoFocus
              className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-green-500/40 font-mono" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={closeSaveTheme} className="px-4 py-2 text-xs text-ps-text-muted hover:text-ps-text-secondary rounded-lg border border-white/10">Cancel</button>
              <button type="button" onClick={saveAsTheme} disabled={!newThemeName.trim() || !premise.trim()}
                className="px-4 py-2 text-xs text-green-400 rounded-lg border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 disabled:opacity-30 flex items-center gap-2">
                <Save className="w-3 h-3" /> Save theme
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        icon={Sparkles}
        color="purple"
        backHref="/recroom/story-weaver"
        backLabel="STORY WEAVER"
        actions={
          hasDraft ? (
            <button
              type="button"
              onClick={loadDraft}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/20 text-xs font-mono text-orange-400 hover:bg-orange-500/10"
            >
              <FolderOpen className="w-3 h-3" /> Load Draft
            </button>
          ) : undefined
        }
      />

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6 flex-1 w-full">

        {/* ═══ SECTION A: Templates + Clear ═══ */}
        <div className="rounded-xl border border-neon-purple/15 bg-dark-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-mono text-ps-text-muted uppercase tracking-widest">Quick Start — Templates</label>
            <button onClick={clearAllInputs}
              className="flex items-center gap-1 text-xs font-mono text-red-400 hover:text-red-300">
              <X className="w-3 h-3" /> Clear all inputs
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {STORY_TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => applyTemplate(t.id)}
                className={`text-left p-3 rounded-lg border transition-all ${
                  selectedTheme === t.id ? "border-neon-purple/40 bg-neon-purple/10" : "border-white/5 bg-white/[0.02] hover:border-white/15"
                }`}>
                <div className="text-xs font-semibold text-ps-text-primary mb-0.5">{t.name}</div>
                <div className="text-xs font-mono text-ps-text-muted">{t.genre.join(", ")}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ═══ SECTION B: Title ═══ */}
        <div className="rounded-xl border border-neon-purple/20 bg-dark-900/50 p-5">
          <label className="text-xs font-mono text-ps-text-muted uppercase tracking-widest block mb-2">Story Title</label>
          <input value={title} onChange={(e) => { setTitle(e.target.value); setTitleManuallyEdited(true); }} placeholder="Give your story a name..." aria-label="Story title"
            className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-4 py-3 text-lg text-white placeholder-white/20 outline-none focus:border-neon-purple/30 font-serif font-semibold" />
        </div>

        {/* ═══ SECTION C: Theme (Premise + Tags + Saved Themes) ═══ */}
        <div className="rounded-xl border border-white/8 bg-dark-900/50 p-5 mt-2">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-mono text-ps-text-muted uppercase tracking-widest">Theme</label>
            <button onClick={() => setShowSaveTheme(true)} disabled={!premise.trim()}
              className="flex items-center gap-1 text-xs font-mono text-green-400 hover:text-green-300 disabled:opacity-30">
              <Save className="w-3 h-3" /> Save as Theme
            </button>
          </div>
          <label className="text-xs font-mono text-ps-text-faint uppercase tracking-wider block mb-2">What&apos;s your story about?</label>
          <textarea value={premise} onChange={(e) => setPremise(e.target.value)} rows={4}
            className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-green-500/30 font-mono resize-none leading-relaxed mb-4" placeholder="Describe your story concept..." aria-label="Premise" />
          <div className="space-y-3">
            <Tags label="Genre" options={genreOpts} selected={genres} onToggle={(t) => toggle(genres, setGenres, t)} onAdd={(t) => addOpt(genreOpts, setGenreOpts, t)} />
            <Tags label="Era" options={eraOpts} selected={[era]} onToggle={(t) => setEra(t === era ? "" : t)} onAdd={(t) => addOpt(eraOpts, setEraOpts, t)} />
            <Tags label="Mood" options={moodOpts} selected={moods} onToggle={(t) => toggle(moods, setMoods, t)} onAdd={(t) => addOpt(moodOpts, setMoodOpts, t)} />
            <Tags label="Setting" options={settingOpts} selected={[setting]} onToggle={(t) => setSetting(t === setting ? "" : t)} onAdd={(t) => addOpt(settingOpts, setSettingOpts, t)} />
          </div>
          {/* Saved themes — prominent at top of Theme section */}
          {savedThemes.length > 0 && (
            <div className="mb-4 pb-4 border-b border-white/5">
              <label className="text-xs font-mono text-ps-text-faint uppercase tracking-wider block mb-2">Saved Themes — click to load</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {savedThemes.map((t) => (
                  <div key={t.id} className={`relative group p-3 rounded-lg border transition-all cursor-pointer ${
                    selectedTheme === t.id ? "border-white/15 bg-white/[0.04]" : "border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                  }`} onClick={() => applyTheme(t)}>
                    <div className="text-xs font-semibold text-ps-text-secondary mb-0.5">{t.name}</div>
                    <div className="text-xs font-mono text-ps-text-faint truncate">{t.genre?.join(", ") || "Custom"} — {t.era || "Any era"}</div>
                    <button onClick={(e) => { e.stopPropagation(); deleteTheme(t.id); }} aria-label={`Delete theme ${t.name}`}
                      className="absolute top-1.5 right-1.5 p-1.5 text-ps-text-faint hover:text-red-400 transition-opacity">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ SECTION D: Characters ═══ */}
        <div className="rounded-xl border border-white/8 bg-dark-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-mono text-ps-text-muted uppercase tracking-widest flex items-center gap-2">
              <Users className="w-3.5 h-3.5" /> Characters ({characters.length})
            </label>
            <div className="flex items-center gap-2">
              {savedCharacters.length > 0 && (
                <button onClick={() => setShowCharPicker(true)}
                  className="flex items-center gap-1 text-xs font-mono text-neon-purple hover:text-purple-300">
                  <Users className="w-3 h-3" /> From Library
                </button>
              )}
              <button onClick={() => setCharacters(prev => [...prev, { ...EMPTY_CHARACTER }])}
                className="flex items-center gap-1 text-xs font-mono text-neon-purple hover:text-purple-300">
                <Plus className="w-3 h-3" /> Add Character
              </button>
            </div>
          </div>
          {characters.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-xs text-ps-text-faint">No characters yet. Add one or import from your library.</p>
            </div>
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
        </div>

        {/* ═══ SECTION E: Story Parameters ═══ */}
        <div className="rounded-xl border border-white/8 bg-dark-900/50 p-5 space-y-4">
          <label className="text-xs font-mono text-ps-text-muted uppercase tracking-widest block">Story Parameters</label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-2">Point of View</label>
              <select aria-label="Point of view" value={pov} onChange={(e) => setPov(e.target.value)}
                className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-neon-purple/40 font-mono">
                <option value="first">First Person</option>
                <option value="third-limited">Third Person Limited</option>
                <option value="third-omniscient">Third Person Omniscient</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-2">Length</label>
              <select aria-label="Length" value={length} onChange={(e) => setLength(e.target.value)}
                className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-neon-purple/40 font-mono">
                <option value="short">Short (3-4 chapters)</option>
                <option value="medium">Medium (5-7 chapters)</option>
                <option value="long">Long (8-12 chapters)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-2">Writing Model</label>
            <select aria-label="Writing model" value={modelId}
              onChange={(e) => { setTouchedModel(true); setModelId(e.target.value); }}
              className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-neon-purple/40 font-mono">
              <option value="">Agent default model</option>
              {(models ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name} · {m.provider}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-2">Chapter Length (words per chapter)</label>
            <div className="flex flex-wrap gap-2">
              {WORD_COUNT_OPTIONS.map((opt) => (
                <button key={opt.id} onClick={() => setWordCountRange(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                    wordCountRange === opt.id ? "border-neon-purple/40 bg-neon-purple/15 text-neon-purple" : "border-white/8 text-ps-text-muted hover:text-ps-text-muted"
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Create Button */}
        <button onClick={handleCreate} disabled={!premise.trim() || generating}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-neon-purple/30 bg-neon-purple/10 text-base font-mono text-neon-purple hover:bg-neon-purple/20 transition-all disabled:opacity-30 shadow-[0_0_20px_rgb(var(--ps-rgb-neon-purple)_/_0.1)]">
          <Sparkles className="w-5 h-5" /> Begin Writing
        </button>
      </div>
    </AppPageShell>
  );
}

// Story Weaver — Prompts (V2 — saved story theme CRUD)
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Save, Trash2, Edit2, FileText, Loader2, ArrowRight } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import type { StoryTheme } from "@/modules/rec-room/types";

const EMPTY_THEME: Omit<StoryTheme, "id" | "createdAt" | "updatedAt"> = {
  name: "", premise: "", genre: [], era: "", setting: "", mood: [], notes: "",
};

const DEFAULT_GENRES = ["Sci-Fi", "Mystery", "Fantasy", "Romance", "Crime", "Horror", "Adventure", "Historical"];
const DEFAULT_ERAS = ["Ancient", "Medieval", "Modern", "Near Future", "Far Future", "Timeless"];
const DEFAULT_MOODS = ["Tense", "Wonder", "Humorous", "Dark", "Hopeful", "Melancholy", "Suspenseful", "Whimsical"];

export default function PromptsPage() {
  const router = useRouter();
  const [themes, setThemes] = useState<StoryTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StoryTheme | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "themes", subAction: "list" }),
      });
      const d = await res.json();
      if (d.data?.themes) setThemes(d.data.themes);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startNew = () => {
    setEditing({ ...EMPTY_THEME, id: "", createdAt: "", updatedAt: "" });
    setIsNew(true);
  };

  const startEdit = (theme: StoryTheme) => {
    setEditing({ ...theme });
    setIsNew(false);
  };

  const save = async () => {
    if (!editing || !editing.name.trim() || !editing.premise.trim()) return;
    setSaving(true);
    try {
      const action = isNew ? "create" : "update";
      const body: Record<string, unknown> = {
        action: "themes",
        subAction: action,
        name: editing.name,
        premise: editing.premise,
        genre: editing.genre,
        era: editing.era,
        setting: editing.setting,
        mood: editing.mood,
        notes: editing.notes,
      };
      if (!isNew) body.themeId = editing.id;
      const res = await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.data) {
        setEditing(null);
        load();
      }
    } catch {} finally { setSaving(false); }
  };

  const deleteTheme = async (id: string) => {
    setDeleting(id);
    try {
      await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "themes", subAction: "delete", themeId: id }),
      });
      setThemes(prev => prev.filter(t => t.id !== id));
    } catch {} finally { setDeleting(null); }
  };

  const loadTheme = (theme: StoryTheme) => {
    router.push(`/recroom/story-weaver/create?theme=${theme.id}`);
  };

  const toggleTag = (field: "genre" | "mood", tag: string) => {
    if (!editing) return;
    const list = editing[field];
    setEditing({
      ...editing,
      [field]: list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag],
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-neon-purple animate-spin" />
      </div>
    );
  }

  return (
    <AppPageShell variant="scanlines">
      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-[60] bg-dark-950/80 backdrop-blur-sm flex items-start justify-center p-4 pt-12 overflow-y-auto">
          <div className="bg-dark-900 border border-green-500/20 rounded-xl w-full max-w-2xl p-6 space-y-4 mb-12">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{isNew ? "New Story Theme" : "Edit Story Theme"}</h3>
              <button onClick={() => setEditing(null)} className="text-ps-text-muted hover:text-ps-text-secondary"><X className="w-4 h-4" /></button>
            </div>

            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1">Name</label>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Give this prompt a name" className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none font-mono" />
            </div>

            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1">Premise</label>
              <textarea value={editing.premise} onChange={(e) => setEditing({ ...editing, premise: e.target.value })}
                rows={4} placeholder="Describe your story concept..."
                className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-3 text-sm text-white placeholder-white/20 outline-none font-mono resize-none leading-relaxed" />
            </div>

            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1.5">Genre</label>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_GENRES.map(g => (
                  <button key={g} onClick={() => toggleTag("genre", g)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${
                      editing.genre.includes(g) ? "border-green-500/40 bg-green-500/15 text-green-400" : "border-white/8 text-ps-text-muted hover:text-ps-text-muted"
                    }`}>{g}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1.5">Era</label>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_ERAS.map(e => (
                  <button key={e} onClick={() => setEditing({ ...editing, era: editing.era === e ? "" : e })}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${
                      editing.era === e ? "border-green-500/40 bg-green-500/15 text-green-400" : "border-white/8 text-ps-text-muted hover:text-ps-text-muted"
                    }`}>{e}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1.5">Mood</label>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_MOODS.map(m => (
                  <button key={m} onClick={() => toggleTag("mood", m)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${
                      editing.mood.includes(m) ? "border-green-500/40 bg-green-500/15 text-green-400" : "border-white/8 text-ps-text-muted hover:text-ps-text-muted"
                    }`}>{m}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1">Setting</label>
              <input value={editing.setting} onChange={(e) => setEditing({ ...editing, setting: e.target.value })}
                placeholder="Where does the story take place?" className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none font-mono" />
            </div>

            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1">Notes</label>
              <textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                rows={2} placeholder="Additional notes, character ideas, plot points..."
                className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none font-mono resize-none" />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setEditing(null)}
                className="px-4 py-2 text-xs text-ps-text-muted hover:text-ps-text-secondary rounded-lg border border-white/10 hover:bg-white/5">
                Cancel
              </button>
              <button onClick={save} disabled={!editing.name.trim() || !editing.premise.trim() || saving}
                className="px-4 py-2 text-xs text-green-400 rounded-lg border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 disabled:opacity-30 flex items-center gap-2">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {saving ? "Saving..." : "Save Theme"}
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        icon={FileText}
        title="Story Themes"
        subtitle={`${themes.length} themes`}
        color="green"
        backHref="/recroom/story-weaver"
        backLabel="STORY WEAVER"
        actions={
          <button
            type="button"
            onClick={startNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-xs font-mono text-green-400 hover:bg-green-500/20"
          >
            <Plus className="w-3 h-3" /> New Theme
          </button>
        }
      />

      <div className="max-w-4xl mx-auto px-6 py-8 flex-1 w-full">
        {themes.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-sm text-ps-text-muted mb-2">No saved themes yet</p>
            <p className="text-xs text-ps-text-faint mb-6">Save story concepts to build on over time</p>
            <button onClick={startNew}
              className="px-4 py-2 rounded-lg border border-green-500/30 bg-green-500/10 text-sm font-mono text-green-400 hover:bg-green-500/20">
              Create Your First Theme
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {themes.map(theme => (
              <div key={theme.id} className="rounded-xl border border-white/5 bg-dark-900/50 p-4 space-y-3 hover:border-white/10 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-ps-text-primary truncate">{theme.name}</h3>
                    <p className="text-xs text-ps-text-muted mt-1 line-clamp-3">{theme.premise}</p>
                  </div>
                </div>

                {(theme.genre.length > 0 || theme.era || theme.mood.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {theme.genre.map(g => (
                      <span key={g} className="px-1.5 py-0.5 rounded text-xs font-mono border border-green-500/20 bg-green-500/5 text-green-400/70">{g}</span>
                    ))}
                    {theme.era && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-mono border border-white/5 bg-white/[0.02] text-ps-text-muted">{theme.era}</span>
                    )}
                    {theme.mood.slice(0, 2).map(m => (
                      <span key={m} className="px-1.5 py-0.5 rounded text-xs font-mono border border-white/5 bg-white/[0.02] text-ps-text-muted">{m}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => loadTheme(theme)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-green-500/20 text-xs font-mono text-green-400 hover:bg-green-500/10">
                    <ArrowRight className="w-3 h-3" /> Use
                  </button>
                  <button onClick={() => startEdit(theme)}
                    className="p-1.5 rounded text-ps-text-faint hover:text-green-400 hover:bg-green-500/10"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteTheme(theme.id)}
                    disabled={deleting === theme.id}
                    className="p-1.5 rounded text-ps-text-faint hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30">
                    {deleting === theme.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppPageShell>
  );
}

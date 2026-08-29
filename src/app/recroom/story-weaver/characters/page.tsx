// Story Weaver — Characters (V2 — character sheet CRUD)
"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, X, Save, Trash2, Edit2, Users, Loader2 } from "lucide-react";
import AppPageShell from "@/components/layout/AppPageShell";
import PageHeader from "@/components/layout/PageHeader";
import type { CharacterSheet } from "@/modules/rec-room/types";

const ROLES = ["protagonist", "ally", "antagonist", "supporting", "mystery", "mentor", "trickster", "guardian"];
const ROLE_COLORS: Record<string, string> = {
  protagonist: "text-green-400 border-green-500/30 bg-green-500/10",
  ally: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  antagonist: "text-red-400 border-red-500/30 bg-red-500/10",
  supporting: "text-ps-text-muted border-white/10 bg-white/5",
  mystery: "text-neon-purple border-neon-purple/30 bg-neon-purple/10",
  mentor: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  trickster: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  guardian: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
};

const EMPTY_CHAR: Omit<CharacterSheet, "id" | "createdAt" | "updatedAt"> = {
  name: "", role: "supporting", description: "",
  personality: [], backstory: "", appearance: "",
  speechPatterns: "", relationships: "", tags: [],
};

export default function CharactersPage() {
  const [characters, setCharacters] = useState<CharacterSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CharacterSheet | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tagInput, setTagInput] = useState("");
  const [personalityInput, setPersonalityInput] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "characters", subAction: "list" }),
      });
      const d = await res.json();
      if (d.data?.characters) setCharacters(d.data.characters);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startNew = () => {
    setEditing({ ...EMPTY_CHAR, id: "", createdAt: "", updatedAt: "" });
    setIsNew(true);
    setTagInput("");
    setPersonalityInput("");
  };

  const startEdit = (c: CharacterSheet) => {
    setEditing({ ...c });
    setIsNew(false);
    setTagInput("");
    setPersonalityInput("");
  };

  const save = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      const action = isNew ? "create" : "update";
      const body: Record<string, unknown> = {
        action: "characters",
        subAction: action,
        name: editing.name,
        role: editing.role,
        description: editing.description,
        personality: editing.personality,
        backstory: editing.backstory,
        appearance: editing.appearance,
        speechPatterns: editing.speechPatterns,
        relationships: editing.relationships,
        tags: editing.tags,
      };
      if (!isNew) body.charId = editing.id;
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

  const deleteChar = async (id: string) => {
    setDeleting(id);
    try {
      await fetch("/api/stories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "characters", subAction: "delete", charId: id }),
      });
      setCharacters(prev => prev.filter(c => c.id !== id));
    } catch {} finally { setDeleting(null); }
  };

  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const addTag = () => {
    if (!tagInput.trim() || !editing) return;
    if (!editing.tags.includes(tagInput.trim())) {
      setEditing({ ...editing, tags: [...editing.tags, tagInput.trim()] });
    }
    setTagInput("");
  };

  const addPersonality = () => {
    if (!personalityInput.trim() || !editing) return;
    if (!editing.personality.includes(personalityInput.trim())) {
      setEditing({ ...editing, personality: [...editing.personality, personalityInput.trim()] });
    }
    setPersonalityInput("");
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
          <div className="bg-dark-900 border border-neon-purple/20 rounded-xl w-full max-w-2xl p-6 space-y-4 mb-12">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{isNew ? "New Character" : "Edit Character"}</h3>
              <button onClick={() => setEditing(null)} className="text-ps-text-muted hover:text-ps-text-secondary"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1">Name</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Character name" className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none font-mono" />
              </div>
              <div>
                <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1">Role</label>
                <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none font-mono">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1">Description</label>
              <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                rows={2} placeholder="Short description of who they are"
                className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none font-mono resize-none" />
            </div>

            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1">Appearance</label>
              <textarea value={editing.appearance} onChange={(e) => setEditing({ ...editing, appearance: e.target.value })}
                rows={2} placeholder="Physical description"
                className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none font-mono resize-none" />
            </div>

            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1">Backstory</label>
              <textarea value={editing.backstory} onChange={(e) => setEditing({ ...editing, backstory: e.target.value })}
                rows={3} placeholder="Their history, motivations, what drives them"
                className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none font-mono resize-none" />
            </div>

            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1">Speech Patterns</label>
              <textarea value={editing.speechPatterns} onChange={(e) => setEditing({ ...editing, speechPatterns: e.target.value })}
                rows={2} placeholder="How they talk — formal, slang, accent, catchphrases"
                className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none font-mono resize-none" />
            </div>

            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1">Relationships</label>
              <textarea value={editing.relationships} onChange={(e) => setEditing({ ...editing, relationships: e.target.value })}
                rows={2} placeholder="Connections to other characters"
                className="w-full bg-dark-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none font-mono resize-none" />
            </div>

            {/* Personality Traits */}
            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1">Personality Traits</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editing.personality.map(t => (
                  <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border border-neon-purple/30 bg-neon-purple/10 text-neon-purple">
                    {t}
                    <button onClick={() => setEditing({ ...editing, personality: editing.personality.filter(p => p !== t) })} className="text-neon-purple hover:text-red-400"><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input value={personalityInput} onChange={(e) => setPersonalityInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPersonality(); } }}
                  placeholder="Add trait..." className="flex-1 bg-dark-800/50 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-white/20 outline-none font-mono" />
                <button type="button" aria-label="Add personality trait" onClick={addPersonality} className="px-2 py-1 text-xs text-neon-purple"><Plus className="w-3 h-3" aria-hidden="true" /></button>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1">Tags (genre associations)</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editing.tags.map(t => (
                  <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono border border-white/10 bg-white/5 text-ps-text-muted">
                    {t}
                    <button onClick={() => setEditing({ ...editing, tags: editing.tags.filter(p => p !== t) })} className="text-ps-text-muted hover:text-red-400"><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="Add tag..." className="flex-1 bg-dark-800/50 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-white/20 outline-none font-mono" />
                <button type="button" aria-label="Add tag" onClick={addTag} className="px-2 py-1 text-xs text-neon-purple"><Plus className="w-3 h-3" aria-hidden="true" /></button>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setEditing(null)}
                className="px-4 py-2 text-xs text-ps-text-muted hover:text-ps-text-secondary rounded-lg border border-white/10 hover:bg-white/5">
                Cancel
              </button>
              <button onClick={save} disabled={!editing.name.trim() || saving}
                className="px-4 py-2 text-xs text-neon-purple rounded-lg border border-neon-purple/30 bg-neon-purple/10 hover:bg-neon-purple/20 disabled:opacity-30 flex items-center gap-2">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {saving ? "Saving..." : "Save Character"}
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        icon={Users}
        title="Characters"
        subtitle={`${characters.length} characters`}
        color="purple"
        backHref="/recroom/story-weaver"
        backLabel="STORY WEAVER"
        actions={
          <button
            type="button"
            onClick={startNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neon-purple/30 bg-neon-purple/10 text-xs font-mono text-neon-purple hover:bg-neon-purple/20"
          >
            <Plus className="w-3 h-3" /> New Character
          </button>
        }
      />

      <div className="max-w-4xl mx-auto px-6 py-8 flex-1 w-full">
        {characters.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <p className="text-sm text-ps-text-muted mb-2">No characters yet</p>
            <p className="text-xs text-ps-text-faint mb-6">Create character sheets to reuse across stories</p>
            <button onClick={startNew}
              className="px-4 py-2 rounded-lg border border-neon-purple/30 bg-neon-purple/10 text-sm font-mono text-neon-purple hover:bg-neon-purple/20">
              Create Your First Character
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {characters.map(c => {
              const isExpanded = expanded[c.id];
              return (
                <div key={c.id} className="rounded-xl border border-white/5 bg-dark-900/50 overflow-hidden">
                  <button onClick={() => toggleExpand(c.id)} className="w-full text-left p-4 flex items-start gap-3 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-ps-text-primary">{c.name}</span>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-mono border ${ROLE_COLORS[c.role] || ROLE_COLORS.supporting}`}>
                          {c.role}
                        </span>
                      </div>
                      <p className="text-xs text-ps-text-muted line-clamp-2">{c.description || c.backstory?.slice(0, 120) || "No description"}</p>
                      {c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {c.tags.map(t => (
                            <span key={t} className="px-1.5 py-0.5 rounded text-xs font-mono border border-white/5 bg-white/[0.02] text-ps-text-muted">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); startEdit(c); }}
                        className="p-1.5 rounded text-ps-text-faint hover:text-neon-purple hover:bg-neon-purple/10"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteChar(c.id); }}
                        disabled={deleting === c.id}
                        className="p-1.5 rounded text-ps-text-faint hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30">
                        {deleting === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-white/5 space-y-3">
                      {c.appearance && (
                        <div>
                          <span className="text-xs font-mono text-ps-text-faint uppercase">Appearance</span>
                          <p className="text-xs text-ps-text-muted mt-0.5">{c.appearance}</p>
                        </div>
                      )}
                      {c.backstory && (
                        <div>
                          <span className="text-xs font-mono text-ps-text-faint uppercase">Backstory</span>
                          <p className="text-xs text-ps-text-muted mt-0.5 whitespace-pre-wrap">{c.backstory}</p>
                        </div>
                      )}
                      {c.speechPatterns && (
                        <div>
                          <span className="text-xs font-mono text-ps-text-faint uppercase">Speech Patterns</span>
                          <p className="text-xs text-ps-text-muted mt-0.5">{c.speechPatterns}</p>
                        </div>
                      )}
                      {c.relationships && (
                        <div>
                          <span className="text-xs font-mono text-ps-text-faint uppercase">Relationships</span>
                          <p className="text-xs text-ps-text-muted mt-0.5">{c.relationships}</p>
                        </div>
                      )}
                      {c.personality.length > 0 && (
                        <div>
                          <span className="text-xs font-mono text-ps-text-faint uppercase">Personality</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.personality.map(p => (
                              <span key={p} className="px-2 py-0.5 rounded-md text-xs font-mono border border-neon-purple/20 bg-neon-purple/5 text-neon-purple">{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppPageShell>
  );
}

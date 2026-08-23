// CharacterCard — collapsible character editor (name/role/description + detail
// fields + save-to-library / remove). Extracted verbatim from the Story Weaver
// create page; the ROLES list is only used here so it lives with the card.

"use client";

import { Save, X } from "lucide-react";
import type { StoryCharacter } from "@/modules/rec-room/types";

const ROLES = ["protagonist", "ally", "antagonist", "supporting", "mystery"];

export default function CharacterCard({ char, index, onUpdate, onRemove, onSave, saved, expanded, onToggle }: {
  char: StoryCharacter;
  index: number;
  onUpdate: (idx: number, field: keyof StoryCharacter, value: string) => void;
  onRemove: (idx: number) => void;
  onSave: (char: StoryCharacter) => void;
  saved: boolean;
  expanded: boolean;
  onToggle: (idx: number) => void;
}) {
  const canSave = char.name.trim() && char.description.trim();
  return (
    <div className="rounded-lg border border-white/5 bg-dark-800/30 overflow-hidden">
      {/* Collapsed header — entire row is tappable to expand */}
      <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.03] min-h-[48px]"
        onClick={() => onToggle(index)}>
        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono ${
          expanded ? "bg-neon-purple/20 text-neon-purple" : "bg-white/5 text-ps-text-muted"
        }`}>
          {expanded ? "−" : "+"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ps-text-primary truncate">{char.name || "New Character"}</div>
          {!expanded && char.description && (
            <div className="text-xs text-ps-text-muted truncate">{char.description}</div>
          )}
        </div>
        <span className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-mono border border-white/8 text-ps-text-muted">{char.role}</span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">
          {/* Name + Role row */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-mono text-ps-text-faint uppercase block mb-1">Name</label>
              <input value={char.name} onChange={(e) => onUpdate(index, "name", e.target.value)}
                placeholder="Character name..."
                className="w-full bg-dark-700/30 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/15 outline-none font-semibold" />
            </div>
            <div className="w-32">
              <label className="text-xs font-mono text-ps-text-faint uppercase block mb-1">Role</label>
              <select value={char.role} onChange={(e) => onUpdate(index, "role", e.target.value)}
                className="w-full bg-dark-700/30 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white outline-none font-mono">
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-mono text-ps-text-faint uppercase block mb-1">Description</label>
            <textarea value={char.description} onChange={(e) => onUpdate(index, "description", e.target.value)}
              rows={2} placeholder="A brief summary of who they are..."
              className="w-full bg-dark-700/30 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-ps-text-secondary placeholder-white/15 outline-none font-mono resize-y min-h-[60px] leading-relaxed" />
          </div>

          {/* Detail fields */}
          {[
            { field: "personality" as const, label: "Personality Traits", ph: "e.g., Pragmatic, Protective, Stubborn — how they think and react" },
            { field: "appearance" as const, label: "Appearance", ph: "Physical description — build, features, distinguishing marks" },
            { field: "backstory" as const, label: "Backstory", ph: "Their history, motivations, what drives them..." },
            { field: "speechPatterns" as const, label: "Speech Patterns", ph: "How they talk — formal, slang, accent, verbal tics" },
            { field: "relationships" as const, label: "Relationships", ph: "Connections to other characters — allies, enemies, bonds" },
          ].map(({ field, label, ph }) => (
            <div key={field}>
              <label className="text-xs font-mono text-ps-text-faint uppercase block mb-1">{label}</label>
              <textarea value={char[field] || ""} onChange={(e) => onUpdate(index, field, e.target.value)}
                rows={2} placeholder={ph}
                className="w-full bg-dark-700/30 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-ps-text-secondary placeholder-white/15 outline-none font-mono resize-y min-h-[60px] leading-relaxed" />
            </div>
          ))}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/5">
            <button onClick={() => onSave(char)} disabled={!canSave}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono border transition-all min-h-[40px] ${
                saved ? "border-green-500/30 bg-green-500/10 text-green-400" :
                canSave ? "border-green-500/20 text-green-400/60 hover:bg-green-500/10 hover:text-green-400" :
                "border-white/5 text-ps-text-faint opacity-50"
              }`}>
              <Save className="w-3.5 h-3.5" />
              {saved ? "Saved!" : "Save to Library"}
            </button>
            <div className="flex-1" />
            <button onClick={() => onRemove(index)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono border border-red-500/10 text-red-400/40 hover:bg-red-500/10 hover:text-red-400 transition-all min-h-[40px]">
              <X className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

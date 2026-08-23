// Tags — a toggleable chip group with an inline "+ Add" custom-value input.
// Extracted verbatim from the Story Weaver create page.

"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

export default function Tags({ label, options, selected, onToggle, onAdd }: {
  label: string; options: string[]; selected: string[];
  onToggle: (t: string) => void; onAdd: (t: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  return (
    <div>
      <label className="text-xs font-mono text-ps-text-muted uppercase tracking-wider block mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((t) => (
          <button key={t} onClick={() => onToggle(t)}
            className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${
              selected.includes(t) ? "border-green-500/40 bg-green-500/15 text-green-400" : "border-white/8 text-ps-text-muted hover:text-ps-text-muted"
            }`}>{t}</button>
        ))}
        {adding ? (
          <div className="flex items-center gap-1">
            <input value={val} onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); setAdding(false); } if (e.key === "Escape") setAdding(false); }}
              className="w-24 bg-dark-800/50 border border-green-500/30 rounded px-2 py-1 text-xs font-mono text-white outline-none" autoFocus placeholder="Custom..." />
            <button onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); setAdding(false); } }} className="p-0.5 text-green-400"><Plus className="w-3 h-3" /></button>
            <button onClick={() => setAdding(false)} className="p-0.5 text-ps-text-muted"><X className="w-3 h-3" /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="px-2 py-1 rounded-md text-xs font-mono border border-dashed border-white/10 text-ps-text-faint hover:text-ps-text-muted">+ Add</button>
        )}
      </div>
    </div>
  );
}

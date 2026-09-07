// Tags — a toggleable chip group, with an inline custom-value input when the
// caller allows one. The chips stay raw buttons: a pressed chip is a toggle
// with aria-pressed, which no primitive draws (U12, T-0126). The chrome is the
// house green rather than the raw palette's.

"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { Input } from "@/components/ui/field";

export default function Tags({ label, options, selected, onToggle, onAdd }: {
  label: string; options: string[]; selected: string[];
  onToggle: (t: string) => void;
  /** Offer "+ Add" for a value of the caller's own. Absent, the set is fixed. */
  onAdd?: (t: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState("");
  const commit = () => {
    if (val.trim() && onAdd) onAdd(val.trim());
    setVal("");
    setAdding(false);
  };
  return (
    <div>
      <span className="mb-1.5 block font-mono text-micro uppercase tracking-wider text-ps-text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
        {options.map((t) => (
          <button key={t} type="button" onClick={() => onToggle(t)} aria-pressed={selected.includes(t)}
            // A border, not a ring: Tailwind renders a ring as a box-shadow with
            // transparent layers, and the census counted it as two new shadows.
            className={`rounded-ps-md border px-2.5 py-1 font-mono text-body transition-colors ${
              selected.includes(t)
                ? "border-neon-green/40 bg-neon-green/15 text-neon-green"
                : "border-ps-edge text-ps-text-muted hover:text-ps-text-secondary"
            }`}>{t}</button>
        ))}
        {onAdd && (adding ? (
          <div className="flex items-center gap-1">
            <Input value={val} onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") setAdding(false); }}
              className="w-28" autoFocus placeholder="Custom..." aria-label={`Custom ${label.toLowerCase()}`} />
            <IconButton icon={Plus} label="Add tag" size="sm" onClick={commit} />
            <IconButton icon={X} label="Cancel adding a tag" size="sm" onClick={() => setAdding(false)} />
          </div>
        ) : (
          <Button variant="ghost" size="sm" icon={Plus} onClick={() => setAdding(true)} aria-label={`Add a ${label.toLowerCase()}`}>
            Add
          </Button>
        ))}
      </div>
    </div>
  );
}

// Tags — a toggleable chip group, with an inline custom-value input when the
// caller allows one. A chip is a Button that carries aria-pressed (C6,
// T-0143): pressed is the primary green chrome, unpressed the secondary, the
// same pair the reader's font picker uses. The chips were raw buttons on the
// belief that a toggle was a shape no primitive drew; Button passes every
// button attribute through, and the pressed state is an attribute.

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
          <Button
            key={t}
            variant={selected.includes(t) ? "primary" : "secondary"}
            color="green"
            size="sm"
            aria-pressed={selected.includes(t)}
            onClick={() => onToggle(t)}
          >
            {t}
          </Button>
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

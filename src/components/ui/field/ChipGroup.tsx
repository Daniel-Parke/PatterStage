// ═══════════════════════════════════════════════════════════════
// ui/field/ChipGroup — multi-select chips with select-all/none + a count
// (Field Kit). `null` selection means "all" (the common default).
// ═══════════════════════════════════════════════════════════════

"use client";

export interface ChipOption {
  key: string;
  label: string;
}

export function ChipGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label?: string;
  options: ChipOption[];
  /** null = all selected (the default); [] = none. */
  selected: string[] | null;
  onChange: (next: string[] | null) => void;
}) {
  const allKeys = options.map((o) => o.key);
  const isActive = (k: string) => selected === null || selected.includes(k);
  const count = selected === null ? options.length : selected.length;

  function toggle(k: string) {
    const base = selected ?? allKeys;
    const next = base.includes(k) ? base.filter((x) => x !== k) : [...base, k];
    // Collapse "everything selected" back to null (the canonical "all").
    onChange(next.length === allKeys.length ? null : next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label ? <span className="text-[10px] uppercase tracking-wider text-white/25">{label}</span> : null}
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={isActive(o.key)}
          onClick={() => toggle(o.key)}
          className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors focus:outline-none focus:ring-1 focus:ring-neon-cyan/30 ${
            isActive(o.key)
              ? "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan"
              : "border-white/10 text-white/35 hover:text-white/60"
          }`}
        >
          {o.label}
        </button>
      ))}
      <span className="ml-1 text-[10px] text-white/25">{count}/{options.length}</span>
      <button type="button" onClick={() => onChange(null)} className="text-[10px] text-white/30 transition-colors hover:text-neon-cyan">
        all
      </button>
      <button type="button" onClick={() => onChange([])} className="text-[10px] text-white/30 transition-colors hover:text-neon-cyan">
        none
      </button>
    </div>
  );
}

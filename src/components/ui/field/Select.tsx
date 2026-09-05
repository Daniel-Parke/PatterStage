// ═══════════════════════════════════════════════════════════════
// ui/field/Select — custom on-brand dropdown (replaces raw native <select>)
//
// Keyboard-accessible listbox (Arrow/Enter/Escape, click-outside to close) with
// the Cherenkov visual language, so every dropdown across the product matches
// instead of falling back to the OS-native control. (UX_AUDIT B1/B3/X3.)
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      const i = options.findIndex((o) => o.value === value);
      setActive(i >= 0 ? i : 0);
    }
  }, [open, value, options]);

  function commit(i: number) {
    const opt = options[i];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(active);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-dark-900/80 px-3 py-2 text-left text-sm text-ps-text-primary transition-colors hover:border-white/20 focus:border-neon-cyan/50 focus:outline-none focus:ring-1 focus:ring-neon-cyan/30 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className={`truncate ${selected ? "" : "text-ps-text-muted"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ps-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-white/10 bg-dark-950/95 p-1 shadow-xl backdrop-blur"
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled}
              onMouseEnter={() => setActive(i)}
              onClick={() => commit(i)}
              className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm ${
                o.disabled
                  ? "cursor-not-allowed text-ps-text-faint"
                  : i === active
                    ? "bg-neon-cyan/10 text-neon-cyan"
                    : "text-ps-text-primary hover:bg-white/5"
              }`}
            >
              <span className="truncate">
                {o.label}
                {o.hint ? <span className="ml-2 text-xs text-ps-text-muted">{o.hint}</span> : null}
              </span>
              {o.value === value ? <Check className="h-3.5 w-3.5 shrink-0 text-neon-cyan" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

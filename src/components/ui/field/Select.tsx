// ═══════════════════════════════════════════════════════════════
// ui/field/Select — custom on-brand dropdown (replaces raw native <select>)
//
// Keyboard-accessible listbox (Arrow/Enter/Escape, click-outside to close) with
// the Cherenkov visual language, so every dropdown across the product matches
// instead of falling back to the OS-native control. (UX_AUDIT B1/B3/X3.)
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useId, useRef, useState, type SelectHTMLAttributes } from "react";
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
        className="flex w-full items-center justify-between gap-2 rounded-ps-md border border-ps-edge bg-ps-surface-panel px-3 py-2 text-left text-body text-ps-text-primary transition-colors hover:border-ps-edge-emphasis disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className={`truncate ${selected ? "" : "text-ps-text-muted"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ps-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-dropdown mt-1 max-h-60 w-full overflow-auto rounded-ps-md border border-ps-edge-hairline bg-ps-surface-ground/95 p-1 shadow-xl backdrop-blur"
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={o.disabled}
              onMouseEnter={() => setActive(i)}
              onClick={() => commit(i)}
              className={`flex cursor-pointer items-center justify-between gap-2 rounded-ps-md px-2.5 py-1.5 text-body ${
                o.disabled
                  ? "cursor-not-allowed text-ps-text-faint"
                  : i === active
                    ? "bg-neon-cyan/10 text-neon-cyan"
                    : "text-ps-text-primary hover:bg-ps-surface-raised"
              }`}
            >
              <span className="truncate">
                {o.label}
                {o.hint ? <span className="ml-2 text-body text-ps-text-muted">{o.hint}</span> : null}
              </span>
              {o.value === value ? <Check className="h-3.5 w-3.5 shrink-0 text-neon-cyan" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ── NativeSelect ──────────────────────────────────────────────
//
// The browser's own <select>, wearing the kit's chrome. The listbox above is
// the product's dropdown; this is for the sites that need the native control
// (a form driven by change events, a picker the OS should draw), so that a
// native select is still a primitive and not a raw element on a page.

const NATIVE_BASE =
  "rounded-ps-md border border-ps-edge bg-ps-surface-panel px-3 py-2 text-body text-ps-text-primary transition-colors hover:border-ps-edge-emphasis disabled:cursor-not-allowed disabled:opacity-40";

export function NativeSelect({ className = "", ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  // form-control-names-disable-next-line -- a pure pass-through: every select attribute including aria-label arrives in {...rest}, so the name is the caller's to supply
  return <select {...rest} className={`${NATIVE_BASE} ${className}`} />;
}

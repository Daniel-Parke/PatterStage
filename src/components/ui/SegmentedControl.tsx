// ═══════════════════════════════════════════════════════════════
// SegmentedControl — a filter group that says what it is.
//
// Thirteen groups in this tree render their state as colour and nothing else.
// A sighted user sees that "Running" is the active filter because it is cyan;
// a screen reader is read three buttons and told nothing about any of them.
// That is not a styling gap - the state is absent from the accessibility tree
// (T-0122).
//
// Two things fix it, and the second is the one that is easy to get wrong.
//
//   A REAL RADIOGROUP. `role="radio"` with `aria-checked`, inside a
//   `role="radiogroup"` with a name. "One of these, currently that one" is
//   exactly what a segmented filter means, and it is a shape assistive
//   technology already knows.
//
//   A ROVING TABINDEX. The group is ONE tab stop, not one per option, and it
//   sits on the CHOSEN option so Tab lands where the user already is. Today
//   every option is its own stop, so crossing the missions filter bar costs
//   eleven keystrokes before reaching the board. Inside the group the arrows
//   move, and moving selects - which is the standard for a radiogroup, and
//   what makes it navigable without a second keystroke per option.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useRef } from "react";

// Not exported until something imports it. `SegmentedControlProps` names it
// for callers, and knip refuses an export with no consumer - which is right:
// U8 builds this primitive, U9-U13 adopt it, and the export belongs to the
// batch that has a caller for it.
interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  /** Optional trailing count, e.g. a filter's match count. */
  count?: number;
}

export interface SegmentedControlProps<T extends string = string> {
  /** The group's accessible name. A filter bar with three unnamed groups is three mysteries. */
  label: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export default function SegmentedControl<T extends string = string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (from: number, delta: number) => {
    // Wraps at both ends. A group that stops at the last option makes the user
    // guess whether they have reached the end or the control has stopped
    // responding.
    const to = (from + delta + options.length) % options.length;
    onChange(options[to].value);
    refs.current[to]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(index, 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(index, -1);
        break;
      case "Home":
        e.preventDefault();
        move(0, 0);
        break;
      case "End":
        e.preventDefault();
        move(options.length - 1, 0);
        break;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded-ps-md border border-ps-edge bg-ps-surface-panel p-1 ${className}`}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            // The roving stop. Only the chosen option is reachable by Tab;
            // the rest are reachable by arrow, which is the point.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`rounded-ps-sm px-3 py-1 text-micro font-mono transition-colors ${
              selected
                ? "bg-ps-surface-raised text-ps-text-primary"
                : "text-ps-text-secondary hover:text-ps-text-primary"
            }`}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="ml-1.5 text-ps-text-faint">{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Picker — one control for choosing one, or several, of a list.
//
// Five Selectors lived in this directory - Profile, Skill, Toolset, Timeout
// and MissionTime - and each spelled the same trigger, the same menu and the
// same click-outside effect, 684 lines between them. Not one was a listbox:
// the menu was a stack of plain buttons with no role, no arrow keys and no
// Escape. T-0122 built useDismissable for exactly this and left the component
// until a screen needed it; the Agent group is that screen (T-0125).
//
// What assistive technology is told is the shape it already knows: a button
// that says it opens a listbox, a listbox of options with the chosen one
// selected, arrows that move and Enter that chooses, Escape that closes and
// hands focus back. The multi-select adds chips that each carry their own
// named remove, a search over the options, and a ceiling.
//
// Not a combobox. A combobox is an input the user types INTO; this is a list
// the user chooses FROM, with an optional filter over it, and the two are read
// out differently. The filter box owns `aria-activedescendant` while it has
// focus, so the arrow keys keep working from inside it.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";

import type { AccentColor } from "@/types/console";
import { useDismissable } from "@/hooks/useDismissable";
import IconButton from "@/components/ui/IconButton";
import { POPOVER_PANEL } from "@/components/ui/Popover";
import { iconColorMap } from "@/lib/ui/theme";

export interface PickerOption {
  value: string;
  label: string;
  /** A second line, quieter: a description, an id, a provider. */
  hint?: string;
  disabled?: boolean;
}

interface PickerBase {
  /** The accessible name of the trigger and of the list. */
  label: string;
  options: readonly PickerOption[];
  placeholder?: string;
  /** A filter box at the head of the list, over label and hint. */
  searchable?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** 26 / 32 / 40: the same three heights as Button, so a picker beside a button lines up. */
  size?: "sm" | "md" | "lg";
  color?: AccentColor;
  icon?: React.ComponentType<{ className?: string }>;
  emptyText?: string;
  /** Classes for the wrapper, typically a width. */
  className?: string;
  "data-testid"?: string;
}

type SingleProps = PickerBase & {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
  max?: undefined;
};

type MultiProps = PickerBase & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
  /** The most that may be chosen; the rest become disabled at the ceiling. */
  max?: number;
};

export type PickerProps = SingleProps | MultiProps;

const HEIGHT: Record<NonNullable<PickerBase["size"]>, string> = {
  sm: "h-6.5",
  md: "h-8",
  lg: "h-10",
};

/** The index of the next enabled option from `from` in `direction`, wrapping. */
function step(options: readonly PickerOption[], enabled: (o: PickerOption) => boolean, from: number, direction: 1 | -1): number {
  if (options.length === 0) return -1;
  let i = from;
  for (let n = 0; n < options.length; n++) {
    i = (i + direction + options.length) % options.length;
    if (enabled(options[i])) return i;
  }
  return from;
}

export default function Picker(props: PickerProps) {
  const {
    label,
    options,
    placeholder = "Select…",
    searchable = false,
    loading = false,
    disabled = false,
    size = "md",
    color = "cyan",
    icon: Icon,
    emptyText = "Nothing to choose from",
    className = "",
    "data-testid": testId,
  } = props;
  const multiple = props.multiple === true;
  const chosen: string[] = multiple ? props.value : props.value ? [props.value] : [];
  const max = multiple ? props.max : undefined;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  // Declared BEFORE the focus effect below, so the hook records the trigger as
  // the element to give focus back to, not the list this then focuses.
  const containerRef = useDismissable<HTMLDivElement>({ open, onClose: close });

  const atCeiling = multiple && max !== undefined && chosen.length >= max;
  const enabled = (o: PickerOption) => o.disabled !== true && !(atCeiling && !chosen.includes(o.value));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...options];
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (open) (searchable ? searchRef.current : listRef.current)?.focus();
  }, [open, searchable]);

  const openList = () => {
    if (disabled) return;
    const start = options.findIndex((o) => chosen.includes(o.value) && enabled(o));
    setActive(start >= 0 ? start : step(options, enabled, -1, 1));
    setOpen(true);
  };

  const choose = (o: PickerOption) => {
    if (!enabled(o)) return;
    if (multiple) {
      const next = chosen.includes(o.value) ? chosen.filter((v) => v !== o.value) : [...chosen, o.value];
      (props as MultiProps).onChange(next);
      return;
    }
    (props as SingleProps).onChange(o.value);
    close();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openList();
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => step(visible, enabled, a, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => step(visible, enabled, a, -1));
        break;
      case "Home":
        e.preventDefault();
        setActive(step(visible, enabled, -1, 1));
        break;
      case "End":
        e.preventDefault();
        setActive(step(visible, enabled, 0, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (visible[active]) choose(visible[active]);
        break;
      case " ":
        if (!searchable) {
          e.preventDefault();
          if (visible[active]) choose(visible[active]);
        }
        break;
      case "Tab":
        // Not trapped: tabbing out of a menu leaves it (I3, T-0122). The panel
        // just should not be left open behind the user's back.
        close();
        break;
      default:
        break;
    }
  };

  const onSearch = (value: string) => {
    setQuery(value);
    const q = value.trim().toLowerCase();
    const next = q
      ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q))
      : [...options];
    setActive(step(next, enabled, -1, 1));
  };

  const optionId = (i: number) => `${listId}-${i}`;
  const activeId = active >= 0 && visible[active] ? optionId(active) : undefined;

  const selectedSingle = !multiple ? options.find((o) => o.value === props.value) : undefined;
  const triggerText = multiple
    ? chosen.length === 0
      ? placeholder
      : `${chosen.length} chosen`
    : (selectedSingle?.label ?? (loading ? "Loading…" : (props.value as string) || placeholder));
  const isPlaceholder = multiple ? chosen.length === 0 : !selectedSingle && !props.value;

  return (
    <div ref={containerRef} data-testid={testId} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        aria-controls={open ? listId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onTriggerKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-ps-md border border-ps-edge bg-ps-surface-panel px-3 text-left text-body text-ps-text-primary transition-colors hover:border-ps-edge-emphasis disabled:cursor-not-allowed disabled:text-ps-text-faint ${HEIGHT[size]}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {loading ? (
            <Loader2 className={`h-4 w-4 shrink-0 animate-spin ${iconColorMap[color]}`} aria-hidden="true" />
          ) : Icon ? (
            <Icon className={`h-4 w-4 shrink-0 ${iconColorMap[color]}`} />
          ) : null}
          <span className={`truncate ${isPlaceholder ? "text-ps-text-muted" : ""}`}>{triggerText}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ps-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {multiple && chosen.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Chosen ${label.toLowerCase()}`}>
          {chosen.map((v) => {
            const text = options.find((o) => o.value === v)?.label ?? v;
            return (
              <li
                key={v}
                className="inline-flex items-center gap-1 rounded-ps-sm border border-ps-edge-hairline bg-ps-surface-raised py-0.5 pl-2 pr-0.5 font-mono text-micro text-ps-text-secondary"
              >
                {text}
                <IconButton
                  size="sm"
                  icon={X}
                  label={`Remove ${text}`}
                  onClick={() => (props as MultiProps).onChange(chosen.filter((x) => x !== v))}
                />
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <div className={`${POPOVER_PANEL} left-0 w-full min-w-56`}>
          {searchable && (
            <div className="border-b border-ps-edge-hairline p-1.5">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                onKeyDown={onListKeyDown}
                aria-label={`Search ${label.toLowerCase()}`}
                aria-controls={listId}
                aria-activedescendant={activeId}
                placeholder="Search…"
                className="w-full rounded-ps-sm border border-ps-edge bg-ps-surface-inset px-2 py-1 font-mono text-micro text-ps-text-primary placeholder-ps-text-muted"
              />
            </div>
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            aria-multiselectable={multiple || undefined}
            aria-activedescendant={searchable ? undefined : activeId}
            tabIndex={-1}
            onKeyDown={searchable ? undefined : onListKeyDown}
            className="max-h-72 overflow-y-auto p-1"
          >
            {loading ? (
              <li role="presentation" className="flex items-center gap-2 px-2.5 py-2 text-body text-ps-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
              </li>
            ) : visible.length === 0 ? (
              <li role="presentation" className="px-2.5 py-2 text-body text-ps-text-muted">
                {query ? "Nothing matches" : emptyText}
              </li>
            ) : (
              visible.map((o, i) => {
                const selected = chosen.includes(o.value);
                const off = !enabled(o);
                return (
                  <li
                    key={o.value}
                    id={optionId(i)}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={off ? "true" : "false"}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={`flex items-center justify-between gap-2 rounded-ps-sm px-2.5 py-1.5 text-body ${
                      off
                        ? "cursor-not-allowed text-ps-text-faint"
                        : i === active
                          ? "cursor-pointer bg-ps-surface-panel text-ps-text-primary"
                          : "cursor-pointer text-ps-text-secondary"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`block truncate ${selected ? iconColorMap[color] : ""}`}>{o.label}</span>
                      {o.hint && <span className="block truncate text-micro text-ps-text-muted">{o.hint}</span>}
                    </span>
                    {selected && <Check className={`h-3.5 w-3.5 shrink-0 ${iconColorMap[color]}`} aria-hidden="true" />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FolderOpen, Loader2, Plus } from "lucide-react";

import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/field";
import { POPOVER_PANEL } from "@/components/ui/Popover";
import { useDismissable } from "@/hooks/useDismissable";
import { statusToneClasses } from "@/lib/theme";
import { CATEGORY_COLOR_CLASSES } from "@/lib/missions/mission-categories";

export interface CategoryOption {
  id: string;
  name: string;
  color: string;
}

export interface CategoryComboboxProps {
  categories: CategoryOption[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
  onCreateCategory?: (name: string) => Promise<string | null>;
  onManageCategories?: () => void;
  disabled?: boolean;
  label?: string;
}

export default function CategoryCombobox({
  categories,
  value,
  onChange,
  onCreateCategory,
  onManageCategories,
  disabled = false,
  label = "Category",
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  // The menu hangs off its trigger in flow, on the dropdown layer, the way
  // Picker's does. It used to be portaled to the body at z-[9999] and
  // positioned by hand, with its own resize, scroll, keydown and mousedown
  // listeners: four copies of what useDismissable already owns, on a layer
  // number no scale names (C6).
  const containerRef = useDismissable<HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
  });

  const selected = categories.find((c) => c.id === value);
  const trimmedQuery = query.trim();

  const filtered = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, trimmedQuery]);

  const canCreate =
    Boolean(onCreateCategory) &&
    trimmedQuery.length > 0 &&
    !categories.some(
      (c) => c.name.toLowerCase() === trimmedQuery.toLowerCase(),
    );

  const searchPlaceholder = onCreateCategory
    ? "Search or create…"
    : "Search categories";

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(
        () => containerRef.current?.querySelector("input")?.focus(),
        0,
      );
      return () => window.clearTimeout(t);
    }
    setQuery("");
  }, [open, containerRef]);

  const handleCreate = async () => {
    if (!onCreateCategory || !trimmedQuery) return;
    setCreating(true);
    try {
      const id = await onCreateCategory(trimmedQuery);
      if (id) {
        onChange(id);
        setQuery("");
        setOpen(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const dotClass = (color: string) =>
    CATEGORY_COLOR_CLASSES[color]?.split(" ")[0] ?? "bg-neon-cyan/30";

  return (
    <div ref={containerRef} className="relative">
      <label className="text-micro text-ps-text-muted font-mono block mb-1.5">
        {label}
      </label>
      <Button
        variant="secondary"
        disabled={disabled}
        data-testid="category-combobox-trigger"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="w-full"
      >
        <span className="flex w-full items-center justify-between gap-2 text-left">
          <span className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                selected ? dotClass(selected.color) : statusToneClasses.idle.dot
              }`}
            />
            <span className="truncate text-ps-text-primary">
              {selected?.name ?? "Uncategorized"}
            </span>
          </span>
          <ChevronDown className="w-4 h-4 text-ps-text-muted shrink-0" />
        </span>
      </Button>
      {open && (
        <div
          data-testid="category-combobox-menu"
          className={`${POPOVER_PANEL} left-0 w-full`}
        >
          <div className="p-2 border-b border-ps-edge-hairline">
            <Input
              aria-label="Search categories"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate && !creating) {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
              placeholder={searchPlaceholder}
              className="font-mono"
            />
          </div>
          <ul className="py-1">
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-micro font-mono text-ps-text-muted hover:bg-ps-surface-raised"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Uncategorized
              </button>
            </li>
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-micro font-mono text-ps-text-primary hover:bg-ps-surface-raised flex items-center gap-2"
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className={`w-2 h-2 rounded-full ${dotClass(c.color)}`} />
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
          {(canCreate || onManageCategories) && (
            <div className="border-t border-ps-edge-hairline">
              {canCreate && (
                <button
                  type="button"
                  data-testid="category-combobox-create"
                  disabled={creating}
                  onClick={() => void handleCreate()}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-micro font-mono text-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Create category &quot;{trimmedQuery}&quot;
                </button>
              )}
              {onManageCategories && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onManageCategories();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-micro font-mono text-ps-text-muted hover:bg-ps-surface-raised border-t border-ps-edge"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Manage all categories…
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

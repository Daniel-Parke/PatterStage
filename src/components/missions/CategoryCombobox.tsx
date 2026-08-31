"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, FolderOpen, Loader2, Plus } from "lucide-react";
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
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

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

  const updateMenuPosition = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const menuH = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= menuH ? rect.bottom + 4 : Math.max(8, rect.top - menuH - 4);
    setMenuPos({ top, left: rect.left, width: rect.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open, updateMenuPosition, filtered.length, canCreate]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => updateMenuPosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    setQuery("");
  }, [open]);

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

  const menu =
    open && menuPos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            data-testid="category-combobox-menu"
            className="fixed z-[9999] rounded-lg border border-white/10 bg-dark-900 shadow-2xl overflow-hidden"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
          >
            <div className="p-2 border-b border-white/10">
              <input aria-label="Search categories"
                ref={inputRef}
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
                className="w-full px-2 py-1.5 text-xs font-mono bg-dark-950 border border-white/10 rounded text-ps-text-primary outline-none focus:border-neon-cyan/40"
              />
            </div>
            <ul className="max-h-48 overflow-y-auto py-1">
              <li>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-xs font-mono text-ps-text-muted hover:bg-white/5"
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
                    className="w-full px-3 py-2 text-left text-xs font-mono text-ps-text-primary hover:bg-white/5 flex items-center gap-2"
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
              <div className="border-t border-white/10">
                {canCreate && (
                  <button
                    type="button"
                    data-testid="category-combobox-create"
                    disabled={creating}
                    onClick={() => void handleCreate()}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono text-neon-cyan hover:bg-neon-cyan/10 disabled:opacity-50"
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
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono text-ps-text-muted hover:bg-white/5 border-t border-white/5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Manage all categories…
                  </button>
                )}
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <label className="text-xs text-ps-text-muted font-mono block mb-1.5">
        {label}
      </label>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        data-testid="category-combobox-trigger"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 h-9 rounded-lg border border-white/10 bg-dark-900/80 text-left text-sm font-mono hover:border-white/20 disabled:opacity-50"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              selected ? dotClass(selected.color) : "bg-white/20"
            }`}
          />
          <span className="truncate text-ps-text-primary">
            {selected?.name ?? "Uncategorized"}
          </span>
        </span>
        <ChevronDown className="w-4 h-4 text-ps-text-muted shrink-0" />
      </button>
      {menu}
    </div>
  );
}

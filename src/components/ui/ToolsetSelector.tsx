"use client";

import { useState, useEffect, useRef } from "react";
import { Wrench, Loader2, X, ChevronDown, Search } from "lucide-react";
import { useToolsetCatalog } from "@/hooks/useToolsetCatalog";
import { pluralise } from "@/lib/utils";
import { useProfileToolsets } from "@/hooks/useProfileAttachables";

interface ToolsetSelectorProps {
  value: string[];
  onChange: (toolsets: string[]) => void;
  profileId?: string;
  max?: number;
}

export default function ToolsetSelector({
  value,
  onChange,
  profileId,
  max = 10,
}: ToolsetSelectorProps) {
  const { toolsetLabel } = useToolsetCatalog();
  const [open, setOpen] = useState(false);
  const { data: availableData, isLoading: loading } = useProfileToolsets(profileId);
  const available = availableData ?? [];
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = available
    .filter(
      (id) =>
        !value.includes(id) &&
        id.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 30);

  const add = (id: string) => {
    if (value.length < max) onChange([...value, id]);
  };

  const remove = (id: string) => onChange(value.filter((v) => v !== id));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm hover:border-white/30 transition-colors text-left"
      >
        <Wrench className="w-4 h-4 text-neon-orange/90 flex-shrink-0" />
        <span className="text-ps-text-muted flex-1">
          {value.length === 0
            ? "Recommend Hermes toolsets (optional)…"
            : `${value.length} toolset${pluralise(value.length)} selected`}
        </span>
        <ChevronDown className={`w-4 h-4 text-ps-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neon-orange/10 border border-neon-orange/20 text-xs font-mono text-neon-orange/90"
            >
              {toolsetLabel(id)}
              <button
                type="button"
                aria-label={`Remove toolset ${toolsetLabel(id)}`}
                onClick={() => remove(id)}
                className="hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-white/10 bg-dark-900 shadow-xl">
          <div className="p-2 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-ps-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search toolsets…" aria-label="Toolset search"
                className="w-full pl-8 pr-3 py-2 text-xs bg-dark-950 border border-white/10 rounded text-white focus:outline-none focus:border-neon-orange/40"
              />
            </div>
            <p className="text-xs text-ps-text-muted mt-1.5 px-1">
              Prompt hints only — runtime tools come from the profile config.
            </p>
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {loading ? (
              <div className="flex items-center justify-center py-4 text-ps-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : available.length === 0 ? (
              <p className="text-xs text-ps-text-muted px-2 py-3">
                No toolsets on this profile. Configure on Operations → Tools.
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-ps-text-muted px-2 py-3">No matches</p>
            ) : (
              filtered.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    add(id);
                    setSearch("");
                  }}
                  className="w-full text-left px-2 py-1.5 rounded text-xs font-mono text-ps-text-secondary hover:bg-white/5"
                >
                  {toolsetLabel(id)}
                  <span className="text-ps-text-faint ml-1">({id})</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

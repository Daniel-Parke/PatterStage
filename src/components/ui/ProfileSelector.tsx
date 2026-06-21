"use client";

import { useState, useRef, useEffect } from "react";
import { User, ChevronDown, Loader2 } from "lucide-react";
import { useProfiles } from "@/hooks/useProfiles";

interface ProfileSelectorProps {
  value: string;
  onChange: (profile: string) => void;
  compact?: boolean;
  placeholder?: string;
  /** `inline` — name + description in trigger (default). `tooltip` — name only; description in native tooltip. */
  subtitle?: "inline" | "tooltip";
}

export default function ProfileSelector({
  value,
  onChange,
  compact = false,
  placeholder,
  subtitle = "inline",
}: ProfileSelectorProps) {
  const [open, setOpen] = useState(false);
  const { data: profilesData, isLoading: loading } = useProfiles();
  const profiles = profilesData ?? [];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = profiles.find((p) => p.id === value) ?? (profiles[0] ?? null);

  if (compact) {
    return (
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/60 hover:border-neon-purple/50 hover:text-neon-purple transition-colors relative"
        title={selected?.name ?? "Select profile"}
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <User className="w-3 h-3" />
        )}
        {selected?.name.split(" - ")[0] ?? "Profile"}
        {open && (
          <div
            ref={ref}
            className="absolute top-full left-0 mt-1 z-50 w-56 bg-dark-900 border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-80 overflow-y-auto"
          >
            {profiles.length === 0 && !loading ? (
              <div className="px-3 py-3 text-xs text-white/30 text-center">
                No profiles found
              </div>
            ) : (
              profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(p.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 ${
                    value === p.id ? "text-neon-purple" : "text-white/60"
                  }`}
                >
                  <div className="font-medium">{p.name}</div>
                  {p.description && (
                    <div className="text-[10px] text-white/30 mt-0.5">
                      {p.description}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </button>
    );
  }

  const triggerTitle =
    subtitle === "tooltip" && selected?.description
      ? `${selected.name}\n\n${selected.description}`
      : subtitle === "tooltip" && selected
        ? selected.name
        : undefined;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={triggerTitle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:border-white/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {loading ? (
            <Loader2 className="w-4 h-4 text-neon-purple animate-spin flex-shrink-0" />
          ) : (
            <User className="w-4 h-4 text-neon-purple flex-shrink-0" />
          )}
          {selected ? (
            <div className="text-left min-w-0">
              <div className="font-medium truncate">{selected.name}</div>
              {subtitle === "inline" && selected.description && (
                <div className="text-[10px] text-white/40 line-clamp-2">
                  {selected.description}
                </div>
              )}
            </div>
          ) : (
            <div className="text-left min-w-0">
              <div className="font-medium text-white/40 truncate">
                {placeholder ?? "Select profile"}
              </div>
            </div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-white/30 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-dark-900 border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-80 overflow-y-auto">
          {profiles.length === 0 && !loading ? (
            <div className="px-3 py-4 text-xs text-white/30 text-center">
              No profiles found
            </div>
          ) : (
            profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-white/5 ${
                  value === p.id
                    ? "text-neon-purple bg-neon-purple/5"
                    : "text-white/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      value === p.id ? "bg-neon-purple" : "bg-white/20"
                    }`}
                  />
                  <span className="font-medium">{p.name}</span>
                </div>
                {p.description && (
                  <div className="text-xs text-white/40 mt-0.5 ml-4">
                    {p.description}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { User, ChevronDown, Loader2 } from "lucide-react";

interface Profile {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
}

interface ProfileSelectorProps {
  value: string;
  onChange: (profile: string) => void;
  compact?: boolean;
  placeholder?: string;
}

export default function ProfileSelector({
  value,
  onChange,
  compact = false,
  placeholder,
}: ProfileSelectorProps) {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetched, setFetched] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/agent/profiles", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        const raw = d.data?.profiles ?? [];
        if (raw.length > 0) {
          const live: Profile[] = raw.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: p.name as string,
            description: (p.description as string) || "",
            isDefault: (p.isDefault as boolean) ?? false,
          }));
          setProfiles(live);
          setFetched(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

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
        {loading && !fetched ? (
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:border-white/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {loading && !fetched ? (
            <Loader2 className="w-4 h-4 text-neon-purple animate-spin" />
          ) : (
            <User className="w-4 h-4 text-neon-purple" />
          )}
          {selected ? (
            <div className="text-left">
              <div className="font-medium">{selected.name}</div>
              {selected.description && (
                <div className="text-[10px] text-white/40">
                  {selected.description}
                </div>
              )}
            </div>
          ) : (
            <div className="text-left">
              <div className="font-medium text-white/40">
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

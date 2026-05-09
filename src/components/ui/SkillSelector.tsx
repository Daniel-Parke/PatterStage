"use client";

import { useState, useEffect, useRef } from "react";
import { Cpu, Loader2, X, ChevronDown, Search } from "lucide-react";

interface Skill {
  name: string;
  category: string;
  description: string;
  enabled: boolean;
}

interface SkillSelectorProps {
  value: string[];
  onChange: (skills: string[]) => void;
  profileId?: string;
  max?: number;
}

export default function SkillSelector({
  value,
  onChange,
  profileId,
  max = 10,
}: SkillSelectorProps) {
  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(
      `/api/skills?profile=${encodeURIComponent(profileId ?? "default")}`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((d) => {
        setSkills(d.data?.skills ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open, profileId]);

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

  const filtered = skills
    .filter(
      (s) =>
        !value.includes(s.name) &&
        s.name.toLowerCase().includes(search.toLowerCase())
    )
    .slice(0, 30);

  const add = (name: string) => {
    if (value.length < max) onChange([...value, name]);
  };

  const remove = (name: string) => onChange(value.filter((v) => v !== name));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm hover:border-white/30 transition-colors text-left"
      >
        <Cpu className="w-4 h-4 text-neon-purple flex-shrink-0" />
        {value.length === 0 ? (
          <span className="text-white/40 text-xs font-mono">
            Attach skills (max {max})...
          </span>
        ) : (
          <span className="text-xs font-mono text-neon-purple">
            {value.length} skill{value.length !== 1 ? "s" : ""} attached
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-white/30 ml-auto flex-shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((name) => (
            <span
              key={name}
              className="flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full bg-neon-purple/10 border border-neon-purple/30 text-[10px] text-neon-purple font-mono"
            >
              {name}
              <button
                type="button"
                onClick={() => remove(name)}
                className="hover:text-red-400 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-dark-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-white/5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search skills..."
                autoFocus
                className="w-full bg-dark-800/50 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-neon-purple/50 font-mono"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-neon-purple" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-xs text-white/30 text-center py-4">
                {search ? "No skills match your search" : "No skills available"}
              </div>
            ) : (
              filtered.map((skill) => (
                <button
                  key={skill.name}
                  type="button"
                  onClick={() => {
                    add(skill.name);
                    setSearch("");
                  }}
                  disabled={value.length >= max}
                  className={`w-full text-left px-3 py-2.5 text-xs hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                    value.length >= max ? "cursor-not-allowed" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white/80">{skill.name}</span>
                    <span className="text-[9px] font-mono text-white/20">
                      {skill.category}
                    </span>
                  </div>
                  <div className="text-white/30 text-[10px] mt-0.5 line-clamp-1">
                    {skill.description || "No description"}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

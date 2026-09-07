"use client";

import { useState, useEffect, useRef } from "react";
import { Cpu, Loader2, X, ChevronDown, Search } from "lucide-react";
import { pluralise } from "@/lib/utils";
import { useProfileSkills } from "@/hooks/useProfileAttachables";

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
  const { data: skillsData, isLoading: loading } = useProfileSkills(profileId);
  const skills = skillsData ?? [];
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
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-ps-md bg-ps-surface-raised border border-ps-edge text-body hover:border-ps-edge-emphasis transition-colors text-left"
      >
        <Cpu className="w-4 h-4 text-neon-purple flex-shrink-0" />
        {value.length === 0 ? (
          <span className="text-ps-text-muted text-micro font-mono">
            Attach skills (enabled for profile, max {max})...
          </span>
        ) : (
          <span className="text-micro font-mono text-neon-purple">
            {value.length} skill{pluralise(value.length)} attached
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 text-ps-text-muted ml-auto flex-shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <p className="text-micro text-ps-text-faint font-mono mt-1 px-0.5">
        Showing only skills enabled for this profile.
      </p>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((name) => (
            <span
              key={name}
              className="flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full bg-neon-purple/10 border border-neon-purple/30 text-micro text-neon-purple font-mono"
            >
              {name}
              <button
                type="button"
                aria-label={`Remove skill ${name}`}
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
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-ps-surface-panel border border-ps-edge-hairline rounded-ps-md shadow-xl overflow-hidden">
          <div className="p-2 border-b border-ps-edge-hairline">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ps-viz-glyph-idle" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search skills..." aria-label="Skill search"
                autoFocus
                className="w-full bg-ps-surface-inset border border-ps-edge rounded-ps-md pl-8 pr-3 py-1.5 text-micro text-ps-text-primary placeholder-ps-text-muted font-mono"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-neon-purple" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-body text-ps-text-muted text-center py-4">
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
                  className={`w-full text-left px-3 py-2.5 text-body hover:bg-ps-surface-raised border-b border-ps-edge last:border-0 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                    value.length >= max ? "cursor-not-allowed" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ps-text-primary">{skill.name}</span>
                    <span className="text-micro font-mono text-ps-text-faint">
                      {skill.category}
                    </span>
                  </div>
                  <div className="text-ps-text-muted text-body mt-0.5 line-clamp-1">
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

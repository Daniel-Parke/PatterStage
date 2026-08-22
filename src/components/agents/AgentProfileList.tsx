// ═══════════════════════════════════════════════════════════════
// AgentProfileList — the profile picker down the left of the page
//
// Extracted verbatim from app/operations/agents/page.tsx. Selection is
// the page's decision; this renders the buttons and calls back.
// Presentation only.
// ═══════════════════════════════════════════════════════════════

"use client";

import { Users } from "lucide-react";
import Badge from "@/components/ui/Badge";
import type { AgentProfile } from "@/types/console";

export default function AgentProfileList({
  profiles,
  selectedProfileId,
  onSelect,
}: {
  profiles: AgentProfile[];
  selectedProfileId: string | null;
  onSelect: (profile: AgentProfile) => void;
}) {
  return (
    <div className="w-full lg:w-64 shrink-0 space-y-2">
      {profiles.map((profile) => {
        const selected = selectedProfileId === profile.id;
        return (
          <button
            key={profile.id}
            type="button"
            onClick={() => onSelect(profile)}
            className={`w-full text-left rounded-xl border p-3 transition-all ${
              selected
                ? profile.isDefault
                  ? "border-cyan-500/50 bg-cyan-500/10"
                  : "border-purple-500/50 bg-purple-500/10"
                : "border-white/10 bg-dark-900/50 hover:border-white/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Users
                className={`w-4 h-4 ${profile.isDefault ? "text-cyan-400" : "text-purple-400"}`}
              />
              <span className="font-semibold text-white text-sm truncate">
                {profile.isDefault ? profile.name.replace(/\s*\(local default\)\s*$/i, "") : profile.name}
              </span>
              {profile.isDefault && <Badge color="cyan" size="sm">Local default</Badge>}
              {profile.syncStatus === "drift" && (
                <Badge color="orange" size="sm">Drift</Badge>
              )}
              {profile.syncStatus === "error" && (
                <Badge color="orange" size="sm">Sync error</Badge>
              )}
            </div>
            {!profile.isDefault && (
              <p className="text-[10px] font-mono text-white/25 mb-1">{profile.id}</p>
            )}
            <p className="text-xs text-white/40 line-clamp-2 mb-2">{profile.description}</p>
            <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono">
              <span>{profile.skillsCount} skills</span>
              <span>·</span>
              <span>{profile.files.length} files</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

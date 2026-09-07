// ═══════════════════════════════════════════════════════════════
// AgentProfileHeader — the selected profile's identity block
//
// Name, description, the edit and delete affordances, the growth panel and
// the note about which file holds what. Presentation only.
//
// The note used to lead the card: three file names, `skills.disabled` and
// `platform_toolsets` were the first thing an operator read about their own
// agent (T-0102, the copy). It is still here, in full, one click away. It
// no longer links to Personalities: that page IS the Identity tab above it
// (decision 11, T-0103), and a link to a redirect is a link to nowhere new.
// ═══════════════════════════════════════════════════════════════

"use client";

import { Pencil, Trash2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import AgentGrowthPanel from "@/components/agents/AgentGrowthPanel";
import type { AgentProfile } from "@/types/console";

export default function AgentProfileHeader({
  profile,
  onEdit,
  onDelete,
}: {
  profile: AgentProfile;
  onEdit: (profile: AgentProfile) => void;
  onDelete: (profileId: string) => void;
}) {
  return (
    <>
      <div className="p-4 border-b border-ps-edge-hairline flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-ps-text-primary">{profile.name}</h2>
            {profile.isDefault && <Badge color="cyan" size="sm">Default</Badge>}
          </div>
          {!profile.isDefault && (
            <p className="text-micro font-mono text-ps-text-muted mt-0.5">slug: {profile.id}</p>
          )}
          <p className="text-body text-ps-text-muted mt-1">{profile.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            color="cyan"
            icon={Pencil}
            onClick={() => onEdit(profile)}
          >
            Edit profile
          </Button>
          {!profile.isDefault && (
            <Button
              variant="ghost"
              size="sm"
              color="orange"
              icon={Trash2}
              onClick={() => onDelete(profile.id)}
            >
              Delete profile
            </Button>
          )}
        </div>
      </div>

      {/* Growth: level + the accumulated signals behind it. */}
      <div className="p-4 border-b border-ps-edge-hairline">
        <AgentGrowthPanel key={profile.id} profileId={profile.id} />
      </div>

      <div className="p-4 border-b border-ps-edge-hairline">
        <p className="text-body text-ps-text-muted">
          This agent&apos;s voice, habits and equipment are files it reads on every run. Open
          one below to change it.
        </p>
        <details className="mt-2 group">
          <summary className="min-h-6.5 cursor-pointer text-body text-neon-cyan hover:underline">
            Which file holds what
          </summary>
          <p className="mt-2 text-micro text-ps-text-muted font-mono">
            Edit <strong className="text-ps-text-secondary">SOUL.md</strong> for voice and identity; the
            Identity tab opens it for you. Use{" "}
            <strong className="text-ps-text-secondary">config.yaml</strong> for skills.disabled and
            platform_toolsets, which the Skills and Tools pages write for you.
          </p>
        </details>
      </div>
    </>
  );
}

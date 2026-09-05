// ═══════════════════════════════════════════════════════════════
// AgentProfileHeader — the selected profile's identity block
//
// Extracted verbatim from app/operations/agents/page.tsx: name, slug,
// description, the delete affordance, the growth panel and the standing
// note about which file holds what. Presentation only.
// ═══════════════════════════════════════════════════════════════

"use client";

import { Trash2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import AgentGrowthPanel from "@/components/agents/AgentGrowthPanel";
import type { AgentProfile } from "@/types/console";

export default function AgentProfileHeader({
  profile,
  onDelete,
}: {
  profile: AgentProfile;
  onDelete: (profileId: string) => void;
}) {
  return (
    <>
      <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-white">{profile.name}</h2>
            {profile.isDefault && <Badge color="cyan" size="sm">Default</Badge>}
          </div>
          {!profile.isDefault && (
            <p className="text-xs font-mono text-ps-text-muted mt-0.5">slug: {profile.id}</p>
          )}
          <p className="text-sm text-ps-text-muted mt-1">{profile.description}</p>
        </div>
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

      {/* Growth: level + the accumulated signals behind it. */}
      <div className="p-4 border-b border-white/10">
        <AgentGrowthPanel key={profile.id} profileId={profile.id} />
      </div>

      <div className="p-4 border-b border-white/10">
        <p className="text-xs text-ps-text-muted font-mono">
          Edit <strong className="text-ps-text-secondary">SOUL.md</strong> for voice and identity.
          Use <strong className="text-ps-text-secondary">config.yaml</strong> for skills.disabled and
          platform_toolsets. Session display presets:{" "}
          <a href="/agent/personalities" className="text-neon-cyan hover:underline">
            Personalities
          </a>
          .
        </p>
      </div>
    </>
  );
}

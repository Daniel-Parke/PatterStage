// ═══════════════════════════════════════════════════════════════
// useProfileAttachables — the skills + toolsets a mission can attach for
// a given profile. Thin useApiResource wrappers so SkillSelector /
// ToolsetSelector stop hand-rolling fetch/loading state in a useEffect.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useApiResource } from "./useApiResource";
import { unionToolsetsFromPlatforms } from "@/lib/hermes-toolset-unify";
import type { PlatformToolsets } from "@/lib/profile-config-builder";
import type { Skill } from "@/types/hermes";

/** Enabled skills available to attach for a profile (defaults to "default"). */
export function useProfileSkills(profileId?: string) {
  const slug = profileId ?? "default";
  return useApiResource<Skill[]>(
    ["profile-skills", slug],
    `/api/skills?profile=${encodeURIComponent(slug)}`,
    {
      select: (payload) => {
        const raw = (payload as { skills?: Skill[] } | undefined)?.skills;
        return Array.isArray(raw) ? raw.filter((s) => s.enabled) : undefined;
      },
      fallback: [],
    },
  );
}

/** Recommended platform toolset ids (unioned across platforms) for a profile. */
export function useProfileToolsets(profileId?: string) {
  const slug = profileId ?? "default";
  return useApiResource<string[]>(
    ["profile-toolsets", slug],
    `/api/agent/profiles/${encodeURIComponent(slug)}/toolsets`,
    {
      select: (payload) => {
        const toolsets = (payload as { platformToolsets?: PlatformToolsets } | undefined)
          ?.platformToolsets;
        return toolsets ? unionToolsetsFromPlatforms(toolsets) : undefined;
      },
      fallback: [],
    },
  );
}

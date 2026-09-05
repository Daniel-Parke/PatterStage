// ═══════════════════════════════════════════════════════════════
// useProfileAttachables — the skills + toolsets a mission can attach for
// a given profile. Thin useApiResource wrappers so SkillSelector /
// ToolsetSelector stop hand-rolling fetch/loading state in a useEffect.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useApiResource } from "./useApiResource";
import type { Skill } from "@/types/console";

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
      // The route already unions across platforms server-side and returns it as
      // `unifiedEnabled` (api/agent/profiles/[id]/toolsets/route.ts:42). Reading
      // it instead of recomputing drops a duplicated implementation of the same
      // fan-in, and with it this hook's only two Hermes imports.
      select: (payload) =>
        (payload as { unifiedEnabled?: string[] } | undefined)?.unifiedEnabled,
      fallback: [],
    },
  );
}

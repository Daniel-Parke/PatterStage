// ═══════════════════════════════════════════════════════════════
// useFeatureFlags — current feature-flag state for client gating.
//
// Used by the sidebar (and any surface) to hide links/buttons for disabled
// features. Flags default ON, so a missing key (or a still-loading fetch) is
// treated as enabled by callers to avoid a flash of hidden nav.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useApiResource } from "./useApiResource";

export type FeatureFlagMap = Record<string, boolean>;

export function useFeatureFlags() {
  return useApiResource<FeatureFlagMap>(["feature-flags"], "/api/feature-flags", {
    select: (p) => (p as { flags?: FeatureFlagMap } | undefined)?.flags,
    fallback: {},
    staleTime: 60_000,
  });
}

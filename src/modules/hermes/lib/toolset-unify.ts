// ═══════════════════════════════════════════════════════════════
// toolset-unify.ts — Unified per-profile toolset helpers
// ═══════════════════════════════════════════════════════════════

import { HERMES_PLATFORMS } from "./toolset-catalog";
import type { PlatformToolsets } from "./profile-config-builder";

/** Sort + dedupe an array of strings. */
export function sortedUnique(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
}

/** Union of toolset IDs enabled across all platforms (for unified UI). */
export function unionToolsetsFromPlatforms(toolsets: PlatformToolsets): string[] {
  const seen = new Set<string>();
  for (const list of Object.values(toolsets)) {
    for (const id of list) {
      seen.add(id);
    }
  }
  return sortedUnique([...seen]);
}

function normalizeListsForCompare(toolsets: PlatformToolsets): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [platform, list] of Object.entries(toolsets)) {
    out[platform] = sortedUnique(list).join(",");
  }
  return out;
}

/** True when any two platforms have different enabled toolsets. */
export function platformsDiffer(toolsets: PlatformToolsets): {
  diverged: boolean;
  platforms: string[];
} {
  const keys = Object.keys(toolsets).filter((k) => (toolsets[k]?.length ?? 0) > 0);
  if (keys.length <= 1) {
    return { diverged: false, platforms: [] };
  }
  const normalized = normalizeListsForCompare(toolsets);
  const firstKey = keys[0];
  const firstSig = normalized[firstKey] ?? "";
  const divergedPlatforms = keys.filter((k) => (normalized[k] ?? "") !== firstSig);
  if (divergedPlatforms.length === 0) {
    return { diverged: false, platforms: [] };
  }
  return { diverged: true, platforms: keys };
}

/** Fan the same toolset list to every PatterStage platform key (Hermes "configure all"). */
export function expandUnifiedToAllPlatforms(enabledIds: string[]): PlatformToolsets {
  const list = sortedUnique(enabledIds);
  const out: PlatformToolsets = {};
  for (const platform of HERMES_PLATFORMS) {
    out[platform.id] = [...list];
  }
  return out;
}

/**
 * When advanced per-platform edits exist, start from unified expansion then
 * overlay platform-specific lists from `perPlatform`.
 */
export function mergeAdvancedOverrides(
  unifiedEnabled: string[],
  perPlatform: PlatformToolsets,
): PlatformToolsets {
  const base = expandUnifiedToAllPlatforms(unifiedEnabled);
  for (const platform of HERMES_PLATFORMS) {
    const override = perPlatform[platform.id];
    if (override && override.length > 0) {
      base[platform.id] = sortedUnique(override);
    }
  }
  return base;
}

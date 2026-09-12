// ═══════════════════════════════════════════════════════════════
// toolset-normalize.ts — Canonical platform_toolsets shapes
// ═══════════════════════════════════════════════════════════════
// Hermes CLI may persist granular toolset IDs alongside hermes-cli.
// Store compact lists: dedupe per platform; drop entries subsumed by hermes-cli.

import type { PlatformToolsets } from "./profile-config-builder";
import { sortedUnique } from "@/modules/hermes/lib/toolset-unify";

/** Toolset names commonly expanded when hermes-cli is saved from `hermes tools`. */
export const HERMES_CLI_SUBSUMED = new Set([
  "browser",
  "clarify",
  "code_execution",
  "cronjob",
  "delegation",
  "file",
  "image_gen",
  "memory",
  "messaging",
  "session_search",
  "skills",
  "terminal",
  "todo",
  "vision",
  "web",
]);

export const PLATFORM_BUNDLE_PREFIX = "hermes-";

function normalizePlatformList(toolsets: string[]): string[] {
  const deduped = sortedUnique(toolsets);
  const hasHermesCli = deduped.includes("hermes-cli");
  if (!hasHermesCli) {
    return deduped;
  }

  const platformBundles = deduped.filter((name) => name.startsWith(PLATFORM_BUNDLE_PREFIX));
  const granular = deduped.filter((name) => !name.startsWith(PLATFORM_BUNDLE_PREFIX));
  const redundant = granular.every((name) => HERMES_CLI_SUBSUMED.has(name));
  if (redundant && granular.length > 0) {
    return sortedUnique(platformBundles.length > 0 ? platformBundles : ["hermes-cli"]);
  }

  const withoutSubsumed = deduped.filter(
    (name) => name.startsWith(PLATFORM_BUNDLE_PREFIX) || !HERMES_CLI_SUBSUMED.has(name),
  );
  return sortedUnique(withoutSubsumed);
}

export function normalizePlatformToolsets(toolsets: PlatformToolsets): PlatformToolsets {
  const out: PlatformToolsets = {};
  for (const platform of Object.keys(toolsets).sort()) {
    const normalized = normalizePlatformList(toolsets[platform]);
    if (normalized.length > 0) {
      out[platform] = normalized;
    }
  }
  return out;
}

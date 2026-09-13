// ═══════════════════════════════════════════════════════════════
// toolset-coverage.ts — which bundle already provides a toolset
// ═══════════════════════════════════════════════════════════════
//
// The Tools grid used to offer every toolset as an independent switch. Beside
// an enabled hermes-cli that is a control that cannot be honest: the click
// registers, Save reports success, and the reload shows the toolset off again,
// because the write path drops what the bundle already contains (T-0103, D80).
//
// The rule is the normaliser's own, read the other way round. Deriving it from
// the same constant is the point: two lists that can drift apart is exactly
// how a button ends up turning itself off.

import { HERMES_CLI_SUBSUMED, PLATFORM_BUNDLE_PREFIX } from "./toolset-normalize";

/**
 * The bundle in `enabled` that already provides `toolsetId`, or null.
 *
 * A bundle never covers itself, and covers nothing outside its own contents.
 */
export function bundleCovering(enabled: string[], toolsetId: string): string | null {
  if (toolsetId.startsWith(PLATFORM_BUNDLE_PREFIX)) return null;
  if (enabled.includes("hermes-cli") && HERMES_CLI_SUBSUMED.has(toolsetId)) return "hermes-cli";
  return null;
}

// ═══════════════════════════════════════════════════════════════
// feature-flags-guard.ts — server-component / route guard.
//
// Kept separate from feature-flags.ts so the pure flag logic stays free of a
// next/navigation import (the engine + jest import feature-flags directly),
// and AT THE LIB ROOT ON PURPOSE (C7, T-0144), beside the flags it guards,
// which belong to no domain because every layer reads them.
// ═══════════════════════════════════════════════════════════════

import { notFound } from "next/navigation";

import { isFeatureEnabled, type FeatureFlag } from "./feature-flags";

/** 404 the current page/route when its feature flag is disabled. */
export function requireFeatureOr404(flag: FeatureFlag): void {
  if (!isFeatureEnabled(flag)) notFound();
}

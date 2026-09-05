// ═══════════════════════════════════════════════════════════════
// GET /api/feature-flags — current feature-flag state for the client.
//
// Lets client components (e.g. the sidebar) hide links + surfaces for
// disabled features without a rebuild. Flags default ON; see feature-flags.ts.
// ═══════════════════════════════════════════════════════════════

import { ok } from "@/lib/api-response";
import { getFeatureFlags } from "@/lib/feature-flags";

export function GET() {
  return ok({ flags: getFeatureFlags() });
}

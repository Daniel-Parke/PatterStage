// ═══════════════════════════════════════════════════════════════
// GET /api/feature-flags — current feature-flag state for the client.
//
// Lets client components (e.g. the sidebar) hide links + surfaces for
// disabled features without a rebuild. Flags default ON; see feature-flags.ts.
// ═══════════════════════════════════════════════════════════════

import { guardRoute } from "@/lib/api/response-route";
import { ok } from "@/lib/api/api-response";
import { getFeatureFlags } from "@/lib/feature-flags";

function GETImpl() {
  return ok({ flags: getFeatureFlags() });
}

export const GET = guardRoute(GETImpl);

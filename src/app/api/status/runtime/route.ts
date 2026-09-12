// GET /api/status/runtime: how this install is configured, as data (T-0097,
// D109). The facts and the rule that none of them is a secret live in
// @/lib/status/runtime-status; this binds them to the route and supplies the
// one fact core cannot read itself, the agent's home (ADR-0005).

import { ok } from "@/lib/api/api-response";
import { collectRuntimeStatus } from "@/lib/status/runtime-status";
import { getActiveHermesHome } from "@/modules/hermes/lib/agent-runtime";
import { route } from "@/lib/api/api-route";

export const GET = route("GET /api/status/runtime", "reading the runtime status", "Failed to read the runtime status", async () => {
  return ok(collectRuntimeStatus({ hermesHome: getActiveHermesHome() }));
});

// GET /api/status/subsystems: is each thing this product depends on up, and
// why not (T-0091). Five rows with a state in words and a reason a person can
// act on. The rules live in @/lib/status/subsystems; this binds the live
// dependencies and answers.

import { ok } from "@/lib/api/api-response";
import { ensureSyncLayer } from "@/lib/sync";
import { collectSubsystems, liveSubsystemDeps } from "@/lib/status/subsystems";
import { route } from "@/lib/api/api-route";

export const GET = route("GET /api/status/subsystems", "collecting", "Failed to check subsystems", async () => {
  // The sync row reads the scheduler's last cycle; make sure one exists to
  // read, the way /api/monitor and /api/status already do.
  ensureSyncLayer();
  return ok(await collectSubsystems(liveSubsystemDeps()));
});

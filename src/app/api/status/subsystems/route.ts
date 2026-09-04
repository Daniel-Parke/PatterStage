// GET /api/status/subsystems: is each thing this product depends on up, and
// why not (T-0091). Five rows with a state in words and a reason a person can
// act on. The rules live in @/lib/status/subsystems; this binds the live
// dependencies and answers.

import { serverErrorFromCatch } from "@/lib/api-logger";
import { ok } from "@/lib/api-response";
import { ensureSyncLayer } from "@/lib/sync";
import { collectSubsystems, liveSubsystemDeps } from "@/lib/status/subsystems";

export async function GET() {
  try {
    // The sync row reads the scheduler's last cycle; make sure one exists to
    // read, the way /api/monitor and /api/status already do.
    ensureSyncLayer();
    return ok(await collectSubsystems(liveSubsystemDeps()));
  } catch (error) {
    return serverErrorFromCatch("GET /api/status/subsystems", "collecting", error, "Failed to check subsystems");
  }
}

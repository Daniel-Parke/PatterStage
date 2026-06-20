// Playwright global setup: give E2E an isolated, fresh PatterStage data dir so
// runs are deterministic and independent of the developer's working DB.
import { rmSync } from "fs";
import { join } from "path";

export const E2E_DATA_DIR = join(process.cwd(), "tmp", "e2e-data");

export default async function globalSetup() {
  // Best-effort wipe. A leftover dev server may still hold the SQLite WAL lock
  // (Windows EPERM); in that case we proceed against the existing dir rather
  // than crashing the run.
  try {
    rmSync(E2E_DATA_DIR, { recursive: true, force: true });
  } catch (err) {
    console.warn(`[e2e global-setup] could not wipe ${E2E_DATA_DIR}:`, (err as Error).message);
  }
}

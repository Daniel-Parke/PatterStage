/** @jest-environment node */
import * as fs from "fs";
import * as path from "path";

import {
  HARDWARE_CRON_PRESET_SCRIPT_FILES,
  HARDWARE_CRON_UI_PRESETS,
} from "@/lib/hardware-cron";

describe("system cron backup preset", () => {
  it("includes Backup ch-backup.sh in UI presets", () => {
    const backup = HARDWARE_CRON_UI_PRESETS.find((p) => p.file === "ch-backup.sh");
    expect(backup).toBeDefined();
    expect(backup?.label).toBe("Backup");
  });

  it("ships ch-backup.sh next to other preset scripts", () => {
    expect(HARDWARE_CRON_PRESET_SCRIPT_FILES).toContain("ch-backup.sh");
    const abs = path.join(process.cwd(), "scripts", "hardware", "ch-backup.sh");
    expect(fs.existsSync(abs)).toBe(true);
  });
});

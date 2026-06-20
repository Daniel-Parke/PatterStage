/** @jest-environment node */
import * as fs from "fs";
import * as path from "path";

import {
  HARDWARE_CRON_PRESET_SCRIPT_FILES,
  HARDWARE_CRON_UI_PRESETS,
} from "@/lib/hardware-cron";

describe("system cron backup preset", () => {
  it("includes Backup ps-backup.sh in UI presets", () => {
    const backup = HARDWARE_CRON_UI_PRESETS.find((p) => p.file === "ps-backup.sh");
    expect(backup).toBeDefined();
    expect(backup?.label).toBe("Backup");
  });

  it("ships ps-backup.sh under scripts/hardware", () => {
    expect(HARDWARE_CRON_PRESET_SCRIPT_FILES).toEqual(["ps-backup.sh"]);
    const abs = path.join(process.cwd(), "scripts", "hardware", "ps-backup.sh");
    expect(fs.existsSync(abs)).toBe(true);
  });
});

/** @jest-environment node */
import { existsSync } from "fs";
import { join } from "path";

import { HARDWARE_CRON_UI_PRESETS, HARDWARE_CRON_PRESET_SCRIPT_FILES } from "@/lib/hardware-cron";
import { isWindows } from "@/lib/platform";

describe("hardware cron presets", () => {
  it("every preset script file is shipped under scripts/hardware", () => {
    expect(HARDWARE_CRON_PRESET_SCRIPT_FILES.length).toBeGreaterThan(0);
    for (const file of HARDWARE_CRON_PRESET_SCRIPT_FILES) {
      expect(existsSync(join(process.cwd(), "scripts", "hardware", file))).toBe(true);
    }
  });

  it("preset script-file list matches the UI preset count", () => {
    expect(HARDWARE_CRON_PRESET_SCRIPT_FILES.length).toBe(HARDWARE_CRON_UI_PRESETS.length);
  });

  it("the Hindsight backup (bash, Linux-only) is offered on Unix only", () => {
    const hasHindsight = HARDWARE_CRON_UI_PRESETS.some((p) => p.file === "ps-backup.sh");
    expect(hasHindsight).toBe(!isWindows);
  });
});

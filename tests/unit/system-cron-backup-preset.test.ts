/** @jest-environment node */
import { existsSync } from "fs";
import { join } from "path";

import { HARDWARE_CRON_UI_PRESETS } from "@/lib/host/hardware-cron";
import { isWindows } from "@/lib/host/platform";

describe("hardware cron presets", () => {
  it("every preset script file is shipped under scripts/hardware", () => {
    const files = HARDWARE_CRON_UI_PRESETS.map(preset => preset.file);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(existsSync(join(process.cwd(), "scripts", "hardware", file))).toBe(true);
    }
  });

  it("the Hindsight backup (bash, Linux-only) is offered on Unix only", () => {
    const hasHindsight = HARDWARE_CRON_UI_PRESETS.some((p) => p.file === "ps-backup.sh");
    expect(hasHindsight).toBe(!isWindows);
  });
});

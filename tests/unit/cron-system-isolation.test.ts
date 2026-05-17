/** @jest-environment node */
import { getChScriptsDir, getChHardwareLogDir, CH_DATA_DIR } from "@/lib/paths";

describe("system cron paths (CH-owned)", () => {
  it("uses CH_DATA_DIR/scripts and CH_DATA_DIR/logs by default", () => {
    expect(getChScriptsDir()).toBe(CH_DATA_DIR + "/scripts");
    expect(getChHardwareLogDir()).toBe(CH_DATA_DIR + "/logs");
  });
});

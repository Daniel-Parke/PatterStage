/** @jest-environment node */
import { getPsScriptsDir, getPsHardwareLogDir, PS_DATA_DIR } from "@/lib/paths";

describe("system cron paths (CH-owned)", () => {
  it("uses PS_DATA_DIR/scripts and PS_DATA_DIR/logs by default", () => {
    expect(getPsScriptsDir()).toBe(PS_DATA_DIR + "/scripts");
    expect(getPsHardwareLogDir()).toBe(PS_DATA_DIR + "/logs");
  });
});

/** @jest-environment node */

import { existsSync } from "node:fs";
import { join } from "node:path";

const repositoryRoot = join(__dirname, "..", "..");
const retiredHardwareNames = [
  "db-backup", "disk-report", "health-check", "log-rotate", "system-report",
] as const;

describe("T-0187 ruled tool retirement", () => {
  it.each(retiredHardwareNames)("retires the repository ch-%s.sh shim", (name) => {
    expect(existsSync(join(repositoryRoot, "scripts", "hardware", `ch-${name}.sh`))).toBe(false);
  });

  it.each(retiredHardwareNames)("retains the same-directory ps-%s.sh twin", (name) => {
    expect(existsSync(join(repositoryRoot, "scripts", "hardware", `ps-${name}.sh`))).toBe(true);
  });

  it("retains the separately ruled ch-backup.sh script", () => {
    expect(existsSync(join(repositoryRoot, "scripts", "hardware", "ch-backup.sh"))).toBe(true);
  });

  it("retires the refused Session 0 EOS compiler", () => {
    expect(existsSync(join(repositoryRoot, "scripts", "tooling", "eos-compile.mjs"))).toBe(false);
  });
});

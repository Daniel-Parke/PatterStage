/** @jest-environment node */

import { runLegacyEnvLoader, type LegacyEnvLoader } from "../helpers/legacy-env-loader";

const legacyLogDirectory = "private-legacy-log-directory";
const secretValue = "private-signing-secret";

function runHardwareLogLoader(loader: LegacyEnvLoader, contents: string, expectedDirectory: string): string[] {
  return runLegacyEnvLoader(
    loader,
    contents,
    "hardware-log-directory",
    expectedDirectory,
    ["CH_HARDWARE_LOG_DIR", "PS_HARDWARE_LOG_DIR", "PS_REQUEST_SIGNING_SECRET"],
    {
      // These are the raw non-empty fallback expressions used by the Node and
      // Bash ps-log-rotate consumers. Neither consumer is executed here.
      nodeExpression: 'process.env.PS_HARDWARE_LOG_DIR || "fallback-logs"',
      bashSelection: 'selected="${PS_HARDWARE_LOG_DIR:-fallback-logs}"',
    },
  );
}

describe.each<LegacyEnvLoader>(["node", "bash"])("T-0187 %s hardware log provenance", (loader) => {
  it("selects a later whitespace canonical directory without a legacy warning", () => {
    const lines = runHardwareLogLoader(
      loader,
      `CH_HARDWARE_LOG_DIR=${legacyLogDirectory}\nPS_HARDWARE_LOG_DIR=   \nPS_REQUEST_SIGNING_SECRET=${secretValue}\n`,
      "   ",
    );

    expect(lines).toEqual([]);
  });

  it("warns once when the legacy hardware log directory wins", () => {
    const lines = runHardwareLogLoader(
      loader,
      `CH_HARDWARE_LOG_DIR=${legacyLogDirectory}\nPS_REQUEST_SIGNING_SECRET=${secretValue}\n`,
      legacyLogDirectory,
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("CH_HARDWARE_LOG_DIR");
    expect(lines[0]).toContain("PS_HARDWARE_LOG_DIR");
    expect(lines[0]).not.toContain(legacyLogDirectory);
    expect(lines[0]).not.toContain(secretValue);
  });
});

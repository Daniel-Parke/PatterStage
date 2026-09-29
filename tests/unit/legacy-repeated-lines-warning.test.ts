/** @jest-environment node */

import { runLegacyEnvLoader } from "../helpers/legacy-env-loader";

const clearedKeys = ["PS_DATA_DIR", "CH_DATA_DIR", "CONTROL_HUB_DATA_DIR"] as const;

function runBash(contents: string, selectedValue: string): string[] {
  return runLegacyEnvLoader(
    "bash", contents, "PS_DATA_DIR", selectedValue, clearedKeys,
    {
      nodeExpression: "process.env.PS_DATA_DIR || process.env.CH_DATA_DIR || process.env.CONTROL_HUB_DATA_DIR",
      // ps_data_dir and the setup data-root reader use this same nonempty-key order.
      bashSelection: 'source scripts/lib/ps-env.sh\nselected="$(ps_data_dir)"',
    },
  );
}

describe("T-0187 Git Bash repeated .env.local lines", () => {
  it("warns once when an empty final PS_DATA_DIR restores the earlier CH_DATA_DIR winner", () => {
    const warnings = runBash(
      "CH_DATA_DIR=legacy-dir\nPS_DATA_DIR=chosen-dir\nPS_DATA_DIR=\n", "legacy-dir",
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("CH_DATA_DIR");
    expect(warnings[0]).toContain("PS_DATA_DIR");
    expect(warnings[0]).not.toContain("legacy-dir");
    expect(warnings[0]).not.toContain("chosen-dir");
  });

  it("names a repeated winning CH_DATA_DIR pair only once in one warning", () => {
    const warnings = runBash("CH_DATA_DIR=winner-dir\nPS_DATA_DIR=\nCH_DATA_DIR=winner-dir\n", "winner-dir");
    expect(warnings).toHaveLength(1);
    expect(warnings[0].match(/CH_DATA_DIR/g)).toHaveLength(1);
    expect(warnings[0].match(/PS_DATA_DIR/g)).toHaveLength(1);
    expect(warnings[0]).not.toContain("winner-dir");
  });

  it("keeps the final canonical value and emits no legacy warning", () => {
    const warnings = runBash("CH_DATA_DIR=legacy-dir\nPS_DATA_DIR=\nPS_DATA_DIR=chosen-dir\n", "chosen-dir");
    expect(warnings).toEqual([]);
  });
});

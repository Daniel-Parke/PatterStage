/** @jest-environment node */

import { runLegacyEnvLoader } from "../helpers/legacy-env-loader";

const legacyPath = "C:/private/legacy-data-sentinel";
const canonicalPath = "C:/private/canonical-data-sentinel";

function runNodeLoader(contents: string, expectedPath: string): string[] {
  return runLegacyEnvLoader(
    "node",
    contents,
    "PS_DATA_DIR",
    expectedPath,
    ["PS_DATA_DIR", "CH_DATA_DIR", "CONTROL_HUB_DATA_DIR"],
    {
      nodeExpression: "process.env.PS_DATA_DIR || process.env.CH_DATA_DIR || process.env.CONTROL_HUB_DATA_DIR || ''",
      bashSelection: 'selected=""',
    },
  );
}

describe("T-0187 Node .env.local bridge line order", () => {
  it("warns once with keys only when later CH_DATA_DIR supplies an empty PS_DATA_DIR", () => {
    const warnings = runNodeLoader(`PS_DATA_DIR=\nCH_DATA_DIR=${legacyPath}\n`, legacyPath);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("CH_DATA_DIR → PS_DATA_DIR");
    expect(warnings[0]).not.toContain(legacyPath);
    expect(warnings[0]).not.toContain(canonicalPath);
  });

  it("keeps an earlier nonempty PS_DATA_DIR when CH_DATA_DIR appears later", () => {
    const warnings = runNodeLoader(
      `PS_DATA_DIR=${canonicalPath}\nCH_DATA_DIR=${legacyPath}\n`, canonicalPath,
    );

    expect(warnings).toEqual([]);
  });
});

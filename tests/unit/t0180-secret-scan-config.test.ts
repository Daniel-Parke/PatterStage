/** @jest-environment node */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");

describe("T-0180 full-history secret scan contract", () => {
  it("loads default rules without excluding the test tree", () => {
    const config = readFileSync(join(root, ".gitleaks.toml"), "utf8");
    expect(config).toMatch(/\[extend\]\s*useDefault\s*=\s*true/);
    expect(config).not.toMatch(/disabledRules\s*=/);
    expect(config).not.toMatch(/\bpaths\s*=/);
  });

  it("retains only exact reviewed historical fingerprints", () => {
    const ignorePath = join(root, ".gitleaksignore");
    expect(existsSync(ignorePath)).toBe(true);
    if (!existsSync(ignorePath)) return;
    const fingerprints = readFileSync(ignorePath, "utf8").split(/\r?\n/)
      .map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
    expect(fingerprints).toHaveLength(10);
    expect(new Set(fingerprints).size).toBe(10);
    for (const fingerprint of fingerprints) {
      expect(fingerprint).toMatch(/^[a-f0-9]{40}:[^\s:]+:generic-api-key:[1-9]\d*$/);
    }
  });

  it("pins the hosted scanner and runs its planted-secret control", () => {
    const workflow = readFileSync(join(root, ".github/workflows/gitleaks.yml"), "utf8");
    expect(workflow).toMatch(/fetch-depth:\s*0/);
    expect(workflow).toMatch(/GITLEAKS_CONFIG:\s*\.gitleaks\.toml/);
    expect(workflow).toMatch(/GITLEAKS_VERSION:\s*8\.30\.1/);
    expect(workflow).toContain("tests/security/secret-scan-canary.mjs");
  });
});

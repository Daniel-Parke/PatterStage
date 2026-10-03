import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";

type Update = {
  "package-ecosystem": string;
  directory: string;
  "target-branch": string;
  schedule: { interval: string };
  "open-pull-requests-limit"?: number;
  ignore?: Array<{ "dependency-name": string; "update-types": string[] }>;
};

const configPath = join(__dirname, "..", "..", ".github", "dependabot.yml");
const config = yaml.load(readFileSync(configPath, "utf8")) as {
  version: number;
  updates: Update[];
};

describe("T-0173 temporary Dependabot version-PR pause", () => {
  it("defines only npm and GitHub Actions weekly updates targeting dev", () => {
    expect(config.version).toBe(2);
    expect(config.updates).toHaveLength(2);
    expect(config.updates.map((update) => update["package-ecosystem"]).sort()).toEqual([
      "github-actions",
      "npm",
    ]);
    for (const update of config.updates) {
      expect(update.directory).toBe("/");
      expect(update["target-branch"]).toBe("dev");
      expect(update.schedule.interval).toBe("weekly");
    }
  });

  it("sets the npm version-update PR limit to zero", () => {
    const npm = config.updates.find((update) => update["package-ecosystem"] === "npm");
    expect(npm?.["open-pull-requests-limit"]).toBe(0);
  });

  it("sets the GitHub Actions version-update PR limit to zero", () => {
    const actions = config.updates.find(
      (update) => update["package-ecosystem"] === "github-actions",
    );
    expect(actions?.["open-pull-requests-limit"]).toBe(0);
  });

  it("preserves the four npm major-version ignore rules", () => {
    const npm = config.updates.find((update) => update["package-ecosystem"] === "npm");
    expect(npm?.ignore).toEqual([
      { "dependency-name": "eslint", "update-types": ["version-update:semver-major"] },
      { "dependency-name": "@types/node", "update-types": ["version-update:semver-major"] },
      { "dependency-name": "typescript", "update-types": ["version-update:semver-major"] },
      { "dependency-name": "cross-env", "update-types": ["version-update:semver-major"] },
    ]);
  });
});

/** @jest-environment node */

import { readDependencyOracleFiles } from "../helpers/dependency-oracle-types";

const { manifest, lockfile } = readDependencyOracleFiles(__dirname);

describe("T-0178 Playwright proposal", () => {
  it("accepts the Playwright 1.62.1 manifest range", () => {
    expect(manifest.devDependencies["@playwright/test"]).toBe("^1.62.1");
  });

  it("keeps the Playwright 1.62.1 range in the root lockfile", () => {
    expect(lockfile.packages[""]?.devDependencies?.["@playwright/test"]).toBe("^1.62.1");
    expect(lockfile.packages[""]?.dependencies).toEqual(manifest.dependencies);
    expect(lockfile.packages[""]?.devDependencies).toEqual(manifest.devDependencies);
  });

  it.each(["@playwright/test", "playwright", "playwright-core"])(
    "resolves %s at Playwright 1.62.1 in the lockfile",
    (name) => {
      expect(lockfile.packages[`node_modules/${name}`]?.version).toBe("1.62.1");
    },
  );
});

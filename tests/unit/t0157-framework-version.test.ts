/** @jest-environment node */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");
const readJson = (path: string) => JSON.parse(readFileSync(join(root, path), "utf8")) as Record<string, unknown>;

describe("T-0157 ruled framework pair", () => {
  it("pins Next at the operator's verified security candidate", () => {
    const manifest = readJson("package.json");
    expect((manifest.dependencies as Record<string, string>).next).toBe("16.3.6");
  });

  it("pins eslint-config-next to the same release", () => {
    const manifest = readJson("package.json");
    expect((manifest.devDependencies as Record<string, string>)["eslint-config-next"]).toBe("16.3.6");
  });

  it("installs the declared Next release", () => {
    expect(readJson("node_modules/next/package.json").version).toBe("16.3.6");
  });

  it("installs the matching ESLint configuration release", () => {
    expect(readJson("node_modules/eslint-config-next/package.json").version).toBe("16.3.6");
  });
});

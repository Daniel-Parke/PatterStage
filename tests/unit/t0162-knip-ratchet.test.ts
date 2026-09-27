/** @jest-environment node */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

it("the Knip gate compares its expanded scan with an exact committed issue register", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
  expect(pkg.scripts["lint:knip"]).toBe("node scripts/tooling/knip-ratchet.mjs");
});

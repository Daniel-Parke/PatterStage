/** @jest-environment node */

// T-0092, finding F from this device's browser pass: the boot log said "Set
// PS_DATA_DIR explicitly if this is the wrong directory" on an instance whose
// PS_DATA_DIR was set explicitly. The warning exists for the discovery case,
// where PatterStage guessed; when the operator chose, there is nothing to
// warn about and the advice is wrong.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const home = mkdtempSync(join(tmpdir(), "ps-paths-home-"));
jest.mock("os", () => ({ ...(jest.requireActual("os") as object), homedir: () => home }));

import { shadowedDataWarning, getDbPath } from "@/lib/paths";

const SAVED = ["PS_DATA_DIR", "CH_DATA_DIR", "CONTROL_HUB_DATA_DIR"].map((k) => [k, process.env[k]] as const);
const active = join(home, "chosen", "data");

beforeAll(() => {
  // A big sibling DB where discovery would look, and a tiny active one.
  const sibling = join(home, "control-hub", "data");
  mkdirSync(sibling, { recursive: true });
  writeFileSync(getDbPath(sibling), Buffer.alloc(600 * 1024));
  mkdirSync(active, { recursive: true });
  writeFileSync(getDbPath(active), Buffer.alloc(1024));
});
afterAll(() => {
  rmSync(home, { recursive: true, force: true });
  for (const [k, v] of SAVED) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});
beforeEach(() => { for (const [k] of SAVED) delete process.env[k]; });

it("warns when the directory was discovered and a bigger sibling exists", () => {
  const w = shadowedDataWarning(active);
  expect(w).toMatch(/looks emptier/);
  expect(w).toMatch(/Set PS_DATA_DIR explicitly/);
});

it("stays quiet when PS_DATA_DIR was set explicitly", () => {
  process.env.PS_DATA_DIR = active;
  expect(shadowedDataWarning(active)).toBeNull();
});

it("stays quiet for the legacy names too", () => {
  process.env.CH_DATA_DIR = active;
  expect(shadowedDataWarning(active)).toBeNull();
});

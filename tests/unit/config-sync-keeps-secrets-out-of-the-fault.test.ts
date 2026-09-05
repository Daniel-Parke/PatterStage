/** @jest-environment node */

// T-0086: a YAMLException carries a code-frame of the file around the fault.
// ConfigSync logged it AND stored it as config.yaml_error, which the monitor
// route carries to the dashboard. A real config.yaml holds api_key lines, and
// the round-6 proof showed the frame in the server log. Same ruling as
// T-0060's PUT refusal: first line only, everywhere downstream.

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const scratch = mkdtempSync(join(tmpdir(), "ps-configsync-hygiene-"));
const hermes = join(scratch, "hermes");

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: () => ({ root: hermes, config: join(hermes, "config.yaml"), backups: join(hermes, "backups") }),
  getActiveHermesHome: () => hermes,
  getHermesDefaultRoot: () => hermes,
}));
const stats: Record<string, string>[] = [];
jest.mock("@/lib/system-repository", () => ({
  setMultipleStats: (s: Record<string, string>) => { stats.push(s); },
  setSystemStat: jest.fn(),
  getSystemStat: jest.fn(),
}));

import { ConfigSync } from "@/modules/hermes/sync/ConfigSync";

beforeEach(() => {
  stats.length = 0;
  rmSync(hermes, { recursive: true, force: true });
  mkdirSync(hermes, { recursive: true });
});
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

it("FUSE: the sync reads under the scratch dir", async () => {
  const rt = await import("@/modules/hermes/lib/agent-runtime");
  expect(rt.getActiveHermesPaths().config).toContain("ps-configsync-hygiene-");
});

it("stores and logs the fault's first line, never the file around it", async () => {
  writeFileSync(
    join(hermes, "config.yaml"),
    "api_key: sk-super-secret\nmodel:\n  a: 1\nmodel:\n  b: 2\n",
    "utf-8",
  );
  const logged: string[] = [];
  const spy = jest.spyOn(console, "error").mockImplementation((...a: unknown[]) => { logged.push(a.map(String).join(" ")); });

  const result = await new ConfigSync().sync();
  spy.mockRestore();

  expect(result.success).toBe(true);
  const stored = stats.map((s) => s["config.yaml_error"]).find(Boolean) ?? "";
  expect(stored).toMatch(/duplicated mapping key/);
  expect(stored).not.toContain("sk-super-secret");
  expect(stored.split("\n")).toHaveLength(1);
  expect(logged.join("\n")).toMatch(/duplicated mapping key/);
  expect(logged.join("\n")).not.toContain("sk-super-secret");
});

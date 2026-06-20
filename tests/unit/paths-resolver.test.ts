// Resolver back-compat: PS_* supersedes CH_*/CONTROL_HUB_*, and the DB filename
// prefers patterstage.db but falls back to a pre-existing control-hub.db so an
// un-migrated install keeps working. See src/lib/paths.ts.

import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { readEnv, getPsDataDir, getDbPath } from "@/lib/paths";

const ENV_KEYS = ["PS_DATA_DIR", "CH_DATA_DIR", "CONTROL_HUB_DATA_DIR"] as const;

describe("paths resolver", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  describe("readEnv", () => {
    it("returns the first non-empty value (new name first)", () => {
      process.env.PS_DATA_DIR = "";
      process.env.CH_DATA_DIR = "   ";
      process.env.CONTROL_HUB_DATA_DIR = "/legacy";
      expect(readEnv(...ENV_KEYS)).toBe("/legacy");
    });
    it("returns undefined when none are set", () => {
      expect(readEnv("PS_NOPE_A", "PS_NOPE_B")).toBeUndefined();
    });
    it("trims surrounding whitespace", () => {
      process.env.PS_DATA_DIR = "  /ps  ";
      expect(readEnv("PS_DATA_DIR")).toBe("/ps");
    });
  });

  describe("getPsDataDir env precedence", () => {
    it("prefers PS_DATA_DIR over the legacy names", () => {
      process.env.PS_DATA_DIR = "/ps";
      process.env.CH_DATA_DIR = "/ch";
      process.env.CONTROL_HUB_DATA_DIR = "/legacy";
      expect(getPsDataDir()).toBe("/ps");
    });
    it("falls back to CH_DATA_DIR, then CONTROL_HUB_DATA_DIR", () => {
      process.env.CH_DATA_DIR = "/ch";
      process.env.CONTROL_HUB_DATA_DIR = "/legacy";
      expect(getPsDataDir()).toBe("/ch");
      delete process.env.CH_DATA_DIR;
      expect(getPsDataDir()).toBe("/legacy");
    });
    it("strips trailing slashes", () => {
      process.env.PS_DATA_DIR = "/ps/data///";
      expect(getPsDataDir()).toBe("/ps/data");
    });
  });

  describe("getDbPath", () => {
    let dir: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), "ps-paths-"));
    });
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it("defaults to patterstage.db when neither file exists (fresh install)", () => {
      expect(getDbPath(dir)).toBe(dir + "/patterstage.db");
    });
    it("prefers patterstage.db when both exist", () => {
      writeFileSync(join(dir, "patterstage.db"), "");
      writeFileSync(join(dir, "control-hub.db"), "");
      expect(getDbPath(dir)).toBe(dir + "/patterstage.db");
    });
    it("falls back to legacy control-hub.db when only it exists (un-migrated)", () => {
      writeFileSync(join(dir, "control-hub.db"), "");
      expect(getDbPath(dir)).toBe(dir + "/control-hub.db");
    });
  });
});

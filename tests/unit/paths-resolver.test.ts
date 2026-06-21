// Resolver back-compat: PS_* supersedes CH_*/CONTROL_HUB_*, and the DB filename
// prefers patterstage.db but falls back to a pre-existing control-hub.db so an
// un-migrated install keeps working. See src/lib/paths.ts.

import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { readEnv, getPsDataDir, getDbPath, resolveDataDir } from "@/lib/paths";

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

  describe("resolveDataDir discovery (no env var set)", () => {
    const home = "/home/u";
    const UPPER = "/home/u/PatterStage/data";
    const LOWER = "/home/u/patterstage/data";
    const LEGACY = "/home/u/control-hub/data";

    it("prefers a dir with a populated DB over an empty one (the case-sensitivity race)", () => {
      // Lowercase dir exists but empty; uppercase dir has the real DB.
      const hasDb = (d: string) => d === UPPER;
      const exists = (d: string) => d === UPPER || d === LOWER;
      expect(resolveDataDir(home, hasDb, exists)).toBe(UPPER);
    });

    it("uses an existing dir when none have a DB yet", () => {
      const hasDb = () => false;
      const exists = (d: string) => d === LOWER;
      expect(resolveDataDir(home, hasDb, exists)).toBe(LOWER);
    });

    it("falls back to the lowercase default when nothing exists (fresh install)", () => {
      expect(resolveDataDir(home, () => false, () => false)).toBe(LOWER);
    });

    it("legacy control-hub dir with a DB wins over a fresh default", () => {
      const hasDb = (d: string) => d === LEGACY;
      expect(resolveDataDir(home, hasDb, (d) => d === LEGACY)).toBe(LEGACY);
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
    it("prefers the populated DB when a stale empty patterstage.db shadows a real control-hub.db", () => {
      writeFileSync(join(dir, "patterstage.db"), ""); // empty stale file
      writeFileSync(join(dir, "control-hub.db"), "x".repeat(4096)); // populated
      expect(getDbPath(dir)).toBe(dir + "/control-hub.db");
    });
  });
});

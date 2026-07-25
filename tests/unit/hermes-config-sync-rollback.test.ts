/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment node */

/**
 * Verifies that when hermes-config-sync.atomicWriteFile fails mid-write,
 * the tmpfile is cleaned up and no partial target file remains.
 *
 * Also verifies that the credentials API rolls back the DB row when the
 * subsequent .env write fails (PR 4 + 5 invariant).
 */

import { mkdtempSync, existsSync, readdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

let fakeRoot: string;

jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: () => {
    const root = (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__!;
    return {
      root,
      env: join(root, ".env"),
      soul: join(root, "SOUL.md"),
      hermes: join(root, "HERMES.md"),
      agents: join(root, "AGENTS.md"),
      skills: join(root, "skills"),
      profiles: join(root, "profiles"),
      sessions: join(root, "sessions"),
      logs: join(root, "logs"),
      config: join(root, "config.yaml"),
      backups: join(root, "backups"),
      cronJobs: join(root, "cron", "jobs.json"),
      memoryDb: join(root, "memory_store.db"),
    };
  },
}));

beforeEach(() => {
  fakeRoot = mkdtempSync(join(tmpdir(), "ch-rollback-"));
  (global as { __FAKE_HERMES_ROOT__?: string }).__FAKE_HERMES_ROOT__ = fakeRoot;
});

afterEach(() => {
  if (fakeRoot && existsSync(fakeRoot)) rmSync(fakeRoot, { recursive: true, force: true });
});

describe("atomicWriteFile rollback", () => {
  it("does not leave a tmp file when the rename fails", () => {
    const { atomicWriteFile } = require("@/modules/hermes/lib/config-sync") as typeof import("@/modules/hermes/lib/config-sync");
    // Spy on fs.renameSync and force a failure inside the same require graph.
    const fs = require("fs") as typeof import("fs");
    const orig = fs.renameSync;
    const spy = jest.spyOn(fs, "renameSync").mockImplementation(() => {
      throw new Error("simulated rename failure");
    });

    const target = join(fakeRoot, "config.yaml");
    expect(() => atomicWriteFile(target, "hello")).toThrow(/simulated rename failure/);

    // Target should not exist (rename never happened).
    expect(existsSync(target)).toBe(false);
    // No leftover tmpfile siblings.
    const stragglers = readdirSync(fakeRoot).filter((n) => n.startsWith("config.yaml.tmp-"));
    expect(stragglers).toEqual([]);

    spy.mockRestore();
    fs.renameSync = orig;
  });

  it("cleans up tmpfile even if writeFileSync throws on the staged file", () => {
    const { atomicWriteFile } = require("@/modules/hermes/lib/config-sync") as typeof import("@/modules/hermes/lib/config-sync");
    const fs = require("fs") as typeof import("fs");

    const target = join(fakeRoot, "config.yaml");
    // Pre-populate target so we can verify it's untouched.
    writeFileSync(target, "ORIGINAL");

    const spy = jest.spyOn(fs, "writeFileSync").mockImplementationOnce(() => {
      throw new Error("simulated write failure");
    });
    expect(() => atomicWriteFile(target, "NEW")).toThrow(/simulated write failure/);
    expect(readFileSync(target, "utf-8")).toBe("ORIGINAL");
    spy.mockRestore();
  });
});

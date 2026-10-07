/** @jest-environment node */
import { mkdtempSync, writeFileSync, readFileSync, openSync, closeSync, renameSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let mockRoot = "";
let mockMode: "normal" | "race" | "refuse" = "normal";
let mockWrite: (() => void) | undefined;
let mockWriterError: unknown;
let mockWriterRan = false;
let mockOpenHandles = 0;
let mockAccessGate: Promise<void> | undefined;
const mockStats: Record<string, string>[] = [];
const replacement = "oracle_replaced: true\n";
function mockQueueWrite() {
  queueMicrotask(() => { mockWriterRan = true; try { mockWrite!(); } catch (error) { mockWriterError = error; } });
}
jest.mock("fs", () => {
  const actual = jest.requireActual<typeof import("fs")>("fs");
  return { ...actual, readFileSync: (...args: unknown[]) => {
    if (args[0] === join(mockRoot, "config.yaml")) {
      if (mockMode === "refuse") throw Object.assign(new Error("owned read refused"), { code: "EACCES" });
      const value = (actual.readFileSync as (...a: unknown[]) => unknown)(...args);
      if (mockMode === "race") mockQueueWrite();
      return value;
    }
    return (actual.readFileSync as (...a: unknown[]) => unknown)(...args);
  } };
});
jest.mock("fs/promises", () => {
  const actual = jest.requireActual<typeof import("fs/promises")>("fs/promises");
  const sync = jest.requireActual<typeof import("fs")>("fs");
  return { ...actual,
    access: async (file: string, mode?: number) => {
      if (file === join(mockRoot, "config.yaml") && mockAccessGate) await mockAccessGate;
      return actual.access(file, mode);
    },
    readFile: (file: string, ...rest: unknown[]) => {
      if (file !== join(mockRoot, "config.yaml") || mockMode === "normal") return (actual.readFile as (...a: unknown[]) => unknown)(file, ...rest);
      if (mockMode === "refuse") return Promise.reject(Object.assign(new Error("owned read refused"), { code: "EACCES" }));
      // Controlled real open descriptor; hold only until the queued writer attempts replacement.
      const fd = sync.openSync(file, "r"); mockOpenHandles++;
      return new Promise<string>((resolve, reject) => queueMicrotask(() => {
        let value: string | undefined, failure: unknown;
        try {
          mockWriterRan = true;
          try { mockWrite!(); } catch (error) { mockWriterError = error; }
          value = sync.readFileSync(fd, "utf8");
        } catch (error) { failure = error; }
        finally { try { sync.closeSync(fd); } finally { mockOpenHandles--; } }
        if (failure) reject(failure); else resolve(value!);
      }));
    },
  };
});
jest.mock("@/modules/hermes/lib/agent-runtime", () => ({ getActiveHermesPaths: () => ({ config: join(mockRoot, "config.yaml"), soul: join(mockRoot, "SOUL.md") }) }));
jest.mock("@/lib/system/system-repository", () => ({ setMultipleStats: (row: Record<string, string>) => mockStats.push(row) }));
jest.mock("@/modules/hermes/lib/agent-root-repository", () => ({ updateAgentRoot: jest.fn() }));
jest.mock("@/lib/config/config-cache", () => ({ invalidateConfigCache: jest.fn() }));
import { ConfigSync } from "@/modules/hermes/sync/ConfigSync";
import { atomicWriteFile } from "@/modules/hermes/lib/hermes-config-write";

beforeEach(() => {
  mockRoot = mkdtempSync(join(tmpdir(), "t0192-config-replacement-"));
  mockMode = "normal"; mockWrite = undefined; mockWriterError = undefined; mockWriterRan = false; mockOpenHandles = 0; mockAccessGate = undefined; mockStats.length = 0;
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { try { expect(mockOpenHandles).toBe(0); } finally { jest.restoreAllMocks(); rmSync(mockRoot, { recursive: true, force: true }); } });

it.each([false, true])("native replacement with open=%s qualifies this platform and closes its descriptor", open => {
  const target = join(mockRoot, "control.yaml"), temporary = target + ".tmp";
  writeFileSync(target, "before\n"); writeFileSync(temporary, replacement);
  const fd = open ? openSync(target, "r") : undefined;
  try {
    if (open && process.platform === "win32") {
      expect(() => renameSync(temporary, target)).toThrow(expect.objectContaining({ code: "EPERM" }));
      expect(readFileSync(target, "utf8")).toBe("before\n");
      expect(readFileSync(temporary, "utf8")).toBe(replacement);
    } else { renameSync(temporary, target); expect(readFileSync(target, "utf8")).toBe(replacement); }
  } finally { if (fd !== undefined) closeSync(fd); }
  if (existsSync(temporary)) { renameSync(temporary, target); expect(readFileSync(target, "utf8")).toBe(replacement); }
});

it("ConfigSync permits a queued atomic replacement without exposing an open read handle across turns", async () => {
  const target = join(mockRoot, "config.yaml");
  writeFileSync(target, "original: true\n"); writeFileSync(join(mockRoot, "SOUL.md"), "owned soul\n");
  mockMode = "race"; mockWrite = () => atomicWriteFile(target, replacement);
  const result = await new ConfigSync().sync();
  mockMode = "normal";
  expect(mockWriterRan).toBe(true);
  expect(mockOpenHandles).toBe(0);
  expect(result).toMatchObject({ sourceName: "config", success: true, syncedCount: 2 });
  expect(mockStats).toEqual([{ "config.present": "true", "config.soul_present": "true", "config.yaml_error": "" }]);
  expect(mockWriterError).toBeUndefined();
  expect(readFileSync(target, "utf8")).toBe(replacement);
});

it.each([false, true])("missing config preserves presence and soul=%s stats", async soul => {
  if (soul) writeFileSync(join(mockRoot, "SOUL.md"), "owned\n");
  expect(await new ConfigSync().sync()).toMatchObject({ success: true, syncedCount: 2 });
  expect(mockStats).toEqual([{ "config.present": "false", "config.soul_present": String(soul), "config.yaml_error": "" }]);
});
it.each([false, true])("valid config preserves presence and soul=%s stats", async soul => {
  writeFileSync(join(mockRoot, "config.yaml"), "valid: true\n");
  if (soul) writeFileSync(join(mockRoot, "SOUL.md"), "owned\n");
  expect(await new ConfigSync().sync()).toMatchObject({ success: true, syncedCount: 2 });
  expect(mockStats).toEqual([{ "config.present": "true", "config.soul_present": String(soul), "config.yaml_error": "" }]);
});
it("malformed YAML stays nonfatal, redacts its frame, deduplicates and resets after valid content", async () => {
  const target = join(mockRoot, "config.yaml"), source = new ConfigSync();
  writeFileSync(target, "valid: true\n"); await source.sync(); mockStats.length = 0;
  const bad = "api_key: independent-sensitive-marker\nmodel: 1\nmodel: 2\n";
  writeFileSync(target, bad);
  expect(await source.sync()).toMatchObject({ success: true, syncedCount: 0 });
  expect(await source.sync()).toMatchObject({ success: true, syncedCount: 0 });
  expect(console.error).toHaveBeenCalledTimes(1);
  for (const row of mockStats) { expect(row["config.yaml_error"]).toMatch(/duplicated mapping key/); expect(row["config.yaml_error"]).not.toContain("\n"); }
  expect(JSON.stringify([mockStats, jest.mocked(console.error).mock.calls])).not.toContain("independent-sensitive-marker");
  writeFileSync(target, "valid: true\n"); await source.sync();
  writeFileSync(target, bad); await source.sync(); expect(console.error).toHaveBeenCalledTimes(2);
});
it("read refusal after successful access remains a failed result without success stats", async () => {
  writeFileSync(join(mockRoot, "config.yaml"), "valid: true\n"); mockMode = "refuse";
  expect(await new ConfigSync().sync()).toMatchObject({ success: false, syncedCount: 0, error: expect.stringContaining("owned read refused") });
  expect(mockStats).toEqual([]); expect(console.error).toHaveBeenCalledTimes(1);
});
it("asynchronous access remains pending while unrelated microtasks progress", async () => {
  writeFileSync(join(mockRoot, "config.yaml"), "valid: true\n");
  let release!: () => void; mockAccessGate = new Promise<void>(resolve => { release = resolve; });
  let finished = false; const work = new ConfigSync().sync().then(result => { finished = true; return result; });
  try { await Promise.resolve(); expect(finished).toBe(false); expect(mockStats).toEqual([]); }
  finally { release(); }
  expect(await work).toMatchObject({ success: true, syncedCount: 2 });
});

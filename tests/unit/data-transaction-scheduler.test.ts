/** @jest-environment node */
// T-0189 independent concurrency oracle: timeouts do not cancel underlying work.
import { SyncScheduler } from "@/lib/sync/SyncScheduler";
import type { SyncResult } from "@/lib/sync/types";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { join } from "path";

let mockConfigRoot = "";
const mockConfigStats: Record<string, string>[] = [];
jest.mock("@/modules/hermes/lib/agent-runtime", () => ({
  getActiveHermesPaths: () => ({ root: mockConfigRoot, config: join(mockConfigRoot, "config.yaml"), backups: join(mockConfigRoot, "backups") }),
  getActiveHermesHome: () => mockConfigRoot,
  getHermesDefaultRoot: () => mockConfigRoot,
}));
jest.mock("@/lib/system/system-repository", () => ({
  setMultipleStats: (stats: Record<string, string>) => { mockConfigStats.push(stats); },
  setSystemStat: jest.fn(), getSystemStat: jest.fn(),
}));
import { ConfigSync } from "@/modules/hermes/sync/ConfigSync";

function deferred() {
  let resolve!: (result: SyncResult) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<SyncResult>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const success = (name = "held"): SyncResult => ({ sourceName: name, success: true, syncedCount: 3, durationMs: 0 });
type Entry = "runOne" | "runAll" | "forceSync";
const entries: Entry[] = ["runOne", "runAll", "forceSync"];
function invoke(scheduler: SyncScheduler, entry: Entry) {
  return entry === "runOne" ? scheduler.runOne("held") : scheduler[entry]();
}
function heldResult(value: unknown): SyncResult | undefined {
  const result = value as SyncResult & { results?: SyncResult[] };
  return result.results ? result.results.find((row) => row.sourceName === "held") : result;
}
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

describe("T-0189 source execution ownership", () => {
  it("actual ConfigSync malformed YAML remains a nonfatal result with a sanitised diagnostic", async () => {
    const parent = join(process.cwd(), "tmp", "t0189-config-fixtures");
    mkdirSync(parent, { recursive: true });
    mockConfigRoot = mkdtempSync(join(parent, "case-"));
    writeFileSync(join(mockConfigRoot, "config.yaml"), "api_key: oracle-fake-key\nmodel:\n  a: 1\nmodel:\n  b: 2\n");
    mockConfigStats.length = 0;
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const result = await new ConfigSync().sync();
      expect(result.success).toBe(true);
      const diagnostic = mockConfigStats.map((row) => row["config.yaml_error"]).find(Boolean) ?? "";
      expect(diagnostic).toMatch(/duplicated mapping key/);
      expect(diagnostic).not.toContain("oracle-fake-key");
      expect(diagnostic.split("\n")).toHaveLength(1);
    } finally { logged.mockRestore(); }
  });
  it.each(entries.flatMap((first) => entries.map((second) => ({ first, second }))))(
    "$first overlapping $second executes one underlying source", async ({ first, second }) => {
      const held = deferred();
      const sync = jest.fn(() => held.promise);
      const scheduler = new SyncScheduler(15000, {}, 1000);
      scheduler.register({ name: "held", sync });
      const work: Promise<unknown>[] = [];
      try {
        work.push(invoke(scheduler, first));
        await jest.advanceTimersByTimeAsync(0);
        expect(sync).toHaveBeenCalledTimes(1);
        work.push(invoke(scheduler, second));
        await jest.advanceTimersByTimeAsync(0);
        expect(sync).toHaveBeenCalledTimes(1);
        expect(scheduler.getRunningSources()).toContain("held");
        held.resolve(success());
        await jest.runAllTimersAsync();
        const results = await Promise.all(work);
        expect(results.map(heldResult)).toEqual([success(), success()]);
      } finally {
        held.resolve(success());
        await jest.runAllTimersAsync();
        await Promise.allSettled(work);
        scheduler.stop();
      }
    },
  );
  it.each(["resolve", "reject"])("timeout retains claim until late %s, preserves timeout observation, then allows retry", async (settlement) => {
    const held = deferred();
    const sync = jest.fn(() => held.promise);
    const scheduler = new SyncScheduler(15000, {}, 40);
    scheduler.register({ name: "held", sync });
    const work: Promise<unknown>[] = [];
    try {
      const first = scheduler.runOne("held");
      work.push(first);
      await jest.advanceTimersByTimeAsync(41);
      expect(await first).toMatchObject({ success: false, error: expect.stringMatching(/timed out/i) });
      const timeoutError = scheduler.getLastErrorBySource().held;
      expect(timeoutError).toMatch(/timed out/i);
      expect(scheduler.getRunningSources()).toContain("held");
      const repeated: unknown[] = [];
      for (const entry of entries) work.push(invoke(scheduler, entry).then((result) => { repeated.push(result); }));
      await jest.advanceTimersByTimeAsync(1);
      expect(sync).toHaveBeenCalledTimes(1);
      expect(repeated).toHaveLength(3);
      expect(repeated.map(heldResult)).toEqual([await first, await first, await first]);
      if (settlement === "resolve") held.resolve(success());
      else held.reject(new Error("late source rejection"));
      await jest.runAllTimersAsync();
      await Promise.allSettled(work);
      expect(scheduler.getRunningSources()).not.toContain("held");
      expect(scheduler.getLastErrorBySource().held).toBe(timeoutError);
      sync.mockResolvedValue(success());
      const retry = scheduler.runOne("held");
      await jest.advanceTimersByTimeAsync(0);
      expect(await retry).toMatchObject({ success: true });
      expect(sync).toHaveBeenCalledTimes(2);
      expect(scheduler.getLastErrorBySource().held).toBeUndefined();
    } finally {
      held.resolve(success());
      await jest.runAllTimersAsync();
      await Promise.allSettled(work);
      scheduler.stop();
    }
  });
  it("different sources progress while one source remains pending", async () => {
    const held = deferred();
    const scheduler = new SyncScheduler(15000, {}, 1000);
    scheduler.register({ name: "held", sync: () => held.promise });
    const quick = jest.fn(async () => success("quick"));
    scheduler.register({ name: "quick", sync: quick });
    const pending = scheduler.runOne("held");
    try {
      const other = scheduler.runOne("quick");
      await jest.advanceTimersByTimeAsync(0);
      expect(await other).toMatchObject({ sourceName: "quick", success: true });
      expect(quick).toHaveBeenCalledTimes(1);
      expect(scheduler.getRunningSources()).toContain("held");
    } finally {
      held.resolve(success());
      await jest.runAllTimersAsync();
      await pending;
      scheduler.stop();
    }
  });
  it.each(entries)("%s retains a resolved failure's error and clears it after success", async (entry) => {
    const scheduler = new SyncScheduler(15000, {}, 1000);
    const sync = jest.fn(async (): Promise<SyncResult> => ({ ...success(), success: false, syncedCount: 0, error: "oracle resolved failure" }));
    scheduler.register({ name: "held", sync });
    try {
      const first = invoke(scheduler, entry);
      await jest.runAllTimersAsync();
      await first;
      expect(scheduler.getLastErrorBySource().held).toBe("oracle resolved failure");
      sync.mockResolvedValue(success());
      const next = scheduler.runOne("held");
      await jest.runAllTimersAsync();
      expect(await next).toMatchObject({ success: true });
      expect(scheduler.getLastErrorBySource().held).toBeUndefined();
    } finally { scheduler.stop(); }
  });
  it("rejection releases the claim and permits a later successful retry", async () => {
    const scheduler = new SyncScheduler(15000, {}, 1000);
    const sync = jest.fn<Promise<SyncResult>, []>().mockRejectedValueOnce(new Error("oracle rejected source")).mockResolvedValue(success());
    scheduler.register({ name: "held", sync });
    try {
      const first = scheduler.runOne("held");
      await jest.runAllTimersAsync();
      expect(await first).toMatchObject({ success: false, error: expect.stringContaining("oracle rejected source") });
      expect(scheduler.getRunningSources()).toEqual([]);
      const retry = scheduler.runOne("held");
      await jest.runAllTimersAsync();
      expect(await retry).toMatchObject({ success: true });
      expect(sync).toHaveBeenCalledTimes(2);
    } finally { scheduler.stop(); }
  });
});

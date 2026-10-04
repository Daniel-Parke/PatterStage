/** @jest-environment node */

// T0194 independent queue oracle, Faraday, 2026-10-04. ADR0019 and the
// operator/Franklin signature agreement precede implementation. All data is owned.
import fs from "node:fs";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { openBaselineDb } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";
import { applyComposerNodeCancelledMigration } from "@/lib/db/apply-composer-node-cancelled-migration";
import type { RunHandle, RunResult, RunSubmit } from "@/lib/runtime/types";
import { HermesRuntime } from "@/lib/runtime/HermesRuntime";
import { inTransaction } from "@/lib/db";
import { createRun, getRun, attachBackendRun, updateRun } from "@/lib/runs/runs-repository";
import {
  createWorkflowFromDef, getWorkflowGraph, createComposerRun, createNodeRun,
  updateComposerRun, updateNodeRun, getComposerRun, getNodeRun,
} from "@/lib/composer/composer-repository";
import { advanceComposerRun, finalizeComposerNodeRun } from "@/lib/composer/engine";
import { cancelComposerRun } from "@/lib/composer/cancel";

let testDb: import("better-sqlite3").Database | null = null;
jest.mock("@/lib/db", () => ({
  ...require("../helpers/baseline-db").dbSingletonMock(() => testDb),
  inTransaction: jest.fn((fn: () => unknown, mode: string = "deferred") => {
    const transaction = testDb!.transaction(fn);
    return mode === "immediate" ? transaction.immediate() : transaction();
  }),
}));
jest.mock("@/lib/runtime", () => ({ runtime: {
  submitRun: jest.fn(), getRun: jest.fn(), stopRun: jest.fn(),
  streamRunEvents: jest.fn(async function* () { yield { type: "output", data: { text: "wrong upstream" } }; }),
} }));
jest.mock("../../src/lib/runtime/composer-queue.ts", () => ({
  submitComposerRun: jest.fn(), drainComposerQueue: jest.fn(),
}), { virtual: true });

type GatewayIdentity = `sha256:${string}`;
type Receipt = { handle: RunHandle; gatewayIdentity: GatewayIdentity };
type Owner = { pid: number; token: string };
type QueueRecord = {
  version: 1; backendRunId: string; gatewayIdentity: GatewayIdentity;
  phase: "attached" | "pending" | "released"; pendingSince: number | null;
  nextAttemptAt: number | null; owner: Owner | null;
  continuationPending: boolean; lastFailure: string | null;
};
type Terminal = Omit<RunResult, "status"> & { status: "completed" | "failed" | "cancelled" };
interface QueueModule {
  recordComposerGateway(id: string, receipt: Receipt): QueueRecord;
  loadComposerQueue(id: string): QueueRecord | null;
  persistComposerTerminal(id: string, result: Terminal): QueueRecord | null;
  claimComposerQueue(id: string, owner: Owner, nowMs: number): QueueRecord | null;
  sweepComposerQueues(input: { nowMs: number; signal?: AbortSignal }): Promise<{
    selected: number; claimed: number; released: number; continued: number;
    retired: number; pending: number; operatorReview: number;
  }>;
}
interface PrivateRuntime {
  submitComposerRun(input: RunSubmit): Promise<Receipt>;
  drainComposerQueue(input: { backendRunId: string; gatewayIdentity: GatewayIdentity; profileName?: string; signal: AbortSignal }): Promise<void>;
}
const root = resolve(__dirname, "../..");
function queue(): QueueModule {
  const path = resolve(root, "src/lib/composer/queue-cleanup.ts");
  expect(fs.existsSync(path)).toBe(true); // Capability red, never an absent-module loader error.
  return require(path) as QueueModule;
}
function privateRuntime(): PrivateRuntime {
  const path = resolve(root, "src/lib/runtime/composer-queue.ts");
  expect(fs.existsSync(path)).toBe(true);
  return jest.requireActual(path) as PrivateRuntime;
}
const seam = require("../../src/lib/runtime/composer-queue.ts") as { submitComposerRun: jest.Mock; drainComposerQueue: jest.Mock };
const runtimeSlot = require("@/lib/runtime") as { runtime: { submitRun: jest.Mock; getRun: jest.Mock; streamRunEvents: jest.Mock } | HermesRuntime };
const ordinaryRuntime = runtimeSlot.runtime;
const identity: GatewayIdentity = `sha256:${"a".repeat(64)}`;
const NOW = Date.parse("2026-10-04T12:00:00Z");
const usage = { inputTokens: 3, outputTokens: 5, totalTokens: 8 };
let workflowId: string;
let sequence: number;
const retained = new Set<string>();

function seed() {
  const stage = getWorkflowGraph(workflowId)!.nodes.find(node => node.key === "stage")!;
  const composer = createComposerRun({ workflowId, currentNodeId: stage.id, profileName: "owned", input: "owned task" });
  updateComposerRun(composer.id, { status: "running" });
  const node = createNodeRun({ composerRunId: composer.id, nodeId: stage.id });
  const id = `cn_${node.id}`;
  createRun({ id, composerNodeRunId: node.id, profileName: "owned" });
  updateNodeRun(node.id, { status: "running", runId: id });
  return { id, composerId: composer.id, nodeId: node.id, backend: `owned-backend-${++sequence}` };
}
type Stage = ReturnType<typeof seed>;
function receipt(stage: Stage): Receipt { return { handle: { runId: stage.backend, status: "started" }, gatewayIdentity: identity }; }
function attach(q: QueueModule, stage = seed()) { q.recordComposerGateway(stage.id, receipt(stage)); retained.add(stage.backend); return stage; }
function terminal(q: QueueModule, stage = attach(q), status: Terminal["status"] = "completed") {
  q.persistComposerTerminal(stage.id, { runId: stage.backend, status, output: "durable output", usage, ...(status === "completed" ? {} : { error: "owned failure" }) });
  return stage;
}
function metadata(stage: Stage) {
  return testDb!.prepare("SELECT key, value FROM meta WHERE json_valid(value) AND json_extract(value, '$.backendRunId') = ?")
    .get(stage.backend) as { key: string; value: string };
}
function replace(stage: Stage, patch: Partial<QueueRecord>) {
  const row = metadata(stage);
  testDb!.prepare("UPDATE meta SET value = ? WHERE key = ?").run(JSON.stringify({ ...JSON.parse(row.value), ...patch }), row.key);
}
function held<T>() {
  let release!: (value: T) => void;
  const promise = new Promise<T>(resolve => { release = resolve; });
  return { promise, release };
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  testDb = openBaselineDb([applyComposerMigration, applyComposerGroupLinkMigration, applyComposerNodeCancelledMigration]);
  workflowId = createWorkflowFromDef({ name: "Owned queue", nodes: [
    { key: "stage", label: "Stage", kind: "custom", gate: "auto", isStart: true },
    { key: "done", label: "Done", kind: "custom", gate: "auto", isTerminal: true },
  ], edges: [{ from: "stage", to: "done", condition: "always" }] }).id;
  sequence = 0; retained.clear(); runtimeSlot.runtime = ordinaryRuntime;
  jest.clearAllMocks();
  seam.drainComposerQueue.mockReset().mockImplementation(async ({ backendRunId }: { backendRunId: string }) => { retained.delete(backendRunId); });
  seam.submitComposerRun.mockReset().mockImplementation(async () => {
    if (retained.size >= 10) throw Object.assign(new Error("owned capacity"), { status: 429 });
    const backendRunId = `owned-submit-${++sequence}`;
    retained.add(backendRunId);
    return { handle: { runId: backendRunId, status: "started" }, gatewayIdentity: identity };
  });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); testDb?.close(); testDb = null; runtimeSlot.runtime = ordinaryRuntime; });

describe("T0194 Composer queue ownership", () => {
  it("atomically attaches the immutable actual receipt and refuses a different backend or gateway", () => {
    const q = queue(), stage = seed(), actual = receipt(stage);
    const record = q.recordComposerGateway(stage.id, actual);
    expect(getRun(stage.id)?.runId).toBe(stage.backend);
    expect(record).toEqual({ version: 1, backendRunId: stage.backend, gatewayIdentity: identity, phase: "attached", pendingSince: null, nextAttemptAt: null, owner: null, continuationPending: false, lastFailure: null });
    actual.handle.runId = "caller mutation";
    expect(q.loadComposerQueue(stage.id)?.backendRunId).toBe(stage.backend);
    expect(() => q.recordComposerGateway(stage.id, { handle: { runId: "other", status: "started" }, gatewayIdentity: identity })).toThrow();
    expect(() => q.recordComposerGateway(stage.id, { ...receipt(stage), gatewayIdentity: `sha256:${"b".repeat(64)}` })).toThrow();
    expect(getRun(stage.id)?.runId).toBe(stage.backend);
    expect((inTransaction as jest.Mock).mock.calls.some(call => call[1] === "immediate")).toBe(true);
  });

  it("rolls back backend attachment if queue metadata cannot be written", () => {
    const q = queue(), stage = seed();
    testDb!.exec("CREATE TRIGGER owned_fail BEFORE INSERT ON meta BEGIN SELECT RAISE(ABORT, 'owned metadata refusal'); END");
    expect(() => q.recordComposerGateway(stage.id, receipt(stage))).toThrow();
    expect(getRun(stage.id)?.runId).toBeNull();
    expect(q.loadComposerQueue(stage.id)).toBeNull();
  });

  it("a late acknowledgement never resurrects cancellation and retains recoverable queue responsibility", async () => {
    const q = queue(), stage = seed();
    cancelComposerRun(stage.composerId);
    const cancelled = getRun(stage.id)!;
    expect(cancelled.status).toBe("cancelled");
    q.recordComposerGateway(stage.id, receipt(stage));
    expect(getRun(stage.id)).toMatchObject({ status: "cancelled", error: cancelled.error, output: cancelled.output, usage: cancelled.usage });
    expect(getNodeRun(stage.nodeId)?.status).toBe("cancelled");
    expect(getComposerRun(stage.composerId)?.status).toBe("cancelled");
    expect(q.loadComposerQueue(stage.id)).toMatchObject({ backendRunId: stage.backend, gatewayIdentity: identity });
    q.persistComposerTerminal(stage.id, { runId: stage.backend, status: "completed", output: "late result must not replace Stop", usage });
    await q.sweepComposerQueues({ nowMs: NOW });
    expect(seam.drainComposerQueue).toHaveBeenCalledTimes(1);
    expect(q.loadComposerQueue(stage.id)).toBeNull();
    expect(getRun(stage.id)).toMatchObject({ status: "cancelled", error: cancelled.error, output: cancelled.output, usage: cancelled.usage });
    expect(getComposerRun(stage.composerId)?.status).toBe("cancelled");
    expect(seam.submitComposerRun).not.toHaveBeenCalled();
  });

  it("rejects malformed metadata with a sanitised diagnostic and no drain", () => {
    const q = queue(), stage = attach(q), row = metadata(stage);
    testDb!.prepare("UPDATE meta SET value = ? WHERE key = ?").run('{"version":999,"secret":"owned-private-secret"}', row.key);
    let error: unknown;
    try { q.loadComposerQueue(stage.id); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain("owned-private-secret");
    expect(seam.drainComposerQueue).not.toHaveBeenCalled();
  });

  it.each(["completed", "failed", "cancelled"] as const)("persists %s output, usage and stage before any drain", async status => {
    const q = queue(), stage = attach(q);
    (inTransaction as jest.Mock).mockClear();
    terminal(q, stage, status);
    expect((inTransaction as jest.Mock).mock.calls.some(call => call[1] === "immediate")).toBe(true);
    expect(q.loadComposerQueue(stage.id)).toMatchObject({ phase: "pending", pendingSince: NOW, continuationPending: true });
    expect(getRun(stage.id)).toMatchObject({ status, output: "durable output", usage });
    expect(getNodeRun(stage.nodeId)).toMatchObject({ status: status === "completed" ? "completed" : "failed", output: "durable output" });
    expect(seam.drainComposerQueue).not.toHaveBeenCalled();
    seam.drainComposerQueue.mockImplementationOnce(async () => {
      expect(getRun(stage.id)).toMatchObject({ status, output: "durable output", usage });
      expect(getNodeRun(stage.nodeId)?.completedAt).not.toBeNull();
    });
    await q.sweepComposerQueues({ nowMs: NOW });
    expect(seam.drainComposerQueue).toHaveBeenCalledTimes(1);
  });

  it("repeated terminal persistence preserves responsibility time, owner and the durable result", () => {
    const q = queue(), stage = terminal(q), owner = { pid: process.pid, token: "original-owner" };
    q.claimComposerQueue(stage.id, owner, NOW);
    jest.setSystemTime(NOW + 90_000);
    q.persistComposerTerminal(stage.id, { runId: stage.backend, status: "completed", output: "durable output", usage });
    expect(q.loadComposerQueue(stage.id)).toMatchObject({ pendingSince: NOW, owner });
    expect(getRun(stage.id)).toMatchObject({ output: "durable output", usage });
  });

  it("rolls back terminal outcome and responsibility when stage persistence fails", () => {
    const q = queue(), stage = attach(q);
    testDb!.exec("CREATE TRIGGER owned_fail BEFORE UPDATE ON composer_node_runs BEGIN SELECT RAISE(ABORT, 'owned stage refusal'); END");
    expect(() => terminal(q, stage)).toThrow();
    expect(getRun(stage.id)).toMatchObject({ status: "started", output: null, usage: null });
    expect(q.loadComposerQueue(stage.id)?.phase).toBe("attached");
    expect(getComposerRun(stage.composerId)?.status).toBe("running");
    expect(seam.drainComposerQueue).not.toHaveBeenCalled();
  });

  it("does not claim missing, active or not-yet-due responsibility", () => {
    const q = queue(), stage = attach(q), owner = { pid: process.pid, token: "tick" };
    expect(q.loadComposerQueue("owned-missing")).toBeNull();
    expect(q.claimComposerQueue("owned-missing", owner, NOW)).toBeNull();
    expect(q.claimComposerQueue(stage.id, owner, NOW)).toBeNull();
    terminal(q, stage); replace(stage, { nextAttemptAt: NOW + 60_000 });
    expect(q.claimComposerQueue(stage.id, owner, NOW)).toBeNull();
  });

  it.each(["live", "uncertain"])("never steals a %s PID owner even after thirty minutes", kind => {
    const q = queue(), stage = terminal(q), original = { pid: 424242, token: "original" };
    replace(stage, { owner: original });
    jest.spyOn(process, "kill").mockImplementation(() => {
      if (kind === "uncertain") throw Object.assign(new Error("owned permission refusal"), { code: "EPERM" });
      return true;
    });
    expect(q.claimComposerQueue(stage.id, { pid: process.pid, token: "other" }, NOW + 1_800_000)).toBeNull();
    expect(q.loadComposerQueue(stage.id)?.owner).toEqual(original);
  });

  it("recovers a demonstrably dead PID and excludes a second claimant", () => {
    const q = queue(), stage = terminal(q);
    replace(stage, { owner: { pid: 424242, token: "dead" } });
    jest.spyOn(process, "kill").mockImplementation(pid => {
      if (pid === process.pid) return true;
      throw Object.assign(new Error("owned absent PID"), { code: "ESRCH" });
    });
    const owner = { pid: process.pid, token: "new" };
    expect(q.claimComposerQueue(stage.id, owner, NOW)?.owner).toEqual(owner);
    expect(q.claimComposerQueue(stage.id, { pid: process.pid, token: "second" }, NOW)).toBeNull();
  });

  it("concurrent sweeps drain once and a stale completion cannot clear a replacement owner", async () => {
    const q = queue(), stage = terminal(q), entered = held<void>(), finish = held<void>();
    seam.drainComposerQueue.mockImplementationOnce(async () => { entered.release(); await finish.promise; });
    const first = q.sweepComposerQueues({ nowMs: NOW });
    try {
      await jest.advanceTimersByTimeAsync(0);
      expect(seam.drainComposerQueue).toHaveBeenCalledTimes(1);
      await entered.promise;
      await q.sweepComposerQueues({ nowMs: NOW });
      expect(seam.drainComposerQueue).toHaveBeenCalledTimes(1);
      const replacement = { pid: process.pid, token: "replacement" };
      replace(stage, { owner: replacement });
      finish.release(); await first;
      expect(q.loadComposerQueue(stage.id)).toMatchObject({ phase: "pending", owner: replacement });
      expect(getComposerRun(stage.composerId)?.status).toBe("running");
    } finally { finish.release(); await first; }
  });

  it("transport refusal preserves outcome and minute spacing across a fresh module load", async () => {
    const q = queue(), stage = terminal(q);
    seam.drainComposerQueue.mockRejectedValue(new Error("owned transport refusal"));
    await q.sweepComposerQueues({ nowMs: NOW });
    expect(q.loadComposerQueue(stage.id)).toMatchObject({ phase: "pending", owner: null, nextAttemptAt: NOW + 60_000 });
    expect(getRun(stage.id)).toMatchObject({ status: "completed", output: "durable output", usage });
    let restarted!: QueueModule;
    jest.isolateModules(() => { restarted = queue(); });
    await restarted.sweepComposerQueues({ nowMs: NOW + 59_999 });
    expect(seam.drainComposerQueue).toHaveBeenCalledTimes(1);
    await restarted.sweepComposerQueues({ nowMs: NOW + 60_000 });
    expect(seam.drainComposerQueue).toHaveBeenCalledTimes(2);
  });

  it("selects at most ten due terminal records per sweep and leaves active records alone", async () => {
    const q = queue();
    for (let index = 0; index < 11; index++) terminal(q);
    const active = attach(q);
    const result = await q.sweepComposerQueues({ nowMs: NOW });
    expect(result).toMatchObject({ selected: 10, claimed: 10, released: 10, continued: 10, retired: 10 });
    expect(seam.drainComposerQueue).toHaveBeenCalledTimes(10);
    expect(q.loadComposerQueue(active.id)?.phase).toBe("attached");
    await q.sweepComposerQueues({ nowMs: NOW + 60_000 });
    expect(seam.drainComposerQueue).toHaveBeenCalledTimes(11);
  });

  it("admits twelve sequential completions through a retained ten-slot gateway while ten active still refuse", async () => {
    const q = queue();
    for (let index = 0; index < 12; index++) {
      const stage = seed(), actual = await seam.submitComposerRun({ input: "owned", idempotencyKey: stage.id }) as Receipt;
      stage.backend = actual.handle.runId; q.recordComposerGateway(stage.id, actual);
      terminal(q, stage); await q.sweepComposerQueues({ nowMs: NOW + index * 60_000 });
      expect(q.loadComposerQueue(stage.id)).toBeNull();
      expect(getComposerRun(stage.composerId)?.status).toBe("completed");
      expect(getRun(stage.id)).toMatchObject({ output: "durable output", usage });
    }
    expect(retained.size).toBe(0);
    for (let index = 0; index < 10; index++) {
      const stage = seed(), actual = await seam.submitComposerRun({ input: "active", idempotencyKey: stage.id }) as Receipt;
      q.recordComposerGateway(stage.id, actual);
    }
    await q.sweepComposerQueues({ nowMs: NOW + 1_000_000 });
    await expect(seam.submitComposerRun({ input: "eleventh active", idempotencyKey: "owned-eleventh" })).rejects.toMatchObject({ status: 429 });
    expect(retained.size).toBe(10);
    expect(seam.drainComposerQueue).toHaveBeenCalledTimes(12);
  });

  it("engine advancement itself cannot bypass an unreleased terminal responsibility", async () => {
    const q = queue(), stage = terminal(q);
    await advanceComposerRun(stage.composerId);
    expect(getComposerRun(stage.composerId)?.status).toBe("running");
    expect(seam.submitComposerRun).not.toHaveBeenCalled();
    expect(q.loadComposerQueue(stage.id)?.phase).toBe("pending");
  });

  it("reconciliation recovers terminal responsibility independently of active-run polling", async () => {
    const q = queue(), stage = terminal(q);
    const { reconcileActiveRuns } = await import("@/lib/orchestration/run-reconcile");
    await reconcileActiveRuns();
    expect(seam.drainComposerQueue).toHaveBeenCalledTimes(1);
    expect((ordinaryRuntime as { getRun: jest.Mock }).getRun).not.toHaveBeenCalled();
    expect(q.loadComposerQueue(stage.id)).toBeNull();
    expect(getComposerRun(stage.composerId)?.status).toBe("completed");
  });

  it("recognises durable continuation after a crash before metadata retirement without replay", async () => {
    const q = queue(), stage = terminal(q), row = metadata(stage);
    replace(stage, { phase: "released", owner: null });
    const released = metadata(stage).value;
    await advanceComposerRun(stage.composerId);
    expect(getComposerRun(stage.composerId)?.status).toBe("completed");
    testDb!.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES (?,?)").run(row.key, released);
    await q.sweepComposerQueues({ nowMs: NOW });
    expect(q.loadComposerQueue(stage.id)).toBeNull();
    expect(seam.submitComposerRun).not.toHaveBeenCalled();
    expect(seam.drainComposerQueue).not.toHaveBeenCalled();
    expect(getRun(stage.id)).toMatchObject({ output: "durable output", usage });
  });

  it("retires thirty-day unresolved responsibility for operator review without replay or lost output", async () => {
    const q = queue(), stage = terminal(q), expiry = NOW + 30 * 86_400_000;
    seam.drainComposerQueue.mockRejectedValue(new Error("owned unavailable gateway"));
    await q.sweepComposerQueues({ nowMs: expiry - 1 });
    expect(getComposerRun(stage.composerId)?.status).toBe("running");
    const result = await q.sweepComposerQueues({ nowMs: expiry });
    expect(result.operatorReview).toBe(1);
    expect(getComposerRun(stage.composerId)).toMatchObject({ status: "failed", error: expect.stringMatching(/operator.*review/i) });
    expect(getComposerRun(stage.composerId)?.error).toContain(identity);
    expect(q.loadComposerQueue(stage.id)).toBeNull();
    expect(getRun(stage.id)).toMatchObject({ runId: stage.backend, status: "completed", output: "durable output", usage });
    expect(seam.submitComposerRun).not.toHaveBeenCalled();
  });
});

describe("T0194 private Composer transport", () => {
  it("refuses a runtime without private capability before dispatching its general submit", async () => {
    const transport = privateRuntime();
    await expect(transport.submitComposerRun({ input: "owned", idempotencyKey: "unsupported" })).rejects.toThrow();
    expect((ordinaryRuntime as { submitRun: jest.Mock }).submitRun).not.toHaveBeenCalled();
  });

  it("pins the accepting endpoint and Idempotency-Key across existing 429 delays and hashes semantic paths", async () => {
    const transport = privateRuntime();
    const endpoint = { profileName: "owned", baseUrl: "http://owned.invalid/first", apiKey: null };
    const resolver = jest.fn(() => ({ ...endpoint }));
    let attempts = 0;
    const fetchImpl = jest.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ run_id: "owned", status: "queued" }), { status: ++attempts === 1 ? 429 : 200 }));
    runtimeSlot.runtime = new HermesRuntime({ fetchImpl: fetchImpl as typeof fetch, resolve: resolver });
    const pending = transport.submitComposerRun({ input: "owned", idempotencyKey: "pinned" });
    await jest.advanceTimersByTimeAsync(1);
    endpoint.baseUrl = "http://owned.invalid/second";
    await jest.advanceTimersByTimeAsync(1999);
    const actual = await pending;
    expect(fetchImpl.mock.calls.map(call => String(call[0]))).toEqual(["http://owned.invalid/first/v1/runs", "http://owned.invalid/first/v1/runs"]);
    expect(fetchImpl.mock.calls.map(call => new Headers(call[1]?.headers).get("Idempotency-Key"))).toEqual(["pinned", "pinned"]);
    expect(actual.gatewayIdentity).toMatch(/^sha256:[a-f0-9]{64}$/);
    const second = await transport.submitComposerRun({ input: "owned", idempotencyKey: "second" });
    expect(second.gatewayIdentity).not.toBe(actual.gatewayIdentity);
  });

  it("refuses gateway identity mismatch before sending any events request or credentials", async () => {
    const transport = privateRuntime(), endpoint = { profileName: "owned", baseUrl: "http://owned.invalid/first", apiKey: "owned-only-key" };
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({ run_id: "owned", status: "queued" }), { status: 200 }));
    runtimeSlot.runtime = new HermesRuntime({ fetchImpl: fetchImpl as typeof fetch, resolve: () => ({ ...endpoint }) });
    const actual = await transport.submitComposerRun({ input: "owned", idempotencyKey: "identity" });
    endpoint.baseUrl = "http://owned.invalid/second"; fetchImpl.mockClear();
    await expect(transport.drainComposerQueue({ backendRunId: actual.handle.runId, gatewayIdentity: actual.gatewayIdentity, profileName: "owned", signal: new AbortController().signal })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(["eof", "404"])("confirms %s release without changing the general runtime handle", async mode => {
    const transport = privateRuntime();
    const fetchImpl = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
      ? new Response(JSON.stringify({ run_id: "owned", status: "queued" }), { status: 200 })
      : new Response(mode === "eof" ? "" : null, { status: mode === "eof" ? 200 : 404 }));
    runtimeSlot.runtime = new HermesRuntime({ fetchImpl: fetchImpl as typeof fetch, resolve: () => ({ profileName: "owned", baseUrl: "http://owned.invalid", apiKey: null }) });
    const actual = await transport.submitComposerRun({ input: "owned", idempotencyKey: "release" });
    await expect(transport.drainComposerQueue({ backendRunId: actual.handle.runId, gatewayIdentity: actual.gatewayIdentity, signal: new AbortController().signal })).resolves.toBeUndefined();
    expect(actual.handle).toEqual({ runId: "owned", status: "started", sessionId: undefined });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("quiet cancellation settles the held reader and releases its lock", async () => {
    const transport = privateRuntime();
    let rejectRead: ((reason: unknown) => void) | undefined;
    let readSignal: AbortSignal | null | undefined, readCount = 0;
    const cancel = jest.fn(async () => undefined), releaseLock = jest.fn();
    const fetchImpl = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ run_id: "owned", status: "queued" }), { status: 200 });
      readSignal = init?.signal;
      return { ok: true, status: 200, body: { getReader: () => ({
        read: () => { readCount++; return new Promise((_, reject) => {
          rejectRead = reject; init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
        }); }, cancel, releaseLock,
      }) } } as unknown as Response;
    });
    runtimeSlot.runtime = new HermesRuntime({ fetchImpl: fetchImpl as typeof fetch, resolve: () => ({ profileName: "owned", baseUrl: "http://owned.invalid", apiKey: null }) });
    const actual = await transport.submitComposerRun({ input: "owned", idempotencyKey: "quiet" }), stop = new AbortController();
    const pending = transport.drainComposerQueue({ backendRunId: actual.handle.runId, gatewayIdentity: actual.gatewayIdentity, signal: stop.signal });
    let settled = false;
    const outcome = pending.then(() => { settled = true; return "released"; }, () => { settled = true; return "pending"; });
    try {
      await jest.advanceTimersByTimeAsync(0); expect(readCount).toBe(1);
      stop.abort(new Error("owned Stop")); await jest.advanceTimersByTimeAsync(0);
      expect(readSignal?.aborted).toBe(true); expect(settled).toBe(true);
      expect(await outcome).toBe("pending");
      expect(cancel).toHaveBeenCalledTimes(1); expect(releaseLock).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally { stop.abort(); rejectRead?.(stop.signal.reason); await outcome; }
  });

  it("a quiet reader has its own finite attempt deadline and always releases its lock", async () => {
    const transport = privateRuntime();
    const cancel = jest.fn(async () => undefined), releaseLock = jest.fn(), read = jest.fn();
    const fetchImpl = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ run_id: "owned", status: "queued" }), { status: 200 });
      read.mockImplementation(() => new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }));
      return { ok: true, status: 200, body: { getReader: () => ({ read, cancel, releaseLock }) } } as unknown as Response;
    });
    runtimeSlot.runtime = new HermesRuntime({ fetchImpl: fetchImpl as typeof fetch, timeoutMs: 25, resolve: () => ({ profileName: "owned", baseUrl: "http://owned.invalid", apiKey: null }) });
    const actual = await transport.submitComposerRun({ input: "owned", idempotencyKey: "deadline" });
    const caller = new AbortController();
    let settled = false;
    const pending = transport.drainComposerQueue({ backendRunId: actual.handle.runId, gatewayIdentity: actual.gatewayIdentity, signal: caller.signal });
    const outcome = pending.then(() => { settled = true; return "released"; }, () => { settled = true; return "pending"; });
    try {
      // Owned fake time bounds observation. The constructor supplies the 25ms deadline;
      // the caller stays live so it cannot manufacture the transport's own timeout.
      await jest.advanceTimersByTimeAsync(60_000);
      expect(read).toHaveBeenCalled(); expect(settled).toBe(true);
      expect(await outcome).toBe("pending"); expect(caller.signal.aborted).toBe(false);
      expect(cancel).toHaveBeenCalledTimes(1); expect(releaseLock).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally { caller.abort(new Error("owned cleanup")); await outcome; }
  });
});

describe("T0194 generic Composer events", () => {
  it.each(["completed", "failed"] as const)("serves durable %s output through the existing envelope without an upstream reader", async status => {
    const stage = seed(); attachBackendRun(stage.id, { runId: stage.backend, status: "started" });
    updateRun(stage.id, { status, output: "durable local output", error: status === "failed" ? "owned stage failure" : null, usage });
    finalizeComposerNodeRun(stage.id, status, "durable local output", status === "failed" ? "owned stage failure" : null);
    const oldToken = process.env.PS_AUTH_TOKEN, oldMode = process.env.PS_AUTH_MODE;
    process.env.PS_AUTH_TOKEN = "owned-t0194-stream-token"; process.env.PS_AUTH_MODE = "token";
    try {
      const { GET } = await import("@/app/api/runs/[id]/events/route");
      const response = await GET(new NextRequest(`http://localhost/api/runs/${stage.id}/events`, { headers: { Authorization: "Bearer owned-t0194-stream-token" } }), { params: Promise.resolve({ id: stage.id }) });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect((ordinaryRuntime as { streamRunEvents: jest.Mock }).streamRunEvents).not.toHaveBeenCalled();
      expect(text).toContain("event: open"); expect(text).toContain("event: done");
      expect(text).toContain("durable local output");
      if (status === "failed") { expect(text).toContain("event: run.error"); expect(text).toContain("owned stage failure"); }
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      if (oldToken === undefined) delete process.env.PS_AUTH_TOKEN; else process.env.PS_AUTH_TOKEN = oldToken;
      if (oldMode === undefined) delete process.env.PS_AUTH_MODE; else process.env.PS_AUTH_MODE = oldMode;
    }
  });
});

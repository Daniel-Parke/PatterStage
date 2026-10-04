/** @jest-environment node */

// Independent Banach companion, 2026-10-04; ADR0019 and Q015 fixture amendment.
// Real SQLite and production entrypoints; owned transport only, no providers.
import { openBaselineDb } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";
import { applyComposerNodeCancelledMigration } from "@/lib/db/apply-composer-node-cancelled-migration";
import { HermesRuntime } from "@/lib/runtime/HermesRuntime";
import { GatewayGate } from "@/lib/runtime/gateway-gate";
import { RuntimeRequestError, type RunResult, type RunSubmit } from "@/lib/runtime/types";
import type { ComposerGatewayReceipt, ComposerQueueRequest } from "@/lib/runtime/composer-queue";
import { createWorkflowFromDef, getWorkflowGraph, createComposerRun, createNodeRun,
  updateComposerRun, updateNodeRun, listNodeRuns, getComposerRun, getNodeRun } from "@/lib/composer/composer-repository";
import { createRun, getRun, updateRun } from "@/lib/runs/runs-repository";
import { dispatchComposerNode } from "@/lib/composer/dispatch";
import { advanceComposerRun } from "@/lib/composer/engine";
import { cancelComposerRun, stopBackendRuns } from "@/lib/composer/cancel";
import { recordComposerGateway, loadComposerQueue, persistComposerTerminal, sweepComposerQueues } from "@/lib/composer/queue-cleanup";

let testDb: import("better-sqlite3").Database | null = null;
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
jest.mock("@/lib/runtime", () => ({ runtime: { submitRun: jest.fn(), getRun: jest.fn(), stopRun: jest.fn() } }));
jest.mock("@/lib/runtime/composer-queue", () => ({
  submitComposerRun: jest.fn(), pollComposerRun: jest.fn(), drainComposerQueue: jest.fn(), stopComposerRun: jest.fn(),
}));
const seam = jest.requireMock("@/lib/runtime/composer-queue") as Record<string, jest.Mock>;
const runtimeSlot = jest.requireMock("@/lib/runtime") as { runtime: unknown };
const originalRuntime = runtimeSlot.runtime;
const identity = ("sha256:" + "a".repeat(64)) as ComposerGatewayReceipt["gatewayIdentity"];
const NOW = Date.parse("2026-10-04T12:00:00Z");
const usage = { inputTokens: 3, outputTokens: 5, totalTokens: 8 };
let workflowId: string, sequence: number;
function held<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function seed(receipt?: ComposerGatewayReceipt) {
  const stage = getWorkflowGraph(workflowId)!.nodes.find(node => node.key === "stage")!;
  const composer = createComposerRun({ workflowId, currentNodeId: stage.id, profileName: "owned", input: "owned task" });
  updateComposerRun(composer.id, { status: "running" });
  const node = createNodeRun({ composerRunId: composer.id, nodeId: stage.id });
  const id = "cn_" + node.id, backend = receipt?.handle.runId ?? "owned-backend-" + ++sequence;
  createRun({ id, composerNodeRunId: node.id, profileName: "owned" });
  updateNodeRun(node.id, { status: "running", runId: id });
  recordComposerGateway(id, receipt ?? { handle: { runId: backend, status: "started" }, gatewayIdentity: identity });
  return { id, backend, nodeId: node.id, composerId: composer.id };
}
function metadata(stage: ReturnType<typeof seed>) {
  return testDb!.prepare("SELECT key, value FROM meta WHERE json_valid(value) AND json_extract(value, '$.backendRunId') = ?")
    .get(stage.backend) as { key: string; value: string };
}
function replace(stage: ReturnType<typeof seed>, patch: Record<string, unknown>) {
  const row = metadata(stage);
  testDb!.prepare("UPDATE meta SET value = ? WHERE key = ?").run(JSON.stringify({ ...JSON.parse(row.value), ...patch }), row.key);
}
function privateTransport() {
  return jest.requireActual("@/lib/runtime/composer-queue") as {
    submitComposerRun(input: RunSubmit): Promise<ComposerGatewayReceipt>;
    pollComposerRun(input: ComposerQueueRequest): Promise<RunResult>;
    stopComposerRun?: (input: ComposerQueueRequest) => Promise<void>;
  };
}
function privateStop() {
  const transport = privateTransport();
  expect(typeof transport.stopComposerRun).toBe("function"); // Missing capability is matcher red, not module-loader failure.
  return transport.stopComposerRun!;
}
beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  testDb = openBaselineDb([applyComposerMigration, applyComposerGroupLinkMigration, applyComposerNodeCancelledMigration]);
  workflowId = createWorkflowFromDef({ name: "Owned confirmation", nodes: [
    { key: "stage", label: "Stage", kind: "custom", gate: "auto", isStart: true },
    { key: "next", label: "Next", kind: "custom", gate: "auto" },
    { key: "done", label: "Done", kind: "custom", gate: "auto", isTerminal: true },
  ], edges: [{ from: "stage", to: "next", condition: "always" }, { from: "next", to: "done", condition: "always" }] }).id;
  sequence = 0; runtimeSlot.runtime = originalRuntime;
  for (const mock of Object.values(seam)) mock.mockReset();
  seam.submitComposerRun.mockImplementation(async () => ({ handle: { runId: "owned-submit-" + ++sequence, status: "started" }, gatewayIdentity: identity }));
  seam.pollComposerRun.mockImplementation(async (request: ComposerQueueRequest) => ({ runId: request.backendRunId, status: "started" }));
  seam.drainComposerQueue.mockResolvedValue(undefined); seam.stopComposerRun.mockResolvedValue(undefined);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); testDb?.close(); testDb = null; runtimeSlot.runtime = originalRuntime; });

describe("T0194 terminal confirmation and Stop", () => {
  it("held POST cancellation before node linkage survives acknowledgement without orphaning an active local run", async () => {
    const stage = getWorkflowGraph(workflowId)!.nodes.find(node => node.key === "stage")!;
    const composer = createComposerRun({ workflowId, currentNodeId: stage.id, profileName: "owned", input: "owned" });
    updateComposerRun(composer.id, { status: "running" });
    const reply = held<ComposerGatewayReceipt>(); seam.submitComposerRun.mockReturnValueOnce(reply.promise);
    const pending = dispatchComposerNode(composer.id, stage.id);
    try {
      await jest.advanceTimersByTimeAsync(0);
      expect(seam.submitComposerRun).toHaveBeenCalledTimes(1);
      const node = listNodeRuns(composer.id)[0], id = "cn_" + node.id;
      expect(node.runId).toBeNull();
      cancelComposerRun(composer.id);
      reply.resolve({ handle: { runId: "owned-late", status: "started" }, gatewayIdentity: identity });
      await pending;
      expect(getComposerRun(composer.id)?.status).toBe("cancelled");
      expect(getNodeRun(node.id)?.status).toBe("cancelled");
      expect(getRun(id)).toMatchObject({ status: "cancelled", error: "Cancelled by user", runId: "owned-late" });
      expect(loadComposerQueue(id)).toMatchObject({ phase: "attached", backendRunId: "owned-late", gatewayIdentity: identity });
      await sweepComposerQueues({ nowMs: NOW });
      expect(seam.drainComposerQueue).not.toHaveBeenCalled();
      expect(seam.submitComposerRun).toHaveBeenCalledTimes(1);
    } finally { reply.resolve({ handle: { runId: "owned-late", status: "started" }, gatewayIdentity: identity }); await pending; }
  });

  it.each(["failed", "cancelled"] as const)("locally %s waits for backend confirmation then preserves its exact outcome", async status => {
    const stage = seed();
    if (status === "cancelled") cancelComposerRun(stage.composerId);
    else { updateRun(stage.id, { status, output: "local output", error: "local deadline", usage }); updateNodeRun(stage.nodeId, { status, output: "local output", error: "local deadline", completedAt: new Date(NOW).toISOString() }); }
    const original = getRun(stage.id), originalNode = getNodeRun(stage.nodeId);
    await sweepComposerQueues({ nowMs: NOW });
    expect(seam.pollComposerRun).toHaveBeenCalledTimes(1); expect(seam.drainComposerQueue).not.toHaveBeenCalled();
    expect(loadComposerQueue(stage.id)).toMatchObject({ phase: "attached", nextAttemptAt: NOW + 60_000, owner: null });
    await sweepComposerQueues({ nowMs: NOW + 59_999 }); expect(seam.pollComposerRun).toHaveBeenCalledTimes(1);
    seam.pollComposerRun.mockResolvedValueOnce({ runId: stage.backend, status: "completed", output: "upstream must not replace local truth", usage });
    await sweepComposerQueues({ nowMs: NOW + 60_000 });
    expect(seam.pollComposerRun).toHaveBeenCalledTimes(2); expect(seam.drainComposerQueue).toHaveBeenCalledTimes(1);
    expect(getRun(stage.id)).toEqual(original); expect(getNodeRun(stage.nodeId)).toEqual(originalNode);
    expect(loadComposerQueue(stage.id)).toBeNull();
    if (status === "cancelled") { expect(getComposerRun(stage.composerId)?.status).toBe("cancelled"); expect(seam.submitComposerRun).not.toHaveBeenCalled(); }
  });

  it.each(["404", "transport", "abort", "wrong backend"])("unconfirmed %s cannot become drain authority", async mode => {
    const stage = seed(); updateRun(stage.id, { status: "failed", error: "local deadline", output: "retained", usage });
    updateNodeRun(stage.nodeId, { status: "failed", completedAt: new Date(NOW).toISOString() });
    const caller = new AbortController(), original = getRun(stage.id);
    seam.pollComposerRun.mockImplementationOnce(async () => {
      if (mode === "wrong backend") return { runId: "different-backend", status: "completed", output: "wrong" };
      if (mode === "abort") caller.abort(new Error("owned abort"));
      throw mode === "404" ? new RuntimeRequestError("owned missing", 404) : new Error("owned refusal");
    });
    const outcome = sweepComposerQueues({ nowMs: NOW, signal: caller.signal });
    if (mode === "wrong backend") await expect(outcome).rejects.toThrow(); else await outcome;
    expect(loadComposerQueue(stage.id)).toMatchObject({ phase: "attached", owner: null, nextAttemptAt: NOW + 60_000 });
    expect(getRun(stage.id)).toEqual(original); expect(seam.drainComposerQueue).not.toHaveBeenCalled(); expect(seam.submitComposerRun).not.toHaveBeenCalled();
  });

  it.each(["backend association", "node association", "extra credential", "missing pending time"])("rejects malformed %s before private transport", async mode => {
    const stage = seed(); updateRun(stage.id, { status: "failed" });
    if (mode === "backend association") replace(stage, { backendRunId: "different-backend" });
    if (mode === "node association") { const other = seed(); testDb!.prepare("UPDATE runs SET composer_node_run_id = ? WHERE id = ?").run(other.nodeId, stage.id); }
    if (mode === "extra credential") replace(stage, { apiKey: "owned-private-secret" });
    if (mode === "missing pending time") replace(stage, { phase: "pending", pendingSince: null });
    let error: unknown; try { loadComposerQueue(stage.id); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(Error); expect(String(error)).not.toContain("owned-private-secret");
    await expect(sweepComposerQueues({ nowMs: NOW })).rejects.toThrow();
    expect(seam.pollComposerRun).not.toHaveBeenCalled(); expect(seam.drainComposerQueue).not.toHaveBeenCalled(); expect(seam.submitComposerRun).not.toHaveBeenCalled();
  });

  it("receipt-bound cancellation carries its identity to private Stop without using the legacy callback", async () => {
    const stage = seed(), legacyStop = jest.fn(async () => undefined), stops = cancelComposerRun(stage.composerId)!;
    expect(stops).toEqual([{ backendRunId: stage.backend, profileName: "owned", gatewayIdentity: identity }]);
    await stopBackendRuns(stops, legacyStop);
    expect(seam.stopComposerRun).toHaveBeenCalledTimes(1); expect(legacyStop).not.toHaveBeenCalled();
    expect(seam.stopComposerRun.mock.calls[0][0]).toMatchObject({ backendRunId: stage.backend, profileName: "owned", gatewayIdentity: identity });
    expect(loadComposerQueue(stage.id)?.phase).toBe("attached"); expect(seam.drainComposerQueue).not.toHaveBeenCalled();
  });

  it("private Stop refuses endpoint rotation before admission without credential handoff", async () => {
    const stop = privateStop(), transport = privateTransport();
    const endpoint = { profileName: "owned", baseUrl: "http://owned.invalid/first", apiKey: "owned-first-key" };
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({ run_id: "owned", status: "queued" }), { status: 200 }));
    runtimeSlot.runtime = new HermesRuntime({ fetchImpl: fetchImpl as typeof fetch, resolve: () => ({ ...endpoint }) });
    const receipt = await transport.submitComposerRun({ input: "owned", idempotencyKey: "owned" });
    endpoint.baseUrl = "http://owned.invalid/second"; endpoint.apiKey = "owned-second-key"; fetchImpl.mockClear();
    await expect(stop({ backendRunId: receipt.handle.runId, gatewayIdentity: receipt.gatewayIdentity, profileName: "owned", signal: new AbortController().signal })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("private Stop retains its checked endpoint while admission is held and does not treat 404 as terminal proof", async () => {
    const stop = privateStop(), transport = privateTransport(), gate = new GatewayGate({ maxInFlight: 1, maxQueue: 1 });
    const endpoint = { profileName: "owned", baseUrl: "http://owned.invalid/first", apiKey: "owned-first-key" };
    const fetchImpl = jest.fn(async (url: RequestInfo | URL) => String(url).endsWith("/stop")
      ? new Response(null, { status: 404 }) : new Response(JSON.stringify({ run_id: "owned", status: "queued" }), { status: 200 }));
    runtimeSlot.runtime = new HermesRuntime({ gate, fetchImpl: fetchImpl as typeof fetch, resolve: () => ({ ...endpoint }) });
    const receipt = await transport.submitComposerRun({ input: "owned", idempotencyKey: "owned" });
    const stage = seed(receipt); // The same backend responsibility remains attached across Stop acknowledgement.
    const release = held<void>(), blocker = gate.run(endpoint.baseUrl, () => release.promise);
    const pending = stop({ backendRunId: receipt.handle.runId, gatewayIdentity: receipt.gatewayIdentity, profileName: "owned", signal: new AbortController().signal });
    const observed = pending.then(() => ({ ok: true }), error => ({ ok: false, error }));
    try {
      await jest.advanceTimersByTimeAsync(0);
      expect(gate.snapshot().endpoints[endpoint.baseUrl].queued).toBe(1);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      endpoint.baseUrl = "http://owned.invalid/second"; endpoint.apiKey = "owned-second-key";
      release.resolve(); await blocker;
      expect(await observed).toEqual({ ok: true });
      expect(String(fetchImpl.mock.calls[1][0])).toBe("http://owned.invalid/first/v1/runs/owned/stop");
      const init = (fetchImpl.mock.calls[1] as unknown as [RequestInfo | URL, RequestInit])[1];
      expect(new Headers(init.headers).get("Authorization")).toBe("Bearer owned-first-key");
      expect(loadComposerQueue(stage.id)?.phase).toBe("attached"); expect(seam.drainComposerQueue).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    } finally { release.resolve(); await blocker; await observed; }
  });

  it.each(["fetch", "body"])("private polling bounds non-cooperative %s without aborting its caller", async mode => {
    const transport = privateTransport(), response = held<Response>(), body = held<unknown>();
    const fetchImpl = jest.fn(async () => mode === "fetch" ? response.promise : ({ ok: true, json: () => body.promise } as Response));
    runtimeSlot.runtime = new HermesRuntime({ fetchImpl: fetchImpl as typeof fetch, timeoutMs: 25,
      gate: new GatewayGate(), resolve: () => ({ profileName: "owned", baseUrl: "http://owned.invalid", apiKey: null }) });
    // Capture the same endpoint identity using the real receipt path, with a separate owned POST responder.
    fetchImpl.mockResolvedValueOnce(new Response(JSON.stringify({ run_id: "owned", status: "queued" }), { status: 200 }));
    const receipt = await transport.submitComposerRun({ input: "owned", idempotencyKey: "owned" }), caller = new AbortController();
    let settled = false;
    const pending = transport.pollComposerRun({ backendRunId: receipt.handle.runId, gatewayIdentity: receipt.gatewayIdentity, signal: caller.signal });
    const outcome = pending.then(() => { settled = true; return "terminal"; }, () => { settled = true; return "unconfirmed"; });
    try {
      await jest.advanceTimersByTimeAsync(26);
      expect(settled).toBe(true); expect(await outcome).toBe("unconfirmed");
      expect(caller.signal.aborted).toBe(false); expect(jest.getTimerCount()).toBe(0);
    } finally { response.resolve(new Response(JSON.stringify({ status: "running" }))); body.resolve({ status: "running" }); caller.abort(); await outcome; }
  });

  it("released continuation expiry retires atomically and preserves completed stage usage", async () => {
    const stage = seed(); persistComposerTerminal(stage.id, { runId: stage.backend, status: "completed", output: "durable", usage });
    replace(stage, { phase: "released" }); const original = getRun(stage.id), originalNode = getNodeRun(stage.nodeId);
    expect(loadComposerQueue(stage.id)).toMatchObject({ phase: "released", pendingSince: NOW, owner: null });
    testDb!.exec("CREATE TRIGGER owned_retire_refusal BEFORE DELETE ON meta BEGIN SELECT RAISE(ABORT, 'owned retirement refusal'); END");
    await expect(sweepComposerQueues({ nowMs: NOW + 30 * 86_400_000 })).rejects.toMatchObject({ message: "owned retirement refusal" });
    expect(getComposerRun(stage.composerId)?.status).toBe("running"); expect(loadComposerQueue(stage.id)?.phase).toBe("released");
    testDb!.exec("DROP TRIGGER owned_retire_refusal");
    await sweepComposerQueues({ nowMs: NOW + 30 * 86_400_000 });
    expect(getComposerRun(stage.composerId)).toMatchObject({ status: "failed", error: expect.stringMatching(/operator.*review/i) });
    expect(getComposerRun(stage.composerId)?.error).toContain(identity); expect(loadComposerQueue(stage.id)).toBeNull();
    expect(getRun(stage.id)).toEqual(original); expect(getNodeRun(stage.nodeId)).toEqual(originalNode);
    expect(seam.submitComposerRun).not.toHaveBeenCalled(); expect(seam.drainComposerQueue).not.toHaveBeenCalled();
  });

  it("a durable paid successor survives replay of released metadata without a second submission", async () => {
    const stage = seed(); persistComposerTerminal(stage.id, { runId: stage.backend, status: "completed", output: "durable", usage });
    replace(stage, { phase: "released" }); const row = metadata(stage);
    await advanceComposerRun(stage.composerId); expect(seam.submitComposerRun).toHaveBeenCalledTimes(1);
    const successor = listNodeRuns(stage.composerId).find(node => node.id !== stage.nodeId)!;
    expect(successor.status).toBe("running"); expect(getRun(successor.runId!)?.runId).toBeTruthy();
    testDb!.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES (?,?)").run(row.key, row.value);
    await sweepComposerQueues({ nowMs: NOW });
    expect(loadComposerQueue(stage.id)).toBeNull(); expect(seam.submitComposerRun).toHaveBeenCalledTimes(1);
    expect(seam.drainComposerQueue).not.toHaveBeenCalled(); expect(getRun(stage.id)).toMatchObject({ output: "durable", usage });
  });
});

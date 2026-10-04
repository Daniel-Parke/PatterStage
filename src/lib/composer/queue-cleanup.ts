import { inTransaction, uuid } from "@/lib/db";
import { getRun, attachBackendRun, updateRun } from "@/lib/runs/runs-repository";
import { getSystemStat, getMetaByPrefix, upsertMetaValue, deleteMetaValue } from "@/lib/system/system-repository";
import { drainComposerQueue, pollComposerRun } from "@/lib/runtime/composer-queue";
import type { ComposerGatewayReceipt, GatewayIdentity } from "@/lib/runtime/composer-queue";
import type { RunResult } from "@/lib/runtime/types";
import { getComposerRun, getNodeRun, listNodeRuns, updateComposerRun, updateNodeRun } from "./composer-repository";
import { advanceComposerRun, finalizeComposerNodeRun } from "./engine";
import { isTerminalComposerRunStatus } from "./schema";

export type { ComposerGatewayReceipt } from "@/lib/runtime/composer-queue";
type ComposerQueueOwner = Readonly<{ pid: number; token: string }>;
export type ComposerTerminalResult = Omit<RunResult, "status"> & {
  status: "completed" | "failed" | "cancelled";
};
export type ComposerQueueRecord = Readonly<{
  version: 1;
  backendRunId: string;
  gatewayIdentity: GatewayIdentity;
  phase: "attached" | "pending" | "released";
  pendingSince: number | null;
  nextAttemptAt: number | null;
  owner: ComposerQueueOwner | null;
  continuationPending: boolean;
  lastFailure: string | null;
}>;
export type ComposerQueueSweepResult = {
  selected: number; claimed: number; released: number; continued: number;
  retired: number; pending: number; operatorReview: number;
};

const PREFIX = "composer.queue.v1:";
const RETRY_MS = 60_000;
const REVIEW_MS = 30 * 86_400_000;
const RECORD_FIELDS = ["version", "backendRunId", "gatewayIdentity", "phase", "pendingSince", "nextAttemptAt", "owner", "continuationPending", "lastFailure"];
const keyFor = (id: string) => `${PREFIX}${id}`;
const stageFor = (id: string) => {
  const run = getRun(id);
  return run?.composerNodeRunId ? getNodeRun(run.composerNodeRunId) : null;
};
const validIdentity = (value: unknown): value is GatewayIdentity =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
const validTime = (value: unknown) => value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
const validOwner = (value: unknown): value is ComposerQueueOwner => {
  if (!value || typeof value !== "object") return false;
  const owner = value as ComposerQueueOwner;
  return Object.keys(owner).length === 2 && Number.isSafeInteger(owner.pid) && owner.pid > 0
    && typeof owner.token === "string" && owner.token.length > 0;
};

export function loadComposerQueue(runId: string): ComposerQueueRecord | null {
  const raw = getSystemStat(keyFor(runId));
  if (raw === null) return null;
  try {
    const record = JSON.parse(raw) as ComposerQueueRecord;
    if (record && Object.keys(record).length === RECORD_FIELDS.length && RECORD_FIELDS.every(field => Object.hasOwn(record, field))
      && record.version === 1 && typeof record.backendRunId === "string" && record.backendRunId.length > 0
      && validIdentity(record.gatewayIdentity) && ["attached", "pending", "released"].includes(record.phase)
      && validTime(record.pendingSince) && validTime(record.nextAttemptAt)
      && (record.phase === "attached" || record.pendingSince !== null)
      && (record.owner === null || validOwner(record.owner))
      && typeof record.continuationPending === "boolean"
      && (record.lastFailure === null || typeof record.lastFailure === "string")) {
      const run = getRun(runId), node = run?.composerNodeRunId ? getNodeRun(run.composerNodeRunId) : null;
      if (run?.runId === record.backendRunId && node?.runId === runId) return record;
    }
  } catch { /* report only the schema failure, never the stored content */ }
  throw new Error("Invalid private Composer queue responsibility; operator review required");
}

function save(runId: string, record: ComposerQueueRecord): ComposerQueueRecord {
  upsertMetaValue(keyFor(runId), JSON.stringify(record));
  return record;
}

export function recordComposerGateway(runId: string, receipt: ComposerGatewayReceipt): ComposerQueueRecord {
  if (!validIdentity(receipt.gatewayIdentity) || !receipt.handle.runId) throw new Error("Invalid Composer gateway receipt");
  return inTransaction(() => {
    const run = getRun(runId);
    if (!run?.composerNodeRunId) throw new Error("Composer run not found for gateway receipt");
    const node = getNodeRun(run.composerNodeRunId);
    if (!node || (node.runId !== null && node.runId !== runId)) throw new Error("Conflicting Composer stage attachment");
    if (run.runId && run.runId !== receipt.handle.runId) throw new Error("Conflicting Composer backend attachment");
    const prior = loadComposerQueue(runId);
    if (prior) {
      if (prior.backendRunId !== receipt.handle.runId || prior.gatewayIdentity !== receipt.gatewayIdentity) {
        throw new Error("Conflicting Composer gateway receipt");
      }
      return prior;
    }
    // Attaching a late acknowledgement has no authority to rewrite Stop.
    attachBackendRun(runId, { runId: receipt.handle.runId, sessionId: receipt.handle.sessionId });
    if (node.runId === null) updateNodeRun(node.id, { runId });
    if (run.status === "started") updateRun(runId, { error: null });
    return save(runId, { version: 1, backendRunId: receipt.handle.runId, gatewayIdentity: receipt.gatewayIdentity,
      phase: "attached", pendingSince: null, nextAttemptAt: null, owner: null,
      continuationPending: false, lastFailure: null });
  }, "immediate");
}

/** Accept a terminal result confirmed by polling the receipt's gateway, never a local deadline or Stop. */
export function persistComposerTerminal(runId: string, result: ComposerTerminalResult): ComposerQueueRecord | null {
  return inTransaction(() => {
    const run = getRun(runId), record = loadComposerQueue(runId);
    if (!run?.composerNodeRunId || !record) return null;
    if (result.runId !== record.backendRunId || !["completed", "failed", "cancelled"].includes(result.status)) {
      throw new Error("Composer terminal result does not match its gateway receipt");
    }
    if (record.phase !== "attached") return record;
    const node = stageFor(runId);
    const composer = node && getComposerRun(node.composerRunId);
    if (!node || !composer) throw new Error("Composer stage missing for terminal persistence");
    if (run.status === "started" && !isTerminalComposerRunStatus(composer.status)) {
      updateRun(runId, { status: result.status, output: result.output ?? null,
        error: result.error ?? null, usage: result.usage ?? null });
      finalizeComposerNodeRun(runId, result.status, result.output ?? null, result.error ?? null);
    }
    return save(runId, { ...record, phase: "pending", pendingSince: record.pendingSince ?? Date.now(),
      continuationPending: true });
  }, "immediate");
}

function ownerCouldBeAlive(owner: ComposerQueueOwner): boolean {
  try { process.kill(owner.pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
}

function responsibilitySince(runId: string, record: ComposerQueueRecord, nowMs: number): number {
  if (record.pendingSince !== null) return record.pendingSince;
  const ended = Date.parse(getRun(runId)?.completedAt ?? "");
  return Number.isFinite(ended) ? ended : nowMs;
}

export function claimComposerQueue(runId: string, owner: ComposerQueueOwner, nowMs: number): ComposerQueueRecord | null {
  if (!validOwner(owner) || !Number.isFinite(nowMs) || nowMs < 0) throw new Error("Invalid Composer queue claimant");
  return inTransaction(() => {
    const record = loadComposerQueue(runId), run = getRun(runId);
    if (!record || !run || (record.phase === "attached" && run.status === "started")
      || (record.nextAttemptAt !== null && record.nextAttemptAt > nowMs)
      || (record.owner && ownerCouldBeAlive(record.owner))) return null;
    return save(runId, { ...record, owner: { ...owner }, pendingSince: responsibilitySince(runId, record, nowMs),
      nextAttemptAt: nowMs + RETRY_MS });
  }, "immediate");
}

function ownedWrite<T>(runId: string, owner: ComposerQueueOwner, fn: (record: ComposerQueueRecord) => T): T | null {
  return inTransaction(() => {
    const record = loadComposerQueue(runId);
    if (!record?.owner || record.owner.pid !== owner.pid || record.owner.token !== owner.token) return null;
    return fn(record);
  }, "immediate");
}

function continuationComplete(runId: string): boolean {
  const node = stageFor(runId), composer = node && getComposerRun(node.composerRunId);
  if (!node || !composer) return false;
  return isTerminalComposerRunStatus(composer.status) || composer.status === "awaiting_approval"
    || composer.currentNodeId !== node.nodeId
    || listNodeRuns(composer.id).some(other => other.nodeId === node.nodeId && other.attempt > node.attempt);
}

export async function sweepComposerQueues(opts: { nowMs: number; signal?: AbortSignal }): Promise<ComposerQueueSweepResult> {
  if (!Number.isFinite(opts.nowMs) || opts.nowMs < 0) throw new Error("Invalid Composer queue sweep time");
  const counts: ComposerQueueSweepResult = { selected: 0, claimed: 0, released: 0, continued: 0, retired: 0, pending: 0, operatorReview: 0 };
  const due = getMetaByPrefix(PREFIX).flatMap(row => {
    const id = row.key.slice(PREFIX.length), record = loadComposerQueue(id);
    return record ? [{ id, record, since: responsibilitySince(id, record, opts.nowMs) }] : [];
  })
    .filter(({ id, record }) => (record.phase !== "attached" || getRun(id)?.status !== "started")
      && ((record.nextAttemptAt ?? 0) <= opts.nowMs || opts.nowMs - responsibilitySince(id, record, opts.nowMs) >= REVIEW_MS))
    .sort((a, b) => a.since - b.since).slice(0, 10);
  for (const { id, since } of due) {
    if (opts.signal?.aborted) break;
    counts.selected++;
    if (opts.nowMs - since >= REVIEW_MS) {
      inTransaction(() => {
        const current = loadComposerQueue(id), node = stageFor(id);
        if (!current || !node) throw new Error("Composer retirement responsibility is incomplete");
        if (opts.nowMs - responsibilitySince(id, current, opts.nowMs) < REVIEW_MS) { counts.pending++; return; }
        if (current.owner && ownerCouldBeAlive(current.owner)) { counts.pending++; return; }
        if (current.phase === "released" && continuationComplete(id)) {
          deleteMetaValue(keyFor(id)); counts.retired++; return;
        }
        updateComposerRun(node.composerRunId, { status: "failed", completedAt: new Date(opts.nowMs).toISOString(),
          error: `Composer queue responsibility requires operator review after 30 days; original gateway ${current.gatewayIdentity}` });
        deleteMetaValue(keyFor(id)); counts.retired++; counts.operatorReview++;
      }, "immediate");
      continue;
    }
    const owner = { pid: process.pid, token: uuid() };
    let claimed = claimComposerQueue(id, owner, opts.nowMs);
    if (!claimed) { counts.pending++; continue; }
    counts.claimed++;
    try {
      const run = getRun(id)!;
      const request = { backendRunId: claimed.backendRunId, gatewayIdentity: claimed.gatewayIdentity,
        profileName: run.profileName ?? undefined, signal: opts.signal ?? new AbortController().signal };
      if (claimed.phase === "attached") {
        let terminal: RunResult;
        try { terminal = await pollComposerRun(request); }
        catch { ownedWrite(id, owner, current => save(id, { ...current, lastFailure: "Composer terminal confirmation unavailable; retry pending" })); counts.pending++; continue; }
        if (terminal.status === "started") { counts.pending++; continue; }
        claimed = ownedWrite(id, owner, () => persistComposerTerminal(id, terminal as ComposerTerminalResult));
        if (!claimed) { counts.pending++; continue; }
      }
      if (claimed.phase === "pending") {
        try { await drainComposerQueue(request); }
        catch { ownedWrite(id, owner, current => save(id, { ...current, lastFailure: "Composer queue cleanup unavailable; retry pending" })); counts.pending++; continue; }
        claimed = ownedWrite(id, owner, current => save(id, { ...current, phase: "released", lastFailure: null }));
        if (!claimed) { counts.pending++; continue; }
        counts.released++;
      }
      if (opts.signal?.aborted) { counts.pending++; continue; }
      const node = stageFor(id);
      if (!node) throw new Error("Composer continuation stage missing");
      const alreadyComplete = continuationComplete(id);
      if (!alreadyComplete) await advanceComposerRun(node.composerRunId);
      const retired = ownedWrite(id, owner, () => {
        if (!continuationComplete(id)) return false;
        deleteMetaValue(keyFor(id)); return true;
      });
      if (retired) { counts.retired++; if (!alreadyComplete) counts.continued++; }
      else counts.pending++;
    } finally {
      ownedWrite(id, owner, current => save(id, { ...current, owner: null }));
    }
  }
  return counts;
}

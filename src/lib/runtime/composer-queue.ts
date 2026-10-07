import { runtime } from "./index";
import type { RunHandle, RunResult, RunSubmit } from "./types";

export type GatewayIdentity = `sha256:${string}`;
export type ComposerGatewayReceipt = Readonly<{
  handle: RunHandle;
  gatewayIdentity: GatewayIdentity;
}>;
export type ComposerQueueRequest = {
  backendRunId: string;
  gatewayIdentity: GatewayIdentity;
  profileName?: string;
  signal: AbortSignal;
};

// Private composition capability. AgentRuntime and its ordinary callers keep
// their existing port; an unsupported adapter must refuse before submitting.
interface ComposerTransport {
  submitComposerRun(input: RunSubmit): Promise<ComposerGatewayReceipt>;
  drainComposerQueue(input: ComposerQueueRequest): Promise<void>;
  pollComposerRun(input: ComposerQueueRequest): Promise<RunResult>;
  stopComposerRun(input: ComposerQueueRequest): Promise<void>;
}

function capability<K extends keyof ComposerTransport>(name: K): ComposerTransport[K] {
  const adapter = runtime as unknown as Partial<ComposerTransport>;
  const method = adapter[name];
  if (typeof method !== "function") throw new Error("Runtime does not support private Composer queue ownership");
  return method.bind(runtime) as ComposerTransport[K];
}

export function submitComposerRun(input: RunSubmit): Promise<ComposerGatewayReceipt> {
  return Promise.resolve().then(() => capability("submitComposerRun")(input));
}

export function drainComposerQueue(input: ComposerQueueRequest): Promise<void> {
  return Promise.resolve().then(() => capability("drainComposerQueue")(input));
}

/** Recover a locally ended stage whose upstream completion is still unknown. */
export function pollComposerRun(input: ComposerQueueRequest): Promise<RunResult> {
  return Promise.resolve().then(() => capability("pollComposerRun")(input));
}

export function stopComposerRun(input: ComposerQueueRequest): Promise<void> {
  return Promise.resolve().then(() => capability("stopComposerRun")(input));
}

import type { ComposerNodeRun } from "@/lib/composer/schema";

export function legacyComposerTransportMock() {
  return {
    submitComposerRun: async (input: unknown) => ({
      handle: await require("@/lib/runtime").runtime.submitRun(input),
      gatewayIdentity: `sha256:${"a".repeat(64)}`,
    }),
    drainComposerQueue: jest.fn(async () => undefined),
  };
}

export function runningNodeRun(composerRunId: string): ComposerNodeRun {
  const { listNodeRuns } = require("@/lib/composer/composer-repository") as typeof import("@/lib/composer/composer-repository");
  const nr = listNodeRuns(composerRunId).find((r) => r.status === "running");
  if (!nr) throw new Error("no running node-run");
  return nr;
}

export async function finishStage(composerRunId: string, output: string): Promise<void> {
  const { getRun } = require("@/lib/runs/runs-repository") as typeof import("@/lib/runs/runs-repository");
  const { persistComposerTerminal, sweepComposerQueues } = require("@/lib/composer/queue-cleanup") as typeof import("@/lib/composer/queue-cleanup");
  const nr = runningNodeRun(composerRunId);
  const run = getRun(nr.runId!)!;
  persistComposerTerminal(run.id, { runId: run.runId!, status: "completed", output });
  await sweepComposerQueues({ nowMs: Date.now() });
}

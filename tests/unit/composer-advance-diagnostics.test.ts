/** @jest-environment node */
import { dbSingletonMock, openBaselineDb } from "../helpers/baseline-db";
import { pendingLookup } from "../helpers/mission-async-deferred";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";

let database: ReturnType<typeof openBaselineDb> | null = null;
jest.mock("@/lib/db", () => dbSingletonMock(() => database));
jest.mock("@/lib/runtime", () => ({ runtime: { submitRun: jest.fn() } }));
jest.mock("@/lib/laboratory/deep-research/research-repository", () => ({ createResearchRun: jest.fn(() => ({ id: "research-owned" })) }));
jest.mock("@/lib/laboratory/deep-research/run-job", () => ({ runResearchJob: jest.fn() }));
jest.mock("@/lib/composer/engine", () => ({ advanceComposerRun: jest.fn() }));

import { dispatchComposerNode } from "@/lib/composer/dispatch";
import { advanceComposerRun } from "@/lib/composer/engine";
import { runResearchJob } from "@/lib/laboratory/deep-research/run-job";
import { createWorkflowFromDef, createComposerRun, listNodeRuns, getComposerRunByParentNodeRunId } from "@/lib/composer/composer-repository";

beforeEach(() => {
  database = openBaselineDb([applyComposerMigration, applyComposerGroupLinkMigration]);
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => { database?.close(); database = null; jest.restoreAllMocks(); });
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

it.each(["research", "group"] as const)("%s advance rejection is attributable and nonfatal without leaking its rejection", async kind => {
  const advancement = pendingLookup<void>(), research = pendingLookup<void>();
  jest.mocked(advanceComposerRun).mockReturnValue(advancement.promise);
  jest.mocked(runResearchJob).mockReturnValue(research.promise);
  const child = createWorkflowFromDef({ key: "child", name: "Child", nodes: [{ key: "start", label: "Start", kind: "custom", isStart: true, isTerminal: true }], edges: [] });
  const workflow = createWorkflowFromDef({ key: "parent", name: "Parent", nodes: [{ key: "stage", label: "Stage", kind, isStart: true, config: kind === "group" ? { workflowRef: child.id } : { query: "private-query-sentinel" } }], edges: [] });
  const run = createComposerRun({ workflowId: workflow.id, input: "private-input-sentinel" });
  const result = await dispatchComposerNode(run.id, workflow.nodes[0].id);
  expect(result.ok).toBe(true);
  const expectedTarget = kind === "group" ? getComposerRunByParentNodeRunId(result.nodeRunId!)!.id : run.id;
  if (kind === "research") {
    expect(advanceComposerRun).not.toHaveBeenCalled();
    research.complete();
  }
  await settle();
  expect(advanceComposerRun).toHaveBeenCalledWith(expectedTarget);
  expect(advanceComposerRun).toHaveBeenCalledTimes(1);
  expect(console.warn).not.toHaveBeenCalled();
  advancement.fail(new Error("private-error-sentinel token=private-token-sentinel"));
  await settle();
  expect(jest.mocked(console.warn).mock.calls).toEqual([[kind === "research"
    ? `[composer] Research continuation failed for run ${run.id}`
    : `[composer] Child continuation failed for run ${expectedTarget} (parent ${run.id})`]]);
  for (const method of [console.log, console.info, console.error]) expect(method).not.toHaveBeenCalled();
  expect(advanceComposerRun).toHaveBeenCalledTimes(1);
  expect(listNodeRuns(run.id)).toEqual([expect.objectContaining({ id: result.nodeRunId, status: "running", error: null })]);
});

it.each(["research", "group"] as const)("%s successful advance remains silent", async kind => {
  jest.mocked(advanceComposerRun).mockResolvedValue(undefined);
  jest.mocked(runResearchJob).mockResolvedValue(undefined);
  const child = createWorkflowFromDef({ key: "child", name: "Child", nodes: [{ key: "start", label: "Start", kind: "custom", isStart: true, isTerminal: true }], edges: [] });
  const workflow = createWorkflowFromDef({ key: "parent", name: "Parent", nodes: [{ key: "stage", label: "Stage", kind, isStart: true, config: kind === "group" ? { workflowRef: child.id } : {} }], edges: [] });
  const run = createComposerRun({ workflowId: workflow.id });
  expect((await dispatchComposerNode(run.id, workflow.nodes[0].id)).ok).toBe(true);
  await settle();
  expect(advanceComposerRun).toHaveBeenCalledTimes(1);
  expect(console.warn).not.toHaveBeenCalled();
  expect(console.error).not.toHaveBeenCalled();
  expect(console.log).not.toHaveBeenCalled();
  expect(console.info).not.toHaveBeenCalled();
});

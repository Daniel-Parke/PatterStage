/** @jest-environment node */

// Independent Banach regression: malformed private metadata cannot veto local Stop.
import { openBaselineDb } from "../helpers/baseline-db";
import { applyComposerMigration } from "@/lib/db/apply-composer-migration";
import { applyComposerGroupLinkMigration } from "@/lib/db/apply-composer-group-link-migration";
import { applyComposerNodeCancelledMigration } from "@/lib/db/apply-composer-node-cancelled-migration";
import { createWorkflowFromDef, getWorkflowGraph, createComposerRun, createNodeRun,
  updateComposerRun, updateNodeRun, getComposerRun, getNodeRun } from "@/lib/composer/composer-repository";
import { createRun, getRun } from "@/lib/runs/runs-repository";
import { recordComposerGateway, loadComposerQueue } from "@/lib/composer/queue-cleanup";
import { cancelComposerRun, stopBackendRuns } from "@/lib/composer/cancel";
import { stopComposerRun } from "@/lib/runtime/composer-queue";
import { logApiError } from "@/lib/api/api-logger";

let testDb: import("better-sqlite3").Database | null = null;
jest.mock("@/lib/db", () => require("../helpers/baseline-db").dbSingletonMock(() => testDb));
jest.mock("@/lib/runtime/composer-queue", () => ({ stopComposerRun: jest.fn() }));
jest.mock("@/lib/api/api-logger", () => ({ logApiError: jest.fn() }));

afterEach(() => { testDb?.close(); testDb = null; jest.clearAllMocks(); });

it("invalid private queue metadata cannot roll back local cancellation or authorise either remote Stop", async () => {
  testDb = openBaselineDb([applyComposerMigration, applyComposerGroupLinkMigration, applyComposerNodeCancelledMigration]);
  const workflowId = createWorkflowFromDef({ name: "Owned invalid receipt", nodes: [
    { key: "stage", label: "Stage", kind: "custom", gate: "auto", isStart: true },
    { key: "done", label: "Done", kind: "custom", gate: "auto", isTerminal: true },
  ], edges: [{ from: "stage", to: "done", condition: "always" }] }).id;
  const stage = getWorkflowGraph(workflowId)!.nodes.find(node => node.key === "stage")!;
  const composer = createComposerRun({ workflowId, currentNodeId: stage.id, profileName: "owned" });
  updateComposerRun(composer.id, { status: "running" });
  const node = createNodeRun({ composerRunId: composer.id, nodeId: stage.id });
  const id = "cn_" + node.id, backend = "owned-invalid-backend";
  createRun({ id, composerNodeRunId: node.id, profileName: "owned" });
  updateNodeRun(node.id, { status: "running", runId: id });
  recordComposerGateway(id, { handle: { runId: backend, status: "started" }, gatewayIdentity: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
  expect(loadComposerQueue(id)).toMatchObject({ backendRunId: backend, phase: "attached" });
  const row = testDb.prepare("SELECT key, value FROM meta WHERE json_valid(value) AND json_extract(value, '$.backendRunId') = ?")
    .get(backend) as { key: string; value: string };
  const syntheticMarker = "owned-invalid-cancel-marker";
  testDb.prepare("UPDATE meta SET value = ? WHERE key = ?")
    .run(JSON.stringify({ ...JSON.parse(row.value), extraCredential: syntheticMarker }), row.key);
  expect(() => loadComposerQueue(id)).toThrow("Invalid private Composer queue responsibility; operator review required");

  let stops: ReturnType<typeof cancelComposerRun> = null;
  let refusal: unknown;
  try { stops = cancelComposerRun(composer.id); } catch (error) { refusal = error; }
  const legacyStop = jest.fn(async () => undefined);
  await stopBackendRuns(stops ?? [], legacyStop);

  // Capture all three durable rows after the real transaction, even when it rejects.
  const local = { composer: getComposerRun(composer.id), stage: getNodeRun(node.id), agent: getRun(id) };
  expect({ composer: local.composer?.status, stage: local.stage?.status, agent: local.agent?.status })
    .toEqual({ composer: "cancelled", stage: "cancelled", agent: "cancelled" });
  for (const outcome of Object.values(local)) {
    expect(outcome?.error).toBe("Cancelled by user");
    expect(outcome?.completedAt).toEqual(expect.any(String));
  }
  expect(refusal).toBeUndefined();
  expect(stops).toEqual([]);
  expect(stopComposerRun).not.toHaveBeenCalled();
  expect(legacyStop).not.toHaveBeenCalled();
  expect(logApiError).toHaveBeenCalled();
  const diagnostic = (logApiError as jest.Mock).mock.calls.flat()
    .map(value => value instanceof Error ? value.message : String(value)).join(" ");
  expect(diagnostic).toMatch(/invalid private Composer queue responsibility/i);
  expect(diagnostic).toMatch(/operator review required/i);
  expect(diagnostic).not.toContain(syntheticMarker);
  expect(diagnostic).not.toContain("extraCredential");
});

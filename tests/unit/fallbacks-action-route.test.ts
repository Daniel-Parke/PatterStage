/** @jest-environment node */

/**
 * Tests for the consolidated POST /api/models/fallbacks action route (N3).
 * Locks in the two bug-fixes from the consolidation: `toggle` accepts the
 * consumer's `entryId` (the old route required `id`) and `custom` accepts
 * `name`/`baseUrl` (the old route required `modelName`/`overrideBaseUrl`).
 */

import type { NextRequest } from "next/server";

const addFallbackEntry = jest.fn();
const toggleFallbackEntry = jest.fn();
const getFallbackEntry = jest.fn();
const updateFallbackEntry = jest.fn();
const listFallbackChain = jest.fn();
const getFallbackConfig = jest.fn();
const updateFallbackConfigBatch = jest.fn();
const commitFallbackChange = jest.fn();
const syncEnabledFallbackChainToHermes = jest.fn();
const importFallbacksFromHermesYaml = jest.fn();

jest.mock("@/lib/fallbacks-repository", () => ({
  addFallbackEntry: (...a: unknown[]) => addFallbackEntry(...a),
  toggleFallbackEntry: (...a: unknown[]) => toggleFallbackEntry(...a),
  getFallbackEntry: (...a: unknown[]) => getFallbackEntry(...a),
  updateFallbackEntry: (...a: unknown[]) => updateFallbackEntry(...a),
  listFallbackChain: (...a: unknown[]) => listFallbackChain(...a),
  getFallbackConfig: (...a: unknown[]) => getFallbackConfig(...a),
  updateFallbackConfigBatch: (...a: unknown[]) => updateFallbackConfigBatch(...a),
}));
jest.mock("@/modules/hermes/lib/fallback-sync", () => ({
  commitFallbackChange: (...a: unknown[]) => commitFallbackChange(...a),
  syncEnabledFallbackChainToHermes: (...a: unknown[]) => syncEnabledFallbackChainToHermes(...a),
}));
jest.mock("@/modules/hermes/lib/fallback-import", () => ({
  importFallbacksFromHermesYaml: (...a: unknown[]) => importFallbacksFromHermesYaml(...a),
}));
jest.mock("@/lib/api-auth", () => ({ requireAuth: () => null }));
jest.mock("@/lib/db", () => {
  const actual = jest.requireActual("@/lib/db");
  return { ...actual, inTransaction: (fn: () => unknown) => fn() };
});

import { POST } from "@/app/api/models/fallbacks/route";

function req(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  jest.clearAllMocks();
  addFallbackEntry.mockReturnValue({ id: "new" });
  getFallbackConfig.mockReturnValue({});
});

it("add: inserts a registry model + returns 201", async () => {
  const res = await POST(req({ action: "add", modelId: "m1" }));
  expect(res.status).toBe(201);
  expect(addFallbackEntry).toHaveBeenCalledWith(expect.objectContaining({ modelId: "m1" }));
});

it("toggle: accepts `entryId` (bug-fix) and toggles by id", async () => {
  toggleFallbackEntry.mockReturnValue({ id: "e1" });
  const res = await POST(req({ action: "toggle", entryId: "e1", enabled: false }));
  expect(res.status).toBe(200);
  expect(toggleFallbackEntry).toHaveBeenCalledWith("e1", false);
});

it("toggle: 404 when the entry doesn't exist", async () => {
  toggleFallbackEntry.mockReturnValue(null);
  const res = await POST(req({ action: "toggle", entryId: "missing", enabled: true }));
  expect(res.status).toBe(404);
});

it("custom: accepts `name`/`baseUrl` (bug-fix) and maps to modelName/overrideBaseUrl", async () => {
  const res = await POST(
    req({ action: "custom", name: "GPT-4o", provider: "openai", modelIdString: "gpt-4o", baseUrl: "http://x" }),
  );
  expect(res.status).toBe(201);
  expect(addFallbackEntry).toHaveBeenCalledWith(
    expect.objectContaining({
      modelId: null,
      modelName: "GPT-4o",
      provider: "openai",
      modelIdString: "gpt-4o",
      overrideBaseUrl: "http://x",
    }),
  );
});

it("reorder: looks up the entry + swaps within the chain", async () => {
  getFallbackEntry.mockReturnValue({ id: "e1" });
  listFallbackChain.mockReturnValue([
    { id: "e1", position: 0 },
    { id: "e2", position: 1 },
  ]);
  const res = await POST(req({ action: "reorder", entryId: "e1", direction: "down" }));
  expect(res.status).toBe(200);
  expect(updateFallbackEntry).toHaveBeenCalledTimes(2);
  expect(commitFallbackChange).toHaveBeenCalled();
});

it("sync: writes the enabled chain to Hermes", async () => {
  syncEnabledFallbackChainToHermes.mockReturnValue({ hermesHome: "/h", configPath: "/c", backupPath: null });
  const res = await POST(req({ action: "sync" }));
  expect(res.status).toBe(200);
  expect(syncEnabledFallbackChainToHermes).toHaveBeenCalled();
});

it("import: delegates to importFallbacksFromHermesYaml", async () => {
  const { NextResponse } = jest.requireActual("next/server");
  importFallbacksFromHermesYaml.mockReturnValue(NextResponse.json({ data: { imported: 0 } }));
  const res = await POST(req({ action: "import" }));
  expect(importFallbacksFromHermesYaml).toHaveBeenCalledWith(false);
  expect(res.status).toBe(200);
});

it("rejects an unknown action with 400 (zod discriminated union)", async () => {
  const res = await POST(req({ action: "bogus" }));
  expect(res.status).toBe(400);
  expect(addFallbackEntry).not.toHaveBeenCalled();
});

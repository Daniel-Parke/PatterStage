/** @jest-environment node */

/* eslint-disable @typescript-eslint/no-require-imports */

// T-0088, ruling 4: bound everything. Round 6, findings 11 and 21: the
// missions list ignored limit (61 rows for limit=5, verified live), models
// were unbounded and unordered. The repository takes the bound; the route
// plumbs it; ordering is deterministic and stated.

import { NextRequest } from "next/server";
import { execBaselineSchema } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;
let tick = 0;

function loadRealBetterSqlite3(): typeof import("better-sqlite3") {
  return require("better-sqlite3/lib/index.js") as typeof import("better-sqlite3");
}

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    getDb: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    // Strictly increasing so ORDER BY created_at DESC is a total order.
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, 0, ++tick)).toISOString(),
    ensureDb: () => undefined,
  };
});

beforeEach(() => {
  const Database = loadRealBetterSqlite3();
  testDb = new (Database as unknown as new (path: string) => import("better-sqlite3").Database)(":memory:");
  testDb.pragma("foreign_keys = ON");
  execBaselineSchema(testDb);
});

afterEach(() => {
  testDb?.close();
  testDb = null;
});

describe("listMissions is bounded and newest-first", () => {
  const repo = () => require("@/lib/missions/mission-repository") as typeof import("@/lib/missions/mission-repository");

  it("honours limit and offset, newest first", () => {
    const { createMission, listMissions } = repo();
    const ids = Array.from({ length: 5 }, (_, i) => createMission({ name: `m${i}`, prompt: "p" }).id);

    const page1 = listMissions({ limit: 2 });
    const page2 = listMissions({ limit: 2, offset: 2 });

    expect(page1.map((m) => m.id)).toEqual([ids[4], ids[3]]);
    expect(page2.map((m) => m.id)).toEqual([ids[2], ids[1]]);
  });

  it("clamps a wild limit to the ceiling rather than passing it to SQL", () => {
    const { createMission, listMissions } = repo();
    for (let i = 0; i < 3; i += 1) createMission({ name: `m${i}`, prompt: "p" });

    expect(listMissions({ limit: -1 })).toHaveLength(1);
    expect(listMissions({ limit: 1e9 })).toHaveLength(3);
  });

  it("GREEN CONTROL: no options still lists, bounded by the default", () => {
    const { createMission, listMissions } = repo();
    createMission({ name: "one", prompt: "p" });

    expect(listMissions()).toHaveLength(1);
  });
});

describe("listModels is bounded and newest-first", () => {
  it("honours limit, newest first", () => {
    const { createModel, listModels } = require("@/lib/models-repository") as typeof import("@/lib/models-repository");
    const a = createModel({ name: "a", provider: "openai", modelId: "m-a" });
    const b = createModel({ name: "b", provider: "openai", modelId: "m-b" });
    const c = createModel({ name: "c", provider: "openai", modelId: "m-c" });

    expect(listModels({ limit: 2 }).map((m) => m.id)).toEqual([c.id, b.id]);
    expect(listModels().map((m) => m.id)).toEqual([c.id, b.id, a.id]);
  });
});

describe("the routes plumb the bound through", () => {
  const req = (path: string) => new NextRequest(`http://localhost${path}`);

  it("GET /api/missions?limit=5 asks the repository for five", async () => {
    jest.resetModules();
    const listMissions = jest.fn(() => []);
    jest.doMock("@/lib/missions/mission-repository", () => ({ listMissions, getMission: jest.fn(), MISSION_LIST_BOUNDS: { defaultLimit: 200, maxLimit: 500 } }));
    jest.doMock("@/lib/runs-repository", () => ({ listLatestRunsForMissions: () => new Map(), getLatestRunForMission: jest.fn() }));
    jest.doMock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn() }));
    jest.doMock("@/lib/api-auth", () => ({ requireNotReadOnly: () => null }));
    const { GET } = require("@/app/api/missions/route") as typeof import("@/app/api/missions/route");

    const res = await GET(req("/api/missions?limit=5&offset=10"));

    expect(res.status).toBe(200);
    expect(listMissions).toHaveBeenCalledWith(expect.objectContaining({ limit: 5, offset: 10 }));
  });

  it("GET /api/missions with junk bounds still lists, with the defaults", async () => {
    jest.resetModules();
    const listMissions = jest.fn(() => []);
    jest.doMock("@/lib/missions/mission-repository", () => ({ listMissions, getMission: jest.fn(), MISSION_LIST_BOUNDS: { defaultLimit: 200, maxLimit: 500 } }));
    jest.doMock("@/lib/runs-repository", () => ({ listLatestRunsForMissions: () => new Map(), getLatestRunForMission: jest.fn() }));
    jest.doMock("@/lib/sync", () => ({ ensureSyncLayer: jest.fn() }));
    jest.doMock("@/lib/api-auth", () => ({ requireNotReadOnly: () => null }));
    const { GET } = require("@/app/api/missions/route") as typeof import("@/app/api/missions/route");

    const res = await GET(req("/api/missions?limit=abc&offset=-3"));

    expect(res.status).toBe(200);
    expect(listMissions).toHaveBeenCalledWith(expect.objectContaining({ limit: 200, offset: 0 }));
  });

  it("GET /api/artifacts?limit=3 asks the repository for three", async () => {
    jest.resetModules();
    const listArtifacts = jest.fn(() => []);
    jest.doMock("@/lib/artifacts-repository", () => ({ listArtifacts, createArtifact: jest.fn(), SOURCE_KINDS: ["mission"] }));
    const { GET } = require("@/app/api/artifacts/route") as typeof import("@/app/api/artifacts/route");

    await GET(req("/api/artifacts?limit=3"));

    expect(listArtifacts).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }));
  });

  it("GET /api/models?limit=2 and GET /api/schedules?limit=2 pass the bound", async () => {
    jest.resetModules();
    const listModels = jest.fn(() => []);
    const listSchedules = jest.fn(() => []);
    jest.doMock("@/lib/models-repository", () => ({ listModels, createModel: jest.fn(), deleteModel: jest.fn(), MODEL_LIST_BOUNDS: { defaultLimit: 200, maxLimit: 500 } }));
    jest.doMock("@/lib/schedules-repository", () => ({ listSchedules, createSchedule: jest.fn(), SCHEDULE_LIST_BOUNDS: { defaultLimit: 200, maxLimit: 500 } }));
    jest.doMock("@/modules/hermes/lib/config-sync", () => ({ syncDefaultsToHermesConfig: jest.fn() }));
    const models = require("@/app/api/models/route") as typeof import("@/app/api/models/route");
    const schedules = require("@/app/api/schedules/route") as typeof import("@/app/api/schedules/route");

    await models.GET(req("/api/models?limit=2"));
    await schedules.GET(req("/api/schedules?limit=2"));

    expect(listModels).toHaveBeenCalledWith(expect.objectContaining({ limit: 2 }));
    expect(listSchedules).toHaveBeenCalledWith(expect.objectContaining({ limit: 2 }));
  });

  it("chat, composer runs and research plumb limit to their existing repository caps", async () => {
    jest.resetModules();
    const listConversations = jest.fn(() => []);
    const listComposerRuns = jest.fn(() => []);
    const listResearchRuns = jest.fn(() => []);
    jest.doMock("@/lib/chat-repository", () => ({ listConversations, createConversation: jest.fn() }));
    jest.doMock("@/lib/runtime", () => ({ runtime: {} }));
    jest.doMock("@/lib/composer/composer-repository", () => ({ listComposerRuns, createComposerRun: jest.fn(), getComposerWorkflow: jest.fn() }));
    jest.doMock("@/lib/composer/engine", () => ({ advanceComposerRun: jest.fn() }));
    jest.doMock("@/lib/feature-flags", () => ({ isFeatureEnabled: () => true }));
    jest.doMock("@/lib/laboratory/deep-research/research-repository", () => ({ listResearchRuns, createResearchRun: jest.fn() }));
    jest.doMock("@/lib/laboratory/deep-research/run-job", () => ({ runResearchJob: jest.fn() }));
    const chat = require("@/app/api/chat/route") as typeof import("@/app/api/chat/route");
    const composer = require("@/app/api/composer/runs/route") as typeof import("@/app/api/composer/runs/route");
    const research = require("@/app/api/laboratory/research/route") as typeof import("@/app/api/laboratory/research/route");

    await chat.GET(req("/api/chat?limit=7"));
    await composer.GET(req("/api/composer/runs?limit=8"));
    await research.GET(req("/api/laboratory/research?limit=9"));

    expect(listConversations).toHaveBeenCalledWith(7);
    expect(listComposerRuns).toHaveBeenCalledWith(8);
    expect(listResearchRuns).toHaveBeenCalledWith(9);
  });
});

/** @jest-environment node */

// T-0087, the lifecycle. Creation spends minutes inside an LLM call, and the
// row's status during that window was "active" from birth: the UI has carried
// a "generating" badge since the schema was written and nothing ever set it.
// Restart the server mid-create and the story sat "active" with no chapters
// forever. Missions have reconcileRunsOnBoot for exactly this; stories get the
// same sweep, at the same moment.

import { execBaselineSchema } from "../helpers/baseline-db";

let testDb: import("better-sqlite3").Database | null = null;

jest.mock("@/lib/db", () => {
  const actualCrypto = jest.requireActual("crypto") as typeof import("crypto");
  return {
    getDb: () => testDb!,
    inTransaction: <T,>(fn: () => T) => testDb!.transaction(fn)(),
    uuid: () => actualCrypto.randomUUID(),
    now: () => new Date().toISOString(),
    ensureDb: () => undefined,
  };
});

import {
  createStory,
  getStory,
  reconcileStoriesOnBoot,
  updateStory,
} from "@/modules/rec-room/lib/story-repository";
import { recRoomServerModule } from "@/modules/rec-room/server";

function loadRealBetterSqlite3(): unknown {
  // The mapper points "better-sqlite3" at a manual mock; the real CJS entry
  // is reached by its file path, as every DB-backed test in this tree does.
  return jest.requireActual("better-sqlite3/lib/index.js");
}

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

describe("the module hook reaches the sweep", () => {
  it("recRoomServerModule.reconcileOnBoot sweeps a generating story", () => {
    const s = createStory({ title: "hook", config: {}, chapters: [], status: "generating" });

    recRoomServerModule.reconcileOnBoot!();

    expect(getStory(s.id)!.status).toBe("failed");
  });
});

describe("reconcileStoriesOnBoot", () => {
  it("marks a story left 'generating' as failed, and says why", () => {
    const s = createStory({ title: "Left mid-create", config: {}, chapters: [], status: "generating" });

    const result = reconcileStoriesOnBoot();

    const after = getStory(s.id)!;
    expect(result.failedStories).toBe(1);
    expect(after.status).toBe("failed");
    expect(after.generationError).toMatch(/restart|interrupted/i);
  });

  it("marks a chapter left 'writing' as failed without touching its siblings", () => {
    const s = createStory({
      title: "Left mid-chapter",
      config: {},
      chapters: [
        { number: 1, title: "One", status: "complete", wordCount: 900 },
        { number: 2, title: "Two", status: "writing", wordCount: 0 },
        { number: 3, title: "Three", status: "pending", wordCount: 0 },
      ],
      status: "active",
    });

    const result = reconcileStoriesOnBoot();

    const after = getStory(s.id)!;
    expect(result.failedChapters).toBe(1);
    expect(after.status).toBe("active");
    expect(after.chapters.map((c) => c.status)).toEqual(["complete", "failed", "pending"]);
    expect(after.chapters[1].error).toMatch(/restart|interrupted/i);
  });

  it("GREEN CONTROL: leaves complete, active and already-failed stories alone", () => {
    const a = createStory({ title: "a", config: {}, chapters: [], status: "active" });
    const c = createStory({ title: "c", config: {}, chapters: [], status: "complete" });
    const f = createStory({ title: "f", config: {}, chapters: [], status: "failed" });
    updateStory(f.id, { generationError: "original reason" });

    const result = reconcileStoriesOnBoot();

    expect(result).toEqual({ failedStories: 0, failedChapters: 0 });
    expect(getStory(a.id)!.status).toBe("active");
    expect(getStory(c.id)!.status).toBe("complete");
    expect(getStory(f.id)!.generationError).toBe("original reason");
  });
});

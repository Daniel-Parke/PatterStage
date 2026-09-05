/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// B14 oracle, group spend-plumbing, part four: the handlers ask for it
// (D87 and D88, blockers). Contract sections 2.6 and 3.3.
//
// The companion file b14-story-spend-is-recorded.test.ts holds callLLM's half
// of the bargain. This one holds the callers': every Story Weaver call must
// name its source, carry the operator's chosen writing model, and forward the
// request's abort signal, or the recording and the Stop reach nothing.
//
// callLLM itself is a double here, so the assertions are exactly the options
// the handlers pass and nothing about the provider.
// ═══════════════════════════════════════════════════════════════

const callLLMMock = jest.fn();
jest.mock("@/lib/llm", () => ({
  callLLM: (...args: unknown[]) => callLLMMock(...args),
}));

const getStory = jest.fn();
const updateStory = jest.fn();
jest.mock("@/modules/rec-room/lib/story-repository", () => ({
  getStory: (id: string) => getStory(id),
  updateStory: (id: string, patch: unknown) => updateStory(id, patch),
  createStory: jest.fn(),
  deleteStory: jest.fn(),
  listStories: jest.fn(),
  reconcileStoriesOnBoot: jest.fn(),
}));

jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(() => ({ status: 500, body: { error: "boom" } })),
}));

// The house NextResponse double: the handlers answer through NextResponse.json.
jest.mock("next/server", () => ({
  NextResponse: class NextResponse {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      this.status = status;
      this.body = body;
    }
    async json() {
      return this.body;
    }
    static json(data: unknown, init?: ResponseInit) {
      return new NextResponse(init?.status ?? 200, data);
    }
  },
}));

import type { LLMOptions } from "@/lib/llm";
import * as generate from "@/modules/rec-room/handlers/generate";
import * as edit from "@/modules/rec-room/handlers/edit";

// ── pre-B14 type shims ──────────────────────────────────────────

type B14Options = LLMOptions & {
  spend?: { source: string; storyId?: string | null };
  signal?: AbortSignal;
};

interface HandlerOpts {
  signal?: AbortSignal;
}
/** The handlers gain an optional second parameter; read loosely until they do. */
type Handler = (body: Record<string, unknown>, opts?: HandlerOpts) => Promise<unknown>;

const handleGenerateChapter = generate.handleGenerateChapter as unknown as Handler;
const handleEditChapter = edit.handleEditChapter as unknown as Handler;
const handleContinue = edit.handleContinue as unknown as Handler;

function optionsOf(): B14Options[] {
  return callLLMMock.mock.calls.map((c) => (c[1] ?? {}) as B14Options);
}

// ── the story fixture ───────────────────────────────────────────

function storyFixture(over: Record<string, unknown> = {}) {
  return {
    id: "S-1",
    title: "A story",
    // The writing model the operator picked on the create page (contract 4.1).
    config: { premise: "p", modelId: "m-99" },
    masterPrompt: "STORY CONFIGURATION:\nChapter Length: 1800-2500 words per chapter",
    storyArc: {
      storyArc: "A throughline",
      fixedPlotPoints: [],
      chapterOutlines: [
        { number: 1, title: "One", purpose: "Open", keyBeats: [], emotionalTone: "Calm" },
        { number: 2, title: "Two", purpose: "Turn", keyBeats: [], emotionalTone: "Tense" },
      ],
    },
    rollingSummary: "so far",
    chapters: [
      { number: 1, title: "One", status: "complete", wordCount: 100 },
      { number: 2, title: "Two", status: "pending", wordCount: 0 },
    ],
    chapterContents: { "1": "Chapter one text." },
    status: "active",
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  callLLMMock.mockResolvedValue({ content: "Prose enough to keep.", model: "gpt-4o-mini" });
  getStory.mockImplementation(() => storyFixture());
  updateStory.mockImplementation(() => storyFixture());
});

// ═══════════════════════════════════════════════════════════════

describe("generate-chapter", () => {
  it("tags every call as story spend for THIS story", async () => {
    await handleGenerateChapter({ storyId: "S-1" });

    const all = optionsOf();
    expect(all.length).toBeGreaterThan(0);
    for (const o of all) {
      expect(o.spend).toEqual({ source: "story", storyId: "S-1" });
    }
  });

  it("writes with the model the operator chose", async () => {
    await handleGenerateChapter({ storyId: "S-1" });
    expect(optionsOf()[0].modelId).toBe("m-99");
  });

  it("falls back to the agent default when the story names no model", async () => {
    getStory.mockImplementation(() => storyFixture({ config: { premise: "p" } }));
    await handleGenerateChapter({ storyId: "S-1" });
    expect(optionsOf()[0].modelId).toBeUndefined();
  });

  it("forwards the request's signal, so a Stop reaches the provider", async () => {
    const controller = new AbortController();
    await handleGenerateChapter({ storyId: "S-1" }, { signal: controller.signal });
    expect(optionsOf()[0].signal).toBe(controller.signal);
  });
});

describe("edit-chapter and continue", () => {
  it("tag their calls and carry the same model", async () => {
    await handleEditChapter({ storyId: "S-1", chapterNumber: 1, editPrompt: "darker" });

    getStory.mockImplementation(() => storyFixture({ status: "complete" }));
    callLLMMock.mockResolvedValue({ content: "[]", model: "gpt-4o-mini" });
    await handleContinue({ storyId: "S-1", direction: "onward", count: 2 });

    const all = optionsOf();
    expect(all.length).toBeGreaterThan(1);
    for (const o of all) {
      expect(o.spend).toEqual({ source: "story", storyId: "S-1" });
      expect(o.modelId).toBe("m-99");
    }
  });

  it("edit-chapter forwards the request's signal", async () => {
    const controller = new AbortController();
    await handleEditChapter(
      { storyId: "S-1", chapterNumber: 1, editPrompt: "darker" },
      { signal: controller.signal },
    );
    expect(optionsOf()[0].signal).toBe(controller.signal);
  });
});

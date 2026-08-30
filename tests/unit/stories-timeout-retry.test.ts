/** @jest-environment node */

// Regression test: callLLM in stories route must retry on timeout (AbortError)
// Bug: AbortError handler threw immediately without checking remaining retries.
// All other errors (network, 429, empty response) retried, but timeouts didn't.

jest.mock("next/server", () => {
  class NextResponse {
    status: number;
    ok: boolean;
    statusText: string;
    headers: Headers;
    private _data: unknown;
    constructor(data?: unknown, init?: ResponseInit) {
      this._data = data;
      this.status = init?.status ?? 200;
      this.ok = this.status >= 200 && this.status < 300;
      this.statusText = init?.statusText ?? "OK";
      this.headers = new Headers(init?.headers);
    }
    static json(data: unknown, init?: ResponseInit) {
      return new NextResponse(data, init);
    }
    async json() {
      return this._data;
    }
  }
  return {
    NextRequest: class NextRequest {
      url: string;
      method: string;
      headers: Headers;
      bodyUsed: boolean = false;
      private _body: string;
      constructor(url: string, init?: RequestInit) {
        this.url = url;
        this.method = init?.method ?? "GET";
        this.headers = new Headers(init?.headers as HeadersInit);
        this._body = typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? {});
      }
      async json() { return JSON.parse(this._body); }
    },
    NextResponse,
  };
});

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/modules/rec-room/lib/prompts", () => ({
  getStoryPrompt: jest.fn(() => "system prompt"),
}));

jest.mock("@/lib/api-auth", () => ({
}));

// Mock story-repository (NOT stories-repository - the file is story-repository.ts)
jest.mock("@/modules/rec-room/lib/story-repository", () => {
  const listStories = jest.fn();
  const getStory = jest.fn();
  const saveStory = jest.fn();
  const createStory = jest.fn();
  const updateStory = jest.fn();
  const deleteStory = jest.fn();

  return {
    listStories,
    getStory,
    saveStory,
    createStory,
    updateStory,
    deleteStory,
    __listStories: listStories,
    __getStory: getStory,
    __saveStory: saveStory,
    STORY_DATA_DIR: "/tmp/test-hermes/stories",
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storyRepo = require("@/modules/rec-room/lib/story-repository") as Record<string, unknown>;
const mockGetStory = storyRepo.__getStory as jest.Mock;
const mockSaveStory = storyRepo.__saveStory as jest.Mock;

describe("callLLM timeout retry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("retries on AbortError (timeout) instead of failing immediately", async () => {
    const mockStory = {
      id: "test-story",
      title: "Test Story",
      masterPrompt: "A test story",
      storyArc: {
        storyArc: "Test arc",
        fixedPlotPoints: [],
        characterArcs: [],
        worldRules: [],
        themes: [],
        chapterOutlines: [
          { number: 1, title: "Chapter 1", purpose: "Introduction", keyBeats: ["Start"], emotionalTone: "Engaging" },
        ],
      },
      rollingSummary: "",
      chapters: [{ number: 1, title: "Chapter 1", status: "pending", wordCount: 0, generatedAt: null }],
      chapterContents: {},
      config: { premise: "Test" },
      status: "active",
    };

    mockGetStory.mockReturnValue(mockStory);
    mockSaveStory.mockReturnValue(undefined);

    let fetchCallCount = 0;

    // Mock global fetch: first call aborts, second call succeeds
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => {
          fetchCallCount++;
          if (fetchCallCount === 1) {
            // Return an AbortError-like response on first call
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            throw err;
          }
          return {
            choices: [{ message: { content: "Successfully generated content after retry." } }],
          };
        },
      })
    ) as jest.Mock;

    try {
      const { POST } = await import("@/app/api/stories/route");
      const { NextRequest } = await import("next/server");

      const request = new NextRequest("http://localhost/api/stories", {
        method: "POST",
        body: JSON.stringify({ action: "generate-chapter", storyId: "test-story" }),
      });

      const res = await POST(request);
      const data = await res.json();

      // The callLLM should have retried after first failure
      expect(fetchCallCount).toBeGreaterThanOrEqual(2);
      expect(res.status).toBe(200);
      expect(data.data?.chapter).toBe(1);
    } finally {
      global.fetch = originalFetch;
    }
  }, 30_000);
});

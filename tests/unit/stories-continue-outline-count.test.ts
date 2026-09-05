/** @jest-environment node */

// Regression test: /api/stories continue action must truncate outlines to requested count
// Bug: if LLM generated MORE outlines than requested, all were appended instead of just addCount

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
    __updateStory: updateStory,
    STORY_DATA_DIR: "/tmp/test-hermes/stories",
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storyRepo = require("@/modules/rec-room/lib/story-repository") as Record<string, unknown>;
const mockGetStory = storyRepo.__getStory as jest.Mock;
const mockSaveStory = storyRepo.__saveStory as jest.Mock;
const mockUpdateStory = storyRepo.__updateStory as jest.Mock;

const mockOutlines = [
  { number: 2, title: "Chapter 2", purpose: "Development A", keyBeats: ["Event A"], emotionalTone: "Tense" },
  { number: 3, title: "Chapter 3", purpose: "Development B", keyBeats: ["Event B"], emotionalTone: "Dramatic" },
  { number: 4, title: "Chapter 4", purpose: "Development C", keyBeats: ["Event C"], emotionalTone: "Climactic" },
  { number: 5, title: "Chapter 5", purpose: "Development D", keyBeats: ["Event D"], emotionalTone: "Falling" },
  { number: 6, title: "Chapter 6", purpose: "Resolution", keyBeats: ["Event E"], emotionalTone: "Satisfying" },
];

const mockStory = {
  id: "story_test123",
  title: "Test Story",
  status: "complete",
  chapters: [
    { number: 1, title: "Chapter 1", status: "complete", wordCount: 1000, generatedAt: "2025-01-01" },
  ],
  chapterContents: { "1": "Chapter 1 content" },
  storyArc: {
    storyArc: "A test story",
    chapterOutlines: [
      { number: 1, title: "Chapter 1", purpose: "Introduction", keyBeats: ["Start"], emotionalTone: "Engaging" },
    ],
    fixedPlotPoints: [],
    characterArcs: [],
    worldRules: [],
    themes: [],
  },
  rollingSummary: "Chapter 1 summary",
  masterPrompt: "Write a story",
  config: { length: "medium", premise: "A test" },
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
};

describe("/api/stories continue outline count validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CH_READ_ONLY;
  });

  it("truncates outlines when LLM returns more than requested count", async () => {
    mockGetStory.mockReturnValue({ ...mockStory });
    mockSaveStory.mockReturnValue(undefined);
    // updateStory is called by handleContinue — return a properly updated story
    mockUpdateStory.mockImplementation((_id: string, updates: Record<string, unknown>) => ({
      ...mockStory,
      ...updates,
      chapters: updates.chapters as typeof mockStory.chapters,
    }));

    // Mock global fetch to return MORE outlines than requested (5 instead of 3)
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          choices: [{ message: { content: JSON.stringify(mockOutlines) } }],
        }),
      })
    ) as jest.Mock;

    try {
      const { POST } = await import("@/app/api/stories/route");
      const { NextRequest } = await import("next/server");

      const request = new NextRequest("http://localhost/api/stories", {
        method: "POST",
        body: JSON.stringify({
          action: "continue",
          storyId: "story_test123",
          direction: "Continue the adventure",
          count: 3, // Request 3 chapters
        }),
      });

      const res = await POST(request);
      const data = await res.json();

      // Should succeed
      expect(res.status).toBe(200);
      expect(data.data).toBeDefined();

      // Verify updateStory was called (saveStory is not used in continue action)
      expect(mockUpdateStory).toHaveBeenCalled();

      // The updated story should have 4 chapters total (1 original + 3 new, not 1 + 5 = 6)
      const savedStory = mockUpdateStory.mock.calls[0][1] as { chapters: Array<unknown>; storyArc: { chapterOutlines: Array<unknown> } };
      expect(savedStory.chapters.length).toBe(4);
      expect(savedStory.storyArc.chapterOutlines.length).toBe(4);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("returns 404 when story is not found", async () => {
    mockGetStory.mockReturnValue(null);

    const { POST } = await import("@/app/api/stories/route");
    const { NextRequest } = await import("next/server");

    const request = new NextRequest("http://localhost/api/stories", {
      method: "POST",
      body: JSON.stringify({
        action: "continue",
        storyId: "nonexistent",
        direction: "Continue",
        count: 3,
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(404);
  });
});

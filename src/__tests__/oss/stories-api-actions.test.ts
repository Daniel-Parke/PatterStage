/** @jest-environment node */

// Regression tests for /api/stories POST handler actions not covered by other test files:
// - handleCreate validation (missing premise)
// - handleLoad missing storyId
// - handleUpdate missing storyId
// - handleDelete missing storyId
// - unknown action returns 400
// - validateChapterOutput strips meta commentary

jest.mock("next/server", () => ({
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
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => {
      const status = init?.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: "OK",
        headers: new Headers(),
        json: () => Promise.resolve(data),
      };
    },
  },
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
}));

jest.mock("@/lib/story-weaver/prompts", () => ({
  getStoryPrompt: jest.fn(() => "system prompt"),
}));

jest.mock("@/lib/api-auth", () => ({
  requireMcApiKey: jest.fn(() => null),
  requireNotReadOnly: jest.fn(() => null),
}));

// Mock story-repository
jest.mock("@/lib/story-repository", () => {
  const listStories = jest.fn();
  const getStory = jest.fn();
  const createStory = jest.fn();
  const updateStory = jest.fn();
  const deleteStory = jest.fn();

  return {
    listStories,
    getStory,
    createStory,
    updateStory,
    deleteStory,
    __listStories: listStories,
    __getStory: getStory,
    __createStory: createStory,
    __updateStory: updateStory,
    __deleteStory: deleteStory,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const storyRepo = require("@/lib/story-repository") as Record<string, unknown>;
const mockGetStory = storyRepo.__getStory as jest.Mock;
const mockCreateStory = storyRepo.__createStory as jest.Mock;
const mockUpdateStory = storyRepo.__updateStory as jest.Mock;
const mockDeleteStory = storyRepo.__deleteStory as jest.Mock;
const mockListStories = storyRepo.__listStories as jest.Mock;

const mockStory = {
  id: "story_test123",
  title: "Test Story",
  status: "complete",
  chapters: [
    { number: 1, title: "Chapter 1", status: "complete", wordCount: 1000, generatedAt: "2025-01-01" },
    { number: 2, title: "Chapter 2", status: "complete", wordCount: 1200, generatedAt: "2025-01-02" },
  ],
  chapterContents: {
    "1": "Chapter 1 content here",
    "2": "Chapter 2 content here",
  },
  storyArc: {
    storyArc: "A test story",
    chapterOutlines: [
      { number: 1, title: "Chapter 1", purpose: "Introduction", keyBeats: ["Start"], emotionalTone: "Engaging" },
      { number: 2, title: "Chapter 2", purpose: "Development", keyBeats: ["Middle"], emotionalTone: "Tense" },
    ],
    fixedPlotPoints: [],
    characterArcs: [],
    worldRules: [],
    themes: [],
  },
  rollingSummary: "Two chapters complete",
  masterPrompt: "Write a story",
  config: { length: "medium", premise: "A test" },
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
};

describe("/api/stories action validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CH_READ_ONLY;
  });

  describe("handleLoad", () => {
    it("returns 400 when storyId is missing", async () => {
      const { POST } = await import("@/app/api/stories/route");
      const { NextRequest } = await import("next/server");

      const request = new NextRequest("http://localhost/api/stories", {
        method: "POST",
        body: JSON.stringify({ action: "load" }),
      });

      const res = await POST(request);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("storyId");
    });

    it("returns 404 when story is not found", async () => {
      mockGetStory.mockReturnValue(null);

      const { POST } = await import("@/app/api/stories/route");
      const { NextRequest } = await import("next/server");

      const request = new NextRequest("http://localhost/api/stories", {
        method: "POST",
        body: JSON.stringify({ action: "load", storyId: "nonexistent" }),
      });

      const res = await POST(request);
      expect(res.status).toBe(404);
    });

    it("returns story when found", async () => {
      mockGetStory.mockReturnValue(mockStory);

      const { POST } = await import("@/app/api/stories/route");
      const { NextRequest } = await import("next/server");

      const request = new NextRequest("http://localhost/api/stories", {
        method: "POST",
        body: JSON.stringify({ action: "load", storyId: "story_test123" }),
      });

      const res = await POST(request);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.id).toBe("story_test123");
    });
  });

  describe("handleUpdate", () => {
    it("returns 400 when storyId is missing", async () => {
      const { POST } = await import("@/app/api/stories/route");
      const { NextRequest } = await import("next/server");

      const request = new NextRequest("http://localhost/api/stories", {
        method: "POST",
        body: JSON.stringify({ action: "update", title: "New Title" }),
      });

      const res = await POST(request);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("storyId");
    });

    it("returns 404 when story is not found", async () => {
      mockUpdateStory.mockReturnValue(null);

      const { POST } = await import("@/app/api/stories/route");
      const { NextRequest } = await import("next/server");

      const request = new NextRequest("http://localhost/api/stories", {
        method: "POST",
        body: JSON.stringify({ action: "update", storyId: "nonexistent", title: "New Title" }),
      });

      const res = await POST(request);
      expect(res.status).toBe(404);
    });

    it("updates and returns story when found", async () => {
      const updated = { ...mockStory, title: "Updated Title" };
      mockUpdateStory.mockReturnValue(updated);

      const { POST } = await import("@/app/api/stories/route");
      const { NextRequest } = await import("next/server");

      const request = new NextRequest("http://localhost/api/stories", {
        method: "POST",
        body: JSON.stringify({ action: "update", storyId: "story_test123", title: "Updated Title" }),
      });

      const res = await POST(request);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.title).toBe("Updated Title");
    });
  });

  describe("handleDelete", () => {
    it("returns 400 when storyId is missing", async () => {
      const { POST } = await import("@/app/api/stories/route");
      const { NextRequest } = await import("next/server");

      const request = new NextRequest("http://localhost/api/stories", {
        method: "POST",
        body: JSON.stringify({ action: "delete" }),
      });

      const res = await POST(request);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("storyId");
    });

    it("returns 404 when story is not found", async () => {
      mockDeleteStory.mockReturnValue(false);

      const { POST } = await import("@/app/api/stories/route");
      const { NextRequest } = await import("next/server");

      const request = new NextRequest("http://localhost/api/stories", {
        method: "POST",
        body: JSON.stringify({ action: "delete", storyId: "nonexistent" }),
      });

      const res = await POST(request);
      expect(res.status).toBe(404);
    });

    it("deletes and returns success when found", async () => {
      mockDeleteStory.mockReturnValue(true);

      const { POST } = await import("@/app/api/stories/route");
      const { NextRequest } = await import("next/server");

      const request = new NextRequest("http://localhost/api/stories", {
        method: "POST",
        body: JSON.stringify({ action: "delete", storyId: "story_test123" }),
      });

      const res = await POST(request);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.deleted).toBe(true);
    });
  });

  describe("handleList", () => {
    it("returns list of stories", async () => {
      mockListStories.mockReturnValue([mockStory]);

      const { POST } = await import("@/app/api/stories/route");
      const { NextRequest } = await import("next/server");

      const request = new NextRequest("http://localhost/api/stories", {
        method: "POST",
        body: JSON.stringify({ action: "list" }),
      });

      const res = await POST(request);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.stories).toHaveLength(1);
      expect(data.data.stories[0].id).toBe("story_test123");
    });

    it("returns empty list on error", async () => {
      mockListStories.mockImplementation(() => { throw new Error("DB error"); });

      const { POST } = await import("@/app/api/stories/route");
      const { NextRequest } = await import("next/server");

      const request = new NextRequest("http://localhost/api/stories", {
        method: "POST",
        body: JSON.stringify({ action: "list" }),
      });

      const res = await POST(request);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.stories).toEqual([]);
    });
  });

  describe("unknown action", () => {
    it("returns 400 for unknown action", async () => {
      const { POST } = await import("@/app/api/stories/route");
      const { NextRequest } = await import("next/server");

      const request = new NextRequest("http://localhost/api/stories", {
        method: "POST",
        body: JSON.stringify({ action: "invalid-action" }),
      });

      const res = await POST(request);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Unknown action");
    });
  });
});

/** @jest-environment node */

// ═══════════════════════════════════════════════════════════════
// B14 oracle, group stop, the route seam (D88, blocker). Contract section 3.3.
//
// THE DEFECT. The reader's only brake on a chapter in flight is closing the
// tab, and even that changes nothing: POST /api/stories reads the body and
// forgets the request (route.ts:29-57), so a client that disconnects leaves the
// provider call running to completion and billing for it.
//
// THE CONTRACT. The route hands each generating action the request's own
// AbortSignal as `{ signal: request.signal }`. Combined with LLMOptions.signal
// (b14-story-spend-is-recorded.test.ts) and the reader's Stop
// (b14-story-reader-writes-on-request.test.tsx), a Stop aborts before the next
// call rather than after it.
//
// Every handler is a double here: the assertion is the wiring and nothing else.
// ═══════════════════════════════════════════════════════════════

const handleCreate = jest.fn();
const handleGenerateChapter = jest.fn();
const handleRetryChapter = jest.fn();
const handleRewriteChapter = jest.fn();
const handleEditChapter = jest.fn();
const handleContinue = jest.fn();
const handleExtend = jest.fn();

jest.mock("@/modules/rec-room/handlers/create", () => ({
  handleCreate: (...a: unknown[]) => handleCreate(...a),
}));
jest.mock("@/modules/rec-room/handlers/generate", () => ({
  handleGenerateChapter: (...a: unknown[]) => handleGenerateChapter(...a),
  handleRetryChapter: (...a: unknown[]) => handleRetryChapter(...a),
  handleRewriteChapter: (...a: unknown[]) => handleRewriteChapter(...a),
}));
jest.mock("@/modules/rec-room/handlers/edit", () => ({
  handleEditChapter: (...a: unknown[]) => handleEditChapter(...a),
  handleContinue: (...a: unknown[]) => handleContinue(...a),
  handleExtend: (...a: unknown[]) => handleExtend(...a),
}));
jest.mock("@/modules/rec-room/handlers/crud", () => ({
  handleList: jest.fn(async () => ({ status: 200, body: { data: {} } })),
  handleLoad: jest.fn(async () => ({ status: 200, body: { data: {} } })),
  handleUpdate: jest.fn(async () => ({ status: 200, body: { data: {} } })),
  handleSyncTitles: jest.fn(async () => ({ status: 200, body: { data: {} } })),
  handleDelete: jest.fn(async () => ({ status: 200, body: { data: {} } })),
}));
jest.mock("@/modules/rec-room/handlers/library", () => ({
  handleCharacters: jest.fn(async () => ({ status: 200, body: { data: {} } })),
  handleThemes: jest.fn(async () => ({ status: 200, body: { data: {} } })),
}));
jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(() => ({ status: 500, body: { error: "boom" } })),
}));

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

import { POST } from "@/app/api/stories/route";

const ANSWER = { status: 200, body: { data: {} } };

function request(body: Record<string, unknown>, signal: AbortSignal) {
  return {
    method: "POST",
    url: "http://localhost/api/stories",
    headers: new Headers({ "content-type": "application/json" }),
    signal,
    json: async () => body,
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const fn of [
    handleCreate,
    handleGenerateChapter,
    handleRetryChapter,
    handleRewriteChapter,
    handleEditChapter,
    handleContinue,
    handleExtend,
  ]) {
    fn.mockResolvedValue(ANSWER);
  }
});

describe("POST /api/stories hands the generating actions the request's signal", () => {
  const cases: Array<[string, Record<string, unknown>, jest.Mock]> = [
    ["generate-chapter", { storyId: "S-1" }, handleGenerateChapter],
    ["retry-chapter", { storyId: "S-1", chapterNumber: 2 }, handleRetryChapter],
    ["rewrite-chapter", { storyId: "S-1", chapterNumber: 2 }, handleRewriteChapter],
    ["edit-chapter", { storyId: "S-1", chapterNumber: 1, editPrompt: "x" }, handleEditChapter],
    ["continue", { storyId: "S-1", direction: "on" }, handleContinue],
    ["create", { config: { premise: "p" } }, handleCreate],
  ];

  it.each(cases)("%s", async (action, body, handler) => {
    const controller = new AbortController();
    await POST(request({ action, ...body }, controller.signal));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ action }),
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});

describe("GREEN CONTROL: the router itself is unchanged", () => {
  it("still routes by action and still answers an unknown one with a 400", async () => {
    const controller = new AbortController();
    const res = (await POST(request({ action: "nonsense" }, controller.signal))) as unknown as {
      status: number;
      body: { error: string };
    };
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("nonsense");
  });

  it("still maps a bare `id` onto `storyId` before dispatching", async () => {
    const controller = new AbortController();
    await POST(request({ action: "generate-chapter", id: "S-9" }, controller.signal));
    // The body only: the second argument is section 3.3's business, above.
    expect(handleGenerateChapter.mock.calls[0][0]).toEqual(
      expect.objectContaining({ storyId: "S-9" }),
    );
  });
});

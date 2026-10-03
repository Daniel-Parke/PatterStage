/** @jest-environment node */

// ══════════════════════════════════════════════════════════════
// What a Stop leaves written on the chapter.
//
// THE DEFECT. A caller abort reached generate.ts as an ordinary throw, so the
// catch marked the chapter "failed" and wrote the provider's excuse into its
// error. Two things followed, both of which cost money:
//
//   1. The write call names no chapter: the server writes the first PENDING
//      one. A stopped chapter left "failed" is therefore skipped, so the next
//      press of "Write chapter 3" writes and bills chapter 4, leaves a hole at
//      3, and breaks continuity (buildChapterPrompt feeds chapters n-2/n-1).
//   2. handleRetryChapter clears the chapter's real error before delegating,
//      so a stopped retry OVERWROTE the true reason with a false one and the
//      operator lost the only record of why the chapter failed.
//
// THE CONTRACT. A Stop leaves the chapter as it was: pending for a generate,
// failed-with-its-own-error for a retry. Its companion,
// llm-stop-is-not-a-timeout.test.ts, holds the provider seam that makes the
// two events tellable apart.
//
// callLLM and the repository are doubles; the repository double keeps the last
// word on each chapter, because the last word is what the operator reloads.
// ══════════════════════════════════════════════════════════════

const callLLMMock = jest.fn();
jest.mock("@/lib/models/llm", () => ({
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
jest.mock("@/lib/api/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.fn(() => ({ status: 500, body: { error: "boom" } })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("next/server", () => require("../helpers/mocks").nextServerMock());

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handleGenerateChapter, handleRetryChapter } = require("@/modules/rec-room/handlers/generate") as
  typeof import("@/modules/rec-room/handlers/generate");

interface ChapterRow {
  number: number;
  title: string;
  status: string;
  wordCount: number;
  error?: string;
}

let chapters: ChapterRow[];

function storyFixture() {
  return {
    id: "S-1",
    title: "A story",
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
    chapters: chapters.map((c) => ({ ...c })),
    chapterContents: { "1": "Chapter one text." },
    status: "active",
    createdAt: "",
    updatedAt: "",
  };
}

/** The chapter rows as they stand after every updateStory this call made. */
function chaptersNow(): ChapterRow[] {
  return chapters;
}

function abortError(): Error {
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
}

beforeEach(() => {
  jest.clearAllMocks();
  getStory.mockImplementation(() => storyFixture());
  // The repository is the record: every patch lands on `chapters`, so the last
  // word on a chapter is what the operator would reload.
  updateStory.mockImplementation((_id: string, patch: { chapters?: ChapterRow[] }) => {
    if (patch.chapters) chapters = patch.chapters.map((c) => ({ ...c }));
    return storyFixture();
  });
});

describe("a stopped generate", () => {
  beforeEach(() => {
    chapters = [
      { number: 1, title: "One", status: "complete", wordCount: 100 },
      { number: 2, title: "Two", status: "pending", wordCount: 0 },
    ];
  });

  it("leaves the chapter pending and unmarked, not failed with a provider's excuse", async () => {
    const controller = new AbortController();
    callLLMMock.mockImplementation(async () => {
      controller.abort();
      throw abortError();
    });

    await handleGenerateChapter({ storyId: "S-1" }, { signal: controller.signal });

    const ch2 = chaptersNow()[1];
    // Pending is what it was, and pending is what the next write needs to see:
    // the write call names no chapter, so a chapter left "failed" here is
    // skipped and the NEXT one is written and billed in its place.
    expect(ch2.status).toBe("pending");
    expect(ch2.error).toBeUndefined();
  });
});

describe("a stopped retry", () => {
  beforeEach(() => {
    chapters = [
      { number: 1, title: "One", status: "complete", wordCount: 100 },
      { number: 2, title: "Two", status: "failed", wordCount: 0, error: "The gateway is not reachable." },
    ];
  });

  it("gives the chapter back with the error the operator was reading", async () => {
    const controller = new AbortController();
    callLLMMock.mockImplementation(async () => {
      controller.abort();
      throw abortError();
    });

    await handleRetryChapter({ storyId: "S-1", chapterNumber: 2 }, { signal: controller.signal });

    const ch2 = chaptersNow()[1];
    expect(ch2.status).toBe("failed");
    expect(ch2.error).toBe("The gateway is not reachable.");
  });

  it("keeps a chapter the provider finished before the Stop landed", async () => {
    const controller = new AbortController();
    let call = 0;
    callLLMMock.mockImplementation(async () => {
      call += 1;
      if (call === 1) return { content: "Prose enough to keep.", model: "gpt-4o-mini" };
      // The Stop arrives during the TITLE call, after the chapter itself was
      // written and billed. Both the title and the summary call are caught, so
      // the chapter completes: putting the old failure back over it would
      // throw away writing the operator has already paid for.
      controller.abort();
      throw abortError();
    });

    await handleRetryChapter({ storyId: "S-1", chapterNumber: 2 }, { signal: controller.signal });

    const ch2 = chaptersNow()[1];
    expect(ch2.status).toBe("complete");
    expect(ch2.error).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// GREEN CONTROL: a real failure is still recorded as one
// ═══════════════════════════════════════════════════════════════

describe("GREEN CONTROL", () => {
  beforeEach(() => {
    chapters = [
      { number: 1, title: "One", status: "complete", wordCount: 100 },
      { number: 2, title: "Two", status: "pending", wordCount: 0 },
    ];
  });

  it("still marks a chapter failed, with the reason, when the provider really fails", async () => {
    callLLMMock.mockRejectedValue(new Error("LLM provider error 500: upstream exploded"));

    const res = (await handleGenerateChapter({ storyId: "S-1" })) as unknown as { status: number };

    const ch2 = chaptersNow()[1];
    expect(res.status).toBe(500);
    expect(ch2.status).toBe("failed");
    expect(ch2.error).toContain("upstream exploded");
  });

  it("still writes the chapter when nobody stops it", async () => {
    callLLMMock.mockResolvedValue({ content: "Prose enough to keep.", model: "gpt-4o-mini" });

    await handleGenerateChapter({ storyId: "S-1" });

    expect(chaptersNow()[1].status).toBe("complete");
  });
});

/** @jest-environment node */

// T-0087, the create boundary and the update allowlist. The report's
// mood:"Melancholy" crash is one field away from the characters guard T-0079
// added. Guard the whole body. And action:update was a mass-assignment hole:
// any column, including status and storyArc, from any client.

jest.mock("@/lib/llm", () => ({
  callLLM: jest.fn(async () => ({
    content: "===ARC===\n{}\n===CHAPTER 1===\n" + "word ".repeat(500),
  })),
}));
jest.mock("@/modules/rec-room/lib/prompts", () => ({ getStoryPrompt: () => "sys" }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/api-logger", () => ({ logApiError: jest.fn(), serverErrorFromCatch: jest.fn() }));

const mockCreateStory = jest.fn();
const mockUpdateStory = jest.fn();
const mockGetStory = jest.fn();
jest.mock("@/modules/rec-room/lib/story-repository", () => ({
  createStory: (d: unknown) => mockCreateStory(d),
  updateStory: (id: string, u: unknown) => mockUpdateStory(id, u),
  getStory: (id: string) => mockGetStory(id),
  listStories: jest.fn(),
  deleteStory: jest.fn(),
}));

import { handleCreate } from "@/modules/rec-room/handlers/create";
import { handleUpdate } from "@/modules/rec-room/handlers/crud";
import { safeArc } from "@/modules/rec-room/handlers/shared";

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateStory.mockImplementation((d: { title: string }) => ({ id: "s_new", title: d.title, chapters: [] }));
  mockUpdateStory.mockImplementation((id: string, u: Record<string, unknown>) => ({ id, ...u }));
});

describe("create normalises what it is given", () => {
  it("a string mood becomes a one-item list, and the story is created", async () => {
    const res = await handleCreate({ title: "T", config: { premise: "A quiet town", mood: "Melancholy" } });

    expect(res.status).toBe(200);
    expect(mockCreateStory).toHaveBeenCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ mood: ["Melancholy"] }) }),
    );
  });

  it("junk in mood is dropped, not crashed on", async () => {
    const res = await handleCreate({ title: "T", config: { premise: "p", mood: { not: "a list" } } });

    expect(res.status).toBe(200);
    expect(mockCreateStory).toHaveBeenCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ mood: [] }) }),
    );
  });

  it("a title that is not text is a 400 before any row exists", async () => {
    const res = await handleCreate({ title: { $ne: "" }, config: { premise: "p" } });

    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/title/i);
    expect(mockCreateStory).not.toHaveBeenCalled();
  });

  it("a premise that is not text is a 400, not a prompt that says [object Object]", async () => {
    const res = await handleCreate({ title: "T", config: { premise: { text: "p" } } });

    expect(res.status).toBe(400);
    expect(mockCreateStory).not.toHaveBeenCalled();
  });

  it("the row is born generating and becomes active once chapter 1 lands", async () => {
    await handleCreate({ title: "T", config: { premise: "p" } });

    expect(mockCreateStory).toHaveBeenCalledWith(expect.objectContaining({ status: "generating" }));
    const last = mockUpdateStory.mock.calls.at(-1)?.[1] as { status?: string };
    expect(last.status).toBe("active");
  });
});

describe("update is an allowlist, not a mass assignment", () => {
  const existing = {
    id: "s1",
    title: "Old",
    status: "active",
    chapters: [{ number: 1, title: "One", status: "pending", wordCount: 0 }],
    chapterContents: {},
    config: {},
    createdAt: "",
    updatedAt: "",
  };
  beforeEach(() => mockGetStory.mockReturnValue(existing));

  it("refuses status, storyArc, generationError and chapterContents, naming what it accepts", async () => {
    const forbidden = [
      { status: "complete" },
      { storyArc: { storyArc: "x" } },
      { generationError: null },
      { chapterContents: { "1": "x" } },
    ];
    for (const field of forbidden) {
      const res = await handleUpdate({ storyId: "s1", ...field });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toMatch(/title|config|chapters/);
    }
    expect(mockUpdateStory).not.toHaveBeenCalled();
  });

  it("a chapters update may change readStatus and title, never status or wordCount", async () => {
    const res = await handleUpdate({
      storyId: "s1",
      chapters: [{ number: 1, title: "Renamed", readStatus: "read", status: "complete", wordCount: 9999 }],
    });

    expect(res.status).toBe(200);
    const patch = mockUpdateStory.mock.calls[0][1] as { chapters: Array<Record<string, unknown>> };
    expect(patch.chapters[0]).toMatchObject({
      number: 1,
      title: "Renamed",
      readStatus: "read",
      status: "pending",
      wordCount: 0,
    });
  });

  it("GREEN CONTROL: a plain title update goes through", async () => {
    const res = await handleUpdate({ storyId: "s1", title: "New" });

    expect(res.status).toBe(200);
    expect(mockUpdateStory).toHaveBeenCalledWith("s1", { title: "New" });
  });
});

describe("safeArc guarantees what the chapter prompt reads", () => {
  it("coerces scalar themes/worldRules and fills missing keyBeats", () => {
    const arc = safeArc({
      storyArc: "x",
      fixedPlotPoints: [],
      themes: "loss",
      worldRules: 42,
      characterArcs: "nope",
      chapterOutlines: [{ number: 1, title: "t", purpose: "p", emotionalTone: "e" }],
    });

    expect(arc).toBeDefined();
    expect(arc!.themes).toEqual(["loss"]);
    expect(arc!.worldRules).toEqual([]);
    expect(arc!.characterArcs).toEqual([]);
    expect(arc!.chapterOutlines[0].keyBeats).toEqual([]);
  });
});

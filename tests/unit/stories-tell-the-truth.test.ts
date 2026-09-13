/** @jest-environment node */

// T-0087 acceptance oracle, the router. Round 6, finding 1: a string mood
// crashed story creation with an EMPTY 500 body. The router returned handler
// promises without awaiting them, so a rejection bypassed serverErrorFromCatch
// for all fourteen actions. Also pinned: the id vocabulary differed from
// missions for no reason.

import { NextRequest } from "next/server";

const mockCreate = jest.fn();
const mockLoad = jest.fn();
jest.mock("@/modules/rec-room/handlers/create", () => ({
  handleCreate: (b: unknown) => mockCreate(b),
}));
jest.mock("@/modules/rec-room/handlers/crud", () => ({
  handleList: jest.fn(),
  handleLoad: (b: unknown) => mockLoad(b),
  handleUpdate: jest.fn(),
  handleSyncTitles: jest.fn(),
  handleDelete: jest.fn(),
}));
jest.mock("@/modules/rec-room/handlers/generate", () => ({
  handleGenerateChapter: jest.fn(),
  handleRetryChapter: jest.fn(),
  handleRewriteChapter: jest.fn(),
}));
jest.mock("@/modules/rec-room/handlers/edit", () => ({
  handleEditChapter: jest.fn(),
  handleExtend: jest.fn(),
  handleContinue: jest.fn(),
}));
jest.mock("@/modules/rec-room/handlers/library", () => ({
  handleCharacters: jest.fn(),
  handleThemes: jest.fn(),
}));

import { POST } from "@/app/api/stories/route";

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/stories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("the router fails out loud", () => {
  it("a rejecting handler becomes a 500 WITH a body, not an escaped rejection", async () => {
    mockCreate.mockRejectedValue(new TypeError("mood.join is not a function"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await post({ action: "create", config: { premise: "x", mood: "Melancholy" } });
    spy.mockRestore();

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeTruthy();
  });

  it("accepts `id` as well as `storyId`, like missions", async () => {
    mockLoad.mockResolvedValue(new Response(null, { status: 200 }));

    await post({ action: "load", id: "s_1" });

    expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining({ storyId: "s_1" }));
  });
});

/** @jest-environment jsdom */

// ═══════════════════════════════════════════════════════════════
// Real-round oracle, group story-spend, the screen half.
//
// THE DEFECT. Nothing anywhere in the Rec Room tells you what a story costs,
// before or after. The money is recorded and totalled; the person spending it
// is looking at a page that never mentions it, and the first they hear of it
// is their provider bill.
//
// THE CONTRACT.
//   - The reader carries a quiet line saying what THIS story has cost so far,
//     and re-reads it once a chapter has been written, so the figure is the
//     one the console would show and not the one from before the call.
//   - Before anything has been spent the same line still says that writing
//     calls a paid model, so the disclosure is not conditional on the bill.
//   - The create page says it before the button, in one sentence, with no
//     modal and no scare.
//
// The double is global fetch. The pages, the reader components and the note
// are real, so what is asserted is what a person would read.
// ═══════════════════════════════════════════════════════════════

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
// Amended 2026-09-10 (C3, T-0138): the create page reads its libraries through useApiResource.
import { renderWithQuery } from "../helpers/render-with-query";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports
jest.mock("lucide-react", () => require("../helpers/story").lucideNullMock());

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports
jest.mock("next/navigation", () => require("../helpers/story").storyReaderNavigationMock(jest.fn()));

jest.mock("@/hooks/useModels", () => ({
  useModels: () => ({ data: [] }),
  useModelDefaults: () => ({ data: { agent: "" } }),
}));

import StoryReaderPage from "@/app/recroom/story-weaver/[id]/page";
import CreateStoryPage from "@/app/recroom/story-weaver/create/page";
import { type Body, ok, story } from "../helpers/story";

// ── the doubles ─────────────────────────────────────────────────

const fetchMock = jest.fn<Promise<unknown>, [string, RequestInit?]>();

let current: ReturnType<typeof story>;
/** What the server would answer for `spend` right now. */
let spendNow: { runs: number; costUsd: number } | null;

function halfWritten() {
  return story(
    [
      { number: 1, title: "The Departure", status: "complete", wordCount: 100 },
      { number: 2, title: "Chapter 2", status: "pending", wordCount: 0 },
    ],
    { title: "Salt and starlight" },
  );
}

function installFetch(): void {
  fetchMock.mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Body;
    switch (body.action) {
      case "load":
        return ok({ data: current });
      case "spend":
        return ok({
          data: {
            spend: spendNow
              ? { source: "story", label: "Story Weaver", runs: spendNow.runs, inputTokens: 0, outputTokens: 0, costUsd: spendNow.costUsd, recorded: true }
              : null,
          },
        });
      case "generate-chapter": {
        const next = (current.chapters as { status: string; number: number }[]).find((c) => c.status === "pending");
        if (next) {
          next.status = "complete";
          (current.chapterContents as Record<string, string>)[String(next.number)] = "Text.";
          current = { ...current, chapters: [...current.chapters] };
        }
        // The call cost money, so the next read of the figure is higher.
        spendNow = { runs: 3, costUsd: 1.25 };
        return ok({ data: { story: current } });
      }
      default:
        return ok({ data: {} });
    }
  });
}

function note(): HTMLElement {
  return screen.getByTestId("story-spend-note");
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  spendNow = null;
  current = halfWritten();
  (globalThis as { fetch?: unknown }).fetch = fetchMock;
  installFetch();
});

// ═══════════════════════════════════════════════════════════════
// (A) the reader says what the story has cost
// ═══════════════════════════════════════════════════════════════

describe("the story reader", () => {
  it("shows what this story has cost so far", async () => {
    spendNow = { runs: 1, costUsd: 0.8 };
    render(<StoryReaderPage />);
    await screen.findByRole("heading", { level: 1 });

    await waitFor(() => expect(note()).toHaveTextContent("$0.80"));
    // The count is there so the figure can be reasoned about: one chapter is
    // several calls, and a person who sees only money cannot tell why.
    expect(note()).toHaveTextContent("1 model call");
  });

  it("still discloses the cost before anything has been spent", async () => {
    spendNow = { runs: 0, costUsd: 0 };
    render(<StoryReaderPage />);
    await screen.findByRole("heading", { level: 1 });

    // The disclosure is not conditional on there being a bill yet: the point
    // is that the FIRST chapter is not a surprise.
    await waitFor(() => expect(note()).toHaveTextContent(/paid model/i));
  });

  it("re-reads the figure once a chapter has been written", async () => {
    spendNow = { runs: 1, costUsd: 0.8 };
    render(<StoryReaderPage />);
    await screen.findByRole("heading", { level: 1 });
    await waitFor(() => expect(note()).toHaveTextContent("$0.80"));

    await act(async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Write chapter 2" }));
    });

    // A figure that is only read on mount is a figure that is always one
    // chapter out of date, which is the number the operator would act on.
    await waitFor(() => expect(note()).toHaveTextContent("$1.25"));
    expect(note()).toHaveTextContent("3 model calls");
  });

  it("reads without the figure when it cannot be loaded", async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Body;
      if (body.action === "load") return ok({ data: current });
      if (body.action === "spend") throw new Error("network down");
      return ok({ data: {} });
    });

    render(<StoryReaderPage />);
    // A spend read that fails must not take the story down with it.
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// (B) the create page says it before the button
// ═══════════════════════════════════════════════════════════════

describe("the create page", () => {
  it("says a story costs money before the button that spends it", async () => {
    renderWithQuery(<CreateStoryPage />);

    const before = await screen.findByTestId("story-spend-before");
    expect(before).toHaveTextContent(/paid model/i);
    // Where to look afterwards, so the sentence is actionable rather than
    // just a warning.
    expect(before).toHaveTextContent(/Insights/);
  });
});

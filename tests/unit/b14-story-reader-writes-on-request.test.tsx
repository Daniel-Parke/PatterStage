/** @jest-environment jsdom */

// ═══════════════════════════════════════════════════════════════
// B14 oracle, group stop, the reader (D88, blocker) and the doubled heading.
// Contract sections 3.1, 3.2 and 4.7.
//
// THE DEFECT. [id]/page.tsx:141-149 auto-fires generateNext() on mount
// whenever any chapter is `pending` and none is `writing`. Clicking a
// half-finished story in the Library purely to re-read chapter 2 starts a
// billed chapter generation: no confirm, no pause, no abort. The only brake is
// the three-consecutive-FAILURE ceiling, which does nothing at all while the
// calls are succeeding.
//
// THE CONTRACT. Nothing generates on mount. The operator gets
// "Write chapter N" (one chapter, once) and, when more than one is pending,
// "Keep writing (N chapters left)" (the loop). While a call is in flight the
// only control is "Stop", and Stop aborts the request that is running as well
// as disarming the loop, so the next call is never made.
//
// The double is global fetch. The page, the view derivation and every reader
// component are real, so the assertions are what a person would see and click.
// ═══════════════════════════════════════════════════════════════

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("lucide-react", () => {
  // Icons leave the accessibility tree, so an icon-only button that names
  // itself with `title` still resolves by its accessible name.
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({ id: "S-1" }),
  usePathname: () => "/recroom/story-weaver/S-1",
  useSearchParams: () => new URLSearchParams(),
}));

import StoryReaderPage from "@/app/recroom/story-weaver/[id]/page";

// ── the story double ────────────────────────────────────────────

interface Chapter {
  number: number;
  title: string;
  status: string;
  wordCount: number;
}

function story(chapters: Chapter[]) {
  return {
    id: "S-1",
    title: "Salt and Starlight",
    status: "active",
    chapters,
    chapterContents: Object.fromEntries(
      chapters.filter((c) => c.status === "complete").map((c) => [String(c.number), `Text of chapter ${c.number}.`]),
    ),
  };
}

/** Two written, two waiting — the Library row an operator clicks to re-read. */
function halfWritten() {
  return story([
    { number: 1, title: "Chapter 1", status: "complete", wordCount: 100 },
    { number: 2, title: "The Signal", status: "complete", wordCount: 100 },
    { number: 3, title: "Chapter 3", status: "pending", wordCount: 0 },
    { number: 4, title: "Chapter 4", status: "pending", wordCount: 0 },
  ]);
}

function allWritten() {
  return story([
    { number: 1, title: "The Departure", status: "complete", wordCount: 100 },
    { number: 2, title: "The Signal", status: "complete", wordCount: 100 },
  ]);
}

// ── the fetch double ────────────────────────────────────────────

type Body = Record<string, unknown>;

const fetchMock = jest.fn<Promise<unknown>, [string, RequestInit?]>();
let current: ReturnType<typeof story>;
/** Resolvers for in-flight generate calls, so a Stop can be timed. */
let pendingGenerate: Array<{ resolve: () => void; signal: AbortSignal | undefined }> = [];
/** When true, a generate call parks until the test resolves it. */
let holdGenerate = false;
/** When true, a parked call IGNORES the abort, the way a provider that does not
 *  honour the header would. The loop then has only its own flag to stop it. */
let holdIgnoresAbort = false;

function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

/** Complete the first pending chapter, as the server would. */
function writeNextChapter(): void {
  const next = current.chapters.find((c) => c.status === "pending");
  if (!next) return;
  next.status = "complete";
  current.chapterContents[String(next.number)] = `Text of chapter ${next.number}.`;
  current = { ...current, chapters: [...current.chapters] };
}

function installFetch(): void {
  fetchMock.mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Body;
    switch (body.action) {
      case "load":
        return ok({ data: current });
      case "sync-titles":
        return ok({ data: { synced: 0 } });
      case "update":
        return ok({ data: current });
      case "generate-chapter":
      case "retry-chapter": {
        if (holdGenerate) {
          return new Promise((resolve, reject) => {
            const signal = init?.signal ?? undefined;
            if (!holdIgnoresAbort) signal?.addEventListener("abort", () => {
              const err = new Error("The operation was aborted.");
              err.name = "AbortError";
              reject(err);
            });
            pendingGenerate.push({
              signal,
              resolve: () => {
                writeNextChapter();
                resolve(ok({ data: { story: current } }));
              },
            });
          });
        }
        writeNextChapter();
        return ok({ data: { story: current } });
      }
      default:
        return ok({ data: {} });
    }
  });
}

function bodies(): Body[] {
  return fetchMock.mock.calls.map((c) => JSON.parse(String(c[1]?.body ?? "{}")) as Body);
}

function generateCalls(): Body[] {
  return bodies().filter((b) => b.action === "generate-chapter");
}

async function mount(initial: ReturnType<typeof story>) {
  current = initial;
  const utils = render(<StoryReaderPage />);
  await screen.findByRole("heading", { level: 1 });
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  pendingGenerate = [];
  holdGenerate = false;
  holdIgnoresAbort = false;
  window.localStorage.clear();
  (globalThis as { fetch?: unknown }).fetch = fetchMock;
  installFetch();
});

// ═══════════════════════════════════════════════════════════════
// (A) nothing is written until the operator asks
// ═══════════════════════════════════════════════════════════════

describe("opening a half-written story", () => {
  it("writes nothing on mount", async () => {
    await mount(halfWritten());
    // Give the effect every chance to fire.
    await act(async () => {
      await Promise.resolve();
    });

    expect(generateCalls()).toHaveLength(0);
    expect(bodies().map((b) => b.action)).toContain("load");
  });

  it("offers the two ways to start, named for what they do", async () => {
    await mount(halfWritten());

    expect(await screen.findByRole("button", { name: "Write chapter 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep writing (2 chapters left)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  it("names the single remaining chapter, and offers no loop, when one is left", async () => {
    await mount(
      story([
        { number: 1, title: "The Departure", status: "complete", wordCount: 100 },
        { number: 2, title: "Chapter 2", status: "pending", wordCount: 0 },
      ]),
    );

    expect(await screen.findByRole("button", { name: "Write chapter 2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Keep writing/ })).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// (B) what each control does
// ═══════════════════════════════════════════════════════════════

describe("Write chapter N writes exactly one chapter", () => {
  it("makes one call and does not roll on into the next", async () => {
    await mount(halfWritten());
    fireEvent.click(await screen.findByRole("button", { name: "Write chapter 3" }));

    await waitFor(() => expect(generateCalls()).toHaveLength(1));
    // Chapter 4 is still pending, and it stays pending: one click, one chapter.
    await act(async () => {
      await Promise.resolve();
    });
    expect(generateCalls()).toHaveLength(1);
    expect(await screen.findByRole("button", { name: "Write chapter 4" })).toBeInTheDocument();
  });
});

describe("Keep writing runs the loop the operator armed", () => {
  it("writes every remaining chapter and then stops offering to", async () => {
    await mount(halfWritten());
    fireEvent.click(await screen.findByRole("button", { name: "Keep writing (2 chapters left)" }));

    await waitFor(() => expect(generateCalls()).toHaveLength(2));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Write chapter|Keep writing/ })).not.toBeInTheDocument(),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// (C) Stop
// ═══════════════════════════════════════════════════════════════

describe("Stop aborts before the next call", () => {
  it("shows only Stop while a chapter is being written", async () => {
    holdGenerate = true;
    await mount(halfWritten());
    fireEvent.click(await screen.findByRole("button", { name: "Keep writing (2 chapters left)" }));

    expect(await screen.findByRole("button", { name: "Stop" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Write chapter|Keep writing/ })).not.toBeInTheDocument();
  });

  it("aborts the request in flight and makes no further call", async () => {
    holdGenerate = true;
    await mount(halfWritten());
    fireEvent.click(await screen.findByRole("button", { name: "Keep writing (2 chapters left)" }));
    await waitFor(() => expect(pendingGenerate).toHaveLength(1));

    fireEvent.click(await screen.findByRole("button", { name: "Stop" }));

    // The call that was running is cancelled, not merely detached from.
    await waitFor(() => expect(pendingGenerate[0].signal?.aborted).toBe(true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(generateCalls()).toHaveLength(1);
    // And a Stop is not a failure: the reader offers to start again. With two
    // chapters still pending it offers BOTH ways to, so this counts rather than
    // insisting on exactly one.
    expect((await screen.findAllByRole("button", { name: /Write chapter|Keep writing/ })).length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// (D) the heading
// ═══════════════════════════════════════════════════════════════

describe("the chapter heading never says the number twice", () => {
  it("an un-retitled chapter reads 'Chapter 1', not 'Chapter 1: Chapter 1'", async () => {
    await mount(halfWritten());
    const heading = await screen.findByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent(/^Chapter 1$/);
  });
});

// ═══════════════════════════════════════════════════════════════
// (E) three things the first sweep found the cases above could not see
// ═══════════════════════════════════════════════════════════════

describe("Stop, read exactly", () => {
  it("a Stop while a single chapter is being written still offers Stop", async () => {
    holdGenerate = true;
    await mount(halfWritten());
    // "Write chapter N" writes ONE chapter and does not arm the loop, so
    // `writing` is false throughout. A Stop control that reads only the loop
    // would leave this call with no way to stop it.
    fireEvent.click(await screen.findByRole("button", { name: "Write chapter 3" }));
    await waitFor(() => expect(pendingGenerate).toHaveLength(1));

    expect(await screen.findByRole("button", { name: "Stop" })).toBeInTheDocument();
  });

  it("disarms the loop, so a call that lands after the Stop starts no other", async () => {
    holdGenerate = true;
    // The provider ignores the abort and answers normally, which is what a
    // gateway that does not honour the header does. The completed chapter then
    // re-arms the effect, and the ONLY thing that stops the next call is the
    // loop flag Stop cleared.
    holdIgnoresAbort = true;
    await mount(halfWritten());
    fireEvent.click(await screen.findByRole("button", { name: "Keep writing (2 chapters left)" }));
    await waitFor(() => expect(pendingGenerate).toHaveLength(1));

    fireEvent.click(await screen.findByRole("button", { name: "Stop" }));
    // The call SUCCEEDS anyway -- it was already on the wire and the server
    // does not care about the abort. The loop must still be disarmed, or the
    // completed chapter re-arms the effect and the writing carries on.
    await act(async () => {
      pendingGenerate[0].resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(generateCalls()).toHaveLength(1);
  });

  it("is not a failure: no error is shown after a Stop", async () => {
    holdGenerate = true;
    await mount(halfWritten());
    fireEvent.click(await screen.findByRole("button", { name: "Keep writing (2 chapters left)" }));
    await waitFor(() => expect(pendingGenerate).toHaveLength(1));

    fireEvent.click(await screen.findByRole("button", { name: "Stop" }));
    await waitFor(() => expect(pendingGenerate[0].signal?.aborted).toBe(true));
    await act(async () => {
      await Promise.resolve();
    });

    // An abort routed through the ordinary catch reads as "Generation failed"
    // and burns one of the three retries the ceiling counts.
    expect(screen.queryByText(/Generation failed|aborted/i)).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// GREEN CONTROL
// ═══════════════════════════════════════════════════════════════

describe("GREEN CONTROL: a finished story is untouched", () => {
  it("writes nothing, offers no write control, and still reads", async () => {
    await mount(allWritten());
    await act(async () => {
      await Promise.resolve();
    });

    expect(generateCalls()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Write chapter|Keep writing|^Stop$/ })).not.toBeInTheDocument();
    expect(screen.getByText("Text of chapter 1.")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2 })).toHaveTextContent("Chapter 1: The Departure");
  });
});

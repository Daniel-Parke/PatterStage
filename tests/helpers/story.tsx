// The Story Weaver harness: the fixtures, the parked fetch and the module
// doubles the story suites each spelled (C4, T-0140). A reader-page suite
// takes `story()`, `halfWritten()`, `ok()`, `park()` and the navigation
// double; a route suite takes `storyRepositoryMock()` beside
// `nextServerMock()`.

export interface Chapter {
  number: number;
  title: string;
  status: string;
  wordCount: number;
  error?: string;
}

export interface StoryFixture {
  id: string;
  title: string;
  status: string;
  chapters: Chapter[];
  chapterContents: Record<string, string>;
}

/** A story whose written chapters carry a line of text each. */
export function story(chapters: Chapter[], over: Partial<Omit<StoryFixture, "chapters" | "chapterContents">> = {}): StoryFixture {
  return {
    id: "S-1",
    title: "Salt and Starlight",
    status: "active",
    ...over,
    chapters,
    chapterContents: Object.fromEntries(
      chapters.filter((c) => c.status === "complete").map((c) => [String(c.number), `Text of chapter ${c.number}.`]),
    ) as Record<string, string>,
  };
}

/** Two written, two waiting: the story a Continue is pressed on. */
export function halfWritten(): StoryFixture {
  return story([
    { number: 1, title: "The Departure", status: "complete", wordCount: 100 },
    { number: 2, title: "The Signal", status: "complete", wordCount: 100 },
    { number: 3, title: "Chapter 3", status: "pending", wordCount: 0 },
    { number: 4, title: "Chapter 4", status: "pending", wordCount: 0 },
  ]);
}

/** One written, one failed, two waiting: the story a Retry is pressed on. */
export function oneFailedTwoPending(): StoryFixture {
  return story([
    { number: 1, title: "The Departure", status: "complete", wordCount: 100 },
    { number: 2, title: "Chapter 2", status: "failed", wordCount: 0, error: "The gateway is not reachable." },
    { number: 3, title: "Chapter 3", status: "pending", wordCount: 0 },
    { number: 4, title: "Chapter 4", status: "pending", wordCount: 0 },
  ]);
}

/** Mark a chapter written, in place, and hand back a fresh object for React. */
export function markComplete(current: StoryFixture, number: number): StoryFixture {
  const chapter = current.chapters.find((c) => c.number === number);
  if (!chapter) return current;
  chapter.status = "complete";
  chapter.error = undefined;
  current.chapterContents[String(number)] = `Text of chapter ${number}.`;
  return { ...current, chapters: [...current.chapters] };
}

/** Write the next pending chapter, if there is one. */
export function writeNextChapter(current: StoryFixture): StoryFixture {
  const next = current.chapters.find((c) => c.status === "pending");
  return next ? markComplete(current, next.number) : current;
}

export type Body = Record<string, unknown>;

/** A 200 with the body. */
export function ok(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

/** A JSON answer with its status. */
export function answer(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

export interface Parked {
  action: string;
  signal: AbortSignal | undefined;
  resolve: (body: unknown) => void;
}

/**
 * A request that waits until the suite answers it, and rejects with an
 * AbortError if its signal fires first: the in-flight generation a Stop
 * must reach.
 */
export function park(parked: Parked[], action: string, init: RequestInit | undefined): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const signal = init?.signal ?? undefined;
    signal?.addEventListener("abort", () => {
      const err = new Error("The operation was aborted.");
      err.name = "AbortError";
      reject(err);
    });
    parked.push({ action, signal, resolve });
  });
}

/** Every body the fetch double was sent, parsed. */
export function bodies(fetchMock: jest.Mock): Body[] {
  return fetchMock.mock.calls.map((c) => JSON.parse(String((c as [unknown, RequestInit?])[1]?.body ?? "{}")) as Body);
}

/** The bodies whose `action` is the one asked for. */
export function callsFor(fetchMock: jest.Mock, action: string): Body[] {
  return bodies(fetchMock).filter((b) => b.action === action);
}

/** lucide-react as nothing: every icon renders null, for a suite that reads text. */
export function lucideNullMock(): Record<string, unknown> {
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
}

/** next/navigation for the reader at /recroom/story-weaver/<id>. */
export function storyReaderNavigationMock(push: jest.Mock, id = "S-1") {
  return {
    useRouter: () => ({ push, replace: jest.fn(), back: jest.fn() }),
    useParams: () => ({ id }),
    usePathname: () => `/recroom/story-weaver/${id}`,
    useSearchParams: () => new URLSearchParams(),
  };
}

/**
 * The story repository as jest.fns, each reachable twice: under its own name
 * for the route, and under `__name` for the suite to arm.
 */
export function storyRepositoryMock() {
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
    __createStory: createStory,
    __updateStory: updateStory,
    __deleteStory: deleteStory,
    STORY_DATA_DIR: "/tmp/test-hermes/stories",
  };
}

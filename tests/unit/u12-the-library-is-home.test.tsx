/** @jest-environment jsdom */
/**
 * U12 (T-0126): the library is the Story Weaver page.
 *
 * The hub was six tiles, four buttons and three cards; the library was three
 * tiles, three filters and every story. The second is a strict superset of
 * the first, so the hub goes and the library stands at the door. What a
 * reader came to the hub for - how much is written, what is waiting - is in
 * the subtitle and on the filters, not in a tile row above the list it counts
 * (the same rule Skills learned in T-0125).
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { pageSubtitle } from "../helpers/page-subtitle";

jest.mock("lucide-react", () => {
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({}),
  usePathname: () => "/recroom/story-weaver",
  useSearchParams: () => new URLSearchParams(),
}));

import StoryWeaverPage from "@/app/recroom/story-weaver/page";

type Body = Record<string, unknown>;

const STORIES = [
  {
    id: "S-1",
    title: "The Lighthouse Keeper",
    premise: "A keeper who has never seen the sea.",
    status: "complete",
    config: { genre: "Mystery" },
    chapters: [1, 2, 3].map((n) => ({ number: n, title: `Chapter ${n}`, status: "complete", wordCount: 1000 })),
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-02T00:00:00Z",
  },
  {
    id: "S-2",
    title: "Rust and Rain",
    premise: "A city that forgot how to dry.",
    status: "active",
    config: { genre: "Sci-Fi" },
    chapters: [
      { number: 1, title: "Chapter 1", status: "complete", wordCount: 900 },
      { number: 2, title: "Chapter 2", status: "pending", wordCount: 0 },
      { number: 3, title: "Chapter 3", status: "pending", wordCount: 0 },
    ],
    createdAt: "2026-09-03T00:00:00Z",
    updatedAt: "2026-09-03T00:00:00Z",
  },
  {
    id: "S-3",
    title: "Signal",
    status: "generating",
    chapters: [{ number: 1, title: "Chapter 1", status: "writing", wordCount: 0 }],
    createdAt: "2026-09-04T00:00:00Z",
  },
];

const fetchMock = jest.fn<Promise<unknown>, [string, RequestInit?]>();
let listAnswer: () => { ok: boolean; status: number; json: () => Promise<unknown> };

function answer(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function bodies(): Body[] {
  return fetchMock.mock.calls.map((c) => JSON.parse(String(c[1]?.body ?? "{}")) as Body);
}

beforeEach(() => {
  jest.clearAllMocks();
  listAnswer = () => answer({ data: { stories: STORIES } });
  (globalThis as { fetch?: unknown }).fetch = fetchMock;
  fetchMock.mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Body;
    if (body.action === "list") return listAnswer();
    if (body.action === "delete") return answer({ data: { deleted: true } });
    return answer({ data: {} });
  });
});

async function mount() {
  const utils = render(<StoryWeaverPage />);
  await screen.findByRole("link", { name: "The Lighthouse Keeper" });
  return utils;
}

const shelf = () => screen.getByTestId("story-shelf");

describe("the page at the door", () => {
  it("is Story Weaver, and its subtitle counts the shelf rather than a row of tiles", async () => {
    await mount();
    expect(screen.getByRole("heading", { level: 1, name: "Story Weaver" })).toBeInTheDocument();
    expect(pageSubtitle()).toHaveTextContent(/3 stories/);
    // The six tiles said "Stories", "Chapters", "Words" above the list that
    // showed them. None of those labels is on the page.
    expect(screen.queryByText(/^Words$/)).toBeNull();
    expect(screen.queryByText(/^Chapters$/)).toBeNull();
  });

  it("offers the filters as one named radiogroup, each with its count", async () => {
    await mount();
    const group = screen.getByRole("radiogroup", { name: "Filter stories" });
    const all = within(group).getByRole("radio", { name: /All/ });
    const done = within(group).getByRole("radio", { name: /Completed/ });
    const waiting = within(group).getByRole("radio", { name: /Waiting for you/ });
    expect(all.textContent).toMatch(/3/);
    expect(done.textContent).toMatch(/1/);
    expect(waiting.textContent).toMatch(/2/);
    expect(all).toHaveAttribute("aria-checked", "true");
  });

  it("lists every story as a link to its reader", async () => {
    await mount();
    for (const s of STORIES) {
      expect(screen.getByRole("link", { name: s.title })).toHaveAttribute("href", `/recroom/story-weaver/${s.id}`);
    }
  });

  it("says each story's status in the one vocabulary", async () => {
    await mount();
    const list = shelf();
    expect(within(list).getByText("Completed")).toBeInTheDocument();
    expect(within(list).getByText("Waiting for you")).toBeInTheDocument();
    expect(within(list).getByText("Running")).toBeInTheDocument();
  });

  it("has one way in to a new story, and no doors to screens that no longer exist", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "New story" }));
    expect(push).toHaveBeenCalledWith("/recroom/story-weaver/create");
    expect(screen.queryByRole("button", { name: /Characters/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Themes/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Library$/ })).toBeNull();
    expect(screen.queryByText(/View all/)).toBeNull();
  });

  it("the Completed filter narrows the shelf", async () => {
    await mount();
    fireEvent.click(screen.getByRole("radio", { name: /Completed/ }));
    expect(within(shelf()).getByRole("link", { name: "The Lighthouse Keeper" })).toBeInTheDocument();
    expect(within(shelf()).queryByRole("link", { name: "Rust and Rain" })).toBeNull();
    expect(within(shelf()).queryByRole("link", { name: "Signal" })).toBeNull();
  });

  it("deleting asks twice, then posts the delete and drops the row", async () => {
    await mount();
    const del = screen.getByRole("button", { name: "Delete story Rust and Rain" });
    fireEvent.click(del);
    expect(del.textContent).toMatch(/Delete\?/);
    expect(bodies().filter((b) => b.action === "delete")).toHaveLength(0);
    fireEvent.click(del);
    await waitFor(() => expect(bodies().filter((b) => b.action === "delete")).toEqual([{ action: "delete", storyId: "S-2" }]));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Rust and Rain" })).toBeNull());
  });
});

describe("the read contract", () => {
  it("an empty shelf says so, only after a read that succeeded, and offers the way in", async () => {
    listAnswer = () => answer({ data: { stories: [] } });
    render(<StoryWeaverPage />);
    await screen.findByText(/Your bookshelf is empty/);
    fireEvent.click(screen.getByRole("button", { name: "Create a story" }));
    expect(push).toHaveBeenCalledWith("/recroom/story-weaver/create");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a failed read is an error with Retry, never an empty shelf", async () => {
    listAnswer = () => answer({ error: "the database is locked" }, 500);
    render(<StoryWeaverPage />);
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/bookshelf is empty/)).toBeNull();
    // The header is drawn even while the body cannot be: a page that vanishes
    // behind a spinner on error has no Retry to press.
    expect(screen.getByRole("heading", { level: 1, name: "Story Weaver" })).toBeInTheDocument();

    listAnswer = () => answer({ data: { stories: STORIES } });
    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }));
    await screen.findByRole("link", { name: "Signal" });
    expect(bodies().filter((b) => b.action === "list")).toHaveLength(2);
  });
});

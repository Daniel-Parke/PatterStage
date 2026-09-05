/** @jest-environment jsdom */

// ═══════════════════════════════════════════════════════════════
// B17 oracle: the /quests page.
//
// Contract §7. Chapter accordions, a progress ring, Teaches chips, an Earns
// badge, Skip and Go — all of it off the stats poll the shell already runs,
// at zero extra requests for the evaluation itself.
//
// This file is deliberately independent of src/lib/quests: it hands the page
// a stats payload and reads what the page does with it, so it stays honest
// whatever the module graph behind the evaluator turns out to be. What is
// under test is the SCREEN: does it render the chapters it is given, does Go
// point at the registry route the quest names, does Skip write the pref B3
// already allow-listed, and does a failed read say so instead of showing a
// page of zeros (the B5 rule).
//
// The page is a placeholder today (T-0097 shipped it so the rail had nowhere
// dead), so every assertion below is red for the contract reason.
// ═══════════════════════════════════════════════════════════════

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let pathname = "/quests";
jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("lucide-react", () => {
  const icon = (name: string) =>
    function Icon(props: Record<string, unknown>) {
      return <svg data-icon={name} aria-hidden="true" {...props} />;
    };
  return new Proxy({}, { get: (_t, prop: string) => icon(prop) });
});
jest.mock("@/components/layout/AppPageShell", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import QuestsPage from "@/app/quests/page";

// ── the payload the stats poll carries ──────────────────────────

interface Q {
  id: string;
  chapter: number;
  title: string;
  action: string;
  screen: string;
  teaches: string[];
  earns?: string;
  requires?: string;
  proof: { kind: "event"; event: string; target: number };
  met: boolean;
  completed: boolean;
  completedAt: string | null;
  skipped: boolean;
}

function q(over: Partial<Q> & Pick<Q, "id" | "chapter" | "title">): Q {
  return {
    action: `Do the thing ${over.id} asks for.`,
    screen: "/work/missions",
    teaches: [],
    proof: { kind: "event", event: "mission.dispatched", target: 1 },
    met: false,
    completed: false,
    completedAt: null,
    skipped: false,
    ...over,
  };
}

const CHAPTER_TITLES = [
  "Get running",
  "Missions",
  "Shape your agent",
  "Automate and watch",
  "Multi-stage work",
  "Rec Room",
  "Keep it healthy",
];
const CHAPTER_IDS = [
  "get-running",
  "missions",
  "shape-your-agent",
  "automate-and-watch",
  "multi-stage-work",
  "rec-room",
  "keep-it-healthy",
];

const QUESTS: Q[] = [
  q({
    id: "1.1",
    chapter: 1,
    title: "Add a model",
    action: "Add the model your agent will call.",
    screen: "/agent/models",
    teaches: ["model", "provider"],
    met: true,
    completed: true,
    completedAt: "2026-09-01T09:00:00.000Z",
  }),
  q({
    id: "1.3",
    chapter: 1,
    title: "Send a first message",
    action: "Open Chat and send your agent one message.",
    screen: "/work/chat",
    teaches: ["agent", "prompt"],
    earns: "first-words",
    requires: "gateway",
  }),
  q({ id: "2.2", chapter: 2, title: "Save a template", screen: "/work/missions", teaches: ["mission"] }),
  q({ id: "3.3", chapter: 3, title: "Toggle a skill", screen: "/agent/skills", teaches: ["skill"] }),
  q({ id: "4.1", chapter: 4, title: "Save a script", screen: "/work/scripts" }),
  q({ id: "5.4", chapter: 5, title: "Save an artifact", screen: "/results/artifacts", teaches: ["artifact"] }),
  q({ id: "6.1", chapter: 6, title: "Start a story", screen: "/recroom/story-weaver", earns: "storyteller" }),
  q({ id: "7.1", chapter: 7, title: "Take a backup", screen: "/agent/settings/system" }),
];

function questsPayload(quests: Q[] = QUESTS) {
  const chapters = CHAPTER_TITLES.map((title, i) => {
    const mine = quests.filter((x) => x.chapter === i + 1 && !x.skipped);
    return {
      number: i + 1,
      id: CHAPTER_IDS[i],
      title,
      blurb: `What chapter ${i + 1} gets you.`,
      total: mine.length,
      completed: mine.filter((x) => x.completed).length,
      seeAlso: i + 1 === 4 ? [{ label: "The artifact it left", href: "/results/artifacts" }] : undefined,
    };
  });
  const counted = quests.filter((x) => !x.skipped);
  return {
    chapters,
    quests,
    completed: counted.filter((x) => x.completed).length,
    total: counted.length,
    nextCompletedAt: {},
    latchChanged: false,
    seeding: false,
  };
}

function statsBody(quests: Q[] = QUESTS) {
  return {
    data: {
      stats: {
        generatedAt: "2026-09-05T12:00:00.000Z",
        missions: { total: 0, queued: 0, draft: 0, dispatched: 0, successful: 0, failed: 0, successRate: 0 },
        runs: {
          total: 0,
          active: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          avgDurationSec: 0,
        },
        sessions: { total: 0, active: 0 },
        automations: { schedulesTotal: 0, schedulesEnabled: 0, scriptsTotal: 0, scriptsEnabled: 0, nextRun: null },
        stories: 0,
        errors24h: 0,
        streak: { current: 0, longest: 0 },
        achievements: [],
        agents: [],
        throughput: [],
        runActivity: [],
        tokensByDay: [],
        quests: questsPayload(quests),
      },
    },
  };
}

const SUBSYSTEMS = {
  data: {
    checkedAt: "2026-09-05T12:00:00.000Z",
    subsystems: [
      { id: "gateway", label: "Gateway", state: "ok", reason: "reachable" },
      { id: "memory", label: "Memory", state: "ok", reason: "reachable" },
    ],
  },
};
const RUNTIME = { data: { runtime: { platform: "linux", composerEnabled: true, readOnly: false } } };
const FLAGS = { data: { flags: { composer: true } } };

// ── the fetch double ────────────────────────────────────────────

type Answer = { status?: number; body: unknown };
let answers: Record<string, Answer> = {};
const calls: Array<{ path: string; method: string; body: unknown }> = [];

function installFetch() {
  calls.length = 0;
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : ((input as Request).url ?? String(input));
    const path = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    calls.push({ path, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const a = answers[path] ?? { status: 404, body: { error: `no stub for ${path}` } };
    return new Response(JSON.stringify(a.body), {
      status: a.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

function withQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

beforeEach(() => {
  pathname = "/quests";
  answers = {
    "/api/stats": { body: statsBody() },
    "/api/prefs": { body: { data: { prefs: {} } } },
    "/api/status/subsystems": { body: SUBSYSTEMS },
    "/api/status/runtime": { body: RUNTIME },
    "/api/feature-flags": { body: FLAGS },
  };
  installFetch();
});

// ═══════════════════════════════════════════════════════════════

describe("the page keeps the registry's word and reads the stats poll", () => {
  // The one deliberate green in this file: it guards what B3 already proved.
  it("GREEN CONTROL: is still headed Quests, from the registry", () => {
    render(withQuery(<QuestsPage />));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Quests");
  });

  it("evaluates nothing of its own: no /api/quests, only the poll the shell already makes", async () => {
    render(withQuery(<QuestsPage />));
    await screen.findByText("Add a model");
    expect(calls.filter((c) => c.path === "/api/quests")).toEqual([]);
    expect(calls.some((c) => c.path === "/api/stats")).toBe(true);
  });

  it("shows how far through the operator is, as n of N", async () => {
    render(withQuery(<QuestsPage />));
    expect(await screen.findByText(/\b1\s*\/\s*8\b/)).toBeInTheDocument();
  });
});

describe("the chapters", () => {
  it("renders one accordion per chapter, in order, each named", async () => {
    render(withQuery(<QuestsPage />));
    for (const title of CHAPTER_TITLES) expect(await screen.findByText(title)).toBeInTheDocument();
  });

  it("says how far through each chapter is", async () => {
    render(withQuery(<QuestsPage />));
    await screen.findByText("Get running");
    // Chapter 1 holds two quests here, one of them done.
    expect(screen.getByText(/\b1\s*\/\s*2\b/)).toBeInTheDocument();
  });

  it("shows a chapter's See also pointers, which are places to look and not quests", async () => {
    render(withQuery(<QuestsPage />));
    const link = await screen.findByRole("link", { name: /the artifact it left/i });
    expect(link).toHaveAttribute("href", "/results/artifacts");
  });
});

describe("a quest row", () => {
  it("says what to do, in one sentence", async () => {
    render(withQuery(<QuestsPage />));
    expect(await screen.findByText("Open Chat and send your agent one message.")).toBeInTheDocument();
  });

  it("Go points at the registry route the quest names", async () => {
    render(withQuery(<QuestsPage />));
    await screen.findByText("Send a first message");
    const links = screen.getAllByRole("link", { name: /^go$/i });
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/work/chat", "/agent/skills", "/agent/settings/system"]));
  });

  it("shows the concepts it teaches as chips", async () => {
    render(withQuery(<QuestsPage />));
    await screen.findByText("Send a first message");
    expect(screen.getAllByText(/agent/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/prompt/i).length).toBeGreaterThan(0);
  });

  it("shows the achievement it earns", async () => {
    render(withQuery(<QuestsPage />));
    await screen.findByText("Send a first message");
    expect(screen.getAllByText(/first words/i).length).toBeGreaterThan(0);
  });

  it("marks a completed quest complete, and dates it", async () => {
    render(withQuery(<QuestsPage />));
    const row = (await screen.findByText("Add a model")).closest("li, div, article") as HTMLElement;
    expect(within(row).getByText(/complete|done/i)).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });
});

describe("Skip writes the preference B3 already allow-listed", () => {
  it("PUTs quests.skipped with the id appended", async () => {
    answers["/api/prefs"] = { body: { data: { prefs: { "quests.skipped": ["9.9"] } } } };
    render(withQuery(<QuestsPage />));
    await screen.findByText("Send a first message");
    const skips = screen.getAllByRole("button", { name: /^skip$/i });
    fireEvent.click(skips[0]);
    await waitFor(() => {
      const put = calls.find((c) => c.path === "/api/prefs" && c.method === "PUT");
      expect(put).toBeDefined();
      expect((put!.body as { key: string }).key).toBe("quests.skipped");
      expect((put!.body as { value: string[] }).value).toEqual(expect.arrayContaining(["9.9"]));
    });
  });

  it("shows a skipped quest as skipped, and offers to put it back", async () => {
    const skipped = QUESTS.map((x) => (x.id === "1.3" ? { ...x, skipped: true } : x));
    answers["/api/stats"] = { body: statsBody(skipped) };
    render(withQuery(<QuestsPage />));
    await screen.findByText("Send a first message");
    expect(screen.getByRole("button", { name: /unskip|put it back/i })).toBeInTheDocument();
    // 8 quests, one skipped, one of the rest done.
    expect(screen.getByText(/\b1\s*\/\s*7\b/)).toBeInTheDocument();
  });
});

describe("a skip is visible before the poll that confirms it", () => {
  // The walk found this: the page wrote `quests.skipped` and then rendered
  // `quest.skipped` from the stats poll, which is up to twenty seconds behind.
  // In both cases below the stats answer NEVER changes, so the only thing that
  // can move the row is the preference the operator just wrote.
  it("marks the row skipped as soon as the preference is written", async () => {
    render(withQuery(<QuestsPage />));
    await screen.findByText("Send a first message");

    // The preferences re-read after the write is what the page reacts to.
    answers["/api/prefs"] = { body: { data: { prefs: { "quests.skipped": ["1.3"] } } } };
    const row = screen.getByText("Send a first message").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: /^skip$/i }));

    await waitFor(() => expect(within(row).getByText(/skipped/i)).toBeInTheDocument());
    expect(within(row).getByRole("button", { name: /unskip/i })).toBeInTheDocument();
  });

  it("un-marks it as soon as the preference is cleared, which a union could not do", async () => {
    // The server still says skipped here, exactly as it would in the window
    // between the write and the next poll. Folding the two together with a
    // union makes an unskip impossible to see, because the stale server view
    // keeps re-adding the id it has not been told about yet.
    answers["/api/stats"] = { body: statsBody(QUESTS.map((x) => (x.id === "1.3" ? { ...x, skipped: true } : x))) };
    answers["/api/prefs"] = { body: { data: { prefs: { "quests.skipped": ["1.3"] } } } };
    render(withQuery(<QuestsPage />));
    await screen.findByText("Send a first message");
    const row = screen.getByText("Send a first message").closest("li")!;
    expect(within(row).getByText(/skipped/i)).toBeInTheDocument();

    answers["/api/prefs"] = { body: { data: { prefs: { "quests.skipped": [] } } } };
    fireEvent.click(within(row).getByRole("button", { name: /unskip/i }));

    await waitFor(() => expect(within(row).queryByText(/skipped/i)).not.toBeInTheDocument());
  });
});

describe("a failed read says so", () => {
  it("shows the error with a Retry, and never a page of zeros over it", async () => {
    answers["/api/stats"] = { status: 500, body: { error: "the database is locked" } };
    render(withQuery(<QuestsPage />));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/\b0\s*\/\s*0\b/)).toBeNull();
  });
});

describe("ADR-0004: no operator level, no operator XP", () => {
  it("says nothing about a level or an XP bar anywhere on the page", async () => {
    const { container } = render(withQuery(<QuestsPage />));
    await screen.findByText("Add a model");
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\bXP\b/);
    expect(text).not.toMatch(/\blevel\s*\d/i);
  });
});

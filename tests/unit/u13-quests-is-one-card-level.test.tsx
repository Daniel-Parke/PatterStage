/** @jest-environment jsdom */
/**
 * U13 (T-0127): Quests is one card level.
 *
 * A chapter was a card; every quest inside it was a card; the achievement a
 * quest earns was a tile with its own border inside that. Three concentric
 * borders, and the quest's title landed 23px further right or left down the
 * list depending on how long its marker word was. The chapter is the one
 * surface; its quests are rows divided by hairlines, each with a fixed-width
 * status column so titles share an edge; Go and Skip sit on one row; the
 * achievement is a chip, not a tile. Spacious, because this screen is read.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen, within } from "@testing-library/react";

jest.mock("lucide-react", () => {
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

import QuestChapter from "@/components/quests/QuestChapter";
import type { QuestChapterState, QuestState } from "@/lib/quests/evaluate";

const ROOT = join(__dirname, "..", "..");

const chapter: QuestChapterState = {
  number: 1,
  id: "get-running",
  title: "Get running",
  blurb: "An agent that can answer, and one piece of work you gave it, finished.",
  total: 2,
  completed: 1,
  seeAlso: [{ label: "Settings", href: "/agent/settings" }],
};

const quest = (over: Partial<QuestState>): QuestState => ({
  id: "1.1",
  chapter: 1,
  title: "Add a model",
  action: "Add a model on the Models page, so the agent has something to think with.",
  screen: "/agent/models",
  teaches: ["model"],
  proof: { kind: "event", name: "model.added" } as unknown as QuestState["proof"],
  met: false,
  completed: false,
  completedAt: null,
  skipped: false,
  ...over,
});

const QUESTS = [
  quest({ id: "1.1", title: "Add a model", completed: true, completedAt: "2026-09-01T10:00:00Z" }),
  quest({ id: "1.3", title: "Send a first message", screen: "/work/chat", teaches: ["agent", "prompt"], earns: "first-words" }),
];

function mount() {
  return render(
    <QuestChapter chapter={chapter} quests={QUESTS} available={() => true} onSkip={() => {}} onUnskip={() => {}} />,
  );
}

describe("the chapter", () => {
  it("is the one bordered surface: no row inside it draws a card of its own", () => {
    const { container } = mount();
    const rows = container.querySelectorAll("li");
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect({ row: row.textContent?.slice(0, 30), className: row.className }).not.toMatchObject({ className: expect.stringMatching(/\bborder\b|rounded-ps-lg/) });
      expect(row.querySelectorAll("[class*='rounded-ps-lg']")).toHaveLength(0);
    }
  });

  it("divides its rows with hairlines rather than boxes", () => {
    const { container } = mount();
    const list = container.querySelector("ul");
    expect(list?.className).toMatch(/divide-y/);
  });
});

describe("a quest row", () => {
  it("puts its status in a fixed-width column, so every title starts at the same x", () => {
    mount();
    const todo = screen.getByText(/^to do$/i);
    const done = screen.getByText(/^complete$/i);
    for (const marker of [todo, done]) {
      expect(marker.className).toMatch(/\bw-24\b/);
      expect(marker.className).toMatch(/\bshrink-0\b/);
    }
  });

  it("puts Go and Skip on one row, and both on the button chrome", () => {
    mount();
    const row = screen.getByText("Send a first message").closest("li") as HTMLElement;
    const go = within(row).getByRole("link", { name: /^go$/i });
    const skip = within(row).getByRole("button", { name: /^skip$/i });
    expect(go).toHaveAttribute("href", "/work/chat");
    expect(go.parentElement).toBe(skip.parentElement);
    // The button chrome's signature: an inline-flex, rounded, mono control at
    // the small height. A Link wearing it is the LinkButton primitive.
    for (const control of [go, skip]) {
      expect(control.className).toMatch(/\binline-flex\b/);
      expect(control.className).toMatch(/\brounded-ps-md\b/);
      expect(control.className).toMatch(/\bh-6\.5\b/);
    }
  });

  it("shows what it earns as a chip in the row, not a tile with its own border", () => {
    mount();
    const row = screen.getByText("Send a first message").closest("li") as HTMLElement;
    const earns = within(row).getByText(/first words/i);
    expect(earns).toBeInTheDocument();
    let el: HTMLElement | null = earns;
    while (el && el !== row) {
      expect(el.className).not.toMatch(/\bw-28\b|rounded-ps-lg/);
      el = el.parentElement;
    }
  });

  it("still says the concepts it teaches, the date it was done, and the chapter's See also", () => {
    mount();
    // Both fixtures teach something, so the label appears twice.
    expect(screen.getAllByText(/^teaches$/i)).toHaveLength(2);
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/agent/settings");
  });
});

describe("in the source", () => {
  it("QuestRow draws no raw control and the page loads on the loading contract", () => {
    const row = readFileSync(join(ROOT, "src", "components", "quests", "QuestRow.tsx"), "utf-8");
    expect(row).not.toMatch(/<button(?=[\s/>])/);
    expect(row).toMatch(/from "@\/components\/ui\/LinkButton"/);
    const page = readFileSync(join(ROOT, "src", "app", "quests", "page.tsx"), "utf-8");
    expect(page.includes("LoadingSpinner")).toBe(false);
    expect(page).toMatch(/from "@\/components\/ui\/PageLoading"/);
  });
});

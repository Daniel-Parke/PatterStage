/**
 * T-0111: the four things B17's mutation sweep proved nothing about.
 *
 * Every case here answers a mutant that lived. They are gathered in one file
 * because they share one cause: the batch's oracles tested the evaluator and
 * the page hard, and left the small pieces around them — two catalogue helpers
 * and three components that render almost nothing — to be obviously correct.
 * Mutation testing does not accept "obviously".
 *
 * The mutants, and the case that now kills each:
 *
 *   questsInChapter(c)      -> chapter + 1        "counts the chapter it was asked about"
 *   questsMetInChapter      -> counts every quest  "a chapter counter is not a total"
 *   QuestTracker `=== null` -> `!== null`          "the first poll seeds and says nothing"
 *   QuestBadge  hides at N/N -> never hides        "the badge gets out of the way when finished"
 *   NextQuestCard !completed -> true               "the card never offers finished work"
 *
 * The two catalogue cases are deliberately written against an INDEPENDENT
 * expectation rather than against the helpers themselves. The integrity test
 * already asserted `measure(m) === questsMetInChapter(m, 1)`, which compares
 * the implementation to the implementation and is green for every possible
 * implementation — which is exactly why both chapter mutants survived it.
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import NextQuestCard from "@/components/dashboard/NextQuestCard";
import QuestBadge from "@/components/quests/QuestBadge";
import QuestTracker from "@/components/quests/QuestTracker";
import type { QuestProgress, QuestState } from "@/lib/quests/evaluate";
import { QUEST_DEFS, questsInChapter, questsMetInChapter } from "@/lib/quests/quest-defs";
import type { RawMetrics } from "@/lib/stats/derive";

// ── doubles ─────────────────────────────────────────────────────

let statsValue: { quests?: QuestProgress } | undefined;
jest.mock("@/hooks/useStats", () => ({
  useStats: () => ({ stats: statsValue }),
}));

const showToast = jest.fn();
jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

// ── fixtures ────────────────────────────────────────────────────

const quest = (over: Partial<QuestState> & { id: string }): QuestState => ({
  chapter: 1,
  title: `Quest ${over.id}`,
  action: `Do ${over.id}`,
  screen: "/work/missions",
  teaches: [],
  requires: undefined,
  earns: undefined,
  proof: { kind: "event", event: "mission.dispatched", target: 1 },
  met: false,
  completed: false,
  completedAt: null,
  skipped: false,
  ...over,
});

const progress = (quests: QuestState[]): QuestProgress => ({
  chapters: [],
  quests,
  completed: quests.filter((q) => q.completed && !q.skipped).length,
  total: quests.filter((q) => !q.skipped).length,
  nextCompletedAt: {},
  latchChanged: false,
  seeding: false,
});

const ALL_HOSTS = { gateway: true, memory: true, composer: true, hostScheduler: true };

const metrics = (over: Partial<RawMetrics> = {}): RawMetrics =>
  ({
    eventCounts: {},
    facts: {},
    ...over,
  }) as unknown as RawMetrics;

beforeEach(() => {
  statsValue = undefined;
  showToast.mockClear();
});

// ═══════════════════════════════════════════════════════════════
// the catalogue helpers
// ═══════════════════════════════════════════════════════════════

describe("the chapter helpers count the chapter they were asked about", () => {
  it("returns the quests whose own chapter number matches, and no others", () => {
    // The independent expectation: filter the catalogue here, in the test,
    // rather than asking the helper to confirm itself.
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      const expected = QUEST_DEFS.filter((d) => d.chapter === n).map((d) => d.id);
      expect(questsInChapter(n).map((d) => d.id)).toEqual(expected);
      expect(expected.length).toBeGreaterThan(0);
    }
  });

  it("a chapter counter is not a total: proving every quest at once still counts one chapter", () => {
    // Every event proved, generously, so every event-proved quest is met. The
    // count for a chapter must still be that chapter's own, never the ledger's.
    const m = metrics({
      eventCounts: Object.fromEntries(
        QUEST_DEFS.flatMap((d) => (d.proof.kind === "event" ? [[d.proof.event, 99] as const] : [])),
      ),
      facts: { profiles: 99, models: 99, credentials: 99, workflows: 99, memoryConfigured: true },
    });

    const everything = QUEST_DEFS.length;
    for (const n of [1, 3, 4]) {
      const inThisChapter = QUEST_DEFS.filter((d) => d.chapter === n).length;
      expect(questsMetInChapter(m, n)).toBeLessThanOrEqual(inThisChapter);
      expect(questsMetInChapter(m, n)).toBeLessThan(everything);
    }
  });

  it("counts nothing for a chapter that does not exist, rather than falling into its neighbour", () => {
    expect(questsInChapter(99)).toHaveLength(0);
    expect(questsInChapter(0)).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// QuestTracker
// ═══════════════════════════════════════════════════════════════

describe("the tracker greets a completion, never a history", () => {
  it("the first poll seeds and says nothing, however much is already done", () => {
    statsValue = { quests: progress([quest({ id: "1.1", completed: true }), quest({ id: "1.2", completed: true })]) };
    render(<QuestTracker />);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("toasts only what became complete after that", () => {
    statsValue = { quests: progress([quest({ id: "1.1", completed: true }), quest({ id: "1.2" })]) };
    const { rerender } = render(<QuestTracker />);
    expect(showToast).not.toHaveBeenCalled();

    statsValue = {
      quests: progress([
        quest({ id: "1.1", completed: true }),
        quest({ id: "1.2", completed: true, title: "Dispatch a mission" }),
      ]),
    };
    rerender(<QuestTracker />);

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("Dispatch a mission"), "success");
  });

  it("says nothing on a seeding poll, which is the server's half of the same rule", () => {
    statsValue = { quests: progress([quest({ id: "1.1" })]) };
    const { rerender } = render(<QuestTracker />);

    statsValue = { quests: { ...progress([quest({ id: "1.1", completed: true })]), seeding: true } };
    rerender(<QuestTracker />);

    expect(showToast).not.toHaveBeenCalled();
  });

  it("never congratulates the operator for a quest they skipped", () => {
    statsValue = { quests: progress([quest({ id: "1.1" })]) };
    const { rerender } = render(<QuestTracker />);

    statsValue = { quests: progress([quest({ id: "1.1", completed: true, skipped: true })]) };
    rerender(<QuestTracker />);

    expect(showToast).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// QuestBadge
// ═══════════════════════════════════════════════════════════════

describe("the rail badge", () => {
  it("carries the count while there is one to carry", () => {
    statsValue = { quests: progress([quest({ id: "1.1", completed: true }), quest({ id: "1.2" })]) };
    render(<QuestBadge />);
    expect(screen.getByTestId("quest-badge")).toHaveTextContent("1/2");
  });

  it("gets out of the way once every quest is done", () => {
    statsValue = { quests: progress([quest({ id: "1.1", completed: true })]) };
    render(<QuestBadge />);
    expect(screen.queryByTestId("quest-badge")).not.toBeInTheDocument();
  });

  it("says nothing at all before the poll has answered", () => {
    statsValue = undefined;
    render(<QuestBadge />);
    expect(screen.queryByTestId("quest-badge")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// NextQuestCard
// ═══════════════════════════════════════════════════════════════

describe("the dashboard's next-quest card", () => {
  it("offers the first quest that is not finished", () => {
    render(
      <NextQuestCard
        quests={progress([
          quest({ id: "1.1", completed: true, title: "Add a model" }),
          quest({ id: "1.2", title: "Add a credential" }),
        ])}
        host={ALL_HOSTS}
      />,
    );
    expect(screen.getByText("Add a credential")).toBeInTheDocument();
    expect(screen.queryByText("Add a model")).not.toBeInTheDocument();
  });

  it("never offers finished work", () => {
    render(
      <NextQuestCard
        quests={progress([quest({ id: "1.1", completed: true }), quest({ id: "1.2", completed: true })])}
        host={ALL_HOSTS}
      />,
    );
    expect(screen.queryByLabelText("Start here")).not.toBeInTheDocument();
  });

  it("passes over a quest the operator skipped", () => {
    render(
      <NextQuestCard
        quests={progress([
          quest({ id: "1.1", skipped: true, title: "Add a model" }),
          quest({ id: "1.2", title: "Add a credential" }),
        ])}
        host={ALL_HOSTS}
      />,
    );
    expect(screen.getByText("Add a credential")).toBeInTheDocument();
  });

  it("passes over a quest this host cannot attempt, rather than sending anyone at a locked door", () => {
    render(
      <NextQuestCard
        quests={progress([
          quest({ id: "1.1", requires: "composer", title: "Run the starter workflow" }),
          quest({ id: "1.2", title: "Add a credential" }),
        ])}
        host={{ ...ALL_HOSTS, composer: false }}
      />,
    );
    expect(screen.queryByText("Run the starter workflow")).not.toBeInTheDocument();
    expect(screen.getByText("Add a credential")).toBeInTheDocument();
  });

  it("stays out of sight when the operator hid the guide", () => {
    render(<NextQuestCard quests={progress([quest({ id: "1.1" })])} host={ALL_HOSTS} hidden />);
    expect(screen.queryByLabelText("Start here")).not.toBeInTheDocument();
  });
});

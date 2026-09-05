/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports -- the status-vocabulary claim is a structural one, read off the source where it is asserted rather than imported at the top of a jsdom file */
// ═══════════════════════════════════════════════════════════════
// B11 oracle, the row and the group (T-0105, contract §1 §2 §6 §12).
//
// Written before the product code moved. What each case pins:
//
//   D29  `SOURCE_META[session.source] ?? SOURCE_META.cli` badges every source
//        PatterStage has no word for as "CLI". The agent emits `chat`, and
//        the operator's own database holds `subagent` and `tui` rows, so the
//        list confidently mislabels three real sources as a fourth.
//   D30  status, exitCode and error are on the record and rendered nowhere:
//        a mission that died with exit 137 looks exactly like one that
//        finished. The word comes from src/lib/status-labels.ts, not from a
//        literal typed into the component.
//   D32  The whole row is an <a> with a second <a> inside it for the mission
//        badge, and the mission group is a <button> with an <a> inside it.
//        Both are invalid; the browser's parser closes the outer element at
//        the inner one, which is why the code needs stopPropagation and a
//        z-index to paper over it.
//   D34  The group card counts the loaded page and says "N sessions", which
//        asserts a total it cannot see (a 40-run mission spread over two
//        pages renders as "12 sessions" and "28 sessions").
// ═══════════════════════════════════════════════════════════════

import { fireEvent, render, screen } from "@testing-library/react";

import SessionCard from "@/components/session/SessionCard";
import MissionGroupCard from "@/components/session/MissionGroupCard";
import { SESSION_STATUS_LABELS } from "@/lib/status-labels";
import type { SessionRecord } from "@/lib/sessions/session-repository";
import type { MissionGroup } from "@/lib/sessions/sessions-grouping";

const HOUR_AGO = new Date(Date.now() - 3_600_000).toISOString();
const DAY_AGO = new Date(Date.now() - 86_400_000).toISOString();

/**
 * `source` is deliberately typed as a plain string here: the column is free
 * text and this oracle is about the values the union does not name yet.
 */
function session(over: Partial<Omit<SessionRecord, "source">> & { source?: string } = {}): SessionRecord {
  return {
    id: "sess-1",
    agentType: "hermes",
    source: "cli",
    missionId: null,
    profileName: "default",
    modelId: "sonnet-4",
    provider: null,
    title: "Triage the queue",
    size: 4096,
    startedAt: HOUR_AGO,
    endedAt: null,
    status: "completed",
    exitCode: 0,
    error: null,
    messageCount: 5,
    ...over,
  } as unknown as SessionRecord;
}

function readSource(relative: string): string {
  const { readFileSync } = require("fs") as typeof import("fs");
  const { join } = require("path") as typeof import("path");
  return readFileSync(join(__dirname, "..", "..", "src", ...relative.split("/")), "utf-8");
}

// ═══════════════════════════════════════════════════════════════
// D29 — no source is badged as another source
// ═══════════════════════════════════════════════════════════════

describe("a session row names the source it actually came from", () => {
  it.each([
    ["chat", "Chat"],
    ["subagent", "Subagent"],
    ["tui", "TUI"],
  ])("badges a %s session %s", (source, label) => {
    render(<SessionCard session={session({ source })} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText("CLI")).toBeNull();
  });

  it("prints a source it has never heard of rather than inventing one", () => {
    render(<SessionCard session={session({ source: "wormhole" })} />);

    expect(screen.getByText("wormhole")).toBeInTheDocument();
    expect(screen.queryByText("CLI")).toBeNull();
  });

  it("GUARD: the four it already knew are unchanged", () => {
    const { unmount } = render(<SessionCard session={session({ source: "cli" })} />);
    expect(screen.getByText("CLI")).toBeInTheDocument();
    unmount();

    render(<SessionCard session={session({ source: "mission", missionId: "m-1" })} />);
    expect(screen.getByText("Mission")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// D30 — a failed session says so, on the row
// ═══════════════════════════════════════════════════════════════

describe("a failed session is distinguishable from a successful one", () => {
  it("badges the failure with its exit code", () => {
    render(
      <SessionCard
        session={session({ status: "failed", exitCode: 137, error: "Killed by the OOM killer" })}
      />,
    );

    expect(screen.getByText(/Failed · exit 137/)).toBeInTheDocument();
  });

  it("carries the error where a reader can get at it", () => {
    render(
      <SessionCard
        session={session({ status: "failed", exitCode: 137, error: "Killed by the OOM killer" })}
      />,
    );

    const badge = screen.getByText(/Failed · exit 137/);
    expect(badge.closest("[title]")?.getAttribute("title")).toContain("Killed by the OOM killer");
  });

  it("still says Failed when there is no exit code to show", () => {
    render(<SessionCard session={session({ status: "failed", exitCode: null, error: null })} />);

    expect(screen.getByText(SESSION_STATUS_LABELS.failed)).toBeInTheDocument();
  });

  it("says nothing of the sort about a session that finished", () => {
    render(<SessionCard session={session({ status: "completed", exitCode: 0 })} />);

    expect(screen.queryByText(/Failed/)).toBeNull();
  });

  it("takes the word from the one status vocabulary, not from a literal", () => {
    // decision 13: thirteen ratified words, and src/lib/status-labels.ts is
    // the only place a status becomes one of them.
    expect(readSource("components/session/SessionCard.tsx")).toContain("@/lib/status-labels");
  });
});

// ═══════════════════════════════════════════════════════════════
// D32 — the row nests validly
// ═══════════════════════════════════════════════════════════════

describe("a session row contains no interactive element inside another", () => {
  it("has no anchor inside an anchor", () => {
    const { container } = render(
      <SessionCard session={session({ missionId: "m-7" })} />,
    );

    expect(container.querySelectorAll("a a")).toHaveLength(0);
  });

  it("the row is still clickable across its whole area", () => {
    // The row used to be an anchor wrapping everything, which is what made the
    // whole row a click target. Taking that away without stretching the title's
    // link would make only the words clickable, which is a worse row than the
    // invalid one it replaced (T-0105, D32).
    render(<SessionCard session={session()} />);

    const rowLink = screen.getByRole("link", { name: /Triage the queue/ });
    expect(rowLink.className).toMatch(/after:absolute/);
    expect(rowLink.className).toMatch(/after:inset-0/);
    // And the thing it covers is positioned, or the stretch covers the page.
    expect(rowLink.closest("[class*='relative']")).not.toBeNull();
  });

  it("the mission badge is its own link, not one buried in the row's link", () => {
    render(<SessionCard session={session({ missionId: "m-7" })} />);

    const badge = screen.getByTitle("Open parent mission");
    // Nothing above it is an anchor: the row's link no longer wraps it.
    expect(badge.parentElement?.closest("a")).toBeNull();
    expect(badge.getAttribute("href")).toBe("/work/missions?mission=m-7");
  });

  it("GUARD: the row still opens the transcript", () => {
    render(<SessionCard session={session({ id: "sess-42" })} />);

    const link = screen.getByRole("link", { name: /Triage the queue/ });
    expect(link.getAttribute("href")).toBe("/results/sessions/sess-42");
  });

  it("the row no longer needs a click swallowed to survive its own markup", () => {
    expect(readSource("components/session/SessionCard.tsx")).not.toContain("stopPropagation");
  });
});

// ═══════════════════════════════════════════════════════════════
// D32 / D34 — the mission group
// ═══════════════════════════════════════════════════════════════

describe("a mission group row", () => {
  function group(over: Partial<MissionGroup> = {}): MissionGroup {
    return {
      kind: "mission",
      key: "mission:m-7",
      missionId: "m-7abcdef012345",
      sessions: [
        session({ id: "s-1", title: "Run one", startedAt: HOUR_AGO }),
        session({ id: "s-2", title: "Run two", startedAt: DAY_AGO }),
      ],
      firstStartedAt: DAY_AGO,
      lastStartedAt: HOUR_AGO,
      activeCount: 0,
      ...over,
    };
  }

  it("counts what it can see, and says that is what it counted", () => {
    render(<MissionGroupCard group={group()} />);

    expect(screen.getByText("2 on this page")).toBeInTheDocument();
    expect(screen.queryByText("2 sessions")).toBeNull();
  });

  it("claims no completeness in the expanded footer either", () => {
    const { container } = render(<MissionGroupCard group={group()} />);
    fireEvent.click(screen.getByRole("button", { name: /Run one/ }));

    expect(container.textContent).not.toMatch(/Showing all 2 sessions/);
    expect(container.textContent).toMatch(/on this page/);
  });

  it("has no link inside its button", () => {
    const { container } = render(<MissionGroupCard group={group()} />);

    expect(container.querySelectorAll("button a")).toHaveLength(0);
  });

  it("GUARD: the mission link and the expander both still work", () => {
    render(<MissionGroupCard group={group()} />);

    expect(screen.getByTitle("Open the parent mission").getAttribute("href")).toBe(
      "/work/missions?mission=m-7abcdef012345",
    );
    expect(screen.queryByText("Run two")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Run one/ }));
    expect(screen.getByText("Run two")).toBeInTheDocument();
  });
});

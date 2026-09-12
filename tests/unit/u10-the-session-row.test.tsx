/** @jest-environment jsdom */
/**
 * U10 (T-0124), part one: a session is a row, not a card.
 *
 * The sessions list is 3,621px of scroll at 77px a row, and a row carries a
 * title, a badge, two timestamps and an id. It is two stacked lines - a title
 * line, then a wrapping line of up to seven chips - inside `p-4`, which is a
 * card's rhythm applied to a ledger.
 *
 * The density decision for this screen is DENSE, and the reason is what the
 * screen is for: you come to it to find one session among hundreds, and the
 * cost of a tall row is how many you can see at once. One line, `px-4 py-2.5`,
 * and it lands at about 44px.
 *
 * Density is not deletion, and that is the half worth testing. Every fact the
 * two-line row carried is still on the one-line row: the source, the age, the
 * profile, the model, the message count, the size, the parent mission and the
 * failure. What changes is that they sit in COLUMNS rather than wrapping, so
 * the eye can run down one of them, and the ones that matter least give way
 * first as the viewport narrows rather than pushing the row to two lines.
 *
 * And one trailing affordance, at a fixed right offset. Three x positions in
 * one list is what makes a list look ragged even when every row is the same
 * height: the chevron sat after a flexible block, the mission badge after
 * another, and the failure badge after a third.
 */
import { render, screen, within } from "@testing-library/react";

import SessionCard from "@/components/session/SessionCard";
import type { SessionRecord } from "@/lib/sessions/session-repository";

const session = (over: Partial<SessionRecord> = {}): SessionRecord =>
  ({
    id: "sess-1",
    title: "Triage the overnight queue",
    source: "cli",
    status: "completed",
    startedAt: "2026-09-08T22:00:00.000Z",
    size: 4096,
    messageCount: 12,
    profileName: "operator",
    modelId: "claude-opus-5",
    missionId: null,
    error: null,
    exitCode: null,
    ...over,
  }) as unknown as SessionRecord;

const row = () => screen.getByTestId("session-row");

describe("a session row is one line", () => {
  it("wears the ledger's row rhythm, not a card's block padding", () => {
    render(<SessionCard session={session()} />);
    const classes = (row().getAttribute("class") ?? "").split(/\s+/);
    expect(classes).toContain("py-2.5");
    expect(classes).not.toContain("p-4");
  });

  /**
   * The facts sit beside the title rather than under it. A nested block that
   * stacks them is exactly the two-line row this replaces, so the test asks
   * about the STRUCTURE rather than about a class.
   */
  it("puts the title and the facts on one axis", () => {
    render(<SessionCard session={session()} />);
    const kids = Array.from(row().children);
    // The heading is a direct child of the row, not of a column inside it.
    expect(kids.some((el) => el.tagName === "H3")).toBe(true);
  });

  it("gives the age a fixed column, so ages line up down the list", () => {
    render(<SessionCard session={session()} />);
    const age = within(row()).getByTestId("session-age");
    const classes = (age.getAttribute("class") ?? "").split(/\s+/);
    expect(classes.some((c) => /^w-\d/.test(c))).toBe(true);
    expect(classes).toContain("text-right");
    expect(classes).toContain("tabular-nums");
  });

  it("ends with exactly one trailing affordance", () => {
    render(<SessionCard session={session({ missionId: "m1" })} />);
    const kids = Array.from(row().children);
    expect(kids[kids.length - 1]!.getAttribute("data-testid")).toBe("session-open");
  });
});

describe("density is not deletion", () => {
  it.each([
    ["the source", /cli/i],
    ["the profile", /operator/],
    ["the model", /claude-opus-5/],
    ["the message count", /12/],
    ["the size", /4\.0 KB/],
  ])("still carries %s", (_what, pattern) => {
    render(<SessionCard session={session()} />);
    expect(row().textContent).toMatch(pattern);
  });

  it("still links to the parent mission when there is one", () => {
    render(<SessionCard session={session({ missionId: "m1" })} />);
    expect(within(row()).getByRole("link", { name: /mission/i })).toHaveAttribute(
      "href",
      expect.stringContaining("m1"),
    );
  });

  it("still says a failed session failed, and how", () => {
    render(<SessionCard session={session({ status: "failed", exitCode: 2 })} />);
    expect(row().textContent).toMatch(/exit 2/);
  });

  it("still opens the session", () => {
    render(<SessionCard session={session()} />);
    expect(within(row()).getByRole("link", { name: /Triage the overnight queue/ })).toHaveAttribute(
      "href",
      "/results/sessions/sess-1",
    );
  });

  /** A live session still says so, which is the one fact that changes. */
  it("still marks a live session", () => {
    const { container } = render(<SessionCard session={session({ status: "active" })} />);
    expect(container.querySelector("[data-ps-live]")).not.toBeNull();
  });
});

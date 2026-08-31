/** @jest-environment node */

// T-0079 acceptance oracle — four instances of one defect shape, plus the one
// the browser pass found.
//
// THE SHAPE. A value is accepted at the boundary, a default or a cast papers
// over the gap, and the damage lands in a column nobody re-validates. In two of
// these the product had already COMPUTED the right answer and thrown it away.
//
//   cron          `0 0 30 2 *` -- the 30th of February -- parses as valid,
//                 stores `enabled: true`, and computes a null next-run. The due
//                 query filters `next_run_at IS NOT NULL`, so the row is
//                 enabled forever and dead forever. Four server write sites and
//                 two client validators all discard computeNextRun's null.
//   mission name  blank or whitespace becomes "Untitled Mission", silently, so
//                 three of them are indistinguishable on the board.
//   category      DELETE with an unknown id answers 200 {"deleted": id} and
//                 deletes nothing. deleteCategory ALREADY returns false; the
//                 route throws the boolean away.
//   characters    `characters: ["QA-Bot"]` is cast to objects and rendered into
//                 the model's prompt as "- undefined (undefined): undefined".
//
// AND THE FIFTH, from driving the product in a browser rather than over HTTP:
// on a fresh install /logs answers 404 "No logs directory found" and the page
// shows "No matching log files" with no error anywhere. An operator cannot tell
// "you have no logs" from "I could not look". T-0071 fixed the sibling 404 --
// the one for a missing FILE -- and never touched this one, which returns no
// availableLogs either, so the page's self-correction has nothing to work with.

import { cronCanEverFire, scheduleCanEverFire, computeNextRun } from "@/lib/schedule/next-run";
import { chapterTitle } from "@/modules/rec-room/lib/chapter-title";
import { normaliseStoryCharacters } from "@/modules/rec-room/lib/characters";
import { missionNameFrom } from "@/lib/missions/mission-name";

describe("a cron that can never fire is refused", () => {
  it.each([
    ["0 0 30 2 *", "the 30th of February"],
    ["0 0 31 4 *", "the 31st of April"],
    ["0 0 31 2,4 *", "the 31st of either February or April"],
    ["0 99 * * *", "hour 99"],
    ["99 * * * *", "minute 99"],
  ])("refuses %s (%s)", (expr) => {
    expect(cronCanEverFire(expr)).toBe(false);
  });

  it("ACCEPTS the 29th of February, which fires every four years", () => {
    // The trap in the obvious fix. Probing computeNextRun and refusing a null
    // would reject this, because the prober gives up after 366 days of
    // minute-stepping. It is a legitimate expression and refusing it would be a
    // new defect wearing the old one's clothes.
    expect(cronCanEverFire("0 0 29 2 *")).toBe(true);
  });

  it.each([
    ["0 9 * * *", "every day at nine"],
    ["*/15 * * * *", "every fifteen minutes"],
    ["0 0 31 1 *", "the 31st of January"],
    ["0 0 1 * *", "the first of every month"],
  ])("GREEN CONTROL: accepts %s (%s)", (expr) => {
    expect(cronCanEverFire(expr)).toBe(true);
  });

  it("accepts an impossible DATE when the day-of-week can still match it", () => {
    // Standard cron: with BOTH day-of-month and day-of-week restricted, a day
    // matching EITHER fires. So `0 0 30 2 1` fires on Mondays and is valid,
    // even though the 30th of February never comes.
    expect(cronCanEverFire("0 0 30 2 1")).toBe(true);
  });

  it("does not judge schedules that are not cron at all", () => {
    // Found by the existing suite the moment this was wired in: the guard was
    // called on every schedule, and an interval shorthand has fewer than five
    // fields, so "every 10m" was refused as unfireable. Only cron carries the
    // impossible-date problem.
    expect(scheduleCanEverFire("every 10m")).toBe(true);
    expect(scheduleCanEverFire("every 2h")).toBe(true);
    expect(scheduleCanEverFire("2027-01-01T09:00:00Z")).toBe(true);
  });

  it("still refuses an impossible cron through the schedule-level guard", () => {
    expect(scheduleCanEverFire("0 0 30 2 *")).toBe(false);
    expect(scheduleCanEverFire("0 9 * * *")).toBe(true);
  });

  it("agrees with computeNextRun on everything it accepts", () => {
    // The two must not disagree: anything this lets through has to actually
    // produce a next run, or the row lands enabled-and-dead exactly as before.
    for (const expr of ["0 9 * * *", "*/15 * * * *", "0 0 1 * *", "0 0 31 1 *"]) {
      expect(computeNextRun(expr, new Date("2026-01-01T00:00:00Z"))).not.toBeNull();
    }
  });
});

describe("a mission is named, or named after what it does", () => {
  it("keeps a name the operator supplied", () => {
    expect(missionNameFrom("Nightly backup", "do the thing")).toBe("Nightly backup");
  });

  it("derives a name from the instruction rather than a shared constant", () => {
    // "Untitled Mission" made every unnamed mission identical on the board.
    // Story Weaver already solved this by titling from the premise's first few
    // words; missions get the same treatment rather than a different constant.
    const name = missionNameFrom(undefined, "Summarise the Q3 revenue report for the board");
    expect(name).not.toMatch(/untitled/i);
    expect(name.toLowerCase()).toContain("summarise");
  });

  it("gives two different instructions two different names", () => {
    const a = missionNameFrom("", "Deploy the staging environment");
    const b = missionNameFrom("", "Rotate the signing keys");
    expect(a).not.toBe(b);
  });

  it("falls back to a constant only when there is nothing to derive from", () => {
    expect(missionNameFrom(undefined, "")).toBeTruthy();
    expect(missionNameFrom("   ", "   ")).toBeTruthy();
  });

  it("bounds a very long instruction rather than titling with all of it", () => {
    expect(missionNameFrom(undefined, "word ".repeat(200)).length).toBeLessThanOrEqual(80);
  });

  it("strips newlines, because the board renders one line", () => {
    expect(missionNameFrom(undefined, "First line\nsecond line")).not.toMatch(/\n/);
  });
});

describe("story characters survive being written as strings", () => {
  it("turns a bare string into a named character", () => {
    // The API has no schema for config.characters at all, and two consumers
    // cast it to objects: the prompt builder and the arc fallback. A string
    // reaches both and renders "- undefined (undefined): undefined".
    expect(normaliseStoryCharacters(["QA-Bot"])).toEqual([{ name: "QA-Bot" }]);
  });

  it("leaves a properly-shaped character alone", () => {
    const full = [{ name: "Ada", role: "protagonist", description: "an engineer" }];
    expect(normaliseStoryCharacters(full)).toEqual(full);
  });

  it("drops entries that are neither, rather than emitting undefined", () => {
    expect(normaliseStoryCharacters([null, 42, { role: "no name" }, "Ada"])).toEqual([
      { name: "Ada" },
    ]);
  });

  it("survives a non-array entirely", () => {
    expect(normaliseStoryCharacters(undefined)).toEqual([]);
    expect(normaliseStoryCharacters("Ada")).toEqual([]);
  });

  it("GREEN CONTROL: the sibling bounding helper still behaves", () => {
    // chapterTitle is the in-file precedent this follows: bound an untrusted
    // field at the boundary rather than trusting the cast.
    expect(chapterTitle("A Good Title", 0)).toBe("A Good Title");
  });
});

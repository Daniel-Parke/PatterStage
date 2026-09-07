/** @jest-environment jsdom */
/**
 * U12 (T-0126): the reader's warm register is three tokens, and its chapter
 * dots are on the status ladder.
 *
 * The register was thirteen tokens for one reading surface: a dark tint and a
 * black tint, each with a page, an ink and a panel; an accent that was the
 * house purple by another name; a rule; and five chapter-state tints that were
 * a second status ladder drawn beside the one the whole product uses. The
 * comment on them said moving them onto the house ladder was "a design
 * decision for the lock-book". The lock-book took it (org/plans/
 * 2026-09-ui-overhaul.md, U12): page, ink and rule stay warm; everything
 * else is the console's.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => {
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

const ROOT = join(__dirname, "..", "..");
const css = readFileSync(join(ROOT, "src", "app", "globals.css"), "utf-8");
const COMPONENTS = join(ROOT, "src", "modules", "rec-room", "components");

describe("the tokens", () => {
  it.each(["--color-ps-reader-page", "--color-ps-reader-ink", "--color-ps-reader-rule"])("declares %s as a theme colour", (token) => {
    expect(css).toMatch(new RegExp(`^\\s*${token}:\\s*#[0-9a-fA-F]{6};`, "m"));
  });

  it.each(["--ps-reader-dark-", "--ps-reader-black-", "--ps-reader-accent", "--ps-reader-chapter-", "--ps-reader-rule:"])(
    "no longer declares %s",
    (prefix) => {
      expect(css.includes(prefix)).toBe(false);
    },
  );

  it("chapter-dot.ts, the second status ladder, is gone", () => {
    expect(existsSync(join(COMPONENTS, "chapter-dot.ts"))).toBe(false);
  });

  it("and no reader component names a ReaderTheme any more", () => {
    const types = readFileSync(join(COMPONENTS, "story-reader-types.ts"), "utf-8");
    expect(types.includes("ReaderTheme")).toBe(false);
  });
});

describe("chapterTone, the one map from a chapter to a rung", () => {
  it.each([
    [{ status: "writing" }, "running"],
    [{ status: "failed" }, "fail"],
    [{ status: "pending" }, "queued"],
    [{ status: "complete", readStatus: "read" }, "ok"],
    [{ status: "complete", readStatus: "unread" }, "blocked"],
    [{ status: "complete" }, "blocked"],
    [{ status: "" }, "idle"],
    [{ status: "something-new" }, "idle"],
  ])("%j reads as %s", async (chapter, tone) => {
    const { chapterTone } = await import("@/modules/rec-room/lib/chapter-tone");
    expect(chapterTone(chapter as { status: string; readStatus?: "writing" | "unread" | "read" })).toBe(tone);
  });
});

describe("the reading settings", () => {
  it("carry no page theme, and a stored one from before is dropped rather than kept", async () => {
    window.localStorage.setItem(
      "story-weaver-reader-settings",
      JSON.stringify({ fontSize: 20, pageTheme: "black" }),
    );
    const mod = await import("@/modules/rec-room/components/ReaderSettings");
    expect("THEMES" in mod).toBe(false);
    const settings = mod.loadSettings() as Record<string, unknown>;
    expect(settings.fontSize).toBe(20);
    expect("pageTheme" in settings).toBe(false);
  });
});

describe("the dots in the reader's header", () => {
  it("paint each chapter with its rung, and mark the one being read", async () => {
    const { default: ReaderHeader } = await import("@/modules/rec-room/components/ReaderHeader");
    const noop = () => {};
    const { DEFAULT_SETTINGS } = await import("@/modules/rec-room/components/ReaderSettings");
    render(
      <ReaderHeader
        title="Signal"
        chapters={[
          { number: 1, title: "Landfall", status: "complete", readStatus: "read", wordCount: 900 },
          { number: 2, title: "The Bell", status: "writing", wordCount: 0 },
          { number: 3, title: "Ashore", status: "pending", wordCount: 0 },
          { number: 4, title: "Storm", status: "failed", wordCount: 0 },
        ]}
        currentChapter={1}
        allComplete={false}
        anyFailed={true}
        sidebarOpen={false}
        settings={DEFAULT_SETTINGS}
        onSettingsChange={noop}
        onBack={noop}
        onContinue={noop}
        onRetryFailed={noop}
        writing={false}
        generating={false}
        pendingCount={1}
        nextPending={3}
        onWriteNext={noop}
        onKeepWriting={noop}
        onStop={noop}
        onOpenBible={noop}
        onToggleSidebar={noop}
        onSelectChapter={noop}
        spend={null}
      />,
    );
    const dots = screen.getAllByRole("button", { name: /^Chapter \d/ });
    expect(dots).toHaveLength(4);
    expect(dots[0].className).toMatch(/bg-status-ok/);
    expect(dots[1].className).toMatch(/bg-status-running/);
    expect(dots[2].className).toMatch(/bg-status-queued/);
    expect(dots[3].className).toMatch(/bg-status-fail/);
    expect(dots[0]).toHaveAttribute("aria-current", "true");
    expect(dots[1]).not.toHaveAttribute("aria-current");
    // Every dot is a target: WCAG 2.5.8 asks 24x24 and the old dots were 8px.
    for (const dot of dots) expect(dot.className).toMatch(/(?:^|\s)(?:h-6|min-h-6|size-6)(?:\s|$)/);
  });
});

describe("the reader's chrome carries no literal palette colour", () => {
  const raw = /(?<![\w-])(?:bg|text|border|from|to|ring)-(?:red|green|blue|orange|yellow|cyan|emerald|purple|white)-\d{2,3}/;
  it.each(["ReaderHeader.tsx", "ReaderNavigation.tsx", "ChapterList.tsx", "ChapterReader.tsx", "ReaderBanners.tsx", "ReaderSettings.tsx"])(
    "%s",
    (file) => {
      const src = readFileSync(join(COMPONENTS, file), "utf-8");
      const hits = src.split("\n").filter((l) => raw.test(l));
      expect({ file, hits }).toEqual({ file, hits: [] });
    },
  );
});

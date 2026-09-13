/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U18 · Prose is Inter; a count is mono.
 *
 * Decision 10 of the overhaul: mono for machine words, Inter for prose. The
 * header's subtitle was `font-mono text-micro` on every screen, so "Talk to
 * your Hermes agent — tools, memory, live runs" was set as if it were a path.
 * Twenty-one subtitles on twenty-one routes were the single largest
 * contributor to the mono share the census counts, and mono at 12px is why
 * the phone crush wrapped so badly (the UI review of 2026-09-08, P2).
 *
 * The subtitle is Inter at body size now, and any count inside it is a mono
 * tabular token, the way the pending-count mark already is. A digit inside a
 * word ("gpt-4o") is not a count and stays in the word.
 *
 * The same rule takes the word "Active" off every Skills row: the switch
 * beside it says active, in its accessible name and its tone, and the word
 * cost the row a line on a phone.
 */

import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

jest.mock("next/navigation", () => ({ usePathname: () => "/agent/profiles" }));
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());
jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("@/components/help/HelpLink", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/layout/PageTitle", () => ({
  __esModule: true,
  default: () => null,
  useRegistryTitle: (title?: string) => title ?? "Agents",
}));

import PageHeader from "@/components/layout/PageHeader";
import { SkillRow } from "@/components/skills/SkillRow";
import type { Skill } from "@/types/console";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const Icon = () => <svg />;

function subtitle(): HTMLElement {
  const h1 = screen.getByRole("heading", { level: 1 });
  const p = h1.nextElementSibling;
  if (!p || p.tagName !== "P") throw new Error("no subtitle under the h1");
  return p as HTMLElement;
}

describe("U18 · prose is Inter", () => {
  it("the subtitle is body prose, not a micro machine word", () => {
    render(<PageHeader icon={Icon} title="Chat" subtitle="Talk to your Hermes agent — tools, memory, live runs" />);
    const p = subtitle();
    expect(p).toHaveClass("text-body");
    expect(p).not.toHaveClass("font-mono");
    expect(p).not.toHaveClass("text-micro");
    // Still wraps on a phone and truncates from sm (T-0128, T-0131).
    expect(p).toHaveClass("sm:truncate");
    expect(p.querySelector(".font-mono")).toBeNull();
  });

  it("a count inside it is a mono tabular token; a digit inside a word is not", () => {
    render(<PageHeader icon={Icon} title="Agents" subtitle="8 profiles · gpt-4o · 1.2 KB · 12:30" />);
    const p = subtitle();
    const mono = Array.from(p.querySelectorAll(".font-mono")).map((el) => el.textContent);
    expect(mono).toEqual(["8", "1.2", "12:30"]);
    for (const el of p.querySelectorAll(".font-mono")) expect(el).toHaveClass("tabular-nums");
    expect(p.textContent).toBe("8 profiles · gpt-4o · 1.2 KB · 12:30");
  });

  it("a Skills row has no state word beside its switch", () => {
    const skill = { name: "web-search", category: "Research", description: "Search the web", enabled: true } as unknown as Skill;
    render(
      <SkillRow skill={skill} enabled isExpanded={false} isPending={false} onToggle={() => {}} onView={() => {}} onEdit={() => {}} />,
    );
    expect(screen.queryByText("Active")).toBeNull();
    expect(screen.queryByText("Inactive")).toBeNull();
    // The switch carries the state: its name says what a press does.
    expect(screen.getByRole("switch", { name: "Disable web-search" })).toBeChecked();
  });

  it("the Skills guide describes the row as it is", () => {
    const guide = read("docs/guides/skills.md");
    expect(guide).not.toMatch(/the word \*\*Active\*\* or \*\*Inactive\*\*/);
  });
});

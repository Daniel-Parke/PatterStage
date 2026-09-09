/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U17 · The phone keeps its title.
 *
 * The header's actions and its title share one flex row, and the title group
 * grows into what the actions leave. On a phone the busiest headers leave
 * nothing: Chat's mode toggle and New Chat, Scripts' two buttons, Skills'
 * profile picker each take the row, and the review measured the h1 reading
 * "(" and "Scr…" with the subtitle wrapped one word per line (the UI review
 * of 2026-09-08, P1). The floor the component describes is `sm:min-w-[16rem]`,
 * which by its own prefix does not exist below sm, so on the one screen size
 * where the title needs a floor it had none.
 *
 * The fix is one class on one element: below sm the actions slot takes its
 * own full row unconditionally, so the title group is never sharing a row
 * with anything at 390. From sm up nothing changes. The gate that measures
 * it live is tests/e2e/phone.spec.ts: at 390 the h1's box is at least 12rem
 * wide on every route, and the subtitle runs to three lines at most.
 */

import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

jest.mock("next/navigation", () => ({ usePathname: () => "/work/chat" }));
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());
jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("@/components/help/HelpLink", () => ({ __esModule: true, default: () => <a href="/help">?</a> }));
jest.mock("@/components/layout/PageTitle", () => ({
  __esModule: true,
  default: () => null,
  useRegistryTitle: (title?: string) => title ?? "Chat",
}));

import PageHeader from "@/components/layout/PageHeader";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const Icon = () => <svg data-testid="icon" />;

describe("U17 · the phone keeps its title", () => {
  it("below sm the actions slot takes its own row, and gives it back at sm", () => {
    render(<PageHeader icon={Icon} subtitle="Talk to your Hermes agent" actions={<button type="button">New Chat</button>} />);
    const slot = screen.getByRole("button", { name: "New Chat" }).parentElement!;
    // The slot is the wrapper that also carries the ? link, so a page with no
    // actions of its own still wraps the same way.
    expect(slot).toContainElement(screen.getByRole("link", { name: "?" }));
    expect(slot).toHaveClass("basis-full");
    expect(slot).toHaveClass("sm:basis-auto");
    expect(slot).toHaveClass("flex-wrap");
  });

  it("the title group keeps its floor and still grows", () => {
    render(<PageHeader icon={Icon} title="Scripts" subtitle="Shell and Python scripts" />);
    const group = screen.getByRole("heading", { level: 1 }).parentElement!;
    expect(group).toHaveClass("flex-1");
    expect(group).toHaveClass("min-w-0");
    expect(group).toHaveClass("sm:min-w-[16rem]");
    // The subtitle wraps below sm and truncates from sm up (T-0128); the fix
    // must not trade one for the other.
    const subtitle = screen.getByText("Shell and Python scripts");
    expect(subtitle).toHaveClass("sm:truncate");
    expect(subtitle).not.toHaveClass("truncate");
  });

  it("the source says why, beside the class", () => {
    const src = read("src/components/layout/PageHeader.tsx");
    expect(src).toMatch(/basis-full sm:basis-auto/);
    // A decision a later reader can check against the review, not a bare
    // utility with no reason.
    expect(src).toMatch(/390/);
  });
});

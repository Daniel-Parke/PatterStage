/** @jest-environment jsdom */
/**
 * U13 (T-0127): Help names itself.
 *
 * The rail says Help and the tab says Help; the front page of the corpus said
 * Documentation, and every guide page's header named only the guide. The
 * front page is titled Help, and a guide page carries the section's word as
 * its back link, so the registry's word is on every Help screen without
 * unseating B16's rule that a guide's header is the guide's own name.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => {
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({}),
  usePathname: () => "/help/guides/missions",
  useSearchParams: () => new URLSearchParams(),
}));

import HelpHeader from "@/components/help/HelpHeader";

const ROOT = join(__dirname, "..", "..");

describe("the front page of the corpus", () => {
  it("is titled Help, the registry's word for the screen that renders it", () => {
    const src = readFileSync(join(ROOT, "docs", "README.md"), "utf-8");
    expect(src).toMatch(/^title: Help$/m);
    expect(src).toMatch(/^# Help$/m);
  });
});

describe("a guide page's header", () => {
  it("carries a back link to Help, the section's own word", () => {
    render(<HelpHeader title="Missions" subtitle="Dispatch work." back />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Missions");
    expect(screen.getByRole("link", { name: /^help$/i })).toHaveAttribute("href", "/help");
  });

  it("and the front page itself carries none: it is Help", () => {
    render(<HelpHeader title="Help" subtitle="The reading path." />);
    expect(screen.queryByRole("link", { name: /^help$/i })).toBeNull();
  });

  it("the page passes the back link on every slug but the front page's", () => {
    const page = readFileSync(join(ROOT, "src", "app", "help", "[[...slug]]", "page.tsx"), "utf-8");
    expect(page).toMatch(/<HelpHeader[^>]*\bback=\{/);
  });
});

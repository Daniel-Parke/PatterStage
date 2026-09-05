/** @jest-environment jsdom */
/**
 * B3 (T-0097), D79: the Settings index derives its grid from the one section
 * catalogue (src/lib/config-sections.ts), so it can no longer print a count
 * that contradicts what it renders or omit two sections; it carries cards for
 * Models, Restore and System; and it gains a search across every field.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";

import { CONFIG_SECTIONS } from "@/lib/config-schema";

jest.mock("next/navigation", () => ({
  usePathname: () => "/agent/settings",
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
jest.mock("@/hooks/useConfig", () => ({ useConfig: () => ({ data: { agent: { max_turns: 40 } }, isLoading: false, error: null, refetch: jest.fn() }) }));

import SettingsIndexPage from "@/app/agent/settings/page";

const sectionLinks = () =>
  Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/agent/settings/"]'))
    .map((a) => a.getAttribute("href")!)
    .filter((h) => h !== "/agent/settings/restore" && h !== "/agent/settings/system");

describe("the Settings index", () => {
  it("renders one card per catalogue section, and the count it prints is the count it renders", () => {
    render(<SettingsIndexPage />);
    const ids = Object.keys(CONFIG_SECTIONS);
    const links = sectionLinks();
    expect(links.sort()).toEqual(ids.map((id) => `/agent/settings/${id}`).sort());
    const subtitle = screen.getByText(/\d+ sections/);
    expect(subtitle.textContent).toContain(`${ids.length} sections`);
  });

  it("carries the Models, Restore and System cards", () => {
    render(<SettingsIndexPage />);
    expect(document.querySelector('a[href="/agent/models"]')).not.toBeNull();
    expect(document.querySelector('a[href="/agent/settings/restore"]')).not.toBeNull();
    expect(document.querySelector('a[href="/agent/settings/system"]')).not.toBeNull();
  });

  it("no longer sends anyone to the retired Personalities activation or the old config paths", () => {
    render(<SettingsIndexPage />);
    expect(document.querySelector('a[href^="/config"]')).toBeNull();
    expect(document.querySelector('a[href^="/operations"]')).toBeNull();
    expect(screen.queryByText(/one-click activation/i)).toBeNull();
  });

  it("a search across every field narrows the grid to the sections that carry a match", () => {
    render(<SettingsIndexPage />);
    const search = screen.getByRole("searchbox", { name: /search settings/i });
    fireEvent.change(search, { target: { value: "reasoning" } });
    const links = sectionLinks();
    expect(links).toContain("/agent/settings/agent");
    expect(links).not.toContain("/agent/settings/discord");
    // The matching field is named on the card, so the operator sees why it matched.
    const agentCard = document.querySelector('a[href="/agent/settings/agent"]') as HTMLElement;
    expect(within(agentCard).getByText(/reasoning effort/i)).toBeInTheDocument();
  });

  it("an empty search shows everything again", () => {
    render(<SettingsIndexPage />);
    const search = screen.getByRole("searchbox", { name: /search settings/i });
    fireEvent.change(search, { target: { value: "zzz-no-such-field" } });
    expect(sectionLinks()).toEqual([]);
    expect(screen.getByText(/no setting matches/i)).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "" } });
    expect(sectionLinks().length).toBe(Object.keys(CONFIG_SECTIONS).length);
  });
});

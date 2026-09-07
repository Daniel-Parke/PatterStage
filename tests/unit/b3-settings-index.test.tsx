/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */
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
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());
jest.mock("@/hooks/useConfig", () => ({ useConfig: () => ({ data: { agent: { max_turns: 40 } }, isLoading: false, error: null, refetch: jest.fn() }) }));
// The two file sections read through apiFetch now that they sit on the page
// beside the yaml ones (U11, T-0125).
jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  apiFetch: async () => ({ data: { content: "" } }),
}));

import SettingsIndexPage from "@/app/agent/settings/page";

// Amended 2026-09-10 (U11, T-0125). The index was a grid of links to 27
// section PAGES; the sections are on this page now, so what is counted is the
// sections rendered rather than the doors to them. The helper keeps answering
// in the old route shape so every assertion below reads exactly as it did.
const sectionLinks = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="settings-section-"]'))
    .map((el) => `/agent/settings/${el.getAttribute("data-testid")!.replace("settings-section-", "")}`);

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
    const agentCard = screen.getByTestId("settings-section-agent");
    // The field itself is on the page now (U11), so the label matches too; the
    // chip is the one that says WHY the section is still on the page.
    expect(within(agentCard).getByTestId("settings-hit")).toHaveTextContent(/reasoning effort/i);
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

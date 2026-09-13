/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B2 (T-0096), D119 and D120: the sidebar as a keyboard user meets it.
 *
 * D120. The mobile drawer was hidden with a transform, which moves it off
 * screen and leaves every link in the tab order: the first thirty tab stops on
 * every page, on a phone, were invisible nav links. It had no Escape, no focus
 * trap, its backdrop was a div, and it sat at the same z-index as the header
 * it slides over. Closed, it is now inert; open, it is a dialog above the
 * header with the shared contract.
 *
 * D119. Every nav link carries its label as an accessible name whether or not
 * the rail is collapsed.
 *
 * Since T-0097 the rail is rendered ONCE: the phone's drawer and the desktop
 * rail are the same aside, told apart by matchMedia, so this test says which
 * it is.
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { matchMediaMock } from "../helpers/mocks";
import { renderWithQuery } from "../helpers/render-with-query";

jest.mock("next/navigation", () => ({ usePathname: () => "/" }));
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());
jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlags: () => ({ data: {} }) }));
jest.mock("@/components/layout/RailFooter", () => ({ RailFooter: () => null }));
// B17 hung a quest counter on the Quests row. It reads the stats poll through
// react-query, and this file mounts the rail bare, with no query client, so
// the read is doubled here. It answers with a programme in progress rather
// than nothing, because the point below is that the rail's links keep their
// accessible names WITH the badge rendered beside one of them.
jest.mock("@/hooks/useStats", () => ({
  useStats: () => ({
    stats: { quests: { completed: 3, total: 32 } },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock("@/lib/api/api-fetch", () => ({ safeApiCall: jest.fn(async () => ({ ok: false, error: "offline" })) }));

import Sidebar, { MobileHeader } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";

// Under a query client: the collapse preference is written through a
// react-query mutation since C6 (T-0143). Nothing here toggles it.
function mountShell() {
  return renderWithQuery(
    <SidebarProvider>
      <MobileHeader />
      <Sidebar />
    </SidebarProvider>,
  );
}

function mockMedia(mobile: boolean) {
  matchMediaMock((query) => mobile && /max-width/.test(query));
}

/** The one rail. */
function rail(): HTMLElement {
  const aside = document.querySelector("aside");
  if (!aside) throw new Error("no rail rendered");
  return aside;
}

describe("D120: the mobile drawer", () => {
  beforeEach(() => mockMedia(true));

  it("is inert while closed, so its links are out of the tab order", async () => {
    mountShell();
    await waitFor(() => expect(rail()).toHaveAttribute("inert"));
  });

  it("opens as a dialog above the header, and Escape closes it", async () => {
    mountShell();
    await waitFor(() => expect(rail()).toHaveAttribute("inert"));
    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    const d = rail();
    expect(d).not.toHaveAttribute("inert");
    expect(d).toHaveAttribute("role", "dialog");
    expect(d).toHaveAttribute("aria-modal", "true");
    // The modal layer of the seven named ones (C6, T-0143): above the sticky
    // header and the overlay its backdrop sits on.
    expect(d.className).toMatch(/\bz-modal\b/);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(rail()).toHaveAttribute("inert");
  });

  it("its backdrop is a real control with a name", async () => {
    mountShell();
    await waitFor(() => expect(rail()).toHaveAttribute("inert"));
    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    const backdrop = screen.getByRole("button", { name: /close navigation/i });
    expect(backdrop.className).toMatch(/\bz-overlay\b/);
    fireEvent.click(backdrop);
    expect(rail()).toHaveAttribute("inert");
  });
});

describe("D119: every nav link has its label as a name, collapsed or not", () => {
  beforeEach(() => mockMedia(false));

  it("collapsed, the icon-only links still say where they go", () => {
    mountShell();
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    const links = Array.from(rail().querySelectorAll("a[href]"));
    expect(links.length).toBeGreaterThan(10);
    const missing = links.filter((a) => !(a.getAttribute("aria-label") || a.textContent?.trim()));
    expect(missing.map((a) => a.getAttribute("href"))).toEqual([]);
    expect(rail().querySelector('a[href="/work/missions"]')).toHaveAttribute("aria-label", "Missions");
  });
});

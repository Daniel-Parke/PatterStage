/** @jest-environment jsdom */
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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({ usePathname: () => "/" }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("lucide-react", () => {
  const icon = (name: string) =>
    function Icon(props: Record<string, unknown>) {
      return <svg data-icon={name} aria-hidden="true" {...props} />;
    };
  return new Proxy({}, { get: (_t, prop: string) => icon(prop) });
});
jest.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlags: () => ({ data: {} }) }));
jest.mock("@/components/layout/RailFooter", () => ({ RailFooter: () => null }));
jest.mock("@/lib/api-fetch", () => ({ safeApiCall: jest.fn(async () => ({ ok: false, error: "offline" })) }));

import Sidebar from "@/components/layout/Sidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import { SidebarProvider } from "@/components/layout/SidebarContext";

function mountShell() {
  return render(
    <SidebarProvider>
      <MobileHeader />
      <Sidebar />
    </SidebarProvider>,
  );
}

function mockMedia(mobile: boolean) {
  window.matchMedia = jest.fn((query: string) => ({
    matches: mobile && /max-width/.test(query),
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
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
    expect(d.className).toMatch(/z-\[6\d\]/);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(rail()).toHaveAttribute("inert");
  });

  it("its backdrop is a real control with a name", async () => {
    mountShell();
    await waitFor(() => expect(rail()).toHaveAttribute("inert"));
    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    const backdrop = screen.getByRole("button", { name: /close navigation/i });
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

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
 */
import { fireEvent, render, screen } from "@testing-library/react";

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
jest.mock("@/components/layout/VersionFooter", () => ({ VersionFooter: () => null }));

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

/** The mobile drawer: the aside that is hidden on lg, not the desktop one. */
function drawer(): HTMLElement {
  const asides = Array.from(document.querySelectorAll("aside"));
  const mobile = asides.find((a) => a.className.includes("lg:hidden"));
  if (!mobile) throw new Error("no mobile drawer rendered");
  return mobile;
}

describe("D120: the mobile drawer", () => {
  it("is inert while closed, so its links are out of the tab order", () => {
    mountShell();
    expect(drawer()).toHaveAttribute("inert");
  });

  it("opens as a dialog above the header, and Escape closes it", () => {
    mountShell();
    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    const d = drawer();
    expect(d).not.toHaveAttribute("inert");
    expect(d).toHaveAttribute("role", "dialog");
    expect(d).toHaveAttribute("aria-modal", "true");
    expect(d.className).toMatch(/z-\[6\d\]/);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(drawer()).toHaveAttribute("inert");
  });

  it("its backdrop is a real control with a name", () => {
    mountShell();
    fireEvent.click(screen.getByRole("button", { name: /open navigation/i }));
    const backdrop = screen.getByRole("button", { name: /close navigation/i });
    fireEvent.click(backdrop);
    expect(drawer()).toHaveAttribute("inert");
  });
});

describe("D119: every nav link has its label as a name, collapsed or not", () => {
  it("collapsed, the icon-only links still say where they go", () => {
    mountShell();
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    const desktop = Array.from(document.querySelectorAll("aside")).find((a) => !a.className.includes("lg:hidden"))!;
    const links = Array.from(desktop.querySelectorAll("a[href]"));
    expect(links.length).toBeGreaterThan(10);
    const missing = links.filter((a) => !(a.getAttribute("aria-label") || a.textContent?.trim()));
    expect(missing.map((a) => a.getAttribute("href"))).toEqual([]);
    expect(desktop.querySelector('a[href="/orchestration/missions"]')).toHaveAttribute("aria-label", "Missions");
  });
});

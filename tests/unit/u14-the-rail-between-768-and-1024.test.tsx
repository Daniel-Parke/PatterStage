/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U14 · The rail between 768 and 1024.
 *
 * The shell had two states: below lg (1024) the rail was the drawer behind a
 * hamburger, at lg and above it was the static rail, full or collapsed to the
 * 64px icon column at the operator's preference. So a tablet at 800 or 1000
 * pixels, with room to spare for the icon column, got the phone's chrome: a
 * 48px header, a hamburger, and a sheet over the content to reach any screen.
 *
 * The icon rail already exists. From md (768) it is used, forced icons-only
 * regardless of the collapse preference because labels do not fit beside a
 * page at that width; the drawer starts below md; at lg the preference is
 * read again. A breakpoint change over code that already exists, which is why
 * the oracle is the classes the aside wears and what the two media queries
 * say, not a new component.
 *
 * The three states are told apart by matchMedia, so the stub here answers
 * each query by its width, the way the b2 drawer suite answers one.
 */

import { render, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { matchMediaMock } from "../helpers/mocks";

jest.mock("next/navigation", () => ({ usePathname: () => "/" }));
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());
jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlags: () => ({ data: {} }) }));
jest.mock("@/components/layout/RailFooter", () => ({ RailFooter: () => null }));
jest.mock("@/hooks/useStats", () => ({
  useStats: () => ({
    stats: { quests: { completed: 3, total: 32 } },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock("@/lib/api-fetch", () => ({ safeApiCall: jest.fn(async () => ({ ok: false, error: "offline" })) }));

import Sidebar from "@/components/layout/Sidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import { SidebarProvider } from "@/components/layout/SidebarContext";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/**
 * A viewport, answered per query. The phone query names a max-width of 767;
 * the tablet query names a min-width of 768. Anything else is false, as it is
 * for a desktop.
 */
function mockViewport(width: number) {
  matchMediaMock((query) => {
    const max = query.match(/max-width:\s*(\d+)px/);
    const min = query.match(/min-width:\s*(\d+)px/);
    return (!max || width <= Number(max[1])) && (!min || width >= Number(min[1])) && Boolean(max || min);
  });
}

function mountShell(initialCollapsed = false) {
  return render(
    <SidebarProvider>
      <MobileHeader />
      <Sidebar initialCollapsed={initialCollapsed} />
    </SidebarProvider>,
  );
}

function rail(): HTMLElement {
  const aside = document.querySelector("aside");
  if (!aside) throw new Error("no <aside> rendered");
  return aside;
}

describe("U14 · the rail between 768 and 1024", () => {
  it("at 900 the rail is the static icon column, not the drawer", async () => {
    mockViewport(900);
    mountShell(false);
    await waitFor(() => expect(rail()).toHaveClass("md:w-16"));
    expect(rail()).not.toHaveAttribute("inert");
    expect(rail()).not.toHaveAttribute("role", "dialog");
    // Icons only: no label text, but every row still has its name and a title.
    const missions = within(rail()).getByRole("link", { name: "Missions" });
    expect(missions).toHaveAttribute("title", "Missions");
    expect(within(rail()).queryByText("Missions")).toBeNull();
  });

  it("at 390 the rail is the drawer, inert while closed", async () => {
    mockViewport(390);
    mountShell(false);
    await waitFor(() => expect(rail()).toHaveAttribute("inert"));
    // The drawer becomes the static rail at md, not lg.
    expect(rail().className).toMatch(/\bmd:static\b/);
    expect(rail().className).not.toMatch(/\blg:static\b/);
  });

  it("at 1280 the preference is read: labels when expanded", async () => {
    mockViewport(1280);
    mountShell(false);
    await waitFor(() => expect(rail()).toHaveClass("md:w-56"));
    expect(within(rail()).getByText("Missions")).toBeInTheDocument();
    expect(rail()).not.toHaveAttribute("inert");
  });

  it("at 1280 the preference is read: icons when collapsed", async () => {
    mockViewport(1280);
    mountShell(true);
    await waitFor(() => expect(rail()).toHaveClass("md:w-16"));
    expect(within(rail()).queryByText("Missions")).toBeNull();
  });

  it("the phone query stops at 767, and the shell's own breakpoints follow", () => {
    // The DEFAULT query is the phone's and ends at 767; the tablet query that
    // ends at 1023 is the other export, and is meant to.
    expect(read("src/hooks/useIsMobile.ts")).toMatch(/MOBILE_QUERY = "\(max-width: 767px\)"/);
    expect(read("src/hooks/useIsMobile.ts")).toMatch(/TABLET_QUERY = "\(min-width: 768px\) and \(max-width: 1023px\)"/);

    const header = read("src/components/layout/MobileHeader.tsx");
    expect(header).toMatch(/\bmd:hidden\b/);
    expect(header).not.toMatch(/\blg:hidden\b/);

    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/\bmd:flex-row\b/);
    expect(layout).not.toMatch(/\blg:flex-row\b/);

    // The backdrop is the drawer's and goes with it; the collapse button stays
    // a desktop control, because at tablet width there is nothing to expand to.
    const sidebar = read("src/components/layout/Sidebar.tsx");
    expect(sidebar).toMatch(/aria-label="Close navigation"[\s\S]{0,200}\bmd:hidden\b/);
    expect(sidebar).toMatch(/hidden lg:flex/);
  });
});

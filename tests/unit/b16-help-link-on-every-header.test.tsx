/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports -- HelpLink and
   HelpProvider do not exist in the tree yet, so a static import would not
   compile. Each require sits in a helper called from the test that needs it,
   so a missing file fails that test with the contract sentence. */

// ═══════════════════════════════════════════════════════════════
// B16 oracle, the `?` on every header.
//
// Contract section 4. The control is resolved automatically from the pathname
// through the manifest's `screen:`, so no page passes a help slug and no page
// can quietly lose its guide by forgetting one. Three things are pinned here:
//
//   · the href is the guide for THIS screen, and a detail path inherits its
//     list page's guide, exactly as the h1 does (labelFor);
//   · it is never dead: with no manifest, or on a screen with no guide yet,
//     it lands on the Help index rather than a 404;
//   · the `?` key does the same thing, and does nothing while you are typing.
//
// The last describe is the coverage question the plan actually asks ("on every
// PageHeader"). It walks the static routes and finds the one screen that does
// not use PageHeader at all: the dashboard paints its own header bar, so the
// `?` has to be put there by hand or the first screen an operator sees is the
// one screen with no way into the guide.
// ═══════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";

// ── Module doubles ──────────────────────────────────────────────

const mockNav = { pathname: "/work/missions" };
const mockRouter = { push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() };

jest.mock("next/navigation", () => ({
  usePathname: () => mockNav.pathname,
  useRouter: () => mockRouter,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
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

import PageHeader from "@/components/layout/PageHeader";

// ── The components under contract ───────────────────────────────

type ProviderProps = {
  screens: Record<string, string>;
  concepts: Record<string, unknown>;
  children: ReactNode;
};

function helpProvider(): ComponentType<ProviderProps> {
  let mod: { HelpProvider?: unknown };
  try {
    mod = require("@/components/help/HelpProvider") as { HelpProvider?: unknown };
  } catch (err) {
    throw new Error(
      "B16 owes src/components/help/HelpProvider.tsx (contract 4.1). require() said: " + String(err),
    );
  }
  if (typeof mod.HelpProvider !== "function") {
    throw new Error("src/components/help/HelpProvider.tsx must export HelpProvider (contract 4.1).");
  }
  return mod.HelpProvider as ComponentType<ProviderProps>;
}

/** The `?` itself, for the one test that renders it outside a PageHeader. */
function helpLink(): ComponentType<{ className?: string }> {
  let mod: { default?: unknown };
  try {
    mod = require("@/components/help/HelpLink") as { default?: unknown };
  } catch (err) {
    throw new Error(
      "B16 owes src/components/help/HelpLink.tsx (contract 4.2). require() said: " + String(err),
    );
  }
  if (typeof mod.default !== "function") {
    throw new Error("src/components/help/HelpLink.tsx must default-export HelpLink (contract 4.2).");
  }
  return mod.default as ComponentType<{ className?: string }>;
}

// ── Fixtures ────────────────────────────────────────────────────

const SCREENS: Record<string, string> = {
  "/": "guides/dashboard",
  "/work/missions": "guides/work-missions",
  "/results/sessions": "guides/results-sessions",
};

const Icon = (props: { className?: string }) => <svg {...props} />;

function withHelp(children: ReactNode, screens: Record<string, string> = SCREENS): ReactNode {
  const Provider = helpProvider();
  return (
    <Provider screens={screens} concepts={{}}>
      {children}
    </Provider>
  );
}

const ROOT = join(__dirname, "..", "..");

beforeEach(() => {
  mockNav.pathname = "/work/missions";
  mockRouter.push.mockClear();
});

// ── The control, green today ────────────────────────────────────

describe("the header the ? has to live on", () => {
  it("still reads its title from the registry", () => {
    mockNav.pathname = "/work/missions";
    render(<PageHeader icon={Icon} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Missions");
  });
});

// ── The href (contract 4.2) ─────────────────────────────────────

describe("the ? points at the guide for the screen you are on", () => {
  it("resolves the guide from the pathname, with no page passing a slug", () => {
    mockNav.pathname = "/work/missions";
    render(withHelp(<PageHeader icon={Icon} />));
    expect(screen.getByRole("link", { name: "Help for Missions" })).toHaveAttribute(
      "href",
      "/help/guides/work-missions",
    );
  });

  it("gives a detail path its list page's guide, the way the h1 gets its word", () => {
    mockNav.pathname = "/results/sessions/abc123";
    render(withHelp(<PageHeader icon={Icon} />));
    expect(screen.getByRole("link", { name: "Help for Sessions" })).toHaveAttribute(
      "href",
      "/help/guides/results-sessions",
    );
  });

  it("is rendered whether or not the page passes actions", () => {
    mockNav.pathname = "/work/missions";
    const { unmount } = render(withHelp(<PageHeader icon={Icon} />));
    expect(screen.getByTestId("help-link")).toBeInTheDocument();
    unmount();

    render(withHelp(<PageHeader icon={Icon} actions={<button type="button">Dispatch</button>} />));
    expect(screen.getByTestId("help-link")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dispatch" })).toBeInTheDocument();
  });

  it("is never dead: an unbuilt corpus lands on the Help index, not a 404", () => {
    mockNav.pathname = "/work/missions";
    render(withHelp(<PageHeader icon={Icon} />, {}));
    expect(screen.getByTestId("help-link")).toHaveAttribute("href", "/help");
  });

  it("works with no provider above it, so a bare header is still a header", () => {
    mockNav.pathname = "/work/missions";
    render(<PageHeader icon={Icon} />);
    expect(screen.getByTestId("help-link")).toHaveAttribute("href", "/help");
  });

  it("shows nothing on Help itself", () => {
    mockNav.pathname = "/help/guides/work-missions";
    const { unmount } = render(withHelp(<PageHeader icon={Icon} />));
    expect(screen.queryByTestId("help-link")).toBeNull();
    unmount();
    mockNav.pathname = "/help";
    render(withHelp(<PageHeader icon={Icon} />));
    expect(screen.queryByTestId("help-link")).toBeNull();
  });
});

// ── The ? key (contract 4.2) ────────────────────────────────────

describe("the ? key is the same control", () => {
  it("opens this screen's guide", () => {
    mockNav.pathname = "/work/missions";
    render(withHelp(<PageHeader icon={Icon} />));
    fireEvent.keyDown(document, { key: "?", shiftKey: true });
    expect(mockRouter.push).toHaveBeenCalledWith("/help/guides/work-missions");
  });

  it("is a question mark while you are typing, not a navigation", () => {
    mockNav.pathname = "/work/missions";
    render(
      withHelp(
        <>
          <PageHeader icon={Icon} />
          <input aria-label="Prompt" />
          <textarea aria-label="Body" />
        </>,
      ),
    );
    fireEvent.keyDown(screen.getByLabelText("Prompt"), { key: "?", shiftKey: true });
    fireEvent.keyDown(screen.getByLabelText("Body"), { key: "?", shiftKey: true });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("ignores a chord: ctrl+? and cmd+? belong to the browser", () => {
    mockNav.pathname = "/work/missions";
    render(withHelp(<PageHeader icon={Icon} />));
    fireEvent.keyDown(document, { key: "?", ctrlKey: true });
    fireEvent.keyDown(document, { key: "?", metaKey: true });
    fireEvent.keyDown(document, { key: "?", altKey: true });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("does nothing on Help itself", () => {
    mockNav.pathname = "/help/guides/work-missions";
    render(withHelp(<PageHeader icon={Icon} />));
    fireEvent.keyDown(document, { key: "?", shiftKey: true });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("takes its listener with it when the header unmounts", () => {
    mockNav.pathname = "/work/missions";
    const Link = helpLink();
    const { unmount } = render(withHelp(<Link />));
    unmount();
    fireEvent.keyDown(document, { key: "?", shiftKey: true });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

// ── Every header, not most of them (contract 4.3) ───────────────

/** Static route pages, the way tests/unit/module-registry.test.ts walks them. */
function staticPages(dir: string, prefix = ""): Array<{ route: string; file: string }> {
  const out: Array<{ route: string; file: string }> = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry.startsWith("[")) continue;
      if (entry.startsWith("(")) {
        out.push(...staticPages(full, prefix));
        continue;
      }
      out.push(...staticPages(full, `${prefix}/${entry}`));
    } else if (entry === "page.tsx") {
      out.push({ route: prefix === "" ? "/" : prefix, file: full });
    }
  }
  return out;
}

describe("every screen carries the ?", () => {
  const pages = staticPages(join(ROOT, "src", "app"));

  it("finds the pages, so an empty walk cannot read as a pass", () => {
    expect(pages.length).toBeGreaterThanOrEqual(20);
  });

  it("PageHeader is where the control lives, so no page has to remember it", () => {
    const src = readFileSync(join(ROOT, "src", "components", "layout", "PageHeader.tsx"), "utf-8");
    expect(src).toMatch(/from\s+["']@\/components\/help\/HelpLink["']/);
    expect(src).toMatch(/<HelpLink\b/);
  });

  it("leaves no screen with a header but no guide behind it", () => {
    // `/PageHeader\b/` also matches AgentsPageHeader, which wraps PageHeader.
    // A page that paints its own header bar (the dashboard) has to render
    // <HelpLink /> itself.
    const without = pages
      .filter(({ route }) => route !== "/help")
      .filter(({ file }) => {
        const src = readFileSync(file, "utf-8");
        return !/PageHeader\b/.test(src) && !/<HelpLink\b/.test(src);
      })
      .map(({ route }) => route);
    expect(without).toEqual([]);
  });
});

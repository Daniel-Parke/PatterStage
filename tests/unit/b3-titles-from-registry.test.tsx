/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * B3 (T-0097), D55 and D56: page titles and nav labels disagreed in seven
 * places ("Session History" under a rail entry that says Sessions, "System
 * Logs" under Logs, "Hindsight Memory" under Memory, "Skills Manager",
 * "Hermes Toolsets", "Deep Research", "Configuration"). The registry is the
 * one source now: PageHeader and PageTitle read the label for the current
 * path when no title is passed, and a page that does pass a literal title
 * must pass the registry's word.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";

import { labelFor } from "@/lib/modules/registry";

let pathname = "/";
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));
jest.mock("next/headers", () => ({ headers: async () => new Headers({ "x-ps-pathname": pathname }) }));
jest.mock("next/font/local", () => () => ({ variable: "--font-test" }));
jest.mock("@/app/globals.css", () => ({}));
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());

import PageHeader from "@/components/layout/PageHeader";
import PageTitle from "@/components/layout/PageTitle";

const ROOT = join(__dirname, "..", "..");
const Icon = (props: { className?: string }) => <svg {...props} />;

describe("PageHeader and PageTitle read the registry when no title is passed", () => {
  it("renders the label for the current path as the h1 and the tab title", () => {
    pathname = "/work/missions";
    render(<PageHeader icon={Icon} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Missions");
    expect(document.title).toBe("Missions · PatterStage");
  });

  it("a detail path inherits its list page's label", () => {
    pathname = "/results/sessions/abc";
    render(<PageTitle />);
    expect(document.title).toBe("Sessions · PatterStage");
  });

  it("an explicit title still wins, for the pages whose header names a thing rather than a place", () => {
    pathname = "/work/missions";
    render(<PageHeader icon={Icon} title="Re-dispatch: Nightly" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Re-dispatch: Nightly");
  });
});

/** Static routes from src/app, the way tests/unit/module-registry.test.ts walks them. */
function pageFiles(dir: string, prefix = ""): Array<{ route: string; file: string }> {
  const out: Array<{ route: string; file: string }> = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry.startsWith("[")) continue;
      if (entry.startsWith("(")) {
        out.push(...pageFiles(full, prefix));
        continue;
      }
      out.push(...pageFiles(full, `${prefix}/${entry}`));
    } else if (entry === "page.tsx") {
      out.push({ route: prefix === "" ? "/" : prefix, file: full });
    }
  }
  return out;
}

describe("a page that passes a literal title passes the registry's word", () => {
  const pages = pageFiles(join(ROOT, "src", "app"));

  it("finds the pages, so an empty walk cannot pass", () => {
    expect(pages.length).toBeGreaterThanOrEqual(20);
  });

  it("no page header contradicts its rail entry", () => {
    const mismatches: Array<{ route: string; title: string; label: string }> = [];
    for (const { route, file } of pages) {
      const label = labelFor(route);
      if (!label) continue;
      const src = readFileSync(file, "utf-8");
      const openings = src.match(/<Page(?:Header|Title)\b[^>]*?>/g) ?? [];
      for (const tag of openings) {
        const m = /\btitle="([^"]+)"/.exec(tag);
        if (m && m[1] !== label) mismatches.push({ route, title: m[1], label });
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("the dashboard names the agent framework from data, not a literal (D56)", () => {
    const src = readFileSync(join(ROOT, "src", "app", "page.tsx"), "utf-8");
    expect(/>\s*Hermes\s*</.test(src)).toBe(false);
  });
});

describe("the tab title is set on the server, from the path the proxy passes", () => {
  it("generateMetadata resolves the registry's word for the request path", async () => {
    const { generateMetadata } = await import("@/app/layout");
    pathname = "/work/missions";
    expect((await generateMetadata()).title).toBe("Missions · PatterStage");
    pathname = "/results/sessions/abc";
    expect((await generateMetadata()).title).toBe("Sessions · PatterStage");
    pathname = "/nowhere";
    expect((await generateMetadata()).title).toBe("PatterStage");
  });

  it("every pass-through in the proxy carries the path header", () => {
    const src = readFileSync(join(ROOT, "src", "proxy.ts"), "utf-8");
    expect(src).toMatch(/x-ps-pathname/);
    // A bare NextResponse.next() would let a request through without the
    // header, and that page's tab would read "PatterStage".
    expect(src.match(/NextResponse\.next\(\)/g) ?? []).toEqual([]);
  });
});

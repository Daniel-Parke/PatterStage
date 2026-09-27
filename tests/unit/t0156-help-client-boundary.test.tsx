/** @jest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import HelpPage from "../../src/app/help/[[...slug]]/page";

jest.mock("next/navigation", () => ({ notFound: () => { throw new Error("missing guide"); } }));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
jest.mock("@/lib/help/help-source", () => ({
  loadHelpManifest: () => ({ pages: [{ slug: "start-here/guide", title: "Guide" }] }),
  loadHelpFragment: () => "<p>Guide body</p>",
  loadHelpSearchIndex: () => [],
}));
jest.mock("@/lib/help/help-manifest", () => ({
  helpIndexSlug: () => "index",
  helpNavOrder: () => [],
  helpNeighbours: () => ({ prev: { slug: "index", title: "Index" }, next: null }),
  helpPageBySlug: () => ({ slug: "start-here/guide", title: "Guide", summary: "A guide" }),
  isSafeHelpSlug: () => true,
}));
jest.mock("@/components/layout/AppPageShell", () => ({
  __esModule: true,
  default: ({ header, children }: { header: ReactNode; children: ReactNode }) =>
    jest.requireActual<typeof import("react")>("react").createElement("main", null, header, children),
}));
jest.mock("@/components/help/HelpHeader", () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => jest.requireActual<typeof import("react")>("react").createElement("h1", null, title),
}));
jest.mock("@/components/help/HelpNav", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/help/HelpSearch", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ui/LinkButton", () => ({
  __esModule: true,
  default: ({ href, children, icon, ...props }: { href: string; children: ReactNode; icon?: unknown; "aria-label"?: string }) => {
    expect(icon).toBeUndefined();
    return jest.requireActual<typeof import("react")>("react").createElement("a", { href, "aria-label": props["aria-label"] }, children);
  },
}));

it("passes a rendered previous icon through the client link boundary", async () => {
  const tree = await HelpPage({ params: Promise.resolve({ slug: ["start-here", "guide"] }) });
  const html = renderToStaticMarkup(tree);
  expect(html).toContain('aria-label="Previous: Index"');
  expect(html).toContain("<svg");
});

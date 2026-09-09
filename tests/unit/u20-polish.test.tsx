/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U20 · Polish, each a line.
 *
 * The review's P4 list (2026-09-08), four of six here:
 *
 * - The rail footer's version line truncated the commit ("v0.1.0 ·…") at
 *   224px. The rail shows the version alone; the commit is the tooltip's
 *   and Settings › System's, where it already is.
 * - Research's Search / Depth / Breadth row left Breadth alone on a third
 *   row at 390. Search takes the row below lg, so the two numbers pair.
 * - The Story Weaver title input was set in the reader's serif; a field is
 *   operated, not read, so it is the house register like every other field.
 * - The dashboard's Launch a Mission strip capped at twelve pills and was
 *   cut at the fold at 900px tall. Six, and "+N more".
 *
 * The other two: the terminal's dots went with U19's toolbar move; the
 * per-line Pull on the Models drift banner is T-0100's decision (one
 * direction per line, because one Sync Now pulled over the top of a push)
 * and stays.
 */

import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => "/",
}));
jest.mock("@/hooks/useApiResource", () => ({
  useApiResource: (endpoint: string) => {
    if (endpoint === "/api/status/runtime") {
      return { data: { appVersion: "0.1.0", gitHash: "abc1234" }, isLoading: false, error: null, settled: true };
    }
    return { data: { updateAvailable: false, behind: 0, checkFailed: false }, isLoading: false, error: null, settled: true };
  },
  apiQueryKey: (e: string) => [e],
}));

import { RailFooter } from "@/components/layout/RailFooter";
import DispatchStrip from "@/components/dashboard/DispatchStrip";
import { DASHBOARD_STRIP_CAP, topNTemplates } from "@/lib/dashboard/dashboard-top-templates";
import type { DashboardTemplate } from "@/hooks/useDashboard";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const template = (i: number): DashboardTemplate => ({
  id: `t${i}`,
  name: `Template ${i}`,
  icon: "rocket",
  color: "cyan",
  category: "General",
  profile: "default",
  description: "",
});

describe("U20 · polish", () => {
  it("the rail shows the version alone, and the commit in its tooltip", () => {
    render(<RailFooter collapsed={false} />);
    const line = screen.getByText("v0.1.0");
    expect(line).toHaveTextContent(/^v0\.1\.0$/);
    expect(line.getAttribute("title")).toContain("abc1234");
  });

  it("Research pairs Depth and Breadth below lg: Search takes its own row", () => {
    const src = read("src/app/work/research/page.tsx");
    expect(src).toMatch(/<div className="col-span-2 lg:col-span-1">\s*<Field label="Search">/);
  });

  it("the Story Weaver title field is the house register", () => {
    const src = read("src/app/recroom/story-weaver/create/page.tsx");
    const at = src.indexOf('placeholder="Give your story a name..."');
    expect(at).toBeGreaterThan(-1);
    const field = src.slice(src.lastIndexOf("<Input", at), src.indexOf("/>", at));
    expect(field).not.toMatch(/font-serif/);
  });

  it("the dashboard strip shows six templates and says how many more", () => {
    expect(DASHBOARD_STRIP_CAP).toBe(6);
    expect(topNTemplates(Array.from({ length: 20 }, (_, i) => template(i)))).toHaveLength(6);
    render(<DispatchStrip templates={Array.from({ length: 8 }, (_, i) => template(i))} categories={[]} />);
    expect(screen.getAllByRole("button", { name: /Template \d/ })).toHaveLength(6);
    expect(screen.getByRole("button", { name: "+2 more" })).toBeInTheDocument();
    // The strip reads the cap, not a literal of its own.
    const src = read("src/components/dashboard/DispatchStrip.tsx");
    expect(src).toMatch(/DASHBOARD_STRIP_CAP/);
    expect(src).not.toMatch(/> 12\b|- 12\b/);
  });
});

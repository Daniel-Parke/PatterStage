/** @jest-environment jsdom */
// The in-app skim layer on a Deep Research report (T-0023, WG-WEB-006):
// the In brief band, the on-page navigator, and the deep-linkable headings.
//
// The tolerance cases matter more than the happy path here. Every report already
// in a database predates the In brief section, and those still have to render.

import { render, screen } from "@testing-library/react";

import ResearchReport from "@/components/research/ResearchReport";
import type { ResearchRun, ResearchStep } from "@/lib/laboratory/deep-research/types";

const LONG_REPORT =
  "## In brief\n\n- SQLite wins on ops [1]\n- Postgres wins on concurrency\n- Either is fine small\n\n" +
  "## Executive summary\n\nBoth work.\n\n## Key findings\n\nDetail.\n\n" +
  "## Evidence\n\nMore.\n\n## Conclusion\n\nDone.\n";

const OLD_REPORT = "## Verdict\n\nNo In brief section, because this report predates it.\n";

function makeRun(report: string | null): ResearchRun {
  return {
    id: "run-1",
    query: "SQLite vs Postgres?",
    status: "completed",
    provider: "duckduckgo",
    modelId: null,
    config: {},
    report,
    error: null,
    createdAt: "",
    completedAt: "",
    // Fixtures predate migration 034: null is the honest value for a run
    // whose token usage was never recorded (T-0030).
    usage: null,
    // T-0070: unmeasured, exactly as a pre-036 run is.
    gather: null,
  };
}

const steps: ResearchStep[] = [
  {
    id: "s1",
    runId: "run-1",
    position: 0,
    kind: "synthesize",
    input: null,
    output: "out",
    sources: ["https://x.test"],
    createdAt: "",
  },
];

describe("ResearchReport skim layer", () => {
  it("leads a long report with the In brief band", () => {
    const { container } = render(<ResearchReport run={makeRun(LONG_REPORT)} steps={steps} />);
    const band = container.querySelector(".dr-brief");
    expect(band).not.toBeNull();
    expect(band?.textContent).toContain("SQLite wins on ops");
    // The band is a treatment, not just a heading that happens to be first: the
    // section is lifted out of the prose entirely.
    expect(container.querySelector(".dr-brief a.dr-cite")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: /in brief/i })).toBeNull();
  });

  it("gives a long report a navigator pointing at ids the prose rendered", () => {
    const { container } = render(<ResearchReport run={makeRun(LONG_REPORT)} steps={steps} />);
    const nav = container.querySelector(".dr-nav");
    expect(nav).not.toBeNull();
    const links = [...(nav?.querySelectorAll("a") ?? [])];
    expect(links.map((a) => a.textContent)).toEqual([
      "Executive summary",
      "Key findings",
      "Evidence",
      "Conclusion",
    ]);
    for (const a of links) {
      const id = (a.getAttribute("href") ?? "").slice(1);
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it("renders an older report with neither band nor navigator", () => {
    const { container } = render(<ResearchReport run={makeRun(OLD_REPORT)} steps={steps} />);
    expect(container.querySelector(".dr-brief")).toBeNull();
    expect(container.querySelector(".dr-nav")).toBeNull();
    expect(container.textContent).toContain("No In brief section");
    expect(container.querySelector("#dr-h-verdict")).not.toBeNull();
  });

  it("renders nothing extra while the run has no report yet", () => {
    const running = { ...makeRun(null), status: "running" as const };
    const { container } = render(<ResearchReport run={running} steps={[]} />);
    expect(container.querySelector(".dr-brief")).toBeNull();
    expect(container.querySelector(".dr-nav")).toBeNull();
  });
});

/** @jest-environment node */

// B5 (T-0099) oracle, the source-shape half: what the dashboard and Insights
// no longer carry, read off the files. The render oracles say what the
// operations board shows; this one says what left, so a widget cannot creep
// back under a different name: the clock, the Rec Room card, the Command
// Center and its charts on the dashboard; the dollar sub-line on Insights'
// model list; and the monitor error the data hook now exposes.

import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

describe("the dashboard page", () => {
  const src = read("src/app/page.tsx");

  it("has no clock and no one-second interval", () => {
    expect(src).not.toMatch(/LiveClock/);
    expect(src).not.toMatch(/toLocaleTimeString/);
    expect(src).not.toMatch(/ms:\s*1000\b/);
  });

  it("has no Rec Room card and no Command Center", () => {
    expect(src).not.toMatch(/Rec Room/);
    expect(src).not.toMatch(/recroom\/story-weaver/);
    expect(src).not.toMatch(/CommandCenter/);
  });

  it("renders the Progress line and the six pills the plan names", () => {
    expect(src).toMatch(/ProgressLine/);
    for (const label of ['"Gateway"', '"Memory"', '"Scheduler"', '"Spend"', '"Processes"', '"Errors"']) {
      expect(src).toContain(`label=${label}`);
    }
    expect(src).not.toMatch(/label="Sessions"/);
  });

  it("reads the monitor's failure from the hook rather than waiting forever", () => {
    expect(src).toMatch(/monitorError/);
    expect(read("src/hooks/useDashboard.ts")).toMatch(/monitorError/);
    expect(read("src/hooks/useDashboard.ts")).toMatch(/monitorSettled/);
  });
});

describe("what left with the Command Center", () => {
  it("the component file is gone", () => {
    expect(existsSync(join(ROOT, "src", "components", "dashboard", "CommandCenter.tsx"))).toBe(false);
  });

  it("the Progress line exists as its own component", () => {
    expect(existsSync(join(ROOT, "src", "components", "dashboard", "ProgressLine.tsx"))).toBe(true);
  });
});

describe("the Insights page", () => {
  const src = read("src/app/results/insights/page.tsx");

  it("carries one money number: no dollar figure on the model list", () => {
    expect(src).not.toMatch(/costUsd/);
    expect(src).not.toMatch(/estimated cost/);
  });

  it("reads active days from the window's bundle, not the 30-day summary", () => {
    expect(src).toMatch(/insights\?\.activeDays/);
    expect(src).not.toMatch(/summary\?\.activeDays/);
  });

  it("holds the mission mix the dashboard gave up", () => {
    expect(src).toMatch(/Mission mix/);
  });
});

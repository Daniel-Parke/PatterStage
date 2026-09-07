/** @jest-environment jsdom */
/**
 * U10 (T-0124), part two: seven strips, one rule.
 *
 * The plan calls these "seven near-clone `*Insights.tsx` stat-strip wrappers
 * (482 lines)" and asks for one data-driven strip. Measured, that is not what
 * they are: they already share `StatStrip`, and each is a thin adapter that
 * computes its own domain's figures. There is no chrome duplicated between
 * them to collapse.
 *
 * What IS duplicated is inside each one. Every strip draws a donut and then a
 * row of tiles that restate the donut's own segments:
 *
 *   Logs      donut Errors / Warnings / Info    tiles Errors / Warnings / Info / Lines
 *   Skills    donut Active / Inactive           tiles Active / Inactive / Categories
 *   Tools     donut Enabled / Disabled          tiles Enabled / Disabled / Platforms
 *   Memory    donut Fresh / Stale               tiles Fresh / Stale / Distinct tags
 *   Models    donut per provider, centre Models tiles Models / Providers / Credentials
 *   Sessions  donut per source, centre Total    tiles Active / Total / Messages
 *
 * A donut IS those numbers, as a mix and as a set of labelled arcs. Printing
 * them again beside it is the same defect the missions strip had in U9, where
 * four tiles restated the five columns directly below them - and the cure is
 * the same. One rule, and it is machine-checkable, which is why this is a gate
 * rather than six judgements:
 *
 *   A TILE SAYS SOMETHING THE DONUT CANNOT. Not a segment's label, and not the
 *   number in the donut's own centre.
 *
 * What survives is the fact each screen has that the mix does not carry: how
 * many lines were read, how many categories exist, how many platforms, how many
 * distinct tags, how many credentials, how many messages. One or two per strip,
 * which is the point - the donut is the picture, the tiles are the footnote.
 */
import { render } from "@testing-library/react";

interface Captured {
  donut?: { segments?: Array<{ label: string; value: number }>; center?: unknown };
  tiles?: Array<{ label: string; value: unknown }>;
}
const captured: Captured[] = [];

jest.mock("@/components/viz/StatStrip", () => ({
  __esModule: true,
  default: (props: Captured) => {
    captured.push(props);
    return null;
  },
}));

import LogInsights from "@/components/logs/LogInsights";
import MemoryInsights from "@/components/memory/MemoryInsights";
import SessionInsights from "@/components/session/SessionInsights";
import SkillsInsights from "@/components/skills/SkillsInsights";
import ModelInsights from "@/components/models/ModelInsights";
import ToolsInsights from "@/modules/hermes/components/ToolsInsights";

/** Each strip, with enough data that it renders rather than returning null. */
const STRIPS: Array<[string, () => React.ReactElement]> = [
  [
    "Logs",
    () => <LogInsights lines={["ERROR boom", "WARN careful", "info fine", "info also fine"]} />,
  ],
  [
    "Memory",
    () => (
      <MemoryInsights
        memories={[{ tags: ["a", "b"] }, { tags: ["b"] }]}
        hiddenStaleCount={3}
        totalFacts={42}
      />
    ),
  ],
  [
    "Sessions",
    () => (
      <SessionInsights
        totals={
          {
            total: 20,
            active: 2,
            messages: 300,
            bySource: { cli: 8, mission: 6, cron: 4, api: 2 },
          } as never
        }
      />
    ),
  ],
  [
    "Skills",
    () => (
      <SkillsInsights
        skills={[{ category: "ops" }, { category: "ops" }, { category: "research" }]}
        activeCount={2}
      />
    ),
  ],
  [
    "Models",
    () => (
      <ModelInsights
        models={[{ provider: "anthropic" }, { provider: "anthropic" }, { provider: "openai" }]}
        credentialCount={2}
      />
    ),
  ],
  ["Tools", () => <ToolsInsights total={10} enabled={7} />],
];

describe("a tile says something the donut cannot", () => {
  it.each(STRIPS)("%s", (_name, renderStrip) => {
    captured.length = 0;
    render(renderStrip());
    expect(captured).toHaveLength(1);

    const { donut, tiles = [] } = captured[0];
    const segmentLabels = new Set((donut?.segments ?? []).map((s) => s.label.toLowerCase()));
    const centre = donut?.center;

    const restated = tiles.filter((t) => segmentLabels.has(t.label.toLowerCase()));
    expect(restated.map((t) => t.label)).toEqual([]);

    const echoesTheCentre = tiles.filter(
      (t) => centre !== undefined && String(t.value) === String(centre).replace(/,/g, ""),
    );
    expect(echoesTheCentre.map((t) => t.label)).toEqual([]);
  });

  /**
   * Anti-vacuity twice over: the strips must actually be handing StatStrip a
   * donut with segments, or "no tile restates a segment" is true of nothing.
   */
  it.each(STRIPS)("%s draws a donut with segments to compare against", (_name, renderStrip) => {
    captured.length = 0;
    render(renderStrip());
    expect((captured[0].donut?.segments ?? []).length).toBeGreaterThan(1);
  });

  it.each(STRIPS)("%s keeps at least one tile, so the footnote survives", (_name, renderStrip) => {
    captured.length = 0;
    render(renderStrip());
    expect((captured[0].tiles ?? []).length).toBeGreaterThan(0);
  });
});

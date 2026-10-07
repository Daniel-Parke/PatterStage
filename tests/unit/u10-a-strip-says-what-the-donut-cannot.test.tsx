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
import { render, screen, waitFor } from "@testing-library/react";
import { fetchMap, type FetchAnswer } from "../helpers/fetch-map";
import { renderWithQuery } from "../helpers/render-with-query";
import { TASK_TYPES } from "@/lib/models/task-types";

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
import ModelsPage from "@/app/agent/models/page";
// SkillsInsights and ToolsInsights are gone (U11, T-0125): on a list screen the
// strip was a dashboard about the list, and its one fact moved into the
// subtitle. The rule holds for the strips that remain.
//
// The Models strip is a local function of the Models page since C6 (T-0143),
// so it is reached the way an operator reaches it: the page, over a registry
// of three models from two providers and two credentials, hands StatStrip the
// same donut and tile the old component did.

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function model(id: string, provider: string) {
  return {
    id,
    name: id,
    provider,
    modelId: id,
    baseUrl: null,
    contextLength: null,
    credentialsId: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  };
}

/** The registry's reads, for the Models page. */
function registry(): Record<string, FetchAnswer> {
  const config = { restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 2 };
  const credential = (id: string) => ({ id, provider: "anthropic", label: id, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" });
  return {
    "/api/models/sync/drift": { body: { data: null } },
    "/api/models/fallbacks/config": { body: { data: { config } } },
    "/api/models/fallbacks": { body: { data: { entries: [], config } } },
    "/api/models/defaults": {
      body: { data: { defaults: TASK_TYPES.reduce<Record<string, string | null>>((acc, t) => ({ ...acc, [t]: null }), {}) } },
    },
    "/api/credentials": { body: { data: { credentials: [credential("c-1"), credential("c-2")] } } },
    "/api/models": {
      body: { data: { models: [model("m-1", "anthropic"), model("m-2", "anthropic"), model("m-3", "openai")] } },
    },
  };
}

/** Each strip, mounted with enough data that it renders rather than returning null. */
const STRIPS: Array<[string, () => Promise<void>]> = [
  [
    "Logs",
    async () => {
      render(<LogInsights lines={["ERROR boom", "WARN careful", "info fine", "info also fine"]} />);
    },
  ],
  [
    "Memory",
    async () => {
      render(
        <MemoryInsights
          memories={[{ tags: ["a", "b"] }, { tags: ["b"] }]}
          hiddenStaleCount={3}
          totalFacts={42}
        />,
      );
    },
  ],
  [
    "Sessions",
    async () => {
      render(
        <SessionInsights
          totals={
            {
              total: 20,
              active: 2,
              messages: 300,
              bySource: { cli: 8, mission: 6, cron: 4, api: 2 },
            } as never
          }
        />,
      );
    },
  ],
  [
    "Models",
    async () => {
      fetchMap(registry());
      // The page's registry reads go through react-query, so it takes the provider.
      renderWithQuery(<ModelsPage />);
      // The strip renders once per read that lands; the one the operator
      // sees is the last, after the whole registry is on screen.
      await screen.findByRole("button", { name: /Fallback Chain/ });
      await waitFor(() => expect(captured.length).toBeGreaterThan(0));
      captured.splice(0, captured.length - 1);
    },
  ],
];

describe("a tile says something the donut cannot", () => {
  it.each(STRIPS)("%s", async (_name, mountStrip) => {
    captured.length = 0;
    await mountStrip();
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
  it.each(STRIPS)("%s draws a donut with segments to compare against", async (_name, mountStrip) => {
    captured.length = 0;
    await mountStrip();
    expect((captured[0].donut?.segments ?? []).length).toBeGreaterThan(1);
  });

  /**
   * At most three, which is the plan's number, and zero is allowed. The Logs
   * strip ends with none: its donut is the severity mix, the number in that
   * donut's centre is the line count, and the ring beside it is how clean the
   * file is. Nothing is left for a tile to say, and inventing one would be the
   * defect this rule exists to stop.
   */
  it.each(STRIPS)("%s carries at most three tiles", async (_name, mountStrip) => {
    captured.length = 0;
    await mountStrip();
    expect((captured[0].tiles ?? []).length).toBeLessThanOrEqual(3);
  });
});

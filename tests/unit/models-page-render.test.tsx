/**
 * @jest-environment jsdom
 */
// ═══════════════════════════════════════════════════════════════
// Models page rendering tests
// ═══════════════════════════════════════════════════════════════

import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import { fetchMap, type FetchAnswer } from "../helpers/fetch-map";

import ModelsPage from "@/app/agent/models/page";
import { TASK_TYPES } from "@/lib/models/task-types";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

/**
 * Smart fetch mock: matches by URL prefix so query params don't break tests.
 */
function setFetch(map: Record<string, FetchAnswer>) {
  fetchMap(map, {
    // For any unmatched fetch, return a safe 200 with empty data
    // so the page doesn't crash — these are optional endpoints
    fallback: (url) => {
      if (url.includes("/api/models/sync/drift")) return { body: { data: null } };
      if (url.includes("/api/models/fallbacks")) return { body: { data: { chain: [], config: null } } };
      if (url.includes("/api/models/import")) return { body: { data: { modelsImported: 0 } } };
      return undefined;
    },
  });
}

// Default fallback responses used across tests
function defaultFallbacks() {
  return {
    "/api/models/sync/drift": { body: { data: null } },
    "/api/models/fallbacks": { body: { data: { chain: [], config: { restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 2 } } } },
    "/api/models/fallbacks/config": { body: { data: { config: { restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 2 } } } },
  } as Record<string, FetchAnswer>;
}

describe("ModelsPage", () => {
  it("renders empty state when no models exist", async () => {
    setFetch({
      "/api/models": { body: { data: { models: [] } } },
      "/api/credentials": { body: { data: { credentials: [] } } },
      "/api/models/defaults": {
        body: {
          data: {
            defaults: TASK_TYPES.reduce<Record<string, null>>((acc, t) => {
              acc[t] = null;
              return acc;
            }, {}),
          },
        },
      },
      ...defaultFallbacks(),
    });

    render(<ModelsPage />);

    await waitFor(() =>
      expect(screen.getByText(/No models yet/i)).toBeInTheDocument()
    );

    // Section headers (h2 elements with icons)
    const headings = screen.getAllByRole("heading", { level: 2 });
    const headingTexts = headings.map((h) => h.textContent);

    expect(headingTexts.some((t) => t.includes("Models"))).toBe(true);
    expect(headingTexts.some((t) => t.includes("Task Defaults"))).toBe(true);
    expect(headingTexts.some((t) => t.includes("Agent Default"))).toBe(true);
  });

  it("renders one defaults card per task type", async () => {
    setFetch({
      "/api/models": { body: { data: { models: [] } } },
      "/api/credentials": { body: { data: { credentials: [] } } },
      "/api/models/defaults": {
        body: {
          data: {
            defaults: TASK_TYPES.reduce<Record<string, null>>((acc, t) => {
              acc[t] = null;
              return acc;
            }, {}),
          },
        },
      },
      ...defaultFallbacks(),
    });

    const { container } = render(<ModelsPage />);

    await waitFor(() =>
      expect(container.querySelectorAll("[data-task-slot]").length).toBe(
        TASK_TYPES.length
      )
    );

    for (const slot of TASK_TYPES) {
      expect(
        container.querySelector(`[data-task-slot="${slot}"]`)
      ).toBeInTheDocument();
    }
  });

  it("renders rows + Default-For badges for populated models", async () => {
    const minimax = {
      id: "model-minimax",
      name: "MiniMax M2.1",
      provider: "minimax",
      modelId: "MiniMax/MiniMax-M2.1",
      baseUrl: null,
      contextLength: 200000,
      credentialsId: null,
      defaults: TASK_TYPES.reduce<Record<string, string | null>>((acc, t) => {
        acc[t] = t === "agent" ? "model-minimax" : null;
        return acc;
      }, {}),
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    setFetch({
      "/api/models": { body: { data: { models: [minimax] } } },
      "/api/credentials": {
        body: {
          data: {
            credentials: [],
          },
        },
      },
      "/api/models/defaults": {
        body: {
          data: {
            defaults: TASK_TYPES.reduce<Record<string, string | null>>(
              (acc, t) => {
                acc[t] = t === "agent" ? minimax.id : null;
                return acc;
              },
              {}
            ),
          },
        },
      },
      ...defaultFallbacks(),
    });

    const { container } = render(<ModelsPage />);

    await waitFor(() =>
      expect(screen.getAllByText("MiniMax M2.1").length).toBeGreaterThanOrEqual(1)
    );

    const row = container.querySelector(
      `[data-row-id="${minimax.id}"]`
    ) as HTMLElement;
    expect(row).not.toBeNull();
    // Provider + modelId + context cells
    expect(within(row).getByText("minimax")).toBeInTheDocument();
    expect(within(row).getByText("MiniMax/MiniMax-M2.1")).toBeInTheDocument();
    expect(within(row).getByText("200000")).toBeInTheDocument();
    // Default-For badge
    expect(within(row).getByText(/agent/i)).toBeInTheDocument();
  });
});

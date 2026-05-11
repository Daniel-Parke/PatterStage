/**
 * @jest-environment jsdom
 */
// ═══════════════════════════════════════════════════════════════
// Models page rendering tests
// ═══════════════════════════════════════════════════════════════

import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";

import ModelsPage from "@/app/config/models/page";
import { TASK_TYPES } from "@/lib/hermes-providers";

interface FetchResponseInit {
  body: unknown;
  status?: number;
}

interface MinimalResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

function jsonResponse({ body, status = 200 }: FetchResponseInit): MinimalResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

/**
 * Smart fetch mock: matches by URL prefix so query params don't break tests.
 */
function setFetch(map: Record<string, FetchResponseInit>) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    // Try exact match first
    const matched = map[url];
    if (matched) return jsonResponse(matched) as unknown as Response;
    // Fallback: prefix match (routes with query params)
    for (const [k, v] of Object.entries(map)) {
      if (url.startsWith(k)) return jsonResponse(v) as unknown as Response;
    }
    // For any unmatched fetch, return a safe 200 with empty data
    // so the page doesn't crash — these are optional endpoints
    if (url.includes("/api/models/sync/drift")) {
      return jsonResponse({ data: null }) as unknown as Response;
    }
    if (url.includes("/api/models/fallbacks")) {
      return jsonResponse({ data: { chain: [], config: null } }) as unknown as Response;
    }
    if (url.includes("/api/models/framework")) {
      return jsonResponse({ data: { active: "hermes" } }) as unknown as Response;
    }
    if (url.includes("/api/models/import")) {
      return jsonResponse({ data: { modelsImported: 0 } }) as unknown as Response;
    }
    throw new Error(`Unmatched fetch: ${url}`);
  }) as typeof global.fetch;
}

// Default fallback responses used across tests
function defaultFallbacks() {
  return {
    "/api/models/sync/drift": { data: null },
    "/api/models/fallbacks": { data: { chain: [], config: { restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 2 } } },
    "/api/models/fallbacks/config": { data: { config: { restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 2 } } },
  } as Record<string, FetchResponseInit>;
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

    expect(screen.getByText(/My Models/i)).toBeInTheDocument();
    expect(screen.getByText(/Default Models/i)).toBeInTheDocument();
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
      frameworkId: "*",
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
      expect(screen.getByText("MiniMax M2.1")).toBeInTheDocument()
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

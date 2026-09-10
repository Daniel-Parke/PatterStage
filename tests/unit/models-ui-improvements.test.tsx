/**
 * @jest-environment jsdom
 */
// ═══════════════════════════════════════════════════════════════
// Models page UI improvements tests
// Tests for: compact Agent Default, section icons
// ═══════════════════════════════════════════════════════════════

import "@testing-library/jest-dom";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQuery } from "../helpers/render-with-query";
import { fetchMap, type FetchAnswer } from "../helpers/fetch-map";

import ModelsPage from "@/app/agent/models/page";
import { TASK_TYPES } from "@/lib/models/task-types";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function setFetch(map: Record<string, FetchAnswer>) {
  fetchMap(map, {
    fallback: (url) => {
      if (url.includes("/api/models/sync/drift")) return { body: { data: null } };
      if (url.includes("/api/models/fallbacks")) return { body: { data: { chain: [], config: null } } };
      if (url.includes("/api/models/import")) return { body: { data: { modelsImported: 0 } } };
      return undefined;
    },
  });
}

function defaultFallbacks() {
  return {
    "/api/models/sync/drift": { body: { data: null } },
    "/api/models/fallbacks": { body: { data: { chain: [], config: { restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 2 } } } },
    "/api/models/fallbacks/config": { body: { data: { config: { restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 2 } } } },
  } as Record<string, FetchAnswer>;
}

function defaultModelsFetch(models: unknown[] = []) {
  return {
    "/api/models": { body: { data: { models } } },
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
  };
}

describe("ModelsPage UI improvements", () => {
  it("renders section titles with icons: Models, Agent Default, Task Defaults", async () => {
    setFetch(defaultModelsFetch());
    const { container: _c1 } = renderWithQuery(<ModelsPage />);

    await waitFor(() =>
      expect(screen.getByText(/No models yet/i)).toBeInTheDocument()
    );

    // Verify section headers exist as h2 elements
    const headings = screen.getAllByRole("heading", { level: 2 });
    const headingTexts = headings.map((h) => h.textContent);

    expect(headingTexts.some((t) => t.includes("Models"))).toBe(true);
    expect(headingTexts.some((t) => t.includes("Agent Default"))).toBe(true);
    expect(headingTexts.some((t) => t.includes("Task Defaults"))).toBe(true);
  });

  it("does not render verbose 'Universal Agent Default (Framework-scoped)' title", async () => {
    setFetch(defaultModelsFetch());
    renderWithQuery(<ModelsPage />);

    await waitFor(() =>
      expect(screen.queryByText(/Universal Agent Default/i)).not.toBeInTheDocument()
    );
  });

  it("does not render 'Framework' label next to dropdown", async () => {
    setFetch(defaultModelsFetch());
    renderWithQuery(<ModelsPage />);

    await waitFor(() =>
      expect(screen.queryByText(/^Framework$/i)).not.toBeInTheDocument()
    );
  });

  it("shows inline active status when default model is set", async () => {
    const minimax = {
      id: "model-minimax",
      name: "MiniMax M2.1",
      provider: "minimax",
      modelId: "MiniMax/MiniMax-M2.1",
      baseUrl: null,
      contextLength: 200000,
      credentialsId: null,
      defaults: {} as Record<string, string | null>,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    setFetch({
      ...defaultModelsFetch([minimax]),
      "/api/models/defaults": {
        body: {
          data: {
            defaults: TASK_TYPES.reduce<Record<string, string | null>>((acc, t) => {
              acc[t] = t === "agent" ? minimax.id : null;
              return acc;
            }, {}),
            // Amended in the real-agent round. The slot alone used to draw
            // Active, so a model chosen here and never sent to the agent was
            // stamped Active on a machine the agent had never run it on. The
            // endpoint answers the one readiness verdict now, and Active
            // follows that. This fixture is the install where the model really
            // did reach the agent, which is the case the test is about.
            modelReadiness: {
              state: "ready",
              ready: true,
              label: "MiniMax/MiniMax-M2.1 · minimax",
              modelName: "MiniMax/MiniMax-M2.1",
              detail: "",
            },
          },
        },
      },
    });

    const { container: _c2 } = renderWithQuery(<ModelsPage />);

    await waitFor(() =>
      expect(screen.getByText("Active")).toBeInTheDocument()
    );

    const headingTexts = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headingTexts.some((t) => t.includes("Agent Default"))).toBe(true);
    expect(headingTexts.some((t) => t.includes("Task Defaults"))).toBe(true);
  });

  it("does not render verbose 'Default Models' title", async () => {
    setFetch(defaultModelsFetch());
    renderWithQuery(<ModelsPage />);

    await waitFor(() =>
      expect(screen.queryByText("Default Models")).not.toBeInTheDocument()
    );
  });

  it("section headers do not contain long bracketed descriptions", async () => {
    setFetch(defaultModelsFetch());
    renderWithQuery(<ModelsPage />);

    await waitFor(() =>
      expect(screen.queryByText(/\(Framework-scoped\)/i)).not.toBeInTheDocument()
    );
  });
});

/**
 * @jest-environment jsdom
 */
// ═══════════════════════════════════════════════════════════════
// Models page UI improvements tests
// Tests for: compact Agent Default, section icons, FrameworkSelector cleanup
// ═══════════════════════════════════════════════════════════════

import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";

import ModelsPage from "@/app/config/models/page";
import { TASK_TYPES } from "@/lib/hermes-providers";

interface FetchResponseInit {
  body: unknown;
  status?: number;
}

function jsonResponse({ body, status = 200 }: FetchResponseInit) {
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

function setFetch(map: Record<string, FetchResponseInit>) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const matched = map[url];
    if (matched) return jsonResponse(matched) as unknown as Response;
    const sortedKeys = Object.keys(map).sort((a, b) => b.length - a.length);
    for (const k of sortedKeys) {
      if (url.startsWith(k)) return jsonResponse(map[k] as FetchResponseInit) as unknown as Response;
    }
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

function defaultFallbacks() {
  return {
    "/api/models/sync/drift": { data: null },
    "/api/models/fallbacks": { data: { chain: [], config: { restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 2 } } },
    "/api/models/fallbacks/config": { data: { config: { restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 2 } } },
  } as Record<string, FetchResponseInit>;
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
    const { container: _c1 } = render(<ModelsPage />);

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
    render(<ModelsPage />);

    await waitFor(() =>
      expect(screen.queryByText(/Universal Agent Default/i)).not.toBeInTheDocument()
    );
  });

  it("does not render 'Framework' label next to dropdown", async () => {
    setFetch(defaultModelsFetch());
    render(<ModelsPage />);

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
      frameworkId: "*",
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
          },
        },
      },
    });

    const { container: _c2 } = render(<ModelsPage />);

    await waitFor(() =>
      expect(screen.getByText("Active")).toBeInTheDocument()
    );

    const headingTexts = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headingTexts.some((t) => t.includes("Agent Default"))).toBe(true);
    expect(headingTexts.some((t) => t.includes("Task Defaults"))).toBe(true);
  });

  it("does not render verbose 'Default Models' title", async () => {
    setFetch(defaultModelsFetch());
    render(<ModelsPage />);

    await waitFor(() =>
      expect(screen.queryByText("Default Models")).not.toBeInTheDocument()
    );
  });

  it("section headers do not contain long bracketed descriptions", async () => {
    setFetch(defaultModelsFetch());
    render(<ModelsPage />);

    await waitFor(() =>
      expect(screen.queryByText(/\(Framework-scoped\)/i)).not.toBeInTheDocument()
    );
  });
});

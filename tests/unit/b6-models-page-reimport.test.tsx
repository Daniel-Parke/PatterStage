/**
 * @jest-environment jsdom
 */
// ═══════════════════════════════════════════════════════════════
// B6 oracle, group models-origin (T-0100, D10). Section 1 of the contract,
// the page half: "No import on page load". The server half (migration 039,
// the keep-rule, the import route) lives in b6-models-origin.test.ts.
//
// Written before the product code moved. What it holds:
//
//   * rendering <ModelsPage/> issues NO POST to /api/models/import, on mount
//     or after the load settles (today useModelsRegistry.loadAll opens with
//     one, and every write path refetches through loadAll);
//   * the header button is named "Re-import from config" and clicking it
//     issues exactly one POST to /api/models/import; the reload that follows
//     does not issue a second;
//   * its toast reads `Re-imported N models from config.yaml` and, when any,
//     `, N credentials updated`;
//   * the text "Refresh Models" appears nowhere;
//   * the empty state offers both "Add Model" and "Re-import from config",
//     and the empty-state re-import posts once too (ModelsTableSection's new
//     optional onReimport is wired).
//
// The fetch double is the URL-prefix mock of models-page-render.test.tsx,
// with the POST recorded rather than merely tolerated. Reds here are the
// implementation's to-do list; the GREEN CONTROLs pin what B6 keeps.
// ═══════════════════════════════════════════════════════════════

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import ModelsPage from "@/app/agent/models/page";
import { TASK_TYPES } from "@/lib/models/task-types";

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

/** URL-prefix fetch mock, longest key first, as models-page-render.test.tsx. */
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
      return jsonResponse({ body: { data: null } }) as unknown as Response;
    }
    if (url.includes("/api/models/fallbacks")) {
      return jsonResponse({ body: { data: { chain: [], config: null } } }) as unknown as Response;
    }
    throw new Error(`Unmatched fetch: ${url}`);
  }) as typeof global.fetch;
}

/** Every recorded POST to /api/models/import, whatever else was fetched. */
function importPosts(): unknown[][] {
  const calls = (global.fetch as jest.Mock).mock.calls as Array<[RequestInfo | URL, RequestInit?]>;
  return calls.filter(([input, init]) => {
    const url = typeof input === "string" ? input : input.toString();
    return url.includes("/api/models/import") && (init?.method ?? "GET").toUpperCase() === "POST";
  });
}

const nullDefaults = () =>
  TASK_TYPES.reduce<Record<string, string | null>>((acc, t) => {
    acc[t] = null;
    return acc;
  }, {});

const MINIMAX = {
  id: "model-minimax",
  name: "MiniMax M2.1",
  provider: "minimax",
  modelId: "MiniMax/MiniMax-M2.1",
  baseUrl: null,
  contextLength: 200000,
  credentialsId: null,
  apiStyle: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function fixture(over: {
  models?: unknown[];
  importResult?: { modelsImported: number; modelsSkipped?: number; credentialsUpdated?: number };
} = {}) {
  return {
    "/api/models/import": {
      body: { data: over.importResult ?? { modelsImported: 0, modelsSkipped: 0, credentialsUpdated: 0 } },
    },
    "/api/models/defaults": { body: { data: { defaults: nullDefaults() } } },
    "/api/models/sync/drift": { body: { data: null } },
    "/api/models/fallbacks/config": {
      body: { data: { config: { restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 2 } } },
    },
    "/api/models/fallbacks": {
      body: { data: { chain: [], config: { restorePrimaryOnFallback: true, fallbackNotification: false, apiMaxRetries: 2 } } },
    },
    "/api/models": { body: { data: { models: over.models ?? [] } } },
    "/api/credentials": { body: { data: { credentials: [] } } },
  } as Record<string, FetchResponseInit>;
}

const REIMPORT = /^Re-import from config$/;

async function renderLoaded(over: Parameters<typeof fixture>[0] = {}) {
  setFetch(fixture(over));
  const utils = render(<ModelsPage />);
  // Loading is over once the table section has decided between the empty
  // state and rows; both render the "Models" h2, so wait on the content.
  if (over.models && over.models.length > 0) {
    await waitFor(() => expect(screen.getAllByText("MiniMax M2.1").length).toBeGreaterThanOrEqual(1));
  } else {
    await waitFor(() => expect(screen.getByText(/No models yet/i)).toBeInTheDocument());
  }
  return utils;
}

describe("the Models page does not import on load", () => {
  it("issues no POST to /api/models/import on mount or after the load settles", async () => {
    await renderLoaded();

    // Every read the page makes has landed by now; give any trailing write a
    // tick so a deferred import would be recorded rather than missed.
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3));
    expect(importPosts()).toHaveLength(0);
  });

  it("still reads the registry on mount (GREEN CONTROL)", async () => {
    await renderLoaded();

    const urls = (global.fetch as jest.Mock).mock.calls.map(([input]: [RequestInfo | URL]) =>
      typeof input === "string" ? input : input.toString(),
    );
    expect(urls.some((u) => u.startsWith("/api/models") && !u.includes("/import"))).toBe(true);
    expect(urls.some((u) => u.startsWith("/api/credentials"))).toBe(true);
    expect(urls.some((u) => u.startsWith("/api/models/defaults"))).toBe(true);
  });
});

describe("the explicit re-import", () => {
  it("the header button is named 'Re-import from config' and keeps its title", async () => {
    await renderLoaded({ models: [MINIMAX] });

    const button = screen.getByRole("button", { name: REIMPORT });
    expect(button).toBeEnabled();
    // The title is kept: it names the two files a re-import reads.
    expect(button).toHaveAttribute("title", expect.stringMatching(/config\.yaml/));
    expect(button).toHaveAttribute("title", expect.stringMatching(/\.env/));
  });

  it("clicking it issues exactly one POST to /api/models/import, and the reload adds none", async () => {
    await renderLoaded({ models: [MINIMAX] });
    expect(importPosts()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: REIMPORT }));

    await waitFor(() => expect(importPosts()).toHaveLength(1));
    // The refetch after the import has run by the time the button re-enables.
    await waitFor(() => expect(screen.getByRole("button", { name: REIMPORT })).toBeEnabled());
    expect(importPosts()).toHaveLength(1);
  });

  it("reads 'Re-importing…' while it runs", async () => {
    await renderLoaded({ models: [MINIMAX] });
    // Hold the import open so the busy label is observable.
    let release: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const inner = global.fetch as jest.Mock;
    const held = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/models/import") && (init?.method ?? "GET") === "POST") {
        await gate;
      }
      return inner(input, init);
    });
    global.fetch = held as unknown as typeof global.fetch;

    fireEvent.click(screen.getByRole("button", { name: REIMPORT }));

    await screen.findByRole("button", { name: /^Re-importing…$/ });
    expect(screen.queryByRole("button", { name: /Refreshing/ })).toBeNull();
    release!();
    await waitFor(() => expect(screen.getByRole("button", { name: REIMPORT })).toBeEnabled());
  });

  it("toasts what it re-imported, from config.yaml", async () => {
    await renderLoaded({
      models: [MINIMAX],
      importResult: { modelsImported: 2, modelsSkipped: 0, credentialsUpdated: 1 },
    });

    fireEvent.click(screen.getByRole("button", { name: REIMPORT }));

    await screen.findByText("Re-imported 2 models from config.yaml, 1 credential updated");
    expect(screen.queryByText(/from Hermes/)).toBeNull();
    expect(screen.queryByText(/^Synced:/)).toBeNull();
  });

  it("toasts the singular, without the credential clause when none changed", async () => {
    await renderLoaded({
      models: [MINIMAX],
      importResult: { modelsImported: 1, modelsSkipped: 0, credentialsUpdated: 0 },
    });

    fireEvent.click(screen.getByRole("button", { name: REIMPORT }));

    await screen.findByText("Re-imported 1 model from config.yaml");
  });
});

describe("the old wording is gone", () => {
  it("'Refresh Models' appears nowhere", async () => {
    await renderLoaded({ models: [MINIMAX] });

    expect(screen.queryByText(/Refresh Models/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Refresh Models/ })).toBeNull();
    expect(document.body.textContent).not.toContain("Refresh Models");
  });

  it("'Refresh Models' appears nowhere on the empty state either", async () => {
    await renderLoaded();

    expect(document.body.textContent).not.toContain("Refresh Models");
  });
});

describe("the empty state", () => {
  function emptyState(): HTMLElement {
    const heading = screen.getByText(/No models yet/i);
    return heading.closest('[data-section="my-models"]') as HTMLElement;
  }

  it("offers both 'Add Model' and 'Re-import from config'", async () => {
    await renderLoaded();

    const section = emptyState();
    expect(section).not.toBeNull();
    expect(within(section).getByRole("button", { name: /^Add Model$/ })).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: REIMPORT })).toBeInTheDocument();
  });

  it("its re-import posts exactly once", async () => {
    await renderLoaded();

    fireEvent.click(within(emptyState()).getByRole("button", { name: REIMPORT }));

    await waitFor(() => expect(importPosts()).toHaveLength(1));
    await waitFor(() =>
      expect(within(emptyState()).getByRole("button", { name: REIMPORT })).toBeEnabled(),
    );
    expect(importPosts()).toHaveLength(1);
  });

  it("GREEN CONTROL: 'No models yet' and the header 'Add Model' still render", async () => {
    await renderLoaded();

    expect(screen.getByText(/No models yet/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Add Model$/ }).length).toBeGreaterThanOrEqual(2);
  });
});

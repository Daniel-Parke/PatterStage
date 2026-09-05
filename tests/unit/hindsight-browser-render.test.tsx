/**
 * @jest-environment jsdom
 */
// Stream A — HindsightBrowser rendering: empty states, fact-type badges,
// timeAgo, read-only tag badges, tab CTAs.

import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

import HindsightBrowser from "@/components/memory/HindsightBrowser";

interface MinimalResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

function jsonResponse(body: unknown, status = 200): MinimalResponse {
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

function mockHindsightFetch(handlers: {
  memories?: unknown[];
  directives?: unknown[];
  models?: unknown[];
}) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    // The on-the-wire envelope is `{ data: <inner> }` for every
    // /api/memory/hindsight action. The `safeApiCall<T>` helper does
    // NOT unwrap (see api-fetch.ts:85-98) — it returns `{ ok, data:
    // <body> }` where `data` is the whole envelope. The post-fix
    // production code in HindsightBrowser types the calls as
    // `safeApiCall<{ data?: { ... } }>` and reads fields via
    // `result.data?.data?.x` (two indirections). The mock body
    // therefore matches the on-the-wire envelope shape.
    if (url.includes("action=health")) {
      return jsonResponse({ data: { available: true, mode: "ok" } }) as unknown as Response;
    }
    if (url.includes("action=list")) {
      return jsonResponse({
        data: { memories: handlers.memories ?? [] },
      }) as unknown as Response;
    }
    if (url.includes("action=directives")) {
      return jsonResponse({
        data: { directives: handlers.directives ?? [] },
      }) as unknown as Response;
    }
    if (url.includes("action=mental-models")) {
      return jsonResponse({
        data: { models: handlers.models ?? [] },
      }) as unknown as Response;
    }
    if (url.includes("action=recall")) {
      return jsonResponse({ data: { memories: [] } }) as unknown as Response;
    }
    if (url.includes("action=reflect")) {
      return jsonResponse({ data: { response: "text='ok'" } }) as unknown as Response;
    }
    if (url.startsWith("/api/memory/hindsight") && !url.includes("action=")) {
      return jsonResponse({ data: { success: true } }) as unknown as Response;
    }
    throw new Error(`Unmocked fetch: ${url}`);
  }) as typeof global.fetch;
}

describe("HindsightBrowser", () => {
  it("shows memories empty copy aligned with Hermes curation", async () => {
    mockHindsightFetch({ memories: [] });

    render(<HindsightBrowser />);

    await waitFor(() => {
      expect(screen.getByText(/No memories yet/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Hermes will start storing them as you converse/i)
    ).toBeInTheDocument();
  });

  it("renders fact-type badges, read-only tag badges, and relative time", async () => {
    const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    // The modern Hindsight HTTP server returns plain JSON objects
    // (not Python `repr()` strings). The `mapMemoryItem` bridge
    // produces `{ id, content, type, tags, created_at, proofCount }` and
    // the MemoryTab reads those fields directly — see
    // `tests/unit/memory-tab-render.test.tsx` for the underlying
    // render contract. This test verifies the end-to-end
    // HindsightBrowser render: a memory with these fields is
    // shown to the user with a coloured fact-type badge, the
    // tag list, the relevance/proof-count label, and a relative
    // timestamp.
    mockHindsightFetch({
      memories: [
        {
          id: "m1",
          content: "Alpha note",
          type: "observation",
          tags: ["org:acme", "team:eng"],
          created_at: threeMinAgo,
          proofCount: 2,
        },
        {
          id: "m2",
          content: "World fact",
          type: "world",
          tags: [],
          created_at: threeMinAgo,
          proofCount: 5,
        },
      ],
    });

    render(<HindsightBrowser />);

    await waitFor(() => {
      expect(screen.getByText("Alpha note")).toBeInTheDocument();
    });

    const obsBadge = screen.getByText("observation");
    expect(obsBadge.className).toMatch(/neon-cyan/);

    const worldBadge = screen.getByText("world");
    expect(worldBadge.className).toMatch(/neon-purple/);

    expect(screen.getByText("org:acme")).toBeInTheDocument();
    expect(screen.getByText("team:eng")).toBeInTheDocument();

    // Amended for T-0101 (D63): the second row used to carry 0.5 and render
    // "Relevance: 50%", a similarity figure the bridge has never produced. A
    // proof count is a count, and it is the only thing this line says.
    expect(screen.getByText("Proof count: 2")).toBeInTheDocument();
    expect(screen.getByText("Proof count: 5")).toBeInTheDocument();

    const times = screen.getAllByText(/3m ago/);
    expect(times.length).toBeGreaterThanOrEqual(1);
  });

  it("directives tab empty state offers CTA that opens create modal", async () => {
    mockHindsightFetch({ memories: [], directives: [] });

    render(<HindsightBrowser />);

    await waitFor(() => {
      expect(screen.getByText(/No memories yet/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Directives/i }));

    await waitFor(() => {
      expect(screen.getByText(/Create your first directive/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Create your first directive/i }));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("e.g. Always cite sources")
      ).toBeInTheDocument();
    });
  });

  it("mental models tab empty state offers CTA that opens create modal", async () => {
    mockHindsightFetch({ memories: [], models: [] });

    render(<HindsightBrowser />);

    await waitFor(() => {
      expect(screen.getByText(/No memories yet/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Mental Models/i }));

    await waitFor(() => {
      expect(screen.getByText(/Create your first mental model/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Create your first mental model/i }));

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText("e.g. User Communication Style")
      ).toBeInTheDocument();
    });
  });
});

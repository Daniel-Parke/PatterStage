/**
 * @jest-environment jsdom
 */
/**
 * A PatterStage install with no memory provider running is a supported state.
 * The regression this pins: the list endpoint answers 503 when nothing is
 * listening, `hindsightGet` turns a non-2xx into `null`, and that null used to
 * land in the SUCCESS branch of loadRecentMemories. `health` stayed null, the
 * HealthBanner never rendered, and the page told a first-time user "No memories
 * yet. Hermes will start storing them as you converse" while there was no
 * memory provider at all.
 *
 * Amended for T-0101: the sentence is still said, and still exactly once, but
 * the browser no longer says it. It reports the health upward and the provider
 * card at the top of the page renders it, inside the card carrying the host and
 * port that fix it. The page is therefore what this file renders, and "exactly
 * once" is now an assertion rather than a structural accident.
 */
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/agent/memory",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/components/layout/AppPageShell", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import MemoryPage from "@/app/agent/memory/page";

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

/** Exactly what the routes answer with nothing listening on the memory port. */
function mockUnreachableProvider() {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("action=health")) {
      // 200 with an honest body, and NO `mode` field.
      return jsonResponse({
        data: { available: false, error: "fetch failed" },
      }) as unknown as Response;
    }
    if (url.includes("/api/memory/hindsight")) {
      return jsonResponse(
        { data: { available: false, error: "fetch failed", memories: [] } },
        503,
      ) as unknown as Response;
    }
    return jsonResponse({ data: {} }) as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("the Memory page with no memory provider running", () => {
  it("says nothing is answering instead of implying an empty store", async () => {
    mockUnreachableProvider();
    render(<MemoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/No memory provider is answering/i)).toBeInTheDocument();
    });
  });

  it("says it once, on the card that carries the endpoint", async () => {
    mockUnreachableProvider();
    render(<MemoryPage />);

    const said = await screen.findAllByText(/No memory provider is answering/i);
    expect(said).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Set up memory" })).toBeInTheDocument();
  });

  it("never renders the 'Hindsight undefined' string on that banner", async () => {
    mockUnreachableProvider();
    const { container } = render(<MemoryPage />);

    await waitFor(() => {
      expect(screen.getByText(/No memory provider is answering/i)).toBeInTheDocument();
    });
    expect(container.textContent).not.toContain("Hindsight undefined");
    expect(container.textContent).not.toContain("fetch failed");
  });
});

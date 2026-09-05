/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B6 oracle, group config-ui, part 1 of 2 (T-0100, D75).
//
// Written before the product code moved. Contract section 4: the Settings
// index sees a parse error. Three layers, one thread:
//
//   (A) useApiResource gains `selectMeta` and exposes `meta` (null without
//       it); data/error/fallback are unchanged;
//   (B) useConfig reads the envelope's sibling `configError` through it and
//       returns it (null when the key is absent);
//   (C) the Settings index renders ConfigYamlErrorAlert (role="alert",
//       "Hermes config.yaml cannot be parsed", the message, the detail
//       sentence) above the grid when configError is set, with zero
//       "configured" pills; without it the fresh-install view is unchanged
//       and the page tolerates a mock that omits the field.
//
// The alert may carry the first line of the js-yaml message and nothing
// else; the file body never reaches the index, so no key can.
//
// Type-tolerance: `npm run lint` type-checks tests/ (tsconfig.tests.json).
// The two shapes the contract adds (selectMeta on the options, meta and
// configError on the results) are read through loose aliases and one cast
// each, in the manner of b5-first-run-and-active-days. Once B6 lands, strip
// `LooseOptions`, `metaOf` and `configErrorOf` so the file re-tightens.
// ═══════════════════════════════════════════════════════════════

import React from "react";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useApiResource, type UseApiResourceOptions } from "@/hooks/useApiResource";

jest.mock("@/lib/api-fetch", () => ({ safeApiCall: jest.fn() }));
import { safeApiCall } from "@/lib/api-fetch";
const mockSafeApiCall = safeApiCall as jest.Mock;

// The index is rendered against a mocked useConfig (the b3-settings-index
// set, gaining configError); the hook itself is tested through requireActual.
const mockUseConfig = jest.fn();
jest.mock("@/hooks/useConfig", () => ({ useConfig: () => mockUseConfig() }));
jest.mock("next/navigation", () => ({
  usePathname: () => "/agent/settings",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import SettingsIndexPage from "@/app/agent/settings/page";

const { useConfig: realUseConfig } = jest.requireActual<typeof import("@/hooks/useConfig")>(
  "@/hooks/useConfig",
);

// ── pre-B6 type shims (see header) ──────────────────────────────

/** UseApiResourceOptions plus the option B6 adds. Identical after B6. */
type LooseOptions<T> = UseApiResourceOptions<T> & { selectMeta?: (body: unknown) => unknown };

/** The `meta` B6 exposes on the hook result; `undefined` is what today returns. */
function metaOf(result: unknown): unknown {
  return (result as { meta?: unknown }).meta;
}

/** The `configError` B6 exposes on useConfig's result. */
function configErrorOf(result: unknown): unknown {
  return (result as { configError?: unknown }).configError;
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const PARSE_ERROR = "duplicated mapping key (3:3)";
const DETAIL =
  "The sections below read as unconfigured because the file could not be parsed, not because it is empty. Section saves are disabled until it is repaired.";

beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// (A) useApiResource: selectMeta and meta
// ═══════════════════════════════════════════════════════════════

describe("useApiResource: selectMeta sees the whole body", () => {
  it("meta equals what selectMeta returned, data is the selected payload", async () => {
    mockSafeApiCall.mockResolvedValue({
      ok: true,
      data: { data: { agent: { max_turns: 40 } }, configError: "x" },
    });
    const opts: LooseOptions<Record<string, unknown>> = {
      select: (p) => (p as Record<string, unknown> | null) ?? undefined,
      selectMeta: (b) => ({ configError: (b as { configError?: string } | null)?.configError ?? null }),
    };

    const { result } = renderHook(() => useApiResource(["b6-meta"], "/api/config", opts), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ agent: { max_turns: 40 } });
    expect(result.current.error).toBeNull();
    expect(metaOf(result.current)).toEqual({ configError: "x" });
  });

  it("meta survives the fallback path (select undefined, fallback given)", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: {}, configError: "x" } });
    const opts: LooseOptions<string[]> = {
      select: (p) => (p as { items?: string[] } | null)?.items,
      fallback: [],
      selectMeta: (b) => ({ configError: (b as { configError?: string } | null)?.configError ?? null }),
    };

    const { result } = renderHook(() => useApiResource(["b6-meta-fallback"], "/api/list", opts), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
    expect(metaOf(result.current)).toEqual({ configError: "x" });
  });

  it("without selectMeta, meta is null (not undefined) and the payload contract is unchanged", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: { stats: { total: 7 } } } });
    const opts: LooseOptions<{ total: number }> = {
      select: (p) => (p as { stats?: { total: number } } | null)?.stats,
    };

    const { result } = renderHook(() => useApiResource(["b6-no-meta"], "/api/stats", opts), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ total: 7 });
    expect(metaOf(result.current)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// (B) useConfig: configError
// ═══════════════════════════════════════════════════════════════

describe("useConfig: configError rides beside the data", () => {
  it("returns the envelope's configError string when the body carries one", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: {}, configError: PARSE_ERROR } });

    const { result } = renderHook(() => realUseConfig(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({});
    expect(result.current.error).toBeNull();
    expect(configErrorOf(result.current)).toBe(PARSE_ERROR);
  });

  it("returns configError null when the key is absent (a clean parse)", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: { agent: { max_turns: 40 } } } });

    const { result } = renderHook(() => realUseConfig(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual({ agent: { max_turns: 40 } });
    expect(configErrorOf(result.current)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// (C) the Settings index
// ═══════════════════════════════════════════════════════════════

const configuredPills = () => screen.queryAllByText("configured");

describe("the Settings index with a parse error", () => {
  it("renders the alert with the heading and the message above the grid, and no configured pill", () => {
    mockUseConfig.mockReturnValue({
      data: {},
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      configError: PARSE_ERROR,
    });

    render(<SettingsIndexPage />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Hermes config.yaml cannot be parsed");
    expect(alert).toHaveTextContent(PARSE_ERROR);
    expect(alert).toHaveTextContent(DETAIL);
    expect(configuredPills()).toHaveLength(0);
    // The grid is still there behind the alert: the cards still open.
    expect(document.querySelector('a[href="/agent/settings/agent"]')).not.toBeNull();
  });

  it("a section that IS present in the payload still gets no pill while the file is broken", () => {
    // Sweep survivor `index-pills-survive-parse-error`. The other cases pass an
    // empty payload, so zero pills proves nothing about the suppression: this
    // one hands the page a real section and the parse error together.
    mockUseConfig.mockReturnValue({
      data: { agent: { max_turns: 40 } },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      configError: PARSE_ERROR,
    });

    render(<SettingsIndexPage />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(configuredPills()).toHaveLength(0);
    const agentCard = document.querySelector('a[href="/agent/settings/agent"]') as HTMLElement;
    expect(agentCard.textContent).not.toContain("configured");
  });

  it("the alert precedes the section grid in document order", () => {
    mockUseConfig.mockReturnValue({
      data: {},
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      configError: PARSE_ERROR,
    });

    render(<SettingsIndexPage />);

    const alert = screen.getByRole("alert");
    // querySelectorAll answers in document order, so the alert must come first.
    const ordered = Array.from(document.querySelectorAll('[role="alert"], a[href="/agent/settings/agent"]'));
    expect(ordered.indexOf(alert)).toBe(0);
    expect(ordered).toHaveLength(2);
  });

  it("the alert never contains a key: only the first line the route sends is rendered", () => {
    // The route's contract is first-line only; whatever payload rode beside it
    // (masked or not) is not the alert's to repeat.
    const message = "bad indentation of a mapping entry (4:12)";
    mockUseConfig.mockReturnValue({
      data: { model: { api_key: "sk-live-1234567890" } },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      configError: message,
    });

    render(<SettingsIndexPage />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(alert.textContent).not.toContain("sk-live-1234567890");
    expect(alert.textContent).not.toContain("api_key");
    expect(document.body.textContent).not.toContain("sk-live-1234567890");
  });

  it("GREEN CONTROL: configError null renders no alert and no configured pill (fresh install unchanged)", () => {
    mockUseConfig.mockReturnValue({
      data: {},
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      configError: null,
    });

    render(<SettingsIndexPage />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(configuredPills()).toHaveLength(0);
    expect(screen.getByText(/\d+ sections/)).toBeInTheDocument();
  });

  it("GREEN CONTROL: a mock without the field still renders, and a present section still reads configured", () => {
    mockUseConfig.mockReturnValue({
      data: { agent: { max_turns: 40 } },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<SettingsIndexPage />);

    expect(screen.queryByRole("alert")).toBeNull();
    const agentCard = document.querySelector('a[href="/agent/settings/agent"]') as HTMLElement;
    expect(agentCard).not.toBeNull();
    expect(agentCard.textContent).toContain("configured");
    expect(configuredPills()).toHaveLength(1);
  });
});

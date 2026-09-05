/** @jest-environment jsdom */

// ═══════════════════════════════════════════════════════════════
// B14 oracle, group laboratory-pages: D99, D101, D102, D103, and the Stop
// button D98's route exists for. Contract sections 5.1 to 5.5.
//
// THE DEFECTS.
//   D103 23 of the app's 27 pages wrap in AppPageShell, which supplies
//        `min-h-screen bg-dark-950 grid-bg flex flex-col`. Research, Artifacts
//        and Insights do not, so walking in from Missions drops the grid.
//   D99  None of the three pages imports a toast, and every write is
//        fire-and-forget: research start() (page.tsx:79-98) never checks
//        `res.ok`, savePreset() never checks, artifacts remove()
//        (page.tsx:67-71) refetches over its own failure. A 400 or a 500
//        leaves the screen exactly as it was.
//   D101 The artifact sheet's Delete sits beside Download and hard-DELETEs on
//        one click. The artifact may be the only surviving copy of a
//        40-minute report.
//   D102 A ResearchRun persists provider, modelId, config, usage, gather,
//        createdAt and completedAt. The detail pane renders the query, a
//        status word, the error and the report, and none of the rest.
//   D98  Nothing on the page can stop a running run.
//
// The doubles are the data hooks and safeApiCall, so the assertions are what a
// person sees and what goes on the wire.
// ═══════════════════════════════════════════════════════════════

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

jest.mock("lucide-react", () => {
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

jest.mock("next/navigation", () => ({
  usePathname: () => "/work/research",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

const mockSafeApiCall = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  safeApiCall: (...a: unknown[]) => mockSafeApiCall(...a),
}));

const mockUseResearchRuns = jest.fn();
const mockUseResearchRun = jest.fn();
const mockUseResearchPresets = jest.fn();
jest.mock("@/hooks/useDeepResearch", () => ({
  useResearchRuns: () => mockUseResearchRuns(),
  useResearchRun: (id: string | null) => mockUseResearchRun(id),
  useResearchPresets: () => mockUseResearchPresets(),
}));

jest.mock("@/hooks/useModels", () => ({
  useModels: () => ({ data: [], error: null, refetch: jest.fn() }),
  useModelDefaults: () => ({ data: null, error: null, refetch: jest.fn() }),
}));

jest.mock("@/hooks/useEventStream", () => ({
  useEventStream: () => ({ data: null, connected: false, error: null }),
}));

const mockUseArtifacts = jest.fn();
const mockUseArtifact = jest.fn();
jest.mock("@/hooks/useArtifacts", () => ({
  useArtifacts: () => mockUseArtifacts(),
  useArtifact: (id: string | null) => mockUseArtifact(id),
}));

jest.mock("@/lib/chat-utils", () => ({
  ...(jest.requireActual("@/lib/chat-utils") as Record<string, unknown>),
  downloadFile: jest.fn(),
}));

// Insights' data surface, stubbed to its loading state: this file only asks
// that page one question, and it is about the wrapper.
jest.mock("@/hooks/useStats", () => ({
  useStats: () => ({ stats: undefined, isLoading: true, error: null, refetch: jest.fn() }),
}));
jest.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ summary: undefined, error: null, refetch: jest.fn() }),
  useAnalyticsTimeseries: () => ({ points: [], error: null, refetch: jest.fn() }),
  useInsights: () => ({ insights: undefined, error: null, refetch: jest.fn() }),
}));
jest.mock("@/hooks/useSpend", () => ({
  useSpend: () => ({ spend: undefined, saving: false, saveBudget: jest.fn() }),
}));
jest.mock("@/components/spend/SpendPanel", () => ({
  __esModule: true,
  default: () => <div data-testid="spend-panel" />,
}));
jest.mock("@/components/motion", () => ({
  __esModule: true,
  FadeIn: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Stagger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StaggerItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Collapse: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import DeepResearchPage from "@/app/work/research/page";
import ArtifactsPage from "@/app/results/artifacts/page";
import InsightsPage from "@/app/results/insights/page";

// ── fixtures ────────────────────────────────────────────────────

const COMPLETED_RUN = {
  id: "R-1",
  query: "SQLite or Postgres for a self-hosted app?",
  status: "completed" as const,
  provider: "searxng",
  modelId: "anthropic/claude-sonnet-4",
  config: { rounds: 5, resultsPerQuery: 9, visitsPerRound: 2, searchProvider: "searxng" },
  report: "## In brief\n- it depends",
  error: null,
  createdAt: "2026-09-05T10:00:00.000Z",
  completedAt: "2026-09-05T10:02:05.000Z",
  usage: { promptTokens: 900, completionTokens: 334, totalTokens: 1234 },
  gather: { searchAttempts: 5, searchFailures: 0, visitAttempts: 4, visitFailures: 0 },
};

const RUNNING_RUN = {
  ...COMPLETED_RUN,
  id: "R-2",
  status: "running" as const,
  report: null,
  completedAt: null,
  usage: null,
};

const ARTIFACT = {
  id: "A-1",
  name: "Research report",
  sourceKind: "research",
  mimeType: "text/markdown",
  sizeBytes: 2048,
  createdAt: "2026-09-05T10:00:00.000Z",
  content: "# A report",
  description: null,
  sourceRunId: "R-1",
  tags: ["report"],
};

const refetchRuns = jest.fn();
const refetchArtifacts = jest.fn();

// jsdom has no matchMedia, and the Sheet asks it about reduced motion.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  });
});

function researchRuns(runs: unknown[] = [COMPLETED_RUN]) {
  mockUseResearchRuns.mockReturnValue({ data: runs, error: null, refetch: refetchRuns });
}
function selected(run: unknown) {
  mockUseResearchRun.mockImplementation((id: string | null) =>
    id ? { data: { run, steps: [] }, error: null, refetch: jest.fn() } : { data: undefined, error: null, refetch: jest.fn() },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: { run: { id: "R-new" } } } });
  researchRuns();
  selected(COMPLETED_RUN);
  mockUseResearchPresets.mockReturnValue({ data: [], error: null, refetch: jest.fn() });
  mockUseArtifacts.mockReturnValue({ data: [ARTIFACT], error: null, refetch: refetchArtifacts });
  mockUseArtifact.mockImplementation((id: string | null) => ({ data: id ? ARTIFACT : undefined, error: null }));
});

/** Open the artifact sheet by clicking the card. */
async function openArtifact(): Promise<void> {
  render(<ArtifactsPage />);
  fireEvent.click(screen.getByText(ARTIFACT.name));
  await screen.findByRole("dialog");
}

// ═══════════════════════════════════════════════════════════════
// D103 — the shell
// ═══════════════════════════════════════════════════════════════

describe("the three pages sit on AppPageShell like the other 23", () => {
  it.each([
    ["Deep Research", () => render(<DeepResearchPage />)],
    ["Artifacts", () => render(<ArtifactsPage />)],
    ["Insights", () => render(<InsightsPage />)],
  ])("%s carries the app's own background and grid", (_name, mount) => {
    const { container } = mount();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("min-h-screen");
    expect(root.className).toContain("bg-dark-950");
    expect(root.className).toContain("grid-bg");
  });
});

// ═══════════════════════════════════════════════════════════════
// D99 — a write that fails says so
// ═══════════════════════════════════════════════════════════════

describe("Deep Research surfaces its write failures", () => {
  it("a refused start raises the reason instead of doing nothing", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: false, error: "rounds must be <= 8", status: 400 });
    render(<DeepResearchPage />);

    fireEvent.change(screen.getByLabelText(/Research question/i), {
      target: { value: "Why is the sky blue?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Start research/i }));

    expect(await screen.findByText(/rounds must be <= 8/)).toBeInTheDocument();
  });

  it("a start that answers 200 with no id is still a failure", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: {} } });
    render(<DeepResearchPage />);

    fireEvent.change(screen.getByLabelText(/Research question/i), {
      target: { value: "Why is the sky blue?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Start research/i }));

    expect(await screen.findByText(/no id|could not|failed/i)).toBeInTheDocument();
  });

  it("a refused preset save raises the reason", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: false, error: "A preset called that already exists" });
    render(<DeepResearchPage />);

    fireEvent.change(screen.getByPlaceholderText(/Save current as/i), { target: { value: "Deep" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
  });
});

describe("Artifacts surfaces its write failures", () => {
  it("a refused delete says so and does not pretend the artifact is gone", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: false, error: "Artifact is locked" });
    await openArtifact();

    fireEvent.click(screen.getByRole("button", { name: /Delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirm delete\?/i }));

    expect(await screen.findByText(/Artifact is locked/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// D101 — deleting an artifact takes two clicks
// ═══════════════════════════════════════════════════════════════

describe("deleting an artifact", () => {
  it("arms on the first click and does not call the route", async () => {
    await openArtifact();

    fireEvent.click(screen.getByRole("button", { name: /Delete/i }));

    expect(mockSafeApiCall).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: /Confirm delete\?/i })).toBeInTheDocument();
  });

  it("deletes on the second click", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: { deleted: true } } });
    await openArtifact();

    fireEvent.click(screen.getByRole("button", { name: /Delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /Confirm delete\?/i }));

    await waitFor(() =>
      expect(mockSafeApiCall).toHaveBeenCalledWith(
        "/api/artifacts/A-1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// D102 — the run header
// ═══════════════════════════════════════════════════════════════

describe("the research detail says what the run actually did", () => {
  function openRun(run: unknown) {
    selected(run);
    researchRuns([run]);
    render(<DeepResearchPage />);
    fireEvent.click(screen.getByText(/SQLite or Postgres/));
  }

  it("names the model, the search provider, the depth, the breadth, the duration and the tokens", async () => {
    openRun(COMPLETED_RUN);

    expect(await screen.findByText(/Model: anthropic\/claude-sonnet-4/)).toBeInTheDocument();
    expect(screen.getByText(/Search: searxng/)).toBeInTheDocument();
    expect(screen.getByText(/Depth: 5 rounds/)).toBeInTheDocument();
    expect(screen.getByText(/Breadth: 9 results\/query/)).toBeInTheDocument();
    // createdAt -> completedAt is 2m 5s, through the app's own formatElapsed.
    expect(screen.getByText(/Duration: 2m 5s/)).toBeInTheDocument();
    expect(screen.getByText(/Tokens: 1,234/)).toBeInTheDocument();
  });

  it("says a run whose tokens were never recorded is not free", async () => {
    openRun({ ...COMPLETED_RUN, usage: null });
    expect(await screen.findByText(/Tokens: not recorded/)).toBeInTheDocument();
  });

  it("says 'Agent default' rather than blank when no model was chosen", async () => {
    openRun({ ...COMPLETED_RUN, modelId: null });
    expect(await screen.findByText(/Model: Agent default/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// D98 — the Stop control the route exists for
// ═══════════════════════════════════════════════════════════════

describe("a running research run can be stopped from the page", () => {
  it("takes two clicks and posts the cancel route", async () => {
    selected(RUNNING_RUN);
    researchRuns([RUNNING_RUN]);
    mockSafeApiCall.mockResolvedValue({ ok: true, data: { data: { run: { ...RUNNING_RUN, status: "cancelled" } } } });
    render(<DeepResearchPage />);
    fireEvent.click(screen.getByText(/SQLite or Postgres/));

    fireEvent.click(await screen.findByRole("button", { name: /Stop run/i }));
    expect(mockSafeApiCall).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: /Confirm/i }));
    await waitFor(() =>
      expect(mockSafeApiCall).toHaveBeenCalledWith(
        "/api/laboratory/research/R-2/cancel",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("offers no Stop on a run that already finished", async () => {
    selected(COMPLETED_RUN);
    researchRuns([COMPLETED_RUN]);
    render(<DeepResearchPage />);
    fireEvent.click(screen.getByText(/SQLite or Postgres/));

    // The detail pane has opened when the report is on screen.
    await waitFor(() => expect(screen.getAllByText(/SQLite or Postgres/).length).toBeGreaterThan(1));
    expect(screen.queryByRole("button", { name: /Stop run/i })).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// GREEN CONTROL
// ═══════════════════════════════════════════════════════════════

describe("GREEN CONTROL: the read contract on these pages is unchanged", () => {
  it("a failed research list read still shows the banner and no empty state", () => {
    mockUseResearchRuns.mockReturnValue({ data: [], error: "gateway down", refetch: refetchRuns });
    render(<DeepResearchPage />);

    expect(screen.getByText(/gateway down/)).toBeInTheDocument();
    expect(screen.queryByText("No research runs yet.")).not.toBeInTheDocument();
  });

  it("a failed artifact list read still shows the banner and no empty state", () => {
    mockUseArtifacts.mockReturnValue({ data: [], error: "database is locked", refetch: refetchArtifacts });
    render(<ArtifactsPage />);

    expect(screen.getByText(/database is locked/)).toBeInTheDocument();
    expect(screen.queryByText("No artifacts yet")).not.toBeInTheDocument();
  });
});

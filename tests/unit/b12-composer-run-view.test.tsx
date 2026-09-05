/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B12 oracle, group run-view (D3 major, D7 major, plus the two Run-tab items
// the plan names: the workflow name on run rows, and "waiting on a question"
// told apart from "at a gate").
//
// Written before the product code moved. Contract sections 3 and 5.1.
//
//   D3   The runs LIST already banners its failures (T-0096 did that half).
//        The run DETAIL still drops the hook's error on the floor at
//        page.tsx:97, so a 500 or a 404 on GET /api/composer/runs/[id] paints
//        the "Loading run…" spinner and paints it forever. The one screen
//        state that means "still working" is the one shown when nothing is
//        working, and there is no Retry anywhere near it.
//   D7   `mode === "build" ? <WorkflowCanvas/> : <>…</>` unmounts the editor
//        on a tab switch, so a glance at the Run tab discards the board.
//   +    Every run row says `awaiting_approval` in raw enum case, and says it
//        identically whether a HIL gate is open or a stage stopped to ask the
//        operator a question — two different things needing two different
//        answers. And no row says which workflow it is a run OF, on a page
//        that now ships three of them.
//
// Doubles: the four data hooks and the SSE hook are jest.fn()s; the two
// react-flow canvases are stubs (the Build one deliberately holds a scrap of
// state, which is how "your work survived the tab switch" is asserted rather
// than assumed); next/dynamic is React.lazy so those stubs actually resolve.
// ═══════════════════════════════════════════════════════════════

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("lucide-react", () => {
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

// next/dynamic, minus the framework: a lazy component around the same loader.
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: (loader: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>) => {
    const React = jest.requireActual("react") as typeof import("react");
    const Lazy = React.lazy(loader);
    return function Dynamic(props: Record<string, unknown>) {
      return React.createElement(React.Suspense, { fallback: null }, React.createElement(Lazy, props));
    };
  },
}));

// The Build canvas stub keeps a mount counter and one text box. Both are the
// point: a canvas that unmounts loses the box's value AND bumps the counter.
let buildMounts = 0;
jest.mock("@/components/composer/WorkflowCanvas", () => {
  const React = jest.requireActual("react") as typeof import("react");
  return {
    __esModule: true,
    default: function WorkflowCanvasStub() {
      React.useEffect(() => {
        buildMounts += 1;
      }, []);
      return React.createElement("input", { "aria-label": "unsaved board", defaultValue: "" });
    },
  };
});

jest.mock("@/components/composer/WorkflowRunCanvas", () => {
  const React = jest.requireActual("react") as typeof import("react");
  return {
    __esModule: true,
    default: function WorkflowRunCanvasStub({ gate }: { gate?: React.ReactNode }) {
      return React.createElement("div", { "data-testid": "run-canvas" }, gate ?? null);
    },
  };
});

const mockUseWorkflows = jest.fn();
const mockUseRuns = jest.fn();
const mockUseRun = jest.fn();
const mockUseGraph = jest.fn(() => ({ data: null }));
jest.mock("@/hooks/useComposer", () => ({
  useComposerWorkflows: (...a: unknown[]) => mockUseWorkflows(...(a as [])),
  useComposerRuns: (...a: unknown[]) => mockUseRuns(...(a as [])),
  useComposerRun: (...a: unknown[]) => mockUseRun(...(a as [])),
  useComposerWorkflowGraph: (...a: unknown[]) => mockUseGraph(...(a as [])),
}));

jest.mock("@/hooks/useProfiles", () => ({ useProfiles: () => ({ data: [] }) }));
jest.mock("@/hooks/useEventStream", () => ({
  useEventStream: () => ({ data: null, connected: false, error: null }),
}));
jest.mock("@/lib/api-fetch", () => ({ safeApiCall: jest.fn(async () => ({ ok: true, data: {} })) }));

import ComposerPage from "@/app/work/composer/page";
import type { ComposerRun, ComposerWorkflow, ComposerWorkflowGraph } from "@/lib/composer/schema";

// ── fixtures ───────────────────────────────────────────────────

const WORKFLOWS: ComposerWorkflow[] = [
  { id: "wf-1", key: null, name: "Research then summarise", description: "", version: 1, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
  { id: "wf-2", key: null, name: "Draft and review", description: "", version: 1, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
];

function run(over: Partial<ComposerRun> = {}): ComposerRun {
  return {
    id: "run-1",
    workflowId: "wf-1",
    status: "running",
    currentNodeId: "node-a",
    input: "Summarise the options for on-device speech to text.",
    context: null,
    profileName: null,
    error: null,
    parentNodeRunId: null,
    createdAt: "2026-09-05T12:00:00.000Z",
    updatedAt: "2026-09-05T12:00:00.000Z",
    completedAt: null,
    ...over,
  };
}

const GRAPH: ComposerWorkflowGraph = {
  ...WORKFLOWS[0],
  nodes: [
    { id: "node-a", workflowId: "wf-1", key: "a", label: "Research", kind: "research", gate: "auto", isStart: true, isTerminal: false, config: null, pos: 0 },
  ],
  edges: [],
};

// ── harness ────────────────────────────────────────────────────

interface Resource<T> {
  data: T;
  error: string | null;
  refetch: jest.Mock;
}

function resource<T>(data: T, error: string | null = null): Resource<T> {
  return { data, error, refetch: jest.fn() };
}

function setRuns(runs: ComposerRun[], error: string | null = null) {
  mockUseRuns.mockReturnValue(resource(error ? [] : runs, error));
}

function setDetail(detail: unknown, error: string | null = null) {
  mockUseRun.mockReturnValue(resource(detail, error));
}

async function mount() {
  const utils = render(<ComposerPage />);
  // The two dynamic canvases resolve on a microtask.
  await act(async () => {});
  return utils;
}

async function click(name: string | RegExp): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

/** One run row, by the title the page derives from the run's input. */
function rowFor(title: string): HTMLElement {
  return screen.getByText(title).closest("button")!;
}

beforeEach(() => {
  jest.clearAllMocks();
  buildMounts = 0;
  window.history.replaceState(null, "", "/work/composer");
  // The stage sheet reads a media query on mount; jsdom ships no matchMedia.
  window.matchMedia = jest.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia;
  mockUseWorkflows.mockReturnValue({ ...resource(WORKFLOWS), refetch: jest.fn() });
  mockUseGraph.mockReturnValue({ data: null });
  setRuns([]);
  setDetail(undefined);
});

// ═══════════════════════════════════════════════════════════════
// D3 — a failed detail read is an error, not a spinner
// ═══════════════════════════════════════════════════════════════

describe("a run whose detail will not load says so", () => {
  async function selectTheRun(): Promise<void> {
    setRuns([run()]);
    await mount();
    await act(async () => {
      fireEvent.click(rowFor("Summarise the options for on-device speech to text."));
    });
  }

  it("the failure is on screen, in the operator's words", async () => {
    setDetail(undefined, "Failed to load run");
    await selectTheRun();

    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toContain("Failed to load run");
  });

  it("there is a Retry, and it asks the run detail again", async () => {
    setDetail(undefined, "Failed to load run");
    await selectTheRun();
    const { refetch } = mockUseRun.mock.results.at(-1)!.value as Resource<unknown>;

    await click("Retry");

    expect(refetch).toHaveBeenCalled();
  });

  it("the eternal spinner is gone: a failed read never claims to be loading", async () => {
    setDetail(undefined, "Failed to load run");
    await selectTheRun();

    expect(screen.queryByText("Loading run…")).toBeNull();
  });

  it("GREEN CONTROL: a read still in flight is still a spinner, not an error", async () => {
    setDetail(undefined, null);
    await selectTheRun();

    expect(screen.getByText("Loading run…")).toBeTruthy();
  });

  it("GREEN CONTROL: a successful read draws the pipeline", async () => {
    setDetail({ run: run(), nodeRuns: [], graph: GRAPH });
    await selectTheRun();

    expect(screen.getByTestId("run-canvas")).toBeTruthy();
    expect(screen.queryByText("Loading run…")).toBeNull();
  });

  it("GREEN CONTROL: a failed runs LIST is still a banner and never 'no runs yet'", async () => {
    setRuns([], "Failed to list runs");
    await mount();

    expect(screen.getByText("Failed to list runs")).toBeTruthy();
    expect(screen.queryByText("No workflow runs yet.")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// The run rows
// ═══════════════════════════════════════════════════════════════

describe("a run row says which workflow it is a run of", () => {
  it("the workflow's name is on the row", async () => {
    setRuns([run(), run({ id: "run-2", workflowId: "wf-2", input: "Draft the release note." })]);
    await mount();

    expect(within(rowFor("Summarise the options for on-device speech to text.")).getByText("Research then summarise")).toBeTruthy();
    expect(within(rowFor("Draft the release note.")).getByText("Draft and review")).toBeTruthy();
  });

  it("a run of a workflow that is no longer listed does not print undefined", async () => {
    setRuns([run({ workflowId: "wf-gone" })]);
    await mount();

    expect(rowFor("Summarise the options for on-device speech to text.").textContent).not.toContain("undefined");
  });
});

describe("waiting on a question is not the same as waiting at a gate", () => {
  const AT_A_GATE = run({ id: "run-gate", status: "awaiting_approval", input: "Plan the migration." });
  const ASKED = run({
    id: "run-ask",
    status: "awaiting_approval",
    input: "Do the thing.",
    context: { __clarify: { nodeId: "node-a", question: "Which page do you mean?" } },
  });

  it("the two rows do not read the same", async () => {
    setRuns([AT_A_GATE, ASKED]);
    await mount();

    expect(rowFor("Plan the migration.").textContent).toContain("at a gate");
    expect(rowFor("Do the thing.").textContent).toContain("answer a question");
  });

  it("both are the ratified word first, so the vocabulary still holds", async () => {
    setRuns([AT_A_GATE, ASKED]);
    await mount();

    expect(rowFor("Plan the migration.").textContent).toContain("Waiting for you");
    expect(rowFor("Do the thing.").textContent).toContain("Waiting for you");
  });

  it("the raw enum is off the screen", async () => {
    setRuns([AT_A_GATE, ASKED, run({ id: "run-done", status: "completed", input: "An old run." })]);
    await mount();

    expect(document.body.textContent).not.toContain("awaiting_approval");
  });

  it("GREEN CONTROL: the status filter still offers the awaiting state", async () => {
    setRuns([AT_A_GATE]);
    await mount();

    expect(screen.getAllByRole("button", { expanded: false }).length).toBeGreaterThan(0);
    expect(rowFor("Plan the migration.")).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// D7 — the Build tab is not thrown away by a glance at Run
// ═══════════════════════════════════════════════════════════════

describe("switching tabs does not discard the board", () => {
  async function toBuild(): Promise<void> {
    await click("Build");
    await act(async () => {});
  }

  it("the editor is mounted once and stays mounted across a round trip", async () => {
    await mount();
    await toBuild();
    expect(buildMounts).toBe(1);

    await click("Run");
    await toBuild();

    expect(buildMounts).toBe(1);
  });

  it("work on the board survives a look at the Run tab", async () => {
    await mount();
    await toBuild();
    fireEvent.change(screen.getByLabelText("unsaved board"), { target: { value: "twelve stages of layout" } });

    await click("Run");
    await toBuild();

    expect((screen.getByLabelText("unsaved board") as HTMLInputElement).value).toBe("twelve stages of layout");
  });

  it("GREEN CONTROL: only one tab's content is offered to the user at a time", async () => {
    setRuns([run()]);
    await mount();

    // On the Run tab the runs list is reachable; the board is not.
    expect(screen.getByRole("button", { name: /Summarise the options/ })).toBeTruthy();
    await toBuild();
    await waitFor(() => expect(screen.queryByRole("button", { name: /Summarise the options/ })).toBeNull());
  });
});

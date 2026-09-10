/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// The gate shows the work it is asking about.
//
// THE DEFECT, found by running a real workflow. ComposerGatePrompt takes
// `nodeLabel`, `busy` and `onAction` and nothing else, and the page passes
// nothing else: the panel asks Accept or Reject while showing not one word of
// the output being judged, nor the verdict the reviewing stage reached on it.
// The evidence exists -- it is in the stage sheet -- but that sheet is a modal
// dialog with a full-viewport backdrop, so opening it COVERS the gate. There is
// no arrangement of that screen in which the operator can read the work and
// decide on it at the same time.
//
// This is asserted at page level rather than on the component alone, because
// half the defect is the wiring: the page holds the stage's node-run in hand
// (`latestNodeRun`) and hands the panel only a label.
//
// The doubles follow tests/unit/b12-composer-run-view.test.tsx: the data hooks
// are jest.fn()s, the two react-flow canvases are stubs, and next/dynamic is
// React.lazy so the stubs resolve. The run-canvas stub renders whatever the page
// passes as its `gate`, which is the panel under test.
// ═══════════════════════════════════════════════════════════════

import { act, render, screen, within } from "@testing-library/react";
import { matchMediaMock } from "../helpers/mocks";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories are hoisted above imports
jest.mock("lucide-react", () => require("../helpers/story").lucideNullMock());

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

jest.mock("@/components/composer/WorkflowCanvas", () => ({
  __esModule: true,
  default: function WorkflowCanvasStub() {
    return null;
  },
}));

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

jest.mock("@/hooks/useProfiles", () => ({ useProfiles: () => ({ refetch: async () => undefined, data: [] }) }));
jest.mock("@/hooks/useEventStream", () => ({
  useEventStream: () => ({ data: null, connected: false, error: null }),
}));
jest.mock("@/lib/api/api-fetch", () => ({ safeApiCall: jest.fn(async () => ({ ok: true, data: {} })) }));

import ComposerPage from "@/app/work/composer/page";
import type {
  ComposerNodeRun,
  ComposerRun,
  ComposerWorkflow,
  ComposerWorkflowGraph,
} from "@/lib/composer/schema";

// ── fixtures ───────────────────────────────────────────────────

const WORKFLOWS: ComposerWorkflow[] = [
  { id: "wf-1", key: null, name: "Research then summarise", description: "", version: 1, createdAt: "2026-09-06T09:00:00.000Z", updatedAt: "2026-09-06T09:00:00.000Z" },
];

const GRAPH: ComposerWorkflowGraph = {
  ...WORKFLOWS[0],
  nodes: [
    { id: "node-gather", workflowId: "wf-1", key: "gather", label: "Research", kind: "research", gate: "auto", isStart: true, isTerminal: false, config: null, pos: 0 },
    { id: "node-gate", workflowId: "wf-1", key: "gate", label: "Check the findings", kind: "review", gate: "hil", isStart: false, isTerminal: false, config: null, pos: 1 },
  ],
  edges: [],
};

const THE_WORK =
  "A CSV file stores a table as plain text, one record per line, with commas between the fields.";

function gateRun(over: Partial<ComposerNodeRun> = {}): ComposerNodeRun {
  return {
    id: "nr-gate",
    composerRunId: "run-1",
    nodeId: "node-gate",
    attempt: 1,
    status: "completed",
    runId: "cn_nr-gate",
    input: "…",
    output: THE_WORK,
    verdict: { pass: false, reasons: ["No sources are cited."], suggestions: ["Cite two sources."] },
    error: null,
    startedAt: "2026-09-06T09:01:00.000Z",
    completedAt: "2026-09-06T09:02:00.000Z",
    createdAt: "2026-09-06T09:01:00.000Z",
    ...over,
  };
}

const WAITING: ComposerRun = {
  id: "run-1",
  workflowId: "wf-1",
  status: "awaiting_approval",
  currentNodeId: "node-gate",
  input: "Give a short overview of what a CSV file is.",
  context: null,
  profileName: null,
  error: null,
  parentNodeRunId: null,
  createdAt: "2026-09-06T09:00:00.000Z",
  updatedAt: "2026-09-06T09:02:00.000Z",
  completedAt: null,
};

// ── harness ────────────────────────────────────────────────────

function resource<T>(data: T, error: string | null = null) {
  return { data, error, refetch: jest.fn() };
}

/** Mount the page with the run selected and parked at its gate. */
async function mountAtTheGate(nodeRuns: ComposerNodeRun[] = [gateRun()]) {
  mockUseRuns.mockReturnValue(resource([WAITING]));
  mockUseRun.mockReturnValue(resource({ run: WAITING, nodeRuns, graph: GRAPH, approvals: [] }));
  window.history.replaceState(null, "", "/work/composer?runId=run-1");
  render(<ComposerPage />);
  await act(async () => {}); // the dynamic canvases resolve on a microtask
}

/** The gate panel, and only the gate panel. */
function gatePanel(): HTMLElement {
  return screen.getByTestId("run-canvas");
}

beforeEach(() => {
  jest.clearAllMocks();
  matchMediaMock();
  mockUseWorkflows.mockReturnValue(resource(WORKFLOWS));
  mockUseGraph.mockReturnValue({ data: null });
});

describe("the gate shows the work it is asking a decision about", () => {
  it("the stage's output is on screen, at the gate", async () => {
    await mountAtTheGate();

    expect(within(gatePanel()).getByText(new RegExp("one record per line"))).toBeTruthy();
  });

  it("the reviewing stage's verdict is on screen, so an accept is not blind", async () => {
    await mountAtTheGate();

    const panel = gatePanel();
    expect(within(panel).getByText("FAIL")).toBeTruthy();
    expect(within(panel).getByText("No sources are cited.")).toBeTruthy();
  });

  it("a PASS reads as a pass, not as an absence of a fail", async () => {
    await mountAtTheGate([gateRun({ verdict: { pass: true, reasons: [], suggestions: [] } })]);

    expect(within(gatePanel()).getByText("PASS")).toBeTruthy();
  });

  it("a stage that recorded no output says so rather than showing an empty box", async () => {
    await mountAtTheGate([gateRun({ output: null, verdict: null })]);

    expect(within(gatePanel()).getByText(/no output/i)).toBeTruthy();
  });

  it("GREEN CONTROL: the decision itself is still there, with its note box", async () => {
    await mountAtTheGate();

    const panel = gatePanel();
    expect(within(panel).getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Reject" })).toBeTruthy();
    expect(within(panel).getByLabelText("Gate note")).toBeTruthy();
    expect(within(panel).getByText("Check the findings")).toBeTruthy();
  });

  it("GREEN CONTROL: a run that is not at a gate shows no gate panel at all", async () => {
    mockUseRuns.mockReturnValue(resource([{ ...WAITING, status: "running" as const }]));
    mockUseRun.mockReturnValue(
      resource({ run: { ...WAITING, status: "running" as const }, nodeRuns: [gateRun()], graph: GRAPH, approvals: [] }),
    );
    window.history.replaceState(null, "", "/work/composer?runId=run-1");
    render(<ComposerPage />);
    await act(async () => {});

    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
  });
});

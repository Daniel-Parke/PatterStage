/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B12 oracle, group build-tab-destructive (D1 blocker, plus Duplicate).
//
// Written before the product code moved. Contract sections 1.3 and 1.4.
//
// The two-click ConfirmButton landed in B2, so the pink Delete is no longer a
// single click. It is still a single click that DOES NOT SAY WHAT IT DELETES:
// removeWorkflow() fires a bare DELETE, and deleteWorkflow() drops every run
// of the workflow, their stage outputs and their approvals, on the way to
// dropping the workflow. The save path already learned to ask -- 409, a run
// count, and an inline question answered by a second click. Delete has to
// learn the same lesson, and name the workflow while it asks, because the
// Build tab's selector is the only thing on screen saying which one is loaded.
//
// Duplicate is here rather than in its own file because it shares the seam:
// both take the canvas as it stands and send it somewhere, and Duplicate's
// one real hazard is sending the `key` along with it -- createWorkflowFromDef
// treats a repeated key as a REPLACE, so a keyed duplicate would silently
// overwrite the original instead of copying it.
//
// Doubles: @xyflow/react is a light stand-in (the board itself is not under
// test and needs a real DOM box to lay out); the graph hook and safeApiCall
// are jest.fn()s, so every assertion is about the request the toolbar chose
// to make.
// ═══════════════════════════════════════════════════════════════

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("lucide-react", () => {
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

// ── the board ──────────────────────────────────────────────────
//
// useNodesState/useEdgesState are real useState pairs, so applyCanvas ->
// currentCanvas round-trips exactly as it does in the browser; everything
// else is inert chrome.
jest.mock("@xyflow/react", () => {
  const React = jest.requireActual("react") as typeof import("react");
  const useFlowState = (initial: unknown[]) => {
    const [value, setValue] = React.useState(initial);
    return [value, setValue, jest.fn()];
  };
  return {
    __esModule: true,
    ReactFlow: ({ children }: { children?: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "flow" }, children),
    ReactFlowProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    Handle: () => null,
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
    addEdge: (edge: Record<string, unknown>, edges: unknown[]) => [...edges, { id: `e${edges.length}`, ...edge }],
    useNodesState: useFlowState,
    useEdgesState: useFlowState,
    useReactFlow: () => ({ screenToFlowPosition: (p: { x: number; y: number }) => p }),
  };
});

const mockUseGraph = jest.fn();
jest.mock("@/hooks/useComposer", () => ({
  useComposerWorkflowGraph: (...a: unknown[]) => mockUseGraph(...(a as [])),
}));

const mockSafeApiCall = jest.fn();
jest.mock("@/lib/api-fetch", () => ({ safeApiCall: (...a: unknown[]) => mockSafeApiCall(...(a as [])) }));

import WorkflowCanvas from "@/components/composer/WorkflowCanvas";
import type { ComposerWorkflow, ComposerWorkflowGraph } from "@/lib/composer/schema";

// ── fixtures ───────────────────────────────────────────────────

const WORKFLOWS: ComposerWorkflow[] = [
  {
    id: "wf-1",
    key: null,
    name: "Research then summarise",
    description: "Research a question, check the findings, then write it up.",
    version: 3,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
  },
];

const GRAPH: ComposerWorkflowGraph = {
  ...WORKFLOWS[0],
  nodes: [
    {
      id: "n-research",
      workflowId: "wf-1",
      key: "research",
      label: "Research",
      kind: "research",
      gate: "auto",
      isStart: true,
      isTerminal: false,
      config: { _ui: { x: 0, y: 0 } },
      pos: 0,
    },
    {
      id: "n-write",
      workflowId: "wf-1",
      key: "write",
      label: "Write the summary",
      kind: "documentation",
      gate: "auto",
      isStart: false,
      isTerminal: true,
      config: { _ui: { x: 0, y: 120 } },
      pos: 1,
    },
  ],
  edges: [
    { id: "e-1", workflowId: "wf-1", fromNodeId: "n-research", toNodeId: "n-write", condition: "always", label: null },
  ],
};

// ── harness ────────────────────────────────────────────────────

function mount() {
  const onSaved = jest.fn();
  const utils = render(<WorkflowCanvas workflows={WORKFLOWS} onSaved={onSaved} />);
  return { onSaved, ...utils };
}

/**
 * The toolbar's "Edit workflow" dropdown.
 *
 * Found by its listbox trigger rather than by its label: `Field` mints an id
 * and clones it onto its child, and `Select` does not take an `id` prop, so
 * the label's htmlFor points at nothing and getByLabelText cannot see it.
 * That is a real (separate) accessibility gap; it is not this batch's, and
 * pinning it here would red these tests for the wrong reason.
 */
function workflowSelectTrigger(): HTMLElement {
  return screen.getAllByRole("button", { expanded: false })[0];
}

async function chooseWorkflow(label: string): Promise<void> {
  await act(async () => {
    fireEvent.click(workflowSelectTrigger());
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("option", { name: new RegExp(label) }));
  });
}

async function click(name: string | RegExp): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

/** Arm and fire the two-step Delete. */
async function pressDelete(): Promise<void> {
  await click("Delete");
  await click("Delete workflow?");
}

function requests(): { url: string; method?: string; body?: unknown }[] {
  return mockSafeApiCall.mock.calls.map(([url, opts]) => ({
    url: url as string,
    method: (opts as { method?: string } | undefined)?.method,
    body: (opts as { body?: unknown } | undefined)?.body,
  }));
}

function answerOk(data: unknown = { data: { workflow: { id: "wf-2" } } }) {
  mockSafeApiCall.mockResolvedValue({ ok: true, status: 200, data });
}

function answerConflict(runCount: number, workflowName = "Research then summarise") {
  mockSafeApiCall.mockResolvedValue({
    ok: false,
    status: 409,
    error: `Deleting "${workflowName}" would permanently delete ${runCount} run(s) of it, including their stage outputs and approvals.`,
    body: { runCount, workflowName, confirmWith: "?discardRunHistory=1" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseGraph.mockImplementation((id: string | null) => ({ data: id === "wf-1" ? GRAPH : null }));
  answerOk();
});

// ═══════════════════════════════════════════════════════════════
// D1 — the delete asks
// ═══════════════════════════════════════════════════════════════

describe("deleting a workflow that has run history asks first", () => {
  it("GREEN CONTROL: the first DELETE does not carry consent it has not been given", async () => {
    answerConflict(7);
    mount();
    await chooseWorkflow("Research then summarise");

    await pressDelete();

    expect(requests()).toEqual([{ url: "/api/composer/workflows/wf-1", method: "DELETE", body: undefined }]);
  });

  it("the 409 becomes a question that names the workflow and the count", async () => {
    answerConflict(7);
    mount();
    await chooseWorkflow("Research then summarise");

    await pressDelete();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Research then summarise");
    expect(alert.textContent).toContain("7 runs");
    expect(alert.textContent).toContain("stage outputs and approvals");
  });

  it("one run is one run", async () => {
    answerConflict(1);
    mount();
    await chooseWorkflow("Research then summarise");

    await pressDelete();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("1 run of it");
    expect(alert.textContent).not.toContain("1 runs");
  });

  it("answering the question sends the consent, once", async () => {
    answerConflict(7);
    mount();
    await chooseWorkflow("Research then summarise");
    await pressDelete();
    await screen.findByRole("alert");

    answerOk({ data: { deleted: true } });
    await click(/Delete 7 runs and the workflow/);

    expect(requests().at(-1)).toEqual({
      url: "/api/composer/workflows/wf-1?discardRunHistory=1",
      method: "DELETE",
      body: undefined,
    });
  });

  it("declining sends nothing and says the history is safe", async () => {
    answerConflict(7);
    const { onSaved } = mount();
    await chooseWorkflow("Research then summarise");
    await pressDelete();
    await screen.findByRole("alert");
    const before = mockSafeApiCall.mock.calls.length;

    await click("Keep it");

    expect(mockSafeApiCall).toHaveBeenCalledTimes(before);
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByText("Not deleted. Run history kept.")).toBeTruthy();
    expect(screen.queryByText(/Delete 7 runs and the workflow/)).toBeNull();
  });

  it("a confirmed delete refreshes the list and returns the editor to a blank workflow", async () => {
    answerConflict(3);
    const { onSaved } = mount();
    await chooseWorkflow("Research then summarise");
    await pressDelete();
    await screen.findByRole("alert");

    answerOk({ data: { deleted: true } });
    await click(/Delete 3 runs and the workflow/);

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Deleted.")).toBeTruthy();
  });

  it("GREEN CONTROL: a workflow with no runs deletes on the first ask, with no question", async () => {
    answerOk({ data: { deleted: true } });
    const { onSaved } = mount();
    await chooseWorkflow("Research then summarise");

    await pressDelete();

    expect(requests()).toEqual([{ url: "/api/composer/workflows/wf-1", method: "DELETE", body: undefined }]);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/and the workflow/)).toBeNull();
  });

  it("GREEN CONTROL: the two-step arming is still the first guard", async () => {
    answerConflict(7);
    mount();
    await chooseWorkflow("Research then summarise");

    await click("Delete");

    expect(mockSafeApiCall).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete workflow?" })).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// Duplicate
// ═══════════════════════════════════════════════════════════════

describe("a saved workflow can be duplicated", () => {
  it("Duplicate is offered for a saved workflow and not for an unsaved new one", async () => {
    mount();
    expect(screen.queryByRole("button", { name: "Duplicate" })).toBeNull();

    await chooseWorkflow("Research then summarise");

    expect(screen.getByRole("button", { name: "Duplicate" })).toBeTruthy();
  });

  it("it POSTs a NEW workflow whose name says it is a copy", async () => {
    mount();
    await chooseWorkflow("Research then summarise");

    await click("Duplicate");

    const last = requests().at(-1)!;
    expect(last.url).toBe("/api/composer/workflows");
    expect(last.method).toBe("POST");
    expect((last.body as { name?: string }).name).toBe("Research then summarise (copy)");
  });

  it("it carries the graph that is on the board", async () => {
    mount();
    await chooseWorkflow("Research then summarise");

    await click("Duplicate");

    const body = requests().at(-1)!.body as { nodes: { key: string }[]; edges: { from: string; to: string }[] };
    expect(body.nodes.map((n) => n.key).sort()).toEqual(["research", "write"]);
    expect(body.edges).toEqual([expect.objectContaining({ from: "research", to: "write" })]);
  });

  it("it never sends the original's key, which would overwrite the original", async () => {
    // createWorkflowFromDef is idempotent BY KEY: a duplicate that carried one
    // would delete the source's nodes and bump its version instead of copying.
    mount();
    await chooseWorkflow("Research then summarise");

    await click("Duplicate");

    expect(Object.prototype.hasOwnProperty.call(requests().at(-1)!.body, "key")).toBe(false);
  });

  it("it refreshes the workflow list and says so", async () => {
    const { onSaved } = mount();
    await chooseWorkflow("Research then summarise");

    await click("Duplicate");

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Duplicated.")).toBeTruthy();
  });

  it("a refused duplicate says so in the tone of a refusal", async () => {
    mockSafeApiCall.mockResolvedValue({ ok: false, status: 500, error: "Failed to create workflow" });
    const { onSaved } = mount();
    await chooseWorkflow("Research then summarise");

    await click("Duplicate");

    const message = await screen.findByText("Failed to create workflow");
    expect(message.getAttribute("data-tone")).toBe("error");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: Save still PUTs to the selected workflow", async () => {
    mount();
    await chooseWorkflow("Research then summarise");

    await click("Save");

    const last = requests().at(-1)!;
    expect(last.url).toBe("/api/composer/workflows/wf-1");
    expect(last.method).toBe("PUT");
  });

  it("GREEN CONTROL: with no workflow chosen the primary action is Create, and it POSTs", async () => {
    mount();

    await click("Create");

    const last = requests().at(-1)!;
    expect(last.url).toBe("/api/composer/workflows");
    expect(last.method).toBe("POST");
  });
});

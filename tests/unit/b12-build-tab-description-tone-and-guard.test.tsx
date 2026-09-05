/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B12 oracle, group build-tab-editor (D2, D6, D7 — all major).
//
// Written before the product code moved. Contract sections 2.4, 4 and 5.2.
// One file, because all three are the same toolbar and the same save, and
// splitting them would mean mounting the same board three times to assert
// three things about one row of controls.
//
//   D2  Open the seeded workflow, move a node, save: the description is gone.
//       canvasToWorkflowDef never carried it, zod defaulted it to "", and the
//       UPDATE wrote that "" over the sentence. There is also no field to type
//       it back in, so the loss is not even recoverable by hand.
//   D6  "Saved.", "Deleted.", "Mark one stage as the Start." and "Cannot
//       change a workflow with active runs" are all the same muted grey at the
//       same size in the same corner. A refusal and a success look identical.
//   D7  Changing the "Edit workflow" dropdown resets loadedRef and re-applies
//       the fetched graph over whatever is on the board. Twelve stages of
//       layout, gone, with no warning and no undo.
//
// Doubles as in the sibling file: a light @xyflow/react, a jest.fn() graph
// hook, a jest.fn() safeApiCall. The board's state round-trips through real
// useState pairs, which is what makes "the board still has your work" a real
// assertion rather than a re-render check.
// ═══════════════════════════════════════════════════════════════

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("lucide-react", () => {
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

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

const DESCRIPTION = "Methodical feature/bug pipeline: prepare, implement, verify.";

const WORKFLOWS: ComposerWorkflow[] = [
  {
    id: "wf-1",
    key: "software-delivery-v1",
    name: "Software Delivery",
    description: DESCRIPTION,
    version: 3,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
  },
  {
    id: "wf-2",
    key: null,
    name: "Draft and review",
    description: "Draft the piece, then review it.",
    version: 1,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
];

function graphFor(index: number): ComposerWorkflowGraph {
  const wf = WORKFLOWS[index];
  return {
    ...wf,
    nodes: [
      {
        id: `${wf.id}-a`,
        workflowId: wf.id,
        key: "a",
        label: index === 0 ? "Review" : "Draft",
        kind: "review",
        gate: "auto",
        isStart: true,
        isTerminal: false,
        config: { _ui: { x: 0, y: 0 } },
        pos: 0,
      },
      {
        id: `${wf.id}-b`,
        workflowId: wf.id,
        key: "b",
        label: index === 0 ? "Ship" : "Review",
        kind: "custom",
        gate: "auto",
        isStart: false,
        isTerminal: true,
        config: { _ui: { x: 0, y: 120 } },
        pos: 1,
      },
    ],
    edges: [
      { id: `${wf.id}-e`, workflowId: wf.id, fromNodeId: `${wf.id}-a`, toNodeId: `${wf.id}-b`, condition: "always", label: null },
    ],
  };
}

// ── harness ────────────────────────────────────────────────────

function mount() {
  const onSaved = jest.fn();
  const utils = render(<WorkflowCanvas workflows={WORKFLOWS} onSaved={onSaved} />);
  return { onSaved, ...utils };
}

/** See the sibling file: Select's trigger is not reachable by its label. */
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

function type(labelText: string, value: string): void {
  fireEvent.change(screen.getByLabelText(labelText), { target: { value } });
}

function lastBody(): Record<string, unknown> {
  const call = mockSafeApiCall.mock.calls.at(-1) as [string, { body?: Record<string, unknown> }];
  return call[1].body ?? {};
}

/**
 * Drag a "Task" from the palette onto the board. It arrives labelled
 * "New stage", which is the one board state validateCanvas refuses that this
 * harness can reach without react-flow's own node selection.
 */
async function dropAStage(): Promise<void> {
  const board = screen.getByTestId("flow").parentElement!;
  await act(async () => {
    fireEvent.drop(board, {
      dataTransfer: { getData: () => "custom" },
      clientX: 40,
      clientY: 40,
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseGraph.mockImplementation((id: string | null) => ({
    data: id === "wf-1" ? graphFor(0) : id === "wf-2" ? graphFor(1) : null,
  }));
  mockSafeApiCall.mockResolvedValue({ ok: true, status: 200, data: { data: { workflow: { id: "wf-1" } } } });
});

// ═══════════════════════════════════════════════════════════════
// D2 — the description
// ═══════════════════════════════════════════════════════════════

describe("the Build tab can see and keep a workflow's description", () => {
  it("there is a Description field beside the name", async () => {
    mount();
    await chooseWorkflow("Software Delivery");

    expect(screen.getByLabelText("Description")).toBeTruthy();
  });

  it("it is filled from the loaded workflow", async () => {
    mount();
    await chooseWorkflow("Software Delivery");

    expect((screen.getByLabelText("Description") as HTMLInputElement).value).toBe(DESCRIPTION);
  });

  it("a save carries the description, so a save that touched only the graph cannot blank it", async () => {
    mount();
    await chooseWorkflow("Software Delivery");

    await click("Save");

    expect(lastBody().description).toBe(DESCRIPTION);
  });

  it("an edited description is what gets saved", async () => {
    mount();
    await chooseWorkflow("Software Delivery");
    type("Description", "Now it says something else.");

    await click("Save");

    expect(lastBody().description).toBe("Now it says something else.");
  });

  it("a cleared description is sent as cleared, not as absent", async () => {
    mount();
    await chooseWorkflow("Software Delivery");
    type("Description", "");

    await click("Save");

    expect(lastBody().description).toBe("");
  });

  it("a brand-new workflow starts with an empty description", () => {
    mount();

    expect((screen.getByLabelText("Description") as HTMLInputElement).value).toBe("");
  });

  it("GREEN CONTROL: the name is still there and still saved", async () => {
    mount();
    await chooseWorkflow("Software Delivery");

    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Software Delivery");
    await click("Save");
    expect(lastBody().name).toBe("Software Delivery");
  });
});

// ═══════════════════════════════════════════════════════════════
// D6 — success and failure do not look the same
// ═══════════════════════════════════════════════════════════════

describe("the Build tab's message has a tone", () => {
  it("a success is marked as one", async () => {
    mount();
    await chooseWorkflow("Software Delivery");

    await click("Save");

    const el = await screen.findByText("Saved.");
    expect(el.getAttribute("data-tone")).toBe("ok");
    expect(el.getAttribute("role")).toBeNull();
  });

  it("a refusal from the server is marked as an error and announced", async () => {
    mockSafeApiCall.mockResolvedValue({
      ok: false,
      status: 400,
      error: "Cannot change a workflow with active runs — let them finish or cancel them first.",
    });
    mount();
    await chooseWorkflow("Software Delivery");

    await click("Save");

    const el = await screen.findByText(/Cannot change a workflow with active runs/);
    expect(el.getAttribute("data-tone")).toBe("error");
    expect(el.getAttribute("role")).toBe("alert");
  });

  it("a validation refusal is an error too, and never reaches the server", async () => {
    // Drag a Task onto the board: it lands labelled "New stage", which
    // validateCanvas refuses by name. The refusal is the client's, so nothing
    // is sent — and it has to LOOK different from "Saved." or the operator
    // reads a refusal as a success.
    mount();
    await chooseWorkflow("Software Delivery");
    await dropAStage();
    mockSafeApiCall.mockClear();

    await click("Save");

    const el = await screen.findByText(/Rename the placeholder/);
    expect(el.getAttribute("data-tone")).toBe("error");
    expect(el.getAttribute("role")).toBe("alert");
    expect(mockSafeApiCall).not.toHaveBeenCalled();
  });

  it("success and failure are not the same colour", async () => {
    mount();
    await chooseWorkflow("Software Delivery");
    await click("Save");
    const okClass = (await screen.findByText("Saved.")).className;

    mockSafeApiCall.mockResolvedValue({ ok: false, status: 500, error: "Save failed" });
    await click("Save");
    const errorClass = (await screen.findByText("Save failed")).className;

    expect(okClass).not.toBe(errorClass);
  });

  it("GREEN CONTROL: nothing is announced before anything has happened", () => {
    mount();

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// D7 — unsaved work is not thrown away in silence
// ═══════════════════════════════════════════════════════════════

describe("switching workflows with unsaved work asks first", () => {
  it("a NEW board with work on it asks too, before it is thrown away", async () => {
    // The seeded blank canvas has its own baseline. Without one, every fresh
    // board reads as clean and a switch takes it silently, which is the same
    // defect one screen along (T-0106, D7).
    mount();
    type("Name", "Something I was in the middle of");

    await chooseWorkflow("Software Delivery");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("unsaved changes");
    expect(alert.textContent).toContain("Something I was in the middle of");
  });

  async function mountDirty(): Promise<ReturnType<typeof mount>> {
    const utils = mount();
    await chooseWorkflow("Software Delivery");
    type("Name", "Software Delivery, rearranged");
    return utils;
  }

  it("the switch does not happen behind your back", async () => {
    await mountDirty();

    await chooseWorkflow("Draft and review");

    // Still the edited workflow, still the edited name.
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Software Delivery, rearranged");
  });

  it("it says what is about to be lost, and names it", async () => {
    await mountDirty();

    await chooseWorkflow("Draft and review");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("unsaved changes");
    expect(alert.textContent).toContain("Software Delivery, rearranged");
  });

  it("Keep editing leaves the board exactly as it was", async () => {
    await mountDirty();
    await chooseWorkflow("Draft and review");
    await screen.findByRole("alert");

    await click("Keep editing");

    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Software Delivery, rearranged");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("Discard changes and switch does what it says", async () => {
    await mountDirty();
    await chooseWorkflow("Draft and review");
    await screen.findByRole("alert");

    await click("Discard changes and switch");

    await waitFor(() =>
      expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Draft and review"),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("GREEN CONTROL: a saved board is clean again, so the next switch does not ask", async () => {
    // Vacuous today (nothing asks); load-bearing the moment the guard lands,
    // because a snapshot that is not refreshed on save turns every switch
    // after the first save into a false alarm.
    await mountDirty();
    await click("Save");
    await screen.findByText("Saved.");

    await chooseWorkflow("Draft and review");

    await waitFor(() =>
      expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Draft and review"),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("GREEN CONTROL: with nothing edited, the switch is immediate and silent", async () => {
    mount();
    await chooseWorkflow("Software Delivery");

    await chooseWorkflow("Draft and review");

    await waitFor(() =>
      expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Draft and review"),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

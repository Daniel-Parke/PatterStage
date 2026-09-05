/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B12 oracle, group gate-notes, UI half (D8, major).
//
// Written before the product code moved. Contract section 6.1: the stage
// sheet -- the one panel in Composer that already explains a stage, with its
// verdict, its reasons, its suggestions and its output -- shows the gate
// decisions taken on that stage, and the note the operator typed with them.
//
// Today ComposerNodeRunDetail has no idea approvals exist. The note is
// written to composer_approvals and read by nothing but the router, so the
// sentence explaining a rejection is visible to no one, ever, anywhere in the
// product.
//
// The `approvals` prop is cast in (pre-B12 type shim) so this file
// type-checks against today's signature while asserting tomorrow's.
// ═══════════════════════════════════════════════════════════════

import { render, screen, within } from "@testing-library/react";

jest.mock("lucide-react", () => {
  // Icons leave the accessibility tree, so an icon-only button that names
  // itself with `title` or `aria-label` still resolves by its accessible name.
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

jest.mock("@/lib/api-fetch", () => ({ safeApiCall: jest.fn(async () => ({ ok: true, data: {} })) }));

import ComposerNodeRunDetail from "@/components/composer/ComposerNodeRunDetail";
import type { ComposerApproval, ComposerNode, ComposerNodeRun } from "@/lib/composer/schema";

// ── pre-B12 type shim: the sheet gains the decisions ────────────
type DetailProps = React.ComponentProps<typeof ComposerNodeRunDetail> & { approvals?: ComposerApproval[] };
const Detail = ComposerNodeRunDetail as unknown as React.ComponentType<DetailProps>;

const NODE: ComposerNode = {
  id: "node-plan",
  workflowId: "wf-1",
  key: "plan",
  label: "Plan",
  kind: "plan",
  gate: "hil",
  isStart: false,
  isTerminal: false,
  config: null,
  pos: 4,
};

const NODE_RUN: ComposerNodeRun = {
  id: "nr-1",
  composerRunId: "run-1",
  nodeId: "node-plan",
  attempt: 1,
  status: "rejected",
  runId: "cn_nr-1",
  input: "…",
  output: "A plan.",
  verdict: null,
  error: null,
  startedAt: "2026-09-05T12:00:00.000Z",
  completedAt: "2026-09-05T12:01:00.000Z",
  createdAt: "2026-09-05T12:00:00.000Z",
};

function approval(over: Partial<ComposerApproval> = {}): ComposerApproval {
  return {
    id: "ap-1",
    composerRunId: "run-1",
    nodeId: "node-plan",
    action: "reject",
    approved: false,
    note: "Use the existing adapter instead of a new one.",
    decidedBy: "user",
    createdAt: "2026-09-05T12:01:00.000Z",
    ...over,
  };
}

function mount(approvals: ComposerApproval[]) {
  return render(
    <Detail open onClose={jest.fn()} node={NODE} nodeRun={NODE_RUN} approvals={approvals} />,
  );
}

function sheet(): HTMLElement {
  return screen.getByRole("dialog");
}

beforeEach(() => {
  // The sheet reads a media query on mount to choose its side; jsdom ships no
  // matchMedia, and without one every render here dies in the framework
  // rather than on the contract.
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
});

describe("the stage sheet shows what the operator decided at this gate, and why", () => {
  it("the note the operator typed is on screen", () => {
    mount([approval()]);

    expect(within(sheet()).getByText("Use the existing adapter instead of a new one.")).toBeTruthy();
  });

  it("the decision is named in words, not left to the note to imply", () => {
    mount([approval()]);

    const panel = sheet();
    expect(within(panel).getByText("Gate decisions")).toBeTruthy();
    expect(within(panel).getByText("Rejected")).toBeTruthy();
  });

  it("an acceptance reads as an acceptance", () => {
    mount([approval({ action: "accept", approved: true, note: "Fine, but keep it reversible." })]);

    const panel = sheet();
    expect(within(panel).getByText("Accepted")).toBeTruthy();
    expect(within(panel).getByText("Fine, but keep it reversible.")).toBeTruthy();
  });

  it("every decision on the stage is shown, in the order they were taken", () => {
    mount([
      approval({ id: "ap-1", note: "First pass: too vague.", createdAt: "2026-09-05T12:01:00.000Z" }),
      approval({ id: "ap-2", action: "accept", approved: true, note: "Better.", createdAt: "2026-09-05T12:09:00.000Z" }),
    ]);

    const text = sheet().textContent ?? "";
    expect(text).toContain("First pass: too vague.");
    expect(text).toContain("Better.");
    expect(text.indexOf("First pass: too vague.")).toBeLessThan(text.indexOf("Better."));
  });

  it("a decision taken without a note still says a decision was taken", () => {
    mount([approval({ note: null })]);

    const panel = sheet();
    expect(within(panel).getByText("Rejected")).toBeTruthy();
    expect(within(panel).getByText("No note")).toBeTruthy();
  });

  it("GREEN CONTROL: a stage with no decisions shows no gate section at all", () => {
    mount([]);

    expect(screen.queryByText("Gate decisions")).toBeNull();
  });

  it("GREEN CONTROL: the sheet still shows the stage's status and output", () => {
    mount([approval()]);

    const panel = sheet();
    expect(within(panel).getByText("rejected")).toBeTruthy();
    expect(within(panel).getByText("A plan.")).toBeTruthy();
  });
});

/**
 * @jest-environment jsdom
 */

/**
 * THE COMPOSER LAUNCH CONTROL SAYS WHAT IT DOES (T-0043).
 *
 * "Review & run" reads as one action that does two things, so a tester who
 * clicked it and got a modal instead of a run reported the run button as
 * broken. It was not broken. The label was.
 *
 * The operator ruled on 2026-08-26: the control is renamed to "Review…", the
 * ellipsis being the long-standing convention for a control that opens a
 * further step (the same convention this codebase already uses for
 * "Workflow…", "Manage all categories…", "Search or create…").
 *
 * The two-step confirm flow is UNTOUCHED, and this file pins that too: the
 * first control only opens the review, and the run is still fired by
 * "Confirm & launch" inside it. A change that renames the label AND collapses
 * the confirm step turns the last case below red.
 */

import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("@/hooks/useComposer", () => ({
  // No graph: the form falls back to its default objective label and renders
  // no stages, which is all this test needs. The launch control is unaffected.
  useComposerWorkflowGraph: () => ({ data: undefined }),
}));

import ComposerRunForm from "@/components/composer/ComposerRunForm";
import type { ComposerWorkflow } from "@/lib/composer/schema";

const workflow: ComposerWorkflow = {
  id: "wf-1",
  key: "wf-1",
  name: "Feature build",
  description: "Plan, implement, test.",
  version: 1,
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
};

function renderForm(onRun = jest.fn()) {
  render(
    <ComposerRunForm
      workflows={[workflow]}
      activeWorkflowId={workflow.id}
      onWorkflowChange={() => {}}
      profileOptions={[{ value: "default", label: "default" }]}
      profileName="default"
      onProfileChange={() => {}}
      input="Add a health endpoint"
      onInputChange={() => {}}
      submitting={false}
      onRun={onRun}
    />,
  );
  return onRun;
}

describe("Composer launch control", () => {
  it("is labelled Review…, the convention for opening a further step", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "Review…" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /review & run/i }),
    ).not.toBeInTheDocument();
  });

  it("opens the review rather than running", () => {
    const onRun = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Review…" }));

    expect(onRun).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: /review before launch/i }),
    ).toBeInTheDocument();
  });

  it("still fires the run only from Confirm & launch", () => {
    const onRun = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Review…" }));
    expect(onRun).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /confirm & launch/i }));
    expect(onRun).toHaveBeenCalledTimes(1);
  });
});

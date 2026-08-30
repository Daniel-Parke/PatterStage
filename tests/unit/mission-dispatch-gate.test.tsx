/**
 * @jest-environment jsdom
 */

/**
 * THE DISPATCH GATE, AND WHAT IT IS FOR (T-0043).
 *
 * The gate is by design: a new mission may not be submitted until the operator
 * has been shown how it will run. What was wrong was never the gate, it was the
 * price of admission. Dispatch opened COLLAPSED, so the only way to satisfy the
 * acknowledgement was to guess that a closed accordion four steps down was the
 * thing standing between you and a disabled button. A competent tester read a
 * working control as a broken form, twice.
 *
 * The operator ruled on 2026-08-26: show the choice instead of demanding a
 * click. Dispatch opens BY DEFAULT and being open IS the acknowledgement.
 *
 * The gate itself stays, and this file still holds it:
 *
 *   - collapse Dispatch and submit is disabled again, with the hint,
 *   - the requirement is stated ON the disabled button (title +
 *     aria-describedby), not only in a paragraph the eye can skip,
 *   - MissionComposerActions still refuses an unacknowledged new mission
 *     when it is handed one.
 *
 * Delete the gate and the collapsed-path cases below go red. That is the
 * point of them: what changed is the DEFAULT, not the rule.
 */

import { useCallback, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import MissionCreateForm, {
  MissionComposerActions,
} from "@/components/missions/MissionCreateForm";
import type { MissionFormState } from "@/components/missions/MissionCreateForm";

const baseFormState: MissionFormState = {
  newName: "Test",
  newInstruction: "Run the task",
  newContext: "",
  newGoals: "",
  newOutputFormat: "",
  newConstraints: "",
  newDispatch: "save",
  newSchedule: "every 5m",
  newMissionTime: 15,
  newTimeout: 10,
  newProfile: "",
  newModel: "",
  newProvider: "",
  newLocalDirs: [],
  localDirDraft: { path: "", branch: null },
  newReferences: [],
  referenceInput: "",
  newSkills: [],
  newToolsets: [],
};

const HINT = /to choose how this mission runs before submitting/i;

/**
 * The composer as the missions page wires it: the page owns
 * `dispatchAcknowledged` and the form reports the Dispatch section's open
 * state into it. Mirrored here so the default-open behaviour is asserted
 * through the same path the real page uses, not through a prop set by hand.
 */
function ComposerHarness() {
  const [formState, setFormState] = useState<MissionFormState>(baseFormState);
  const [dispatchAcknowledged, setDispatchAcknowledged] = useState(false);

  const setFormField = useCallback(
    <K extends keyof MissionFormState>(field: K, value: MissionFormState[K]) => {
      setFormState((s) => ({ ...s, [field]: value }) as MissionFormState);
    },
    [],
  );

  return (
    <MissionCreateForm
      editingId={null}
      missions={[]}
      scheduleDraftError={null}
      onScheduleDraftError={jest.fn()}
      formState={formState}
      setFormField={setFormField}
      categories={[]}
      categoryId={null}
      onCategoryChange={() => {}}
      onSubmit={() => {}}
      onSaveAsTemplate={() => {}}
      onClose={() => {}}
      dispatching={false}
      dispatchAcknowledged={dispatchAcknowledged}
      onDispatchOpenChange={setDispatchAcknowledged}
    />
  );
}

const dispatchHeader = () =>
  screen.getByRole("button", { name: /When and how this mission runs/ });

const submitButton = () => screen.getByRole("button", { name: /save draft/i });

describe("Dispatch is open by default, and being open is the acknowledgement", () => {
  it("shows the dispatch choice without a click, and submit is live", () => {
    render(<ComposerHarness />);

    // The choice is on screen. No accordion to discover, nothing to click.
    expect(
      screen.getByRole("button", { name: "Run now" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Schedule" }),
    ).toBeInTheDocument();

    expect(submitButton()).not.toBeDisabled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("says nothing on the button when there is nothing to require", () => {
    render(<ComposerHarness />);

    const submit = submitButton();
    expect(submit).not.toHaveAttribute("title");
    expect(submit).not.toHaveAttribute("aria-describedby");
  });
});

describe("the gate still exists, on the collapsed path", () => {
  it("collapsing Dispatch disables submit and brings back the hint", () => {
    render(<ComposerHarness />);
    expect(submitButton()).not.toBeDisabled();

    fireEvent.click(dispatchHeader());

    // The choice is hidden again, so the acknowledgement is withdrawn.
    expect(
      screen.queryByRole("button", { name: "Run now" }),
    ).not.toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    expect(screen.getByText(HINT)).toBeInTheDocument();
  });

  it("states the requirement on the disabled button itself", () => {
    render(<ComposerHarness />);
    fireEvent.click(dispatchHeader());

    const submit = submitButton();
    expect(submit).toBeDisabled();

    // A paragraph elsewhere on the form is not an answer to "why is this
    // button dead?". The control carries its own reason.
    expect(submit.getAttribute("title") ?? "").toMatch(/dispatch/i);

    const describedBy = submit.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const description = document.getElementById(String(describedBy));
    expect(description).not.toBeNull();
    expect(description?.textContent ?? "").toMatch(
      /choose\s+how this mission runs before submitting/i,
    );
  });

  it("re-opening Dispatch lifts the gate again", () => {
    render(<ComposerHarness />);

    fireEvent.click(dispatchHeader());
    expect(submitButton()).toBeDisabled();

    fireEvent.click(dispatchHeader());
    expect(submitButton()).not.toBeDisabled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });
});

describe("MissionComposerActions holds the rule on its own", () => {
  it("refuses an unacknowledged new mission, and says why on the button", () => {
    render(
      <MissionComposerActions
        editingId={null}
        missions={[]}
        formState={baseFormState}
        onSubmit={() => {}}
        onSaveAsTemplate={() => {}}
        onClose={() => {}}
        dispatching={false}
        dispatchAcknowledged={false}
      />,
    );

    const submit = submitButton();
    expect(submit).toBeDisabled();
    expect(screen.getByText(HINT)).toBeInTheDocument();
    expect(submit.getAttribute("title") ?? "").toMatch(/dispatch/i);
    expect(submit.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("allows submit once dispatch is acknowledged", () => {
    render(
      <MissionComposerActions
        editingId={null}
        missions={[]}
        formState={baseFormState}
        onSubmit={() => {}}
        onSaveAsTemplate={() => {}}
        onClose={() => {}}
        dispatching={false}
        dispatchAcknowledged={true}
      />,
    );

    expect(submitButton()).not.toBeDisabled();
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });
});

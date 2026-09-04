/**
 * @jest-environment jsdom
 */

// T-0092, findings B and C from this device's browser pass. B: the Goals
// placeholder carried newlines that rendered as three goals run together
// while the hint underneath said "one per line". C: the dispatch-mode
// selector sat below the fold, so the visible footer button said "Save
// draft" on what the person believed was a dispatch; the mode is a decision
// the person makes early, and it belongs where they can see it.

import { render, screen } from "@testing-library/react";
import { useState } from "react";
import MissionCreateForm, { type MissionFormState } from "@/components/missions/MissionCreateForm";

const baseFormState: MissionFormState = {
  newName: "",
  newInstruction: "",
  newContext: "",
  newGoals: "",
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
  newOutputFormat: "",
  newConstraints: "",
  newToolsets: [],
};

function Harness() {
  const [formState, setFormState] = useState<MissionFormState>(baseFormState);
  const setFormField = <K extends keyof MissionFormState>(field: K, value: MissionFormState[K]) =>
    setFormState((s) => ({ ...s, [field]: value }));
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
      dispatchAcknowledged={false}
      onDispatchOpenChange={() => {}}
    />
  );
}

describe("the Goals field", () => {
  it("has a one-line placeholder that agrees with its hint", () => {
    render(<Harness />);
    const hint = screen.getByText(/One goal per line/i);
    const goals = hint.parentElement!.querySelector("textarea")!;

    // Exact, so a missing attribute cannot pass vacuously (found by mutation).
    expect(goals.getAttribute("placeholder")).toBe("e.g. Gather data");
  });
});

describe("the dispatch mode comes before the long tail", () => {
  it("renders the Dispatch section above Mission parameters", () => {
    render(<Harness />);
    const dispatch = screen.getByRole("button", { name: /When and how this mission runs/ });
    const parameters = screen.getByRole("button", { name: /Directories, references, skills/ });

    // DOCUMENT_POSITION_FOLLOWING (4): `parameters` comes after `dispatch`.
    expect(dispatch.compareDocumentPosition(parameters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

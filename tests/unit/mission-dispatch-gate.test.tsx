/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { MissionComposerActions } from "@/components/missions/MissionCreateForm";
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

describe("MissionComposerActions dispatch gate", () => {
  it("disables submit for new missions until dispatch acknowledged", () => {
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
    expect(
      screen.getByRole("button", { name: /save draft/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/to choose how this mission runs before submitting/i),
    ).toBeInTheDocument();
  });

  it("allows submit when dispatch acknowledged", () => {
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
    expect(
      screen.getByRole("button", { name: /save draft/i }),
    ).not.toBeDisabled();
  });
});

/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => ({
  Send: () => "S",
  Save: () => "Sv",
}));

import {
  DISPATCH_MODES,
  dispatchSubmitLabel,
  MissionComposerActions,
} from "@/components/missions/MissionCreateForm";
import type { MissionFormState } from "@/components/missions/MissionCreateForm";

const baseFormState: MissionFormState = {
  newName: "Test",
  newInstruction: "Do work",
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

describe("dispatch modes", () => {
  it("orders Save, Queue, Run now, Schedule", () => {
    expect(DISPATCH_MODES.map((m) => m.id)).toEqual([
      "save",
      "queue",
      "now",
      "cron",
    ]);
  });

  it("maps footer labels per mode", () => {
    expect(dispatchSubmitLabel("save")).toBe("Save draft");
    expect(dispatchSubmitLabel("queue")).toBe("Queue mission");
    expect(dispatchSubmitLabel("now")).toBe("Dispatch now");
    expect(dispatchSubmitLabel("cron")).toBe("Schedule mission");
  });

  it("maps draft edit labels from dispatch choice", () => {
    expect(
      dispatchSubmitLabel("now", { isDraftEdit: true }),
    ).toBe("Dispatch now");
    expect(
      dispatchSubmitLabel("queue", { isDraftEdit: true }),
    ).toBe("Queue mission");
  });

  it("maps running edit to Update Mission", () => {
    expect(
      dispatchSubmitLabel("now", { isRunningEdit: true }),
    ).toBe("Update Mission");
  });

  it("maps queued-waiting edit labels", () => {
    expect(
      dispatchSubmitLabel("save", { isQueuedEdit: true }),
    ).toBe("Move to drafts");
    expect(
      dispatchSubmitLabel("now", { isQueuedEdit: true }),
    ).toBe("Dispatch now");
  });
});

/**
 * Edit-context helper — exercises the resolveEditContext() private helper
 * (defined in MissionCreateForm.tsx) indirectly through the public
 * `dispatchSubmitLabel` surface. The pre-refactor MissionComposerActions
 * computed the same 4 booleans (`isReDispatch` / `isRunningEdit` /
 * `isDraftEdit` / `isQueuedEdit`) inline. After the refactor, both
 * `MissionComposerActions` and the default-exported `MissionCreateForm`
 * share the helper — these tests lock the public-label surface so a
 * future change to the helper is flagged if it diverges.
 */
describe("edit-context resolution (via dispatchSubmitLabel)", () => {
  it("isReDispatch wins over all other context flags", () => {
    expect(
      dispatchSubmitLabel("save", { isReDispatch: true }),
    ).toBe("Re-Dispatch Now");
    expect(
      dispatchSubmitLabel("save", {
        isReDispatch: true,
        isRunningEdit: true,
        isDraftEdit: true,
        isQueuedEdit: true,
      }),
    ).toBe("Re-Dispatch Now");
  });

  it("isRunningEdit wins over draft/queued context flags", () => {
    expect(
      dispatchSubmitLabel("now", {
        isRunningEdit: true,
        isDraftEdit: true,
        isQueuedEdit: true,
      }),
    ).toBe("Update Mission");
  });

  it("isQueuedEdit is ignored when isDraftEdit is also set (precedence: draft first, byte-equivalent)", () => {
    // The pre-refactor code checked isDraftEdit BEFORE isQueuedEdit, so if
    // both flags are true, the draft branch wins and returns the default
    // label. The post-refactor preserves this precedence. (The two flags
    // are by-construction mutually exclusive — a mission is either a
    // plain-queued draft OR a queued-for-run mission, never both — so this
    // case never fires in practice; the precedence is preserved to keep
    // the helper's contract 1:1 with the pre-refactor inline code.)
    expect(
      dispatchSubmitLabel("now", { isQueuedEdit: true, isDraftEdit: true }),
    ).toBe("Dispatch now");
    expect(
      dispatchSubmitLabel("save", { isQueuedEdit: true, isDraftEdit: true }),
    ).toBe("Save draft");
  });
});

describe("MissionComposerActions", () => {
  it("shows Save draft when dispatch mode is save", () => {
    render(
      <MissionComposerActions
        editingId={null}
        missions={[]}
        formState={{ ...baseFormState, newDispatch: "save" }}
        onSubmit={jest.fn()}
        onSaveAsTemplate={jest.fn()}
        onClose={jest.fn()}
        dispatching={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Save draft/i }),
    ).toBeInTheDocument();
  });
});

/**
 * @jest-environment jsdom
 */

// T-0092, finding A from this device's browser pass: the New Mission sheet
// says "Enter a Mission Name before submitting." before anyone has typed a
// character. A requirement stated before the person has done anything reads
// as a scolding, and the same text was the strict-mode ambiguity behind the
// standing Playwright failure. The button stays disabled and keeps its title;
// the sentence waits until the person has started.

import { render, screen } from "@testing-library/react";

jest.mock("lucide-react", () => new Proxy({}, { get: () => (props: Record<string, unknown>) => <svg {...props} /> }));

import { MissionComposerActions, type MissionFormState } from "@/components/missions/MissionCreateForm";

const empty = {
  newName: "",
  newInstruction: "",
  newDispatch: "save",
} as unknown as MissionFormState;

function renderActions(formState: MissionFormState) {
  return render(
    <MissionComposerActions
      editingId={null}
      missions={[]}
      formState={formState}
      onSubmit={jest.fn()}
      onSaveAsTemplate={jest.fn()}
      onClose={jest.fn()}
      dispatching={false}
    />,
  );
}

describe("the submit requirement waits for the person", () => {
  it("says nothing before anything has been typed, and the button is disabled with its reason", () => {
    renderActions(empty);

    expect(screen.queryByText(/Enter a Mission Name/i)).toBeNull();
    const button = screen.getByRole("button", { name: /Save draft/i });
    expect(button).toBeDisabled();
    expect(button.getAttribute("title")).toMatch(/Mission Name/i);
  });

  it("names the missing field once the person has started", () => {
    renderActions({ ...empty, newInstruction: "Do the thing" } as MissionFormState);

    expect(screen.getByText(/Enter a Mission Name/i)).toBeInTheDocument();
  });

  it("names the missing instruction once a name is in", () => {
    renderActions({ ...empty, newName: "Nightly report" } as MissionFormState);

    expect(screen.getByText(/Enter an instruction/i)).toBeInTheDocument();
  });
});

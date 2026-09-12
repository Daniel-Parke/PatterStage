/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * B10 oracle, the category manager's own half (T-0104, D71).
 *
 * The sweep asked for this. b10-category-write-failures pins the hook: both
 * writes answer whether they landed, and nothing reloads over a refusal. What
 * it does not render is the modal, so a modal that closes the editor anyway
 * walked through it, and closing the editor is where the operator's typed name
 * is lost.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

import CategoryManagerModal, {
  type ManagedCategory,
} from "@/components/missions/CategoryManagerModal";

const CATEGORIES: ManagedCategory[] = [
  { id: "ops", name: "Ops", color: "cyan", missionCount: 2 } as unknown as ManagedCategory,
  { id: "eng", name: "Engineering", color: "purple", missionCount: 0 } as unknown as ManagedCategory,
];

function renderModal(over: Partial<React.ComponentProps<typeof CategoryManagerModal>> = {}) {
  const props = {
    open: true,
    onClose: jest.fn(),
    categories: CATEGORIES,
    onRefresh: jest.fn(),
    onCreateCategory: jest.fn(async () => null),
    onUpdate: jest.fn(async () => true),
    onDelete: jest.fn(async () => true),
    ...over,
  };
  render(<CategoryManagerModal {...props} />);
  return props;
}

/** Open the inline rename editor on the "Ops" row and type a new name. */
async function typeARename(name: string): Promise<HTMLInputElement> {
  fireEvent.click(screen.getByRole("button", { name: "Rename category Ops" }));
  const input = (await screen.findByDisplayValue("Ops")) as HTMLInputElement;
  fireEvent.change(input, { target: { value: name } });
  return input;
}

describe("a rename the server refused", () => {
  it("leaves the editor open with the typed name still in it", async () => {
    const props = renderModal({ onUpdate: jest.fn(async () => false) });
    await typeARename("Operations");

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(props.onUpdate).toHaveBeenCalled());
    // The whole difference between a silent no-op and a failure: the text is
    // still there to retry with.
    expect(await screen.findByDisplayValue("Operations")).toBeInTheDocument();
    expect(props.onRefresh).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: a rename that landed closes the editor and refreshes", async () => {
    const props = renderModal({ onUpdate: jest.fn(async () => true) });
    await typeARename("Operations");

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => expect(props.onRefresh).toHaveBeenCalled());
    expect(screen.queryByDisplayValue("Operations")).toBeNull();
  });
});

describe("a delete the server refused", () => {
  /** Arm the delete panel on the "Ops" row. */
  function openDeletePanel() {
    fireEvent.click(screen.getByRole("button", { name: "Delete category Ops" }));
    return screen.getByLabelText("Reassign missions to category") as HTMLSelectElement;
  }

  it("leaves the panel open, with the reassign choice still made", async () => {
    const props = renderModal({ onDelete: jest.fn(async () => false) });
    const select = openDeletePanel();
    fireEvent.change(select, { target: { value: "eng" } });

    fireEvent.click(screen.getByRole("button", { name: /Delete category$/i }));

    await waitFor(() => expect(props.onDelete).toHaveBeenCalledWith("ops", "eng"));
    expect(screen.getByLabelText("Reassign missions to category")).toHaveValue("eng");
    expect(props.onRefresh).not.toHaveBeenCalled();
  });

  it("sends Uncategorized as null, which is the choice that used to 400", async () => {
    const props = renderModal({ onDelete: jest.fn(async () => true) });
    openDeletePanel();

    fireEvent.click(screen.getByRole("button", { name: /Delete category$/i }));

    await waitFor(() => expect(props.onDelete).toHaveBeenCalledWith("ops", null));
  });

  it("GREEN CONTROL: a delete that landed closes the panel and refreshes", async () => {
    const props = renderModal({ onDelete: jest.fn(async () => true) });
    openDeletePanel();

    fireEvent.click(screen.getByRole("button", { name: /Delete category$/i }));

    await waitFor(() => expect(props.onRefresh).toHaveBeenCalled());
    expect(screen.queryByLabelText("Reassign missions to category")).toBeNull();
  });
});

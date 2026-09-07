/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U11 (T-0125): the Picker, one component for five Selectors.
 *
 * Five selectors in ui/ - Profile, Skill, Toolset, Timeout, MissionTime -
 * spelled the same trigger, the same menu and the same click-outside effect
 * five times over 684 lines, and none was keyboard-accessible: the menu was
 * a stack of plain buttons with no listbox role, no arrow keys, no Escape
 * (T-0122 built useDismissable for exactly this and deferred the component
 * until a screen needed it; the Agent group is that screen).
 *
 * What these pin is the shape assistive technology already knows: a trigger
 * that says it opens a listbox, a listbox of options with one selected, arrows
 * that move and Enter that chooses, Escape that closes and hands focus back,
 * and - for the two multi-selects - chips that each carry their own named
 * remove control, a search that filters the options, and a ceiling.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

import Picker from "@/components/ui/Picker";

const OPTIONS = [
  { value: "default", label: "Bob", hint: "The root agent" },
  { value: "qa", label: "QA Engineer" },
  { value: "writer", label: "Writer", disabled: true },
  { value: "ops", label: "Ops" },
];

function Single({ initial = "default", onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <button type="button">before</button>
      <Picker
        label="Profile"
        options={OPTIONS}
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
      />
    </>
  );
}

function Multi({ max, searchable = true }: { max?: number; searchable?: boolean }) {
  const [value, setValue] = useState<string[]>([]);
  return (
    <Picker
      label="Skills"
      multiple
      searchable={searchable}
      max={max}
      options={OPTIONS}
      value={value}
      onChange={setValue}
      placeholder="Attach skills"
    />
  );
}

const trigger = (name: string) => screen.getByRole("button", { name });
const listbox = () => screen.getByRole("listbox");
const options = () => within(listbox()).getAllByRole("option");
const activeOption = (): HTMLElement | null => {
  const focused = document.activeElement as HTMLElement | null;
  const id = focused?.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
};

describe("a single-select picker is a listbox", () => {
  it("the trigger names itself, says it opens a listbox, and shows the chosen label", () => {
    render(<Single />);
    const t = trigger("Profile");
    expect(t).toHaveAttribute("aria-haspopup", "listbox");
    expect(t).toHaveAttribute("aria-expanded", "false");
    expect(t).toHaveTextContent("Bob");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens to options with the chosen one selected, and a hint beside a label that has one", () => {
    render(<Single />);
    fireEvent.click(trigger("Profile"));
    expect(trigger("Profile")).toHaveAttribute("aria-expanded", "true");
    expect(options()).toHaveLength(4);
    expect(within(listbox()).getByRole("option", { name: /Bob/ })).toHaveAttribute("aria-selected", "true");
    expect(within(listbox()).getByRole("option", { name: /QA Engineer/ })).toHaveAttribute("aria-selected", "false");
    expect(within(listbox()).getByRole("option", { name: /Bob/ })).toHaveTextContent("The root agent");
  });

  it("a click chooses, closes, and reports the value", () => {
    const onChange = jest.fn();
    render(<Single onChange={onChange} />);
    fireEvent.click(trigger("Profile"));
    fireEvent.click(within(listbox()).getByRole("option", { name: /QA Engineer/ }));
    expect(onChange).toHaveBeenCalledWith("qa");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger("Profile")).toHaveTextContent("QA Engineer");
  });

  it("a disabled option is announced disabled and cannot be chosen", () => {
    const onChange = jest.fn();
    render(<Single onChange={onChange} />);
    fireEvent.click(trigger("Profile"));
    const writer = within(listbox()).getByRole("option", { name: /Writer/ });
    expect(writer).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(writer);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});

describe("the keyboard", () => {
  it("ArrowDown on the closed trigger opens it with the chosen option active", () => {
    render(<Single initial="qa" />);
    trigger("Profile").focus();
    fireEvent.keyDown(trigger("Profile"), { key: "ArrowDown" });
    expect(listbox()).toBeInTheDocument();
    expect(activeOption()).toHaveTextContent("QA Engineer");
  });

  it("arrows move the active option, skipping a disabled one, and wrap at the ends", () => {
    render(<Single />);
    trigger("Profile").focus();
    fireEvent.keyDown(trigger("Profile"), { key: "ArrowDown" });
    expect(activeOption()).toHaveTextContent("Bob");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(activeOption()).toHaveTextContent("QA Engineer");
    // Writer is disabled, so the next step lands on Ops.
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(activeOption()).toHaveTextContent("Ops");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(activeOption()).toHaveTextContent("Bob");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(activeOption()).toHaveTextContent("Ops");
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(activeOption()).toHaveTextContent("Bob");
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(activeOption()).toHaveTextContent("Ops");
  });

  it("Enter chooses the active option and returns focus to the trigger", () => {
    const onChange = jest.fn();
    render(<Single onChange={onChange} />);
    trigger("Profile").focus();
    fireEvent.keyDown(trigger("Profile"), { key: "ArrowDown" });
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("qa");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger("Profile"));
  });

  it("Escape closes without choosing and gives focus back to the trigger", () => {
    const onChange = jest.fn();
    render(<Single onChange={onChange} />);
    trigger("Profile").focus();
    fireEvent.keyDown(trigger("Profile"), { key: "ArrowDown" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger("Profile"));
  });

  it("a pointer down outside closes it", () => {
    render(<Single />);
    fireEvent.click(trigger("Profile"));
    fireEvent.pointerDown(screen.getByRole("button", { name: "before" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("a multi-select picker", () => {
  it("is announced multiselectable, keeps the list open across choices, and shows each choice as a chip with its own remove", () => {
    render(<Multi />);
    fireEvent.click(trigger("Skills"));
    expect(listbox()).toHaveAttribute("aria-multiselectable", "true");
    fireEvent.click(within(listbox()).getByRole("option", { name: /Bob/ }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.click(within(listbox()).getByRole("option", { name: /Ops/ }));
    expect(within(listbox()).getByRole("option", { name: /Bob/ })).toHaveAttribute("aria-selected", "true");
    const removeBob = screen.getByRole("button", { name: "Remove Bob" });
    expect(screen.getByRole("button", { name: "Remove Ops" })).toBeInTheDocument();
    fireEvent.click(removeBob);
    expect(screen.queryByRole("button", { name: "Remove Bob" })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove Ops" })).toBeInTheDocument();
  });

  it("the search box filters the options by label", () => {
    render(<Multi />);
    fireEvent.click(trigger("Skills"));
    const box = within(listbox().parentElement!).getByRole("searchbox");
    fireEvent.change(box, { target: { value: "qa" } });
    expect(options()).toHaveLength(1);
    expect(options()[0]).toHaveTextContent("QA Engineer");
    fireEvent.change(box, { target: { value: "" } });
    expect(options()).toHaveLength(4);
  });

  it("at the ceiling, the unchosen options are disabled and say so", () => {
    render(<Multi max={1} />);
    fireEvent.click(trigger("Skills"));
    fireEvent.click(within(listbox()).getByRole("option", { name: /Bob/ }));
    expect(within(listbox()).getByRole("option", { name: /QA Engineer/ })).toHaveAttribute("aria-disabled", "true");
    expect(within(listbox()).getByRole("option", { name: /Bob/ })).toHaveAttribute("aria-disabled", "false");
    fireEvent.click(within(listbox()).getByRole("option", { name: /QA Engineer/ }));
    expect(screen.queryByRole("button", { name: "Remove QA Engineer" })).toBeNull();
  });

  it("the trigger counts what is chosen rather than listing it", () => {
    render(<Multi />);
    expect(trigger("Skills")).toHaveTextContent("Attach skills");
    fireEvent.click(trigger("Skills"));
    fireEvent.click(within(listbox()).getByRole("option", { name: /Bob/ }));
    fireEvent.click(within(listbox()).getByRole("option", { name: /Ops/ }));
    expect(trigger("Skills")).toHaveTextContent("2 chosen");
  });
});

describe("the states a list can be in", () => {
  it("says it is loading, and says when there is nothing to choose from", () => {
    const { rerender } = render(<Picker label="Profile" options={[]} value="" onChange={() => {}} loading />);
    fireEvent.click(trigger("Profile"));
    expect(within(listbox()).getByText(/loading/i)).toBeInTheDocument();
    rerender(<Picker label="Profile" options={[]} value="" onChange={() => {}} emptyText="No profiles found" />);
    expect(within(listbox()).getByText("No profiles found")).toBeInTheDocument();
  });

  it("a disabled picker does not open", () => {
    render(<Picker label="Profile" options={OPTIONS} value="default" onChange={() => {}} disabled />);
    fireEvent.click(trigger("Profile"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

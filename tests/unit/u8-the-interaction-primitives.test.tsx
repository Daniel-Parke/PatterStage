/**
 * U8 (T-0122): the three interaction primitives, built and oracled, not adopted.
 *
 * ── useDismissable and Popover ────────────────────────────────
 *
 * Ten components in this tree open a panel and close it by listening for a
 * mousedown somewhere else. They are ~1,778 lines and they are the same
 * fourteen lines fourteen times, except that they are not quite: six of them
 * are a keyboard trap, and the reason is always one of three.
 *
 *   NO ESCAPE. `ProfileSelector`, `SkillSelector`, `ToolsetSelector`,
 *   `TimeoutSelector` and `MissionTimeSelector` open a menu that a mouse can
 *   dismiss and a keyboard cannot. There is no Escape handler at all, so a
 *   keyboard user who opens one has no way back out except Tab, through every
 *   option in the list.
 *
 *   NO FOCUS RETURN. Choosing an option unmounts the panel that focus was
 *   inside, so focus falls to `document.body` and the next Tab starts from the
 *   top of the page. The trigger the user was standing on is gone.
 *
 *   A LISTENER THAT NEVER SLEEPS. The effect has an empty dependency array, so
 *   the document-level mousedown listener is registered whether the panel is
 *   open or shut. Ten of those are attached on every page that mounts one.
 *
 * `useDismissable` owns all three, and it is deliberately NOT `useDialogA11y`:
 * a popover is not a modal. It does not trap Tab (tabbing out of a menu should
 * close it and move on, not cycle inside it forever), it does not lock body
 * scroll, and it does not make the page inert. What the two DO share is the
 * topmost-only rule, and for the same reason: one Escape must close one thing.
 *
 * ── SegmentedControl ──────────────────────────────────────────
 *
 * Thirteen filter groups render their state as colour and nothing else. A
 * sighted user sees which of "All / Running / Failed" is active because it is
 * cyan; a screen reader is read three buttons and told nothing about any of
 * them. That is not a styling gap, it is the state being absent from the
 * accessibility tree entirely.
 *
 * So: a real `radiogroup` with `aria-checked`, and a roving tabindex, which is
 * the part that is easy to get wrong. The group holds ONE tab stop, not one
 * per option, and the arrow keys move within it. Thirteen groups today put
 * every option in the tab order, so tabbing across the missions filter bar
 * costs eleven keystrokes before reaching the board.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";

import { useDismissable } from "@/hooks/useDismissable";
import Popover from "@/components/ui/Popover";
import SegmentedControl from "@/components/ui/SegmentedControl";

// ── useDismissable ────────────────────────────────────────────

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const closed = useRef(0);
  const close = () => {
    closed.current += 1;
    setOpen(false);
    onClose?.();
  };
  const ref = useDismissable<HTMLDivElement>({ open, onClose: close });
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      <div ref={ref} data-testid="container">
        {open && (
          <div data-testid="panel">
            <button type="button">inside</button>
          </div>
        )}
      </div>
      <button type="button">outside</button>
    </div>
  );
}

describe("useDismissable closes a panel the three ways a panel closes", () => {
  const open = () => fireEvent.click(screen.getByText("open"));

  it("closes on a pointer down outside the container", () => {
    render(<Harness />);
    open();
    expect(screen.getByTestId("panel")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText("outside"));
    expect(screen.queryByTestId("panel")).not.toBeInTheDocument();
  });

  it("stays open for a pointer down INSIDE it", () => {
    render(<Harness />);
    open();
    fireEvent.pointerDown(screen.getByText("inside"));
    expect(screen.getByTestId("panel")).toBeInTheDocument();
  });

  /** The half the ten hand-rolled sites are missing. */
  it("closes on Escape", () => {
    render(<Harness />);
    open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("panel")).not.toBeInTheDocument();
  });

  it("returns focus to whatever had it, so the next Tab carries on from there", () => {
    render(<Harness />);
    const trigger = screen.getByText("open");
    trigger.focus();
    fireEvent.click(trigger);
    screen.getByText("inside").focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
  });

  /**
   * Focus is only RESTORED when it was inside the panel. A user who clicked
   * elsewhere on the page has already chosen where they are; yanking them back
   * to the trigger of a menu they just dismissed is the bug, not the fix.
   */
  it("leaves focus alone when it was never inside the panel", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("open"));
    const elsewhere = screen.getByText("outside");
    elsewhere.focus();
    fireEvent.pointerDown(elsewhere);
    expect(document.activeElement).toBe(elsewhere);
  });

  it("registers nothing while the panel is shut", () => {
    const add = jest.spyOn(document, "addEventListener");
    render(<Harness />);
    const before = add.mock.calls.filter(([type]) => type === "pointerdown").length;
    expect(before).toBe(0);
    fireEvent.click(screen.getByText("open"));
    const after = add.mock.calls.filter(([type]) => type === "pointerdown").length;
    expect(after).toBe(1);
    add.mockRestore();
  });

  /** One Escape closes ONE thing: the innermost. */
  it("gives Escape to the innermost panel only", () => {
    const outerClosed = jest.fn();
    const innerClosed = jest.fn();
    render(
      <>
        <Harness onClose={outerClosed} />
        <Harness onClose={innerClosed} />
      </>,
    );
    const [firstOpen, secondOpen] = screen.getAllByText("open");
    fireEvent.click(firstOpen);
    fireEvent.click(secondOpen);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(innerClosed).toHaveBeenCalledTimes(1);
    expect(outerClosed).not.toHaveBeenCalled();
  });
});

// ── Popover ───────────────────────────────────────────────────

function PopoverHarness() {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button type="button" onClick={() => setOpen((v) => !v)}>
          menu
        </button>
      }
    >
      <button type="button">option</button>
    </Popover>
  );
}

describe("Popover is that hook plus the chrome, once", () => {
  it("shows nothing until it is opened", () => {
    render(<PopoverHarness />);
    expect(screen.queryByText("option")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("menu"));
    expect(screen.getByText("option")).toBeInTheDocument();
  });

  it("keeps the trigger and the panel in one dismissable region", () => {
    render(<PopoverHarness />);
    fireEvent.click(screen.getByText("menu"));
    // A pointer down on the trigger must NOT be read as "outside", or the
    // toggle would close and reopen on one click and never appear to work.
    fireEvent.pointerDown(screen.getByText("menu"));
    expect(screen.getByText("option")).toBeInTheDocument();
  });

  it("closes on Escape, like everything else that opens", () => {
    render(<PopoverHarness />);
    fireEvent.click(screen.getByText("menu"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("option")).not.toBeInTheDocument();
  });
});

// ── SegmentedControl ──────────────────────────────────────────

const OPTIONS = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "failed", label: "Failed" },
];

function SegmentedHarness({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState("all");
  return (
    <SegmentedControl
      label="Status"
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe("SegmentedControl puts the state in the accessibility tree", () => {
  it("is a named group of radios, not three anonymous buttons", () => {
    render(<SegmentedHarness />);
    expect(screen.getByRole("radiogroup", { name: "Status" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("says which one is chosen", () => {
    render(<SegmentedHarness />);
    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Running" })).not.toBeChecked();
  });

  /**
   * The roving tabindex. One tab stop for the group, on the CHOSEN option -
   * not on the first, or Tab would land somewhere the user is not.
   */
  it("holds exactly one tab stop, and it is the chosen option", () => {
    render(<SegmentedHarness />);
    const stops = screen.getAllByRole("radio").filter((el) => el.tabIndex === 0);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAccessibleName("All");
  });

  it.each([
    ["ArrowRight", "Running"],
    ["ArrowDown", "Running"],
    ["ArrowLeft", "Failed"],
    ["ArrowUp", "Failed"],
    ["End", "Failed"],
  ])("moves and selects on %s", (key, expected) => {
    const onChange = jest.fn();
    render(<SegmentedHarness onChange={onChange} />);
    const first = screen.getByRole("radio", { name: "All" });
    first.focus();
    fireEvent.keyDown(first, { key });
    expect(screen.getByRole("radio", { name: expected })).toBeChecked();
    expect(document.activeElement).toHaveAccessibleName(expected);
  });

  it("wraps at both ends rather than stopping", () => {
    render(<SegmentedHarness />);
    const first = screen.getByRole("radio", { name: "All" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowLeft" });
    expect(screen.getByRole("radio", { name: "Failed" })).toBeChecked();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
  });

  it("still answers a click", () => {
    const onChange = jest.fn();
    render(<SegmentedHarness onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Failed" }));
    expect(onChange).toHaveBeenCalledWith("failed");
    expect(screen.getByRole("radio", { name: "Failed" })).toBeChecked();
  });
});

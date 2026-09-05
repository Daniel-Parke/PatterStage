/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B6 oracle, group config-ui, part 2 of 2 (T-0100, D77 + D78 UI halves).
//
// Written before the product code moved. Contract section 3, the UI halves:
//
//   (A) NumberInput holds a raw string, emits the number on every valid
//       keystroke (field-kit's onChange(45) pin stays green), emits null for
//       an emptied control, never emits 0 or NaN for a stray "-", clamps to
//       [min, max] on blur, shows "Range: <min>–<max>", and marks an
//       out-of-range value aria-invalid with the problem message;
//   (B) ConfigField renders undefined/null as an explicit unset: the "Not set"
//       pill, "Hermes uses its own default", a neutral control, no Clear;
//       a set value gets a "Clear <label>" button that calls
//       onUpdate(key, null); an emptied number or text emits null, never 0 or
//       ''; a select whose value is outside its options says so, and a wrong
//       type on a toggle or number says "not a <type>" beside the label;
//   (C) the agent section page: Max Turns 9999 before blur has Save disabled
//       with the problem in its title and enabled at 300; Clear enables Save
//       and after Save the field is Not set and the key has left state; a
//       save sends only the keys whose JSON differs from what was loaded, so
//       a foreign out-of-options value on disk never blocks an unrelated save.
//
// jsdom note: a type="number" control sanitises "-" to "" before React sees
// it (the HTML value-sanitisation algorithm, which browsers apply too), so
// the strict "emits nothing" for "-" is unobservable here. The observable
// half is pinned: no 0 and no NaN ever reach onChange for it.
//
// Type-tolerance: `npm run lint` type-checks tests/ (tsconfig.tests.json).
// NumberInput's `value: number | null` and `onChange(null)` are the shapes
// B6 adds; they are read through `LooseNumberProps` and one cast. Once B6
// lands, strip the alias so the file re-tightens to the real props.
// ═══════════════════════════════════════════════════════════════

import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { NumberInput } from "@/components/ui/Input";
import ConfigField from "@/components/config/ConfigField";
import { CONFIG_SECTIONS } from "@/lib/config-schema";

const mockUseParams = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  usePathname: () => "/agent/settings/agent",
  useSearchParams: () => new URLSearchParams(),
  notFound: jest.fn(),
}));

const mockApiFetch = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  setErrorFromCaught: (setError: (m: string) => void, err: unknown, fallback: string) => {
    const msg = err instanceof Error ? err.message : fallback;
    setError(msg);
    return msg;
  },
}));

import ConfigSectionPage from "@/app/agent/settings/[section]/page";

// ── pre-B6 type shims (see header) ──────────────────────────────

type NumberProps = React.ComponentProps<typeof NumberInput>;
/** NumberInput's props with the nullable value and the null emission B6 adds. */
type LooseNumberProps = Omit<NumberProps, "value" | "onChange"> & {
  value: number | null;
  onChange: (v: number | null) => void;
};
const LooseNumberInput = NumberInput as unknown as React.ComponentType<LooseNumberProps>;

const AGENT = CONFIG_SECTIONS.agent;
const DISPLAY = CONFIG_SECTIONS.display;
const fieldOf = (sectionId: "agent" | "display" | "memory", key: string) => {
  const f = CONFIG_SECTIONS[sectionId].fields.find((x) => x.key === key);
  if (!f) throw new Error(`no field ${sectionId}.${key}`);
  return f;
};

/** A parent that keeps NumberInput's value in step, as the section page does. */
function NumberHarness({
  initial,
  onChange,
  min = 1,
  max = 500,
  label = "Max Turns",
}: {
  initial: number | null;
  onChange: jest.Mock;
  min?: number;
  max?: number;
  label?: string;
}) {
  const [v, setV] = useState<number | null>(initial);
  return (
    <LooseNumberInput
      label={label}
      value={v}
      min={min}
      max={max}
      onChange={(n) => {
        onChange(n);
        setV(n);
      }}
    />
  );
}

/** A parent that keeps ConfigField's value in step, as the section page does. */
function FieldHarness({
  field,
  sectionDef,
  initial,
  onUpdate,
}: {
  field: (typeof AGENT.fields)[number];
  sectionDef: typeof AGENT;
  initial: unknown;
  onUpdate: jest.Mock;
}) {
  const [v, setV] = useState<unknown>(initial);
  return (
    <ConfigField
      field={field}
      value={v}
      sectionDef={sectionDef}
      onUpdate={(k, val) => {
        onUpdate(k, val);
        setV(val);
      }}
    />
  );
}

beforeEach(() => {
  mockUseParams.mockReset();
  mockReplace.mockReset();
  mockApiFetch.mockReset();
});

// ═══════════════════════════════════════════════════════════════
// (A) NumberInput
// ═══════════════════════════════════════════════════════════════

describe("NumberInput: keystrokes, blur and the range", () => {
  it("GREEN CONTROL: a valid keystroke still emits the number at once (field-kit pin)", () => {
    const onChange = jest.fn();
    render(<NumberInput label="Timeout" value={30} onChange={onChange} min={1} max={120} />);
    fireEvent.change(screen.getByDisplayValue("30"), { target: { value: "45" } });
    expect(onChange).toHaveBeenCalledWith(45);
  });

  it("typing 9999 then blurring clamps to the max and emits onChange(500)", () => {
    const onChange = jest.fn();
    render(<NumberHarness initial={40} onChange={onChange} />);
    const input = screen.getByDisplayValue("40");

    fireEvent.change(input, { target: { value: "9999" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith(500);
    expect((input as HTMLInputElement).value).toBe("500");
  });

  it("typing 0 then blurring clamps to the min and emits onChange(1)", () => {
    const onChange = jest.fn();
    render(<NumberHarness initial={40} onChange={onChange} />);
    const input = screen.getByDisplayValue("40");

    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("GREEN CONTROL: a value inside the range is emitted as typed and left alone by blur", () => {
    const onChange = jest.fn();
    render(<NumberHarness initial={40} onChange={onChange} />);
    const input = screen.getByDisplayValue("40");

    fireEvent.change(input, { target: { value: "300" } });
    expect(onChange).toHaveBeenLastCalledWith(300);
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(300);
    expect(onChange.mock.calls.every(([v]) => v === 300)).toBe(true);
  });

  it("clearing the control emits onChange(null), never 0", () => {
    const onChange = jest.fn();
    render(<NumberHarness initial={40} onChange={onChange} />);
    const input = screen.getByDisplayValue("40");

    fireEvent.change(input, { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(null);
    expect(onChange).not.toHaveBeenCalledWith(0);
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("a stray '-' never reaches onChange as 0 or NaN", () => {
    const onChange = jest.fn();
    render(<NumberHarness initial={40} onChange={onChange} />);
    const input = screen.getByDisplayValue("40");

    fireEvent.change(input, { target: { value: "-" } });

    expect(onChange).not.toHaveBeenCalledWith(0);
    expect(onChange.mock.calls.some(([v]) => typeof v === "number" && !Number.isFinite(v))).toBe(false);
  });

  it("shows the range as helper text", () => {
    render(<NumberHarness initial={40} onChange={jest.fn()} />);
    expect(screen.getByText("Range: 1–500")).toBeInTheDocument();
  });

  it("an out-of-range value is aria-invalid and names the problem until blur clamps it", () => {
    const onChange = jest.fn();
    render(<NumberHarness initial={40} onChange={onChange} />);
    const input = screen.getByDisplayValue("40");

    fireEvent.change(input, { target: { value: "9999" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Max Turns must be between 1 and 500/)).toBeInTheDocument();

    fireEvent.blur(input);
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(/must be between 1 and 500/)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// (B) ConfigField
// ═══════════════════════════════════════════════════════════════

describe("ConfigField: an unset value is said, not coerced", () => {
  it("boolean undefined: switch unchecked, Not set pill, the default helper, no Clear", () => {
    const onUpdate = jest.fn();
    render(<ConfigField field={fieldOf("display", "show_cost")} value={undefined} sectionDef={DISPLAY} onUpdate={onUpdate} />);

    expect(screen.getByRole("switch", { name: /^Show Cost/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getByText("Hermes uses its own default")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear Show Cost" })).toBeNull();
  });

  it("boolean false: unchecked, no pill, and Clear Show Cost calls onUpdate('show_cost', null)", () => {
    const onUpdate = jest.fn();
    render(<ConfigField field={fieldOf("display", "show_cost")} value={false} sectionDef={DISPLAY} onUpdate={onUpdate} />);

    expect(screen.getByRole("switch", { name: /^Show Cost/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText("Not set")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear Show Cost" }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith("show_cost", null);
  });

  it("boolean null reads as unset too (the value a Clear leaves behind)", () => {
    render(<ConfigField field={fieldOf("display", "show_cost")} value={null} sectionDef={DISPLAY} onUpdate={jest.fn()} />);
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear Show Cost" })).toBeNull();
  });

  it("number undefined: an empty input and the Not set pill", () => {
    const { container } = render(
      <ConfigField field={fieldOf("agent", "max_turns")} value={undefined} sectionDef={AGENT} onUpdate={jest.fn()} />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("");
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear Max Turns" })).toBeNull();
  });

  it("clearing a number that held 40 calls onUpdate(key, null), never onUpdate(key, 0)", () => {
    const onUpdate = jest.fn();
    render(<FieldHarness field={fieldOf("agent", "max_turns")} sectionDef={AGENT} initial={40} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByDisplayValue("40"), { target: { value: "" } });

    expect(onUpdate).toHaveBeenCalledWith("max_turns", null);
    expect(onUpdate).not.toHaveBeenCalledWith("max_turns", 0);
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("a set number carries Clear Max Turns, which calls onUpdate('max_turns', null)", () => {
    const onUpdate = jest.fn();
    render(<ConfigField field={fieldOf("agent", "max_turns")} value={40} sectionDef={AGENT} onUpdate={onUpdate} />);
    expect(screen.queryByText("Not set")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear Max Turns" }));
    expect(onUpdate).toHaveBeenCalledWith("max_turns", null);
    expect(onUpdate).not.toHaveBeenCalledWith("max_turns", undefined);
  });

  it("select undefined: the trigger reads Select… with the pill; choosing high drops the pill and shows Clear", () => {
    const onUpdate = jest.fn();
    render(
      <FieldHarness field={fieldOf("agent", "reasoning_effort")} sectionDef={AGENT} initial={undefined} onUpdate={onUpdate} />,
    );

    const trigger = screen.getByRole("button", { name: "Reasoning Effort" });
    expect(trigger).toHaveTextContent("Select…");
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear Reasoning Effort" })).toBeNull();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "high" }));

    expect(onUpdate).toHaveBeenCalledWith("reasoning_effort", "high");
    expect(trigger).toHaveTextContent("high");
    expect(screen.queryByText("Not set")).toBeNull();
    expect(screen.getByRole("button", { name: "Clear Reasoning Effort" })).toBeInTheDocument();
  });

  it("text undefined: empty input with placeholder Not set and the pill; emptying a text emits null, not ''", () => {
    const onUpdate = jest.fn();
    const { unmount } = render(
      <ConfigField field={fieldOf("display", "skin")} value={undefined} sectionDef={DISPLAY} onUpdate={onUpdate} />,
    );
    expect(screen.getByPlaceholderText("Not set")).toHaveValue("");
    expect(screen.getByText("Not set")).toBeInTheDocument();
    unmount();

    render(<FieldHarness field={fieldOf("display", "skin")} sectionDef={DISPLAY} initial="mono" onUpdate={onUpdate} />);
    fireEvent.change(screen.getByDisplayValue("mono"), { target: { value: "" } });
    expect(onUpdate).toHaveBeenCalledWith("skin", null);
    expect(onUpdate).not.toHaveBeenCalledWith("skin", "");
  });
});

describe("ConfigField: a field another surface owns is shown, not offered", () => {
  // Sweep survivor `managed-field-renders-a-control` (T-0101). The schema
  // declares who manages memory.provider and the PUT refuses it, and nothing
  // proved the page stopped drawing an editable control for it.
  const managed = fieldOf("memory", "provider");

  it("renders the value read-only, with no control and no Clear", () => {
    const onUpdate = jest.fn();
    render(
      <ConfigField
        field={managed}
        value="hindsight"
        sectionDef={CONFIG_SECTIONS.memory}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByText("hindsight")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear Provider" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Provider" })).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("says where it IS set, and links there", () => {
    render(
      <ConfigField
        field={managed}
        value="hindsight"
        sectionDef={CONFIG_SECTIONS.memory}
        onUpdate={jest.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: "Memory" });
    expect(link).toHaveAttribute("href", "/agent/memory");
    expect(screen.getByText(/Set this on the/)).toBeInTheDocument();
  });

  it("an unset managed field says Not set rather than nothing", () => {
    render(
      <ConfigField
        field={managed}
        value={undefined}
        sectionDef={CONFIG_SECTIONS.memory}
        onUpdate={jest.fn()}
      />,
    );

    expect(screen.getByText("Not set")).toBeInTheDocument();
  });
});

describe("ConfigField: a value the schema does not expect is shown, not hidden", () => {
  it("a select value outside its options is named beside the options", () => {
    render(
      <ConfigField field={fieldOf("agent", "reasoning_effort")} value="minimal" sectionDef={AGENT} onUpdate={jest.fn()} />,
    );
    expect(
      screen.getByText("Current value 'minimal' is not one of: none, low, medium, high, xhigh"),
    ).toBeInTheDocument();
    // The options themselves are unchanged: no synthetic "minimal" entry.
    fireEvent.click(screen.getByRole("button", { name: "Reasoning Effort" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["none", "low", "medium", "high", "xhigh"]);
  });

  it("a toggle holding a string says not a boolean, and does not render as on", () => {
    render(<ConfigField field={fieldOf("agent", "verbose")} value="yes" sectionDef={AGENT} onUpdate={jest.fn()} />);
    expect(screen.getByText(/not a boolean/)).toBeInTheDocument();
    // Sweep survivor `field-toggle-coerces`: Boolean("yes") is true, so the
    // switch would read ON beside a line saying the value is not a boolean.
    expect(screen.getByRole("switch", { name: /^Verbose Mode/ })).toHaveAttribute("aria-checked", "false");
  });

  it("a number holding a string says not a number", () => {
    render(<ConfigField field={fieldOf("agent", "max_turns")} value="12" sectionDef={AGENT} onUpdate={jest.fn()} />);
    expect(screen.getByText(/not a number/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// (C) the agent section page
// ═══════════════════════════════════════════════════════════════

const saveButton = () => screen.getByRole("button", { name: /^Save/ });

/** Every PUT /api/config body the page sent, parsed. */
function putBodies(): Array<{ section: string; values: Record<string, unknown> }> {
  return mockApiFetch.mock.calls
    .filter(([path, init]) => path === "/api/config" && (init as { method?: string } | undefined)?.method === "PUT")
    .map(([, init]) => JSON.parse((init as { body: string }).body));
}

async function renderAgentPage(agent: Record<string, unknown>) {
  mockUseParams.mockReturnValue({ section: "agent" });
  mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === "/api/config" && init?.method === "PUT") return { data: { success: true } };
    return { data: { agent } };
  });
  render(<ConfigSectionPage />);
  await screen.findByText("Agent Settings");
  await waitFor(() => expect(screen.queryByText(/Loading Agent Settings/)).toBeNull());
}

describe("the agent section page: Save follows the range", () => {
  it("Max Turns 9999 before blur: Save disabled with the problem in its title; 300 enables it", async () => {
    await renderAgentPage({ max_turns: 40 });
    const input = screen.getByDisplayValue("40");

    fireEvent.change(input, { target: { value: "9999" } });
    const save = saveButton();
    expect(save).toBeDisabled();
    expect(save.getAttribute("title") ?? "").toContain("Max Turns must be between 1 and 500");

    fireEvent.change(input, { target: { value: "300" } });
    expect(saveButton()).toBeEnabled();
    expect(saveButton().getAttribute("title") ?? "").not.toContain("must be between");
  });
});

describe("the agent section page: Clear and the diff-only send", () => {
  it("Clear enables Save; the save sends {max_turns: null}; afterwards the field is Not set and the key has left state", async () => {
    await renderAgentPage({ max_turns: 40 });
    expect(saveButton()).toBeDisabled();
    const pillsBefore = screen.queryAllByText("Not set").length;

    fireEvent.click(screen.getByRole("button", { name: "Clear Max Turns" }));
    expect(saveButton()).toBeEnabled();

    await act(async () => {
      fireEvent.click(saveButton());
    });
    await waitFor(() => expect(putBodies()).toHaveLength(1));
    expect(putBodies()[0]).toEqual({ section: "agent", values: { max_turns: null } });

    // The field renders unset (one more pill than the other unset fields
    // already carried) and Save has nothing left to send.
    expect(screen.queryAllByText("Not set")).toHaveLength(pillsBefore + 1);
    expect(screen.queryByRole("button", { name: "Clear Max Turns" })).toBeNull();
    await waitFor(() => expect(saveButton()).toBeDisabled());

    // A second save of a different field carries no trace of the cleared key.
    fireEvent.click(screen.getByRole("switch", { name: /^Verbose Mode/ }));
    await act(async () => {
      fireEvent.click(saveButton());
    });
    await waitFor(() => expect(putBodies()).toHaveLength(2));
    expect(putBodies()[1].values).toEqual({ verbose: true });
    expect(Object.keys(putBodies()[1].values)).not.toContain("max_turns");
  });

  it("a foreign out-of-options value on disk is shown, and a save of another field sends only that field", async () => {
    await renderAgentPage({ max_turns: 40, reasoning_effort: "minimal" });

    expect(screen.getByText(/Current value 'minimal' is not one of/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: /^Verbose Mode/ }));
    expect(saveButton()).toBeEnabled();
    await act(async () => {
      fireEvent.click(saveButton());
    });

    await waitFor(() => expect(putBodies()).toHaveLength(1));
    expect(putBodies()[0]).toEqual({ section: "agent", values: { verbose: true } });
  });

  it("GREEN CONTROL: an untouched page sends nothing and shows no UNSAVED marker", async () => {
    await renderAgentPage({ max_turns: 40 });
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByText("UNSAVED")).toBeNull();
    expect(putBodies()).toHaveLength(0);
    const header = screen.getByText("Agent Settings");
    expect(within(header.parentElement as HTMLElement).queryByText("UNSAVED")).toBeNull();
  });
});

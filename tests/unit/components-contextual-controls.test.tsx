/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import ComposerRunForm from "@/components/composer/ComposerRunForm";
import CategoryAccordion from "@/components/ui/CategoryAccordion";
import { Field } from "@/components/ui/field/Field";
import { Select } from "@/components/ui/field/Select";
import Picker from "@/components/ui/Picker";
import { renderWithQuery } from "../helpers/render-with-query";
import { ok } from "../helpers/story";

const options = [{ value: "one", label: "First" }, { value: "two", label: "Second" }];

describe("T0191 contextual controls", () => {
  it("Composer's workflow and profile controls expose their rendered contextual names", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = jest.fn().mockResolvedValue(ok({ data: { nodes: [], edges: [] } }));
    try {
      renderWithQuery(<ComposerRunForm workflows={[{ id: "wf", key: "wf", name: "Controlled workflow", description: "Oracle workflow", version: 1, createdAt: "2026-10-03", updatedAt: "2026-10-03" }]} activeWorkflowId="" onWorkflowChange={jest.fn()} profileOptions={options} profileName="one" onProfileChange={jest.fn()} input="A controlled objective" onInputChange={jest.fn()} submitting={false} onRun={jest.fn()} />);
      expect(screen.getByRole("button", { name: /workflow/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /profile/i })).toBeInTheDocument();
    } finally { globalThis.fetch = original; }
  });
  it("Field-linked Select retains the visible name and keyboard selection without extra aria labels", () => {
    const change = jest.fn();
    render(<Field label="Research depth"><Select value="one" onChange={change} options={options} /></Field>);
    const trigger = screen.getByRole("button", { name: "Research depth" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(change).not.toHaveBeenCalled();
  });
  it("Picker keeps its separately named selection and Escape contract", () => {
    const change = jest.fn();
    render(<Picker label="Research agent" options={options} value="one" onChange={change} />);
    const trigger = screen.getByRole("button", { name: /Research agent/i });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Second" }));
    expect(change).toHaveBeenCalledWith("two");
    fireEvent.click(trigger);
    fireEvent.keyDown(document.activeElement ?? trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("category disclosure exposes expanded state without nesting its independent action", () => {
    const refresh = jest.fn();
    const view = render(<CategoryAccordion name="Installed skills" count={2} headerRight={<button onClick={refresh}>Refresh skills</button>}><p>Skill rows</p></CategoryAccordion>);
    const disclosure = screen.getByRole("button", { name: /Installed skills/i });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: "Refresh skills" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector("button button, button a, a button")).toBeNull();
  });
});

import FallbackConfigPanel from "@/components/models/FallbackConfigPanel";
import ResearchPage from "@/app/work/research/page";
import { jsonResponse } from "../helpers/fetch-map";

jest.mock("next/navigation", () => ({ usePathname: () => "/work/research", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
it("T0191 fallback restore choices remain one mutually exclusive radio group", () => {
  const update = jest.fn();
  render(<FallbackConfigPanel config={{ restorePrimaryOnFallback: true, fallbackNotification: true, apiMaxRetries: 3 }} onUpdate={update} onSyncToHermes={jest.fn()} onImportFromConfig={jest.fn()} />);
  const group = screen.getByRole("radiogroup");
  expect(group).toHaveAccessibleName();
  expect(screen.getAllByRole("radio")).toHaveLength(2);
  expect(screen.getAllByRole("radio").filter(radio => radio.getAttribute("aria-checked") === "true" || (radio as HTMLInputElement).checked)).toHaveLength(1);
});
it.each([true, false])("T0191 fallback alternative changes only restore preference [initial=%s]", initial => {
  const initialConfig = { restorePrimaryOnFallback: initial, fallbackNotification: false, apiMaxRetries: 7 };
  const onUpdate = jest.fn();
  const props = { onUpdate, onSyncToHermes: jest.fn(), onImportFromConfig: jest.fn() };
  const view = render(<FallbackConfigPanel {...props} config={initialConfig} />);
  const selected = (radio: HTMLElement) => radio.getAttribute("aria-checked") === "true" || (radio as HTMLInputElement).checked === true;
  const radios = screen.getAllByRole("radio");
  const alternative = radios.find(radio => !selected(radio))!;
  expect(alternative).toBeDefined();
  fireEvent.click(alternative);
  const nextConfig = { ...initialConfig, restorePrimaryOnFallback: !initial };
  expect(onUpdate.mock.calls).toEqual([[nextConfig]]);
  view.rerender(<FallbackConfigPanel {...props} config={nextConfig} />);
  expect(screen.getAllByRole("radio").filter(selected)).toEqual([alternative]);
  expect(onUpdate).toHaveBeenCalledTimes(1);
});
it("T0191 actual Research inputs and selectors have contextual rendered names", async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = jest.fn(async () => jsonResponse({ data: { jobs: [], models: [], defaults: {}, profiles: [], reports: [] } }));
  try {
    const view = renderWithQuery(<ResearchPage />);
    await screen.findByRole("heading", { level: 1 });
    const controls = view.container.querySelectorAll('input:not([type="hidden"]), textarea, select, button[aria-haspopup="listbox"]');
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) expect(control).toHaveAccessibleName();
  } finally { globalThis.fetch = saved; }
});

import WorkflowCanvas from "@/components/composer/WorkflowCanvas";
import { waitFor } from "@testing-library/react";
import type { ComposerWorkflowGraph } from "@/lib/composer/schema";

// JSDOM has no canvas geometry. The graph library alone renders a selectable
// node list; WorkflowCanvas, its inspector and its HTTP reads remain actual.
jest.mock("@xyflow/react", () => {
  const original = jest.requireActual("@xyflow/react");
  return { ...original, Background: () => null, Controls: () => null, MiniMap: () => null,
    ReactFlow: ({ nodes, onNodeClick }: { nodes: { id: string; data: { label: string } }[]; onNodeClick: (event: unknown, node: unknown) => void }) => <div>{nodes.map(node => <button key={node.id} onClick={event => onNodeClick(event, node)}>{node.data.label}</button>)}</div>,
  };
});
it("T0191 actual Composer inspector names selectors and preserves approved switch callbacks", async () => {
  const saved = globalThis.fetch;
  const workflow: ComposerWorkflowGraph = { id: "oracle-wf", key: "oracle", name: "Inspector workflow", description: "Controlled graph", version: 1, createdAt: "2026-10-03", updatedAt: "2026-10-03", edges: [], nodes: [{ id: "node-one", workflowId: "oracle-wf", key: "one", label: "Inspector stage", kind: "custom", gate: "auto", isStart: true, isTerminal: true, config: { _ui: { x: 0, y: 0 } }, pos: 0 }] };
  globalThis.fetch = jest.fn(async () => jsonResponse({ data: { workflow } }));
  try {
    const view = renderWithQuery(<WorkflowCanvas workflows={[workflow]} onSaved={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /select|workflow/i }));
    fireEvent.click(screen.getByRole("option", { name: "Inspector workflow" }));
    fireEvent.click(await screen.findByRole("button", { name: "Inspector stage" }));
    await waitFor(() => expect(screen.getByLabelText(/^label$/i)).toBeInTheDocument());
    const selectors = view.container.querySelectorAll('button[aria-haspopup="listbox"]');
    expect(selectors.length).toBeGreaterThan(1);
    for (const selector of selectors) expect(selector).toHaveAccessibleName();
    for (const label of view.container.querySelectorAll("label[for]")) {
      const control = document.getElementById(label.getAttribute("for")!);
      if (control) expect(control).toHaveAccessibleName(expect.stringContaining(label.textContent!.trim()));
    }
    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBeGreaterThanOrEqual(2);
    for (const control of switches) {
      expect(control).toHaveAccessibleName();
      const before = control.getAttribute("aria-checked");
      fireEvent.click(control);
      expect(control).toHaveAttribute("aria-checked", before === "true" ? "false" : "true");
    }
  } finally { globalThis.fetch = saved; }
});

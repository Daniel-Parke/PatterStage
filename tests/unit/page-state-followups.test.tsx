/** @jest-environment jsdom */
// T-0193 ORACLE Franklin-01a1062c-ad31-77c2-8ff2-71c41ee9b5d6, 2026-10-04.
// Behaviour and DOM semantics only; held transport separates A from replacement B.
import "@testing-library/jest-dom";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { isInaccessible } from "@testing-library/dom";
import { renderWithQuery } from "../helpers/render-with-query";
import { pendingLookup } from "../helpers/mission-async-deferred";
import { jsonResponse } from "../helpers/fetch-map";
import { matchMediaMock } from "../helpers/mocks";
import ComposerNodeRunDetail from "@/components/composer/ComposerNodeRunDetail";
import ScriptEditorModal from "@/components/scripts/ScriptEditorModal";
import ResearchReport from "@/components/research/ResearchReport";
import * as reportExport from "@/lib/laboratory/deep-research/report";
import SkillsSearchResults from "@/components/skills/SkillsSearchResults";
import AreaTrend from "@/components/viz/AreaTrend";
import StackedAreaTrend from "@/components/viz/StackedAreaTrend";
import MissionGroupCard from "@/components/session/MissionGroupCard";
import LogFilePicker from "@/components/logs/LogFilePicker";
import HindsightBrowser from "@/components/memory/HindsightBrowser";
import { FeedbackContext } from "@/components/ui/feedback-context";
import type { ComposerNode, ComposerNodeRun } from "@/lib/composer/schema";
import type { ResearchRun, ResearchStep } from "@/lib/laboratory/deep-research/types";
import type { MissionGroup } from "@/lib/sessions/sessions-grouping";
import type { SessionRecord } from "@/lib/sessions/session-repository";

const originalFetch = global.fetch;
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
let drain = async () => {};
beforeEach(() => { matchMediaMock(); drain = async () => {}; });
afterEach(async () => {
  await drain(); cleanup(); global.fetch = originalFetch;
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
});

const node: ComposerNode = { id: "node-a", workflowId: "wf-owned", key: "draft", label: "Draft A", kind: "worker", gate: "auto", isStart: true, isTerminal: true, config: null, pos: 0 };
const nodeRun: ComposerNodeRun = { id: "nr-a", composerRunId: "run-a", nodeId: node.id, attempt: 1, status: "completed", runId: "underlying-a", input: null, output: "Owned output A", verdict: null, error: null, startedAt: null, completedAt: "2026-10-04T09:00:00Z", createdAt: "2026-10-04T09:00:00Z" };
function composer() {
  const held = pendingLookup<Response>(); const bodies: Record<string, unknown>[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(String(input)).toBe("/api/artifacts"); expect(init?.method).toBe("POST");
    bodies.push(JSON.parse(String(init?.body)));
    return bodies.length === 1 ? held.promise : jsonResponse({ data: { success: true } });
  });
  const h = render(<ComposerNodeRunDetail open onClose={() => {}} node={node} nodeRun={nodeRun} />);
  async function settle(refused = false) {
    await act(async () => { held.complete(refused ? jsonResponse({ error: "Owned artifact refusal" }, 500) : jsonResponse({ data: { success: true } })); });
  }
  drain = () => settle(true);
  return { ...h, bodies, settle };
}

describe("T-0193 Composer output ownership", () => {
  it("A completion cannot mark replacement B saved and B saves its own identity", async () => {
    const h = composer(); fireEvent.click(screen.getByRole("button", { name: "Save as artifact" }));
    await waitFor(() => expect(h.bodies).toHaveLength(1));
    h.rerender(<ComposerNodeRunDetail open onClose={() => {}} node={{ ...node, id: "node-b", label: "Draft B" }} nodeRun={{ ...nodeRun, id: "nr-b", nodeId: "node-b", composerRunId: "run-b", output: "Owned output B" }} />);
    expect(screen.getByText("Owned output B")).toBeInTheDocument();
    await h.settle();
    const saveB = screen.getByRole("button", { name: "Save as artifact" }); expect(saveB).toBeEnabled();
    fireEvent.click(saveB); await waitFor(() => expect(h.bodies).toHaveLength(2));
    expect(h.bodies[0]).toMatchObject({ sourceRunId: "run-a", sourceNodeId: "nr-a", content: "Owned output A" });
    expect(h.bodies[1]).toMatchObject({ sourceRunId: "run-b", sourceNodeId: "nr-b", content: "Owned output B" });
  });

  it("same-output success prevents duplicates and refusal permits retry", async () => {
    const h = composer(); fireEvent.click(screen.getByRole("button", { name: "Save as artifact" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await h.settle(true); await screen.findByText("Owned artifact refusal");
    fireEvent.click(screen.getByRole("button", { name: "Save as artifact" }));
    const saved = await screen.findByRole("button", { name: "Saved" }); expect(saved).toBeDisabled();
    fireEvent.click(saved); expect(h.bodies).toHaveLength(2);
    expect(h.bodies[0]).toEqual(h.bodies[1]);
  });
});

// Q015 independent lifecycle amendment, Faraday, 2026-10-04; original 17 controls unchanged.
describe("T-0193 Composer retained save lifecycle", () => {
  it("same-frame duplicate clicks claim one artifact write synchronously", async () => {
    const h = composer(), action = screen.getByRole("button", { name: "Save as artifact" });
    act(() => { fireEvent.click(action); fireEvent.click(action); });
    await waitFor(() => expect(h.bodies).toHaveLength(1));
    await h.settle(); expect(h.bodies).toHaveLength(1);
  });

  it("refused A remains retryable after B and retries the captured A payload", async () => {
    const h = composer(); fireEvent.click(screen.getByRole("button", { name: "Save as artifact" }));
    await waitFor(() => expect(h.bodies).toHaveLength(1));
    h.rerender(<ComposerNodeRunDetail open onClose={() => {}} node={{ ...node, id: "node-b", label: "Draft B" }} nodeRun={{ ...nodeRun, id: "nr-b", nodeId: "node-b", composerRunId: "run-b", output: "Owned output B" }} />);
    await h.settle(true);
    h.rerender(<ComposerNodeRunDetail open onClose={() => {}} node={node} nodeRun={nodeRun} />);
    const action = screen.getByRole("button", { name: /^(Save as artifact|Saving…|Saved)$/ });
    expect(action).toBeEnabled(); expect(action).toHaveTextContent("Save as artifact");
    fireEvent.click(action); await waitFor(() => expect(h.bodies).toHaveLength(2));
    expect(h.bodies[1]).toEqual(h.bodies[0]); expect(await screen.findByRole("button", { name: "Saved" })).toBeDisabled();
  });

  it("composer run identity separates identical node ID and output while A is held", async () => {
    const h = composer(); fireEvent.click(screen.getByRole("button", { name: "Save as artifact" }));
    await waitFor(() => expect(h.bodies).toHaveLength(1));
    h.rerender(<ComposerNodeRunDetail open onClose={() => {}} node={node} nodeRun={{ ...nodeRun, composerRunId: "run-b" }} />);
    const action = screen.getByRole("button", { name: /^(Save as artifact|Saving…|Saved)$/ });
    expect(action).toBeEnabled(); expect(action).toHaveTextContent("Save as artifact");
    fireEvent.click(action); await waitFor(() => expect(h.bodies).toHaveLength(2));
    expect(h.bodies[1]).toMatchObject({ sourceRunId: "run-b", sourceNodeId: "nr-a", content: "Owned output A" });
    await h.settle(); expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
    h.rerender(<ComposerNodeRunDetail open onClose={() => {}} node={node} nodeRun={nodeRun} />);
    expect(screen.getByRole("button", { name: /^(Save as artifact|Saving…|Saved)$/ })).toBeDisabled();
    expect(h.bodies).toHaveLength(2);
  });

  it("parent unmount suppresses held artifact completion feedback", async () => {
    const h = composer(), feedback = jest.fn();
    h.rerender(<FeedbackContext.Provider value={{ showToast: feedback }}><ComposerNodeRunDetail open onClose={() => {}} node={node} nodeRun={nodeRun} /></FeedbackContext.Provider>);
    fireEvent.click(screen.getByRole("button", { name: "Save as artifact" }));
    await waitFor(() => expect(h.bodies).toHaveLength(1)); h.unmount(); await h.settle();
    expect(feedback).not.toHaveBeenCalled(); expect(h.bodies).toHaveLength(1);
  });

  for (const lifecycle of ["close/reopen", "A to B to A"] as const) {
    for (const state of ["pending", "saved"] as const) {
      it(`${state} A retains duplicate protection through ${lifecycle}`, async () => {
        const h = composer(); fireEvent.click(screen.getByRole("button", { name: "Save as artifact" }));
        await waitFor(() => expect(h.bodies).toHaveLength(1));
        if (state === "saved") await h.settle();
        if (lifecycle === "close/reopen") {
          h.rerender(<ComposerNodeRunDetail open={false} onClose={() => {}} node={node} nodeRun={nodeRun} />);
        } else {
          h.rerender(<ComposerNodeRunDetail open onClose={() => {}} node={{ ...node, id: "node-b", label: "Draft B" }} nodeRun={{ ...nodeRun, id: "nr-b", nodeId: "node-b", composerRunId: "run-b", output: "Owned output B" }} />);
          expect(screen.getByRole("button", { name: "Save as artifact" })).toBeEnabled();
        }
        h.rerender(<ComposerNodeRunDetail open onClose={() => {}} node={node} nodeRun={nodeRun} />);
        const action = screen.getByRole("button", { name: /^(Save as artifact|Saving…|Saved)$/ });
        expect(action).toBeDisabled(); expect(action).toHaveTextContent(state === "pending" ? "Saving…" : "Saved");
        fireEvent.click(action); expect(h.bodies).toHaveLength(1);
        if (state === "pending") await h.settle();
        const saved = screen.getByRole("button", { name: /^(Save as artifact|Saving…|Saved)$/ });
        expect(saved).toHaveTextContent("Saved"); expect(saved).toBeDisabled();
        fireEvent.click(saved); expect(h.bodies).toHaveLength(1);
        expect(h.bodies[0]).toMatchObject({ sourceRunId: "run-a", sourceNodeId: "nr-a", content: "Owned output A" });
      });
    }
  }
});

function script() {
  const onContentChange = jest.fn(), onSave = jest.fn();
  render(<ScriptEditorModal open isNew name="owned.mjs" onNameChange={() => {}} content="abc" onContentChange={onContentChange} loading={false} saving={false} onClose={() => {}} onSave={onSave} onDelete={() => {}} />);
  const field = screen.getByRole("textbox", { name: "Script content" }) as HTMLTextAreaElement;
  field.focus(); field.setSelectionRange(1, 2);
  return { field, onContentChange, onSave };
}
describe("T-0193 Script keyboard", () => {
  it("Shift+Tab permits navigation without inserting spaces", () => {
    const h = script(); const allowed = fireEvent.keyDown(h.field, { key: "Tab", shiftKey: true });
    expect(h.onContentChange).not.toHaveBeenCalled(); expect(allowed).toBe(true);
    expect(h.field).toHaveValue("abc");
  });
  it("plain Tab still replaces the selection with two spaces", () => {
    const h = script(); expect(fireEvent.keyDown(h.field, { key: "Tab" })).toBe(false);
    expect(h.onContentChange).toHaveBeenCalledWith("a  c");
  });
  it.each(["ctrlKey", "metaKey"])("%s+S still saves without editing content", (modifier) => {
    const h = script(); expect(fireEvent.keyDown(h.field, { key: "s", [modifier]: true })).toBe(false);
    expect(h.onSave).toHaveBeenCalledTimes(1); expect(h.onContentChange).not.toHaveBeenCalled();
  });
});

const research: ResearchRun = { id: "research-owned", query: "Owned question", status: "completed", provider: "duckduckgo", modelId: null, config: {}, report: "## Findings\n\nOwned research body.", error: null, createdAt: "", completedAt: "", usage: null, gather: null };
function clipboard(writeText: jest.Mock) { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } }); }
describe("T-0193 Research actions and labels", () => {
  it("clipboard refusal is handled visibly without claiming Copied", async () => {
    const writeText = jest.fn().mockRejectedValue(new Error("Owned clipboard refusal")); clipboard(writeText);
    render(<ResearchReport run={research} steps={[]} />); fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy" })).toBeEnabled();
    expect(writeText).toHaveBeenCalledWith(research.report);
  });
  it("successful clipboard copy uses the report and confirms success", async () => {
    clipboard(jest.fn().mockResolvedValue(undefined));
    render(<ResearchReport run={research} steps={[]} />); fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await screen.findByRole("button", { name: "Copied" }); expect(navigator.clipboard.writeText).toHaveBeenCalledWith(research.report);
  });
  it("exports are single links with preserved targets and no nested controls", () => {
    render(<ResearchReport run={research} steps={[]} />);
    const view = screen.getByRole("link", { name: "View report" }), download = screen.getByRole("link", { name: "Download" });
    expect(view).toHaveAttribute("href", "/api/laboratory/research/research-owned/export"); expect(view).toHaveAttribute("target", "_blank");
    expect(download).toHaveAttribute("download", "research-research.html");
    for (const link of [view, download]) expect(link.querySelector("button, a, input, select, textarea")).toBeNull();
  });
  it("shared report STEP_LABEL export preserves the five labels", () => {
    // The brief expressly asks for this small public-export assertion; no source parsing.
    expect((reportExport as typeof reportExport & { STEP_LABEL?: Record<string, string> }).STEP_LABEL).toEqual({ plan: "Plan", search: "Search", visit: "Read", reason: "Reason", synthesize: "Synthesize" });
  });
  it("app and standalone HTML preserve step labels and unknown-kind fallback", () => {
    const kinds = ["plan", "search", "visit", "reason", "synthesize", "future-kind"];
    const steps = kinds.map((kind, position): ResearchStep => ({ id: `step-${position}`, runId: research.id, position, kind: kind as ResearchStep["kind"], input: null, output: "Owned step body", sources: [], createdAt: "" }));
    const h = render(<ResearchReport run={research} steps={steps} />);
    const exported = document.createElement("div"); exported.innerHTML = reportExport.buildExportHtml(research, steps);
    const labels = ["Plan", "Search", "Read", "Reason", "Synthesize", "future-kind"];
    expect([...h.container.querySelectorAll("summary")].map(el => el.textContent?.trim())).toEqual(labels);
    expect([...exported.querySelectorAll("summary .k")].map(el => el.textContent)).toEqual(labels);
  });
});

describe("T-0193 search and trend equivalents", () => {
  it("each flat search match names its category and keeps row actions", () => {
    const matches = [{ name: "Owned search", category: "Research", path: "research/owned", description: "Owned description", enabled: true, size: 10, lastModified: "" }];
    const rowActions = { toggling: {}, expandedSkill: null, skillContent: "", onToggleSkill: jest.fn(), onViewSkill: jest.fn(), onEditSkill: jest.fn() };
    render(<SkillsSearchResults matches={matches} total={70} page={0} onPageChange={() => {}} rowActions={rowActions} />);
    const row = screen.getByTestId("skill-row"); expect(within(row).getByText("Research")).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "View" })); expect(rowActions.onViewSkill).toHaveBeenCalledWith(matches[0]);
    expect(screen.getByTestId("skills-search-summary")).toHaveTextContent("1 match across all 70 skills");
  });
  function equivalents(root: HTMLElement) {
    return [...root.querySelectorAll("tr, li, p, figcaption, title, desc, [aria-label]")]
      .filter(el => !isInaccessible(el)).map(el => `${el.getAttribute("aria-label") ?? ""} ${el.textContent ?? ""}`).join("\n");
  }
  it("throughput dates and completed/failed daily values have text equivalents", () => {
    const h = render(<AreaTrend data={[{ date: "2026-10-01", completed: 17, failed: 3 }, { date: "2026-10-02", completed: 29 }]} />);
    const text = equivalents(h.container);
    expect(text).toMatch(/completed/i); expect(text).toMatch(/failed/i);
    expect(text).toMatch(/2026-10-01[^\n]*17[^\n]*3/); expect(text).toMatch(/2026-10-02[^\n]*29[^\n]*0/);
  });
  it("stacked dates and each labelled daily series have text equivalents", () => {
    const h = render(<StackedAreaTrend data={[{ date: "2026-10-01", values: { skills: 17, tools: 29 } }, { date: "2026-10-02", values: { skills: 5, tools: 11 } }]} series={[{ key: "skills", label: "Skills", color: "cyan" }, { key: "tools", label: "Tools", color: "pink" }]} />);
    const text = equivalents(h.container);
    expect(text).toMatch(/Skills/); expect(text).toMatch(/Tools/);
    expect(text).toMatch(/2026-10-01[^\n]*17[^\n]*29/); expect(text).toMatch(/2026-10-02[^\n]*5[^\n]*11/);
  });
});

describe("T-0193 collection state semantics", () => {
  it("mission expansion announces collapsed and expanded state while retaining sessions", () => {
    const session = (id: string, title: string): SessionRecord => ({ id, title, agentType: "hermes", source: "cli", missionId: "mission-owned", profileName: "default", modelId: "owned", provider: "local", size: 0, startedAt: "2026-10-04T09:00:00Z", endedAt: null, status: "completed", exitCode: 0, error: null, messageCount: 1 } as SessionRecord);
    const group: MissionGroup = { kind: "mission", key: "mission:owned", missionId: "mission-owned", sessions: [session("s-a", "Owned latest"), session("s-b", "Owned earlier")], firstStartedAt: "2026-10-04T08:00:00Z", lastStartedAt: "2026-10-04T09:00:00Z", activeCount: 0 };
    render(<MissionGroupCard group={group} />); const expand = screen.getByRole("button", { name: /Owned latest/ });
    expect(expand).toHaveAttribute("aria-expanded", "false"); fireEvent.click(expand);
    expect(expand).toHaveAttribute("aria-expanded", "true"); expect(screen.getByText("Owned earlier")).toBeInTheDocument();
    fireEvent.click(expand); expect(expand).toHaveAttribute("aria-expanded", "false"); expect(screen.queryByText("Owned earlier")).toBeNull();
  });
  it("log selection exposes the active file and follows the existing callback", () => {
    const onSelect = jest.fn(); const props = { files: ["agent", "gateway"].map(name => ({ name, size: 1, modified: "2026-10-04T09:00:00Z", group: "core" as const })), query: "", onQueryChange: () => {}, activeLog: "agent", onSelect };
    const h = render(<LogFilePicker {...props} />);
    const agent = screen.getByRole("button", { name: /agent\.log/ }), gateway = screen.getByRole("button", { name: /gateway\.log/ });
    expect(agent).toHaveAttribute("aria-pressed", "true"); expect(gateway).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(gateway); expect(onSelect).toHaveBeenCalledWith("gateway"); h.rerender(<LogFilePicker {...props} activeLog="gateway" />);
    expect(agent).toHaveAttribute("aria-pressed", "false"); expect(gateway).toHaveAttribute("aria-pressed", "true");
  });
  it("Hindsight collection selection announces state and retains tab content", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const action = new URL(String(input), "http://localhost").searchParams.get("action");
      const data = action === "health" ? { available: true, mode: "ok" } : action === "list" ? { memories: [] } : action === "directives" ? { directives: [] } : action === "mental-models" ? { models: [] } : undefined;
      if (!data) throw new Error(`Unmatched owned collection: ${input}`); return jsonResponse({ data });
    });
    renderWithQuery(<HindsightBrowser />); await screen.findByText(/No memories yet/i);
    const memories = screen.getByRole("button", { name: "Memories" }), directives = screen.getByRole("button", { name: "Directives" });
    expect(memories).toHaveAttribute("aria-pressed", "true"); expect(directives).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(directives); await screen.findByText(/Create your first directive/i);
    expect(memories).toHaveAttribute("aria-pressed", "false"); expect(directives).toHaveAttribute("aria-pressed", "true");
  });
});

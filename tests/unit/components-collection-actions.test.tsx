/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import TemplateCard from "@/components/ui/TemplateCard";
import StoryCard from "@/modules/rec-room/components/StoryCard";
import CredentialsPanel from "@/components/models/CredentialsPanel";
import type { ApiCredential } from "@/components/models/types";
import * as Lucide from "lucide-react";

// Fixed stored-name inventory; expected artwork comes from public Lucide
// constructors, never from TemplateCard's production lookup table.
const storedIconNames = ["Search", "Bug", "GitPullRequest", "Wrench", "PenTool", "Zap",
  "Rocket", "Cpu", "Activity", "Shield", "Terminal", "Database", "Globe", "Code",
  "FileText", "Layers", "HardDrive", "AlertTriangle", "BarChart3", "Brain", "TrendingUp",
  "DollarSign", "Target", "ClipboardList", "Palette", "Megaphone", "Microscope", "Scale",
  "ShieldCheck", "CheckSquare", "TestTube", "ShieldAlert", "Gauge", "BookOpen", "RefreshCw",
  "FlaskConical", "Sparkles", "Clock", "Bot", "UnknownStoredIcon"] as const;

const credential: ApiCredential = { id: "oracle-credential", label: "Long synthetic credential label", provider: "openai", keyHint: "test...only", createdAt: "2026-10-03T00:00:00Z", updatedAt: "2026-10-03T00:00:00Z" };

describe("T0191 collection action identities", () => {
  it.each(storedIconNames)("template stored icon %s preserves identity and selection", (icon) => {
    const select = jest.fn();
    const Reference = Lucide[icon === "UnknownStoredIcon" ? "Zap" : icon];
    const view = render(<><section data-testid="stored-icon"><TemplateCard id="oracle-template" name="Synthetic template" icon={icon} color="cyan" description="Stored template" onSelect={select} /></section><aside data-testid="reference-icon"><Reference /></aside></>);
    fireEvent.click(screen.getByText("Synthetic template"));
    expect(select).toHaveBeenCalledTimes(1);
    const actual = view.getByTestId("stored-icon").querySelector("svg");
    const reference = view.getByTestId("reference-icon").querySelector("svg");
    expect(actual).not.toBeNull();
    expect(reference).not.toBeNull();
    expect(actual!.innerHTML).toBe(reference!.innerHTML);
  });
  it("Story read and confirmed deletion retain the selected ID", () => {
    const read = jest.fn(), remove = jest.fn();
    render(<StoryCard story={{ id: "oracle-story", title: "A long controlled story title", chapters: [], status: "active" }} onRead={read} onDelete={remove} />);
    fireEvent.click(screen.getByRole("button", { name: /read/i }));
    expect(read).toHaveBeenCalledWith("oracle-story");
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(remove).toHaveBeenCalledWith("oracle-story");
    expect(remove).toHaveBeenCalledTimes(1);
  });
  it("credential rotation cancellation does not leak a write or retarget another row", () => {
    const rotate = jest.fn(), remove = jest.fn();
    render(<CredentialsPanel credentials={[credential, { ...credential, id: "other", label: "Other credential" }]} onRotate={rotate} onDelete={remove} onAdd={jest.fn()} providers={["openai"]} busyId={null} />);
    fireEvent.click(screen.getByRole("button", { name: `Rotate key for ${credential.label}` }));
    fireEvent.change(screen.getByLabelText(`New API key for ${credential.label}`), { target: { value: "synthetic-key-never-valid" } });
    fireEvent.click(screen.getByRole("button", { name: `Cancel rotating ${credential.label}` }));
    expect(rotate).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue("synthetic-key-never-valid")).not.toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
  });
});

import { within, waitFor, cleanup } from "@testing-library/react";
import SessionDetailPage from "@/app/results/sessions/[id]/page";
import FallbackChainList from "@/components/models/FallbackChainList";
import DirectivesTab from "@/components/memory/hindsight/DirectivesTab";
import MentalModelsTab from "@/components/memory/hindsight/MentalModelsTab";
import type { FallbackChainEntry } from "@/types/console";
import { renderWithQuery } from "../helpers/render-with-query";
import { jsonResponse } from "../helpers/fetch-map";

const mockNavigate = jest.fn();
jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "oracle-session" }), usePathname: () => "/results/sessions/oracle-session",
  useRouter: () => ({ push: mockNavigate, replace: mockNavigate, back: mockNavigate }), useSearchParams: () => new URLSearchParams(),
}));
const savedFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = savedFetch; });

it.each([404, 500])("T0191 Session %i retains Retry, back navigation and one visible primary heading", async status => {
  const transport = jest.fn(async () => jsonResponse({ error: status === 404 ? "Session not found" : "Owned server refusal" }, status));
  globalThis.fetch = transport;
  renderWithQuery(<SessionDetailPage />);
  const retry = await screen.findByRole("button", { name: /retry/i });
  const reads = transport.mock.calls.length;
  fireEvent.click(retry);
  await waitFor(() => expect(transport.mock.calls.length).toBeGreaterThan(reads));
  expect(screen.getByRole("link", { name: /back|sessions/i })).toHaveAttribute("href", "/results/sessions");
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
});

it.each(["Directives", "Mental models"])("T0191 %s toolbar keeps named refresh/create actions", kind => {
  const create = jest.fn(), refresh = jest.fn();
  render(kind === "Directives" ? <DirectivesTab directives={[]} loading={false} onCreateClick={create} onRefresh={refresh} onEdit={jest.fn()} onToggle={jest.fn()} onDelete={jest.fn()} /> : <MentalModelsTab models={[]} loading={false} refreshingModelId={null} onCreateClick={create} onRefresh={refresh} onEdit={jest.fn()} onRefreshModel={jest.fn()} onDelete={jest.fn()} />);
  fireEvent.click(screen.getAllByRole("button", { name: /new|create/i })[0]);
  expect(create).toHaveBeenCalledTimes(1);
  const control = screen.getByRole("button", { name: /refresh/i });
  control.focus(); expect(control).toHaveFocus(); fireEvent.click(control);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it("T0191 fallback first/middle/last actions retain bounds and exact row identity", () => {
  const chain: FallbackChainEntry[] = [0, 1, 2].map(position => ({ id: `entry-${position}`, modelId: `model-${position}`, modelName: `Synthetic model ${position}`, modelIdString: `remote-${position}`, provider: "synthetic", position, enabled: true, overrideBaseUrl: null, createdAt: "2026-10-03", updatedAt: "2026-10-03" }));
  const reorder = jest.fn(), toggle = jest.fn(), remove = jest.fn(), edit = jest.fn();
  render(<FallbackChainList chain={chain} models={[]} onReorder={reorder} onToggle={toggle} onDelete={remove} onEdit={edit} onAddFromRegistry={jest.fn()} onAddCustom={jest.fn()} />);
  const row = (position: number) => within(screen.getByText(`Synthetic model ${position}`).closest("tr")!);
  expect(row(0).getByRole("button", { name: /up/i })).toBeDisabled();
  expect(row(2).getByRole("button", { name: /down/i })).toBeDisabled();
  fireEvent.click(row(1).getByRole("button", { name: /up/i }));
  expect(reorder).toHaveBeenCalledWith("entry-1", "up");
  fireEvent.click(row(1).getByRole("button", { name: /edit/i }));
  expect(edit).toHaveBeenCalledWith(chain[1]);
  fireEvent.click(row(1).getByRole("switch"));
  expect(toggle).toHaveBeenCalledWith("entry-1", false);
  fireEvent.click(row(1).getByRole("button", { name: /delet|remove/i }));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(row(1).getByRole("button", { name: /delet|remove/i }));
  expect(remove).toHaveBeenCalledWith("entry-1");
});

import MissionEditorPanel from "@/components/missions/MissionEditorPanel";
import { missionRow } from "../helpers/mission-link-query-fixture";
it("T0191 Mission metadata retains distinct agent model and provider values", () => {
  const row = { ...missionRow("metadata", "Metadata mission"), status: "successful", profileName: "Oracle agent", model: "Oracle model", modelId: "Oracle model", provider: "Oracle provider" };
  globalThis.fetch = jest.fn(async () => jsonResponse({ data: {} }));
  renderWithQuery(<MissionEditorPanel mission={row} detail={{ mission: row, run: null, schedule: null }} detailLoading={false} promptCollapsed onPromptCollapsedChange={jest.fn()} onEdit={jest.fn()} onCancel={jest.fn()} onDelete={jest.fn()} />);
  for (const label of ["Agent", "Model", "Provider"]) expect(screen.getByText(label, { exact: true })).toBeVisible();
  for (const value of ["Oracle agent", "Oracle model", "Oracle provider"]) expect(screen.getByText(value, { exact: true })).toBeVisible();
});
it("T0191 fallback add from registry reports the chosen registry ID", () => {
  const add = jest.fn();
  render(<FallbackChainList chain={[]} models={[{ id: "registry-owned", name: "Registry model", provider: "synthetic", modelId: "remote-owned" }]} onReorder={jest.fn()} onToggle={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()} onAddFromRegistry={add} onAddCustom={jest.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /add.*registry|add.*model/i }));
  fireEvent.click(screen.getByText("Registry model"));
  expect(add).toHaveBeenCalledWith("registry-owned");
});

import { TemplateEditorModal } from "@/components/missions/templates/TemplateEditorModal";
import { composerFormState } from "../helpers/fixtures";
it("T0191 stored icon support preserves the existing template editor choices without enlargement", async () => {
  globalThis.fetch = jest.fn(async () => jsonResponse({ data: { models: [], profiles: [], skills: [], defaults: {} } }));
  const unchanged = jest.fn();
  renderWithQuery(<TemplateEditorModal {...composerFormState()} open onClose={unchanged} onCancel={unchanged} editingTemplateId={null} templateName="Owned template" onTemplateNameChange={unchanged} templateDescription="" onTemplateDescriptionChange={unchanged} templateIcon="Zap" onTemplateIconChange={unchanged} templateColor="cyan" onTemplateColorChange={unchanged} templateSaving={false} onSave={unchanged} onNewInstructionChange={unchanged} onNewContextChange={unchanged} onNewGoalsChange={unchanged} onNewProfileChange={unchanged} onModelChange={unchanged} onNewMissionTimeChange={unchanged} onNewTimeoutChange={unchanged} onNewLocalDirsChange={unchanged} onLocalDirDraftChange={unchanged} onNewReferencesChange={unchanged} onReferenceInputChange={unchanged} onNewSkillsChange={unchanged} />);
  expect(await screen.findByRole("button", { name: /^Zap$/i })).toBeInTheDocument();
  expect(Array.from(screen.getByRole("button", { name: /^Zap$/i }).parentElement!.querySelectorAll("button")).map(button => button.getAttribute("aria-label"))).toEqual(["Search", "Bug", "GitPullRequest", "Wrench", "PenTool", "Zap", "Rocket", "Cpu", "Activity", "Shield", "Terminal", "Database", "Globe", "Code", "FileText", "Layers", "Bot", "RefreshCw"]);
});
it("T0191 fallback custom add preserves exact typed identity", () => {
  const add = jest.fn();
  render(<FallbackChainList chain={[]} models={[]} onReorder={jest.fn()} onToggle={jest.fn()} onDelete={jest.fn()} onEdit={jest.fn()} onAddFromRegistry={jest.fn()} onAddCustom={add} />);
  fireEvent.click(screen.getByRole("button", { name: /custom/i }));
  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Owned custom model" } });
  fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: "synthetic" } });
  fireEvent.change(screen.getByLabelText(/model id/i), { target: { value: "remote-owned" } });
  fireEvent.click(screen.getByRole("button", { name: /^add$/i }));
  expect(add).toHaveBeenCalledWith("Owned custom model", "synthetic", "remote-owned", undefined);
});

it.each([
  { scenario: "preferred fields win", fields: {}, expected: ["Preferred agent", "Preferred model", "Distinct provider"] },
  { scenario: "absent preferred agent", fields: { profileName: undefined }, expected: ["Fallback agent", "Preferred model", "Distinct provider"] },
  { scenario: "absent preferred model", fields: { modelId: undefined }, expected: ["Preferred agent", "Fallback model", "Distinct provider"] },
  { scenario: "both preferred fields absent", fields: { profileName: undefined, modelId: undefined }, expected: ["Fallback agent", "Fallback model", "Distinct provider"] },
  { scenario: "empty preferred fields", fields: { profileName: "", modelId: "" }, expected: ["Fallback agent", "Fallback model", "Distinct provider"] },
  { scenario: "provider missing", fields: { provider: undefined }, expected: ["Preferred agent", "Preferred model", "—"] },
  { scenario: "agent and model missing", fields: { profileName: undefined, profileId: undefined, modelId: undefined, model: undefined }, expected: ["—", "—", "Distinct provider"] },
  { scenario: "all metadata missing", fields: { profileName: undefined, profileId: undefined, modelId: undefined, model: undefined, provider: undefined }, expected: ["—", "—", "—"] },
])("T0191 Mission metadata preserves current fallback display [$scenario]", ({ fields, expected }) => {
  const record = { ...missionRow("fallback-metadata", "Fallback metadata"), status: "successful", profileName: "Preferred agent", profileId: "Fallback agent", modelId: "Preferred model", model: "Fallback model", provider: "Distinct provider", ...fields };
  globalThis.fetch = jest.fn(async () => jsonResponse({ data: {} }));
  renderWithQuery(<MissionEditorPanel mission={record} detail={{ mission: record, run: null, schedule: null }} detailLoading={false} promptCollapsed onPromptCollapsedChange={jest.fn()} onEdit={jest.fn()} onCancel={jest.fn()} onDelete={jest.fn()} />);
  for (const [index, label] of ["Agent", "Model", "Provider"].entries()) {
    const labelNode = screen.getByText(label, { exact: true });
    const row = labelNode.parentElement!;
    expect(within(row).getByText(expected[index], { exact: true })).toBeVisible();
  }
  for (const unused of ["Preferred agent", "Fallback agent", "Preferred model", "Fallback model", "Distinct provider"].filter(value => !expected.includes(value))) expect(screen.queryByText(unused, { exact: true })).not.toBeInTheDocument();
});

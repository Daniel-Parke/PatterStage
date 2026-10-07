/** @jest-environment jsdom */
import React from "react";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithQuery } from "../helpers/render-with-query";
import { fetchMap, jsonResponse } from "../helpers/fetch-map";
import { pendingLookup } from "../helpers/mission-async-deferred";
import type { MissionsPageViewModel } from "@/hooks/useMissionsPage";
import type { TemplateEditorModal, MissionTemplate } from "@/components/missions/TemplateModals";

let mockView: MissionsPageViewModel;
let mockEditor: React.ComponentProps<typeof TemplateEditorModal>;
// Transparent observers: the real hook executes, and the real modal receives its original props.
jest.mock("@/hooks/useMissionsPage", () => {
  const actual = jest.requireActual<typeof import("@/hooks/useMissionsPage")>("@/hooks/useMissionsPage");
  return { ...actual, useMissionsPage: () => { mockView = actual.useMissionsPage(); return mockView; } };
});
jest.mock("@/components/missions/TemplateModals", () => {
  const actual = jest.requireActual<typeof import("@/components/missions/TemplateModals")>("@/components/missions/TemplateModals");
  return { ...actual, TemplateEditorModal: (props: React.ComponentProps<typeof TemplateEditorModal>) => {
    mockEditor = props; return <actual.TemplateEditorModal {...props} />;
  } };
});
jest.mock("next/navigation", () => ({ usePathname: () => "/work/missions", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
import MissionsPage from "@/app/work/missions/page";

const template: MissionTemplate = { id: "owned-template", name: "Owned template", description: "Existing description", icon: "Zap", color: "cyan", category: "ops", profile: "profile-a",
  instruction: "Existing instruction", context: "Existing context", goals: ["Existing goal"], suggestedSkills: [], defaultModel: "model-a", defaultProvider: "provider-a", timeoutMinutes: 20, isCustom: true };
const originalFetch = global.fetch;
let writes: Array<{ url: string; body: Record<string, unknown> }>;
let respond: () => Promise<Response>;
let unexpected: string[];
beforeEach(() => {
  window.history.replaceState({}, "", "/work/missions"); localStorage.clear();
  writes = []; unexpected = []; respond = async () => jsonResponse({ data: { success: true } });
  const mapped = fetchMap({
    "/api/monitor": { body: { data: {} } },
    "/api/agent/profiles/profile-a/toolsets": { body: { data: { unifiedEnabled: [] } } },
    "/api/missions?limit=": { body: { data: { missions: [] } } },
    "/api/templates": { body: { data: { templates: [template] } } },
    "/api/mission-categories": { body: { data: { categories: [{ id: "ops", name: "Operations", color: "cyan", missionCount: 0, templateCount: 1 }] } } },
    "/api/agent/profiles": { body: { data: { profiles: [{ id: "profile-a", name: "Agent Alpha" }, { id: "profile-b", name: "Agent Beta" }] } } },
    "/api/models": { body: { data: { models: [{ id: "registry-a", name: "Alpha Model", modelId: "model-a", provider: "provider-a" }, { id: "registry-b", name: "Beta Model", modelId: "model-b", provider: "provider-b" }] } } },
    "/api/models/defaults": { body: { data: { defaults: { agent: "registry-a" }, modelReadiness: { ready: true } } } },
    "/api/skills?": { body: { data: { skills: [{ name: "owned-skill", enabled: true, category: "testing" }] } } },
    "/api/fs/git/branches?": { body: { data: { isGitRepo: true, branches: ["main", "review"], current: "main" } } },
  }, { fallback: url => { unexpected.push(url); return undefined; } });
  global.fetch = jest.fn(async (input, init) => {
    const url = String(input);
    if (init?.method && init.method !== "GET") {
      if (url !== "/api/templates") { unexpected.push(`${init.method} ${url}`); throw new Error("Unexpected write"); }
      expect(init.method).toBe("POST");
      writes.push({ url, body: JSON.parse(String(init.body)) }); return respond();
    }
    return mapped(input, init);
  });
});
afterEach(() => { cleanup(); global.fetch = originalFetch; expect(unexpected).toEqual([]); });

function mapping() {
  const v = mockView;
  // Independent public flat-field mapping; never read a proposed prop bundle or mapCategories().
  const expected: React.ComponentProps<typeof TemplateEditorModal> = {
    open: v.showTemplateEditor, onClose: v.closeTemplateEditor, onCancel: v.closeTemplateEditor, editingTemplateId: v.editingTemplateId,
    templateName: v.templateName, onTemplateNameChange: v.setTemplateName, templateDescription: v.templateDescription, onTemplateDescriptionChange: v.setTemplateDescription,
    templateIcon: v.templateIcon, onTemplateIconChange: v.setTemplateIcon, templateColor: v.templateColor, onTemplateColorChange: v.setTemplateColor,
    templateSaving: v.templateSaving, onSave: v.handleTemplateSave, categories: v.categories.map(({ id, name, color }) => ({ id, name, color })),
    categoryId: v.templateCategoryId, onCategoryChange: v.setTemplateCategoryId, onCreateCategory: v.handleCreateCategory,
    newInstruction: v.templateInstruction, onNewInstructionChange: v.setTemplateInstruction, newContext: v.templateContext, onNewContextChange: v.setTemplateContext,
    newGoals: v.templateGoals, onNewGoalsChange: v.setTemplateGoals, newProfile: v.templateProfile, onNewProfileChange: v.setTemplateProfile,
    newModel: v.templateModel, newProvider: v.templateProvider, onModelChange: v.setTemplateModelAndProvider,
    newMissionTime: v.templateMissionTime, onNewMissionTimeChange: v.setTemplateMissionTime, newTimeout: v.templateTimeout, onNewTimeoutChange: v.setTemplateTimeout,
    newLocalDirs: v.templateLocalDirs, onNewLocalDirsChange: v.setTemplateLocalDirs, localDirDraft: v.templateLocalDirDraft, onLocalDirDraftChange: v.setTemplateLocalDirDraft,
    newReferences: v.templateReferences, onNewReferencesChange: v.setTemplateReferences, referenceInput: v.templateReferenceInput, onReferenceInputChange: v.setTemplateReferenceInput,
    newSkills: v.templateSkills, onNewSkillsChange: v.setTemplateSkills,
  };
  expect(Object.keys(expected)).toHaveLength(43);
  expect(mockEditor).toEqual(expected);
}
async function mount() {
  renderWithQuery(<MissionsPage />);
  await waitFor(() => expect(mockView.loading).toBe(false));
  expect(mockView.templates).toEqual([template]);
}
async function openEditor(edit = true) {
  if (!screen.queryByRole("button", { name: "Edit Templates" })) fireEvent.click(screen.getByRole("button", { name: /Quick load template/ }));
  fireEvent.click(screen.getByRole("button", { name: "Edit Templates" }));
  const manager = await screen.findByRole("dialog", { name: "Edit Templates" });
  fireEvent.click(within(manager).getByRole("button", { name: edit ? "Edit" : "New template" }));
  const dialog = await screen.findByRole("dialog", { name: edit ? "Edit Template" : "Save as Template" });
  await waitFor(() => expect(within(dialog).getByRole("combobox", { name: "Model" })).not.toBeDisabled());
  return within(dialog);
}
function change(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); }
async function pick(label: string, option: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  fireEvent.click(await screen.findByRole("option", { name: name => name.includes(option) }));
}
function composer() {
  const v = mockView;
  return { instruction: v.newInstruction, context: v.newContext, goals: v.newGoals, profile: v.newProfile, model: v.newModel, provider: v.newProvider,
    timeout: v.newTimeout, dirs: v.newLocalDirs, references: v.newReferences, skills: v.newSkills };
}
function expectedSave(name = "Edited template") {
  return { action: "update", templateId: "owned-template", name, icon: "Rocket", color: "pink", description: "Edited description",
    instruction: "Edited instruction", context: "Edited context", outputFormat: "", constraints: "", goals: ["First", " Second "],
    localDirs: [{ path: "/owned/project", branch: "review" }], references: ["https://example.invalid/reference"], suggestedSkills: ["owned-skill"], suggestedToolsets: [],
    profile: "profile-b", defaultModel: "model-b", defaultProvider: "provider-b", timeoutMinutes: 10, categoryId: "ops" };
}

describe("T-0192 actual Missions template editor wiring", () => {
  it("preserves all 43 bindings initially and after existing flat fields change", async () => {
    await mount(); mapping();
    await openEditor(); mapping();
    act(() => {
      mockView.setTemplateName("Changed via public flat setter"); mockView.setTemplateDescription("Changed description");
      mockView.setTemplateInstruction("Changed instruction"); mockView.setTemplateContext("Changed context"); mockView.setTemplateGoals("Changed goal");
      mockView.setTemplateIcon("Rocket"); mockView.setTemplateColor("pink"); mockView.setTemplateProfile("profile-b"); mockView.setTemplateModelAndProvider("model-b", "provider-b");
      mockView.setTemplateMissionTime(45); mockView.setTemplateTimeout(10); mockView.setTemplateCategoryId("ops");
      mockView.setTemplateLocalDirs([{ path: "/owned/changed", branch: null }]); mockView.setTemplateLocalDirDraft({ path: "/owned/draft", branch: "main" });
      mockView.setTemplateReferences(["owned-reference"]); mockView.setTemplateReferenceInput("reference draft"); mockView.setTemplateSkills(["owned-skill"]);
    });
    mapping(); expect(screen.getByLabelText("Template name")).toHaveValue("Changed via public flat setter");
  });

  it("real controls save the exact editor payload without altering the composer draft", async () => {
    await mount();
    act(() => { mockView.setNewInstruction("Composer instruction"); mockView.setNewContext("Composer context"); mockView.setNewGoals("Composer goal"); mockView.setNewProfile("profile-a"); mockView.setModelAndProvider("composer-model", "composer-provider"); mockView.setNewTimeout(60); });
    const before = composer(); const ui = await openEditor(); expect(composer()).toEqual(before);
    for (const [label, value] of [["Template name", "Edited template"], ["Template description", "Edited description"], ["Instruction Prompt", "Edited instruction"], ["Context Prompt", "Edited context"], ["Goals", "First\n\n Second "]]) change(label, value);
    fireEvent.click(ui.getByRole("button", { name: "Rocket" })); fireEvent.click(ui.getByTitle("pink"));
    await pick("Profile", "Agent Beta");
    fireEvent.change(ui.getByRole("combobox", { name: "Model" }), { target: { value: "registry-b" } });
    await pick("Mission scope", "Deep Dive"); await pick("Timeout", "10m (recommended)");
    fireEvent.click(ui.getByTestId("category-combobox-trigger")); fireEvent.click(ui.getByRole("button", { name: "Operations" }));
    change("Local directory path", "/owned/project");
    await waitFor(() => expect(ui.getByRole("combobox", { name: "Git branch" })).toBeInTheDocument());
    fireEvent.change(ui.getByRole("combobox", { name: "Git branch" }), { target: { value: "review" } });
    fireEvent.click(ui.getByRole("button", { name: "Add" }));
    change("Reference to add", "https://example.invalid/reference"); fireEvent.click(ui.getByRole("button", { name: "+ Add" }));
    await pick("Skills", "owned-skill"); fireEvent.click(ui.getByRole("button", { name: "Skills" }));
    mapping(); expect(mockView.templateMissionTime).toBe(45); expect(composer()).toEqual(before);
    fireEvent.click(ui.getByRole("button", { name: "Save Template" }));
    await waitFor(() => expect(mockView.showTemplateEditor).toBe(false));
    expect(writes).toEqual([{ url: "/api/templates", body: expectedSave() }]); expect(composer()).toEqual(before);
  });

  it("held save exposes busy state and refusal retains the draft for an exact retry", async () => {
    await mount(); const ui = await openEditor(); change("Template name", "Retry template"); change("Instruction Prompt", "Retry instruction");
    const held = pendingLookup<Response>(); respond = () => held.promise;
    fireEvent.click(ui.getByRole("button", { name: "Save Template" }));
    await waitFor(() => expect(writes).toHaveLength(1)); expect(mockView.templateSaving).toBe(true); mapping();
    expect(ui.getByRole("button", { name: "Save Template" })).toBeDisabled();
    await act(async () => held.complete(jsonResponse({ error: "Owned template save refusal" }, 409)));
    await waitFor(() => expect(mockView.templateSaving).toBe(false));
    expect(await screen.findByText("Owned template save refusal")).toBeVisible();
    expect(mockView.editingTemplateId).toBe("owned-template"); expect(screen.getByLabelText("Instruction Prompt")).toHaveValue("Retry instruction"); mapping();
    respond = async () => jsonResponse({ data: { success: true } });
    fireEvent.click(ui.getByRole("button", { name: "Save Template" }));
    await waitFor(() => expect(mockView.showTemplateEditor).toBe(false));
    expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]); expect(mockView.editingTemplateId).toBeNull();
  });

  it.each(["Cancel", "Close dialog", "Escape"])("%s forgets the stale target and New Template restores its own defaults", async close => {
    await mount(); const ui = await openEditor(); change("Template name", "Abandoned edit"); change("Reference to add", "abandoned reference");
    if (close === "Escape") fireEvent.keyDown(document, { key: "Escape" });
    else fireEvent.click(ui.getByRole("button", { name: close }));
    await waitFor(() => expect(mockView.showTemplateEditor).toBe(false)); expect(mockView.editingTemplateId).toBeNull(); expect(writes).toEqual([]);
    const fresh = await openEditor(false); mapping();
    expect(mockView).toMatchObject({ editingTemplateId: null, templateName: "", templateDescription: "", templateIcon: "Zap", templateColor: "cyan",
      templateInstruction: "", templateContext: "", templateGoals: "", templateProfile: "", templateModel: "model-a", templateProvider: "provider-a",
      templateMissionTime: 30, templateTimeout: 30, templateLocalDirs: [], templateLocalDirDraft: { path: "", branch: null },
      templateReferences: [], templateReferenceInput: "", templateSkills: [], templateCategoryId: null });
    expect(fresh.getByRole("button", { name: "Save Template" })).toBeDisabled();
    change("Template name", "Fresh template"); change("Instruction Prompt", "Fresh instruction");
    fireEvent.click(fresh.getByRole("button", { name: "Save Template" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({ action: "create", name: "Fresh template", instruction: "Fresh instruction" });
    expect(writes[0].body).not.toHaveProperty("templateId");
    await waitFor(() => expect(mockView.showTemplateEditor).toBe(false));
  });
});

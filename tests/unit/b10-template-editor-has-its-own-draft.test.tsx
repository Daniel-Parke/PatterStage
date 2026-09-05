/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B10 oracle, group missions (D70 and D72).
//
// Written before the product code moved. Holds contract section 3.
//
// The defect (D72): the template editor and the mission composer share ONE set
// of form state. handleCreateNewTemplate calls the composer's
// clearMissionFormFields(); handleEditTemplate calls its applyTemplateToForm(t).
// Both write the very fields the composer Sheet is rendering. So a half-written
// mission plus one click on "Edit Templates" and then "New template" is a
// half-written mission destroyed, with no undo and no warning.
//
// The defect (D70): closeTemplateEditor (the X, the overlay, Escape) clears
// showTemplateEditor and deliberately NOT editingTemplateId — only the Cancel
// button's hard close does that. Close the editor softly, compose an unrelated
// mission, press "Save as Template", and handleSaveAsTemplate resolves its
// target from that stale id and sends action:"update" against a template the
// new mission has nothing to do with.
//
// The contract: the editor owns its own draft, so opening it cannot touch the
// composer; the soft close clears the target exactly as the hard close does;
// and Save-as-Template resolves its target by NAME only, so no stale id can
// reach the payload at all.
// ═══════════════════════════════════════════════════════════════

import { act, renderHook } from "@testing-library/react";

// ── the wire ───────────────────────────────────────────────────

const safeApiCall = jest.fn(async () => ({ ok: true, data: {} }));

jest.mock("@/lib/api-fetch", () => ({
  safeApiCall: (...a: unknown[]) => (safeApiCall as unknown as (...a: unknown[]) => unknown)(...a),
  toastError: jest.fn(),
}));
jest.mock("@/lib/dashboard/toast-from-result", () => ({ toastFromResult: jest.fn() }));

import { useMissionTemplatesState } from "@/hooks/useMissionTemplatesState";
import { useMissionTemplateActions } from "@/hooks/useMissionTemplateActions";
import type { MissionTemplate } from "@/components/missions/TemplateModals";

// ── pre-B10 shim: the editor's own draft ───────────────────────
//
// The draft fields are contract section 3.1 and do not exist yet, so the
// oracle reads the template state through this shape rather than its type.

interface TemplateDraft {
  editingTemplateId: string | null;
  setEditingTemplateId: (id: string | null) => void;
  templateName: string;
  templateInstruction: string;
  setTemplateInstruction: (v: string) => void;
  templateContext: string;
  templateGoals: string;
  templateProfile: string;
  templateSkills: string[];
  templateCategoryId: string | null;
  closeTemplateEditor: () => void;
}

// ── fixtures ───────────────────────────────────────────────────

const TEMPLATE: MissionTemplate = {
  id: "t-1",
  name: "Nightly triage",
  icon: "Zap",
  color: "cyan",
  category: "ops",
  profile: "default",
  description: "Look at the queue",
  instruction: "Triage everything in the queue",
  context: "The queue is the backlog",
  goals: ["Empty the queue", "Write it up"],
  suggestedSkills: ["research"],
  isCustom: true,
};

/** The composer, watched. Its two mutators are the thing D72 is about. */
function composerDouble() {
  return {
    newName: "A brand new mission",
    newInstruction: "Something the user is half way through writing",
    newContext: "",
    newGoals: "",
    newOutputFormat: "",
    newConstraints: "",
    newDispatch: "save",
    newSchedule: "",
    newTimeout: 30,
    newProfile: "",
    newModel: "",
    newProvider: "",
    newLocalDirs: [],
    newReferences: [],
    newSkills: [],
    newToolsets: [],
    newCategoryId: null,
    clearMissionFormFields: jest.fn(),
    applyTemplateToForm: jest.fn(),
  };
}

function mount(templates: MissionTemplate[] = [TEMPLATE]) {
  const composer = composerDouble();
  const showToast = jest.fn();
  const fetchData = jest.fn(async () => {});
  const loadAndApplyTemplate = jest.fn();

  const { result } = renderHook(() => {
    const templateState = useMissionTemplatesState();
    const actions = useMissionTemplateActions({
      composer: composer as never,
      templateState,
      templates,
      fetchData,
      loadAndApplyTemplate,
      showToast,
    });
    return { templateState, actions };
  });

  const draft = () => result.current.templateState as unknown as TemplateDraft;
  return { result, composer, draft, showToast };
}

function lastBody(): Record<string, unknown> {
  const call = safeApiCall.mock.calls[safeApiCall.mock.calls.length - 1] as unknown as [
    string,
    { body: Record<string, unknown> },
  ];
  return call[1].body;
}

beforeEach(() => {
  safeApiCall.mockClear();
  safeApiCall.mockResolvedValue({ ok: true, data: {} } as never);
});

// ── D70: the soft close clears the target ──────────────────────

describe("closing the template editor forgets what was open", () => {
  it("clears editingTemplateId on the soft close, exactly as the hard close does", () => {
    const { result, draft } = mount();

    act(() => draft().setEditingTemplateId("t-1"));
    expect(draft().editingTemplateId).toBe("t-1");

    act(() => draft().closeTemplateEditor());

    expect(draft().editingTemplateId).toBeNull();
    expect(result.current.templateState.showTemplateEditor).toBe(false);
  });
});

// ── D70: Save as Template cannot reach a stale id ──────────────

describe("Save as Template resolves its target by name, never by a stale id", () => {
  it("creates when the composer's name matches no template, even with an id still set", async () => {
    const { result, draft } = mount();

    // The state the defect leaves behind: an id from a template the user
    // looked at earlier, and a composer holding an unrelated mission.
    act(() => draft().setEditingTemplateId("t-1"));

    await act(async () => {
      await result.current.actions.handleSaveAsTemplate();
    });

    expect(safeApiCall).toHaveBeenCalledTimes(1);
    expect(lastBody()).toMatchObject({ action: "create", name: "A brand new mission" });
    expect(lastBody().templateId).toBeUndefined();
  });

  it("does not take the icon, colour or description off the editor's drafts", async () => {
    const { result, draft } = mount();

    act(() => {
      draft().setEditingTemplateId("t-1");
      result.current.templateState.setTemplateIcon("Rocket");
      result.current.templateState.setTemplateColor("pink");
      result.current.templateState.setTemplateDescription("A description of a different template");
    });

    await act(async () => {
      await result.current.actions.handleSaveAsTemplate();
    });

    expect(lastBody()).toMatchObject({ icon: "Zap", color: "cyan", description: "" });
  });

  it("GREEN CONTROL: a name collision still arms before it overwrites (B2, D51)", async () => {
    const { result } = mount([{ ...TEMPLATE, name: "A brand new mission" }]);

    await act(async () => {
      await result.current.actions.handleSaveAsTemplate();
    });
    expect(safeApiCall).not.toHaveBeenCalled();
    expect(result.current.actions.overwriteTemplateName).toBe("A brand new mission");

    await act(async () => {
      await result.current.actions.handleSaveAsTemplate();
    });
    expect(lastBody()).toMatchObject({ action: "update", templateId: "t-1" });
  });
});

// ── D72: the editor never writes the composer ──────────────────

describe("opening the template editor leaves the composer alone", () => {
  it("does not blank the composer when starting a new template", () => {
    const { result, composer, draft } = mount();

    act(() => result.current.actions.handleCreateNewTemplate());

    expect(composer.clearMissionFormFields).not.toHaveBeenCalled();
    // It clears its OWN draft instead.
    expect(draft().templateInstruction).toBe("");
    expect(draft().templateGoals).toBe("");
    expect(draft().templateSkills).toEqual([]);
    expect(result.current.templateState.showTemplateEditor).toBe(true);
  });

  it("does not overwrite the composer when editing an existing template", () => {
    const { result, composer, draft } = mount();

    act(() => result.current.actions.handleEditTemplate(TEMPLATE));

    expect(composer.applyTemplateToForm).not.toHaveBeenCalled();
    // It seeds its OWN draft instead.
    expect(draft().templateName).toBe("Nightly triage");
    expect(draft().templateInstruction).toBe("Triage everything in the queue");
    expect(draft().templateContext).toBe("The queue is the backlog");
    expect(draft().templateGoals).toBe("Empty the queue\nWrite it up");
    expect(draft().templateProfile).toBe("default");
    expect(draft().templateSkills).toEqual(["research"]);
    expect(draft().editingTemplateId).toBe("t-1");
  });
});

// ── D72: Save writes the draft, not the composer ───────────────

describe("the editor saves what the editor holds", () => {
  it("sends the draft's instruction, not the mission the composer is holding", async () => {
    const { result, draft } = mount();

    act(() => result.current.actions.handleEditTemplate(TEMPLATE));
    act(() => draft().setTemplateInstruction("Triage the queue, then write it up"));

    await act(async () => {
      await result.current.actions.handleTemplateSave();
    });

    expect(lastBody()).toMatchObject({
      action: "update",
      templateId: "t-1",
      name: "Nightly triage",
      instruction: "Triage the queue, then write it up",
    });
    // The composer's half-written mission must not have leaked into the write.
    expect(lastBody().instruction).not.toBe("Something the user is half way through writing");
  });
});

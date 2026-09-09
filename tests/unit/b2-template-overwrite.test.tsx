/** @jest-environment jsdom */
/**
 * B2 (T-0096), D51, the fifth native-confirm site. Saving a mission as a
 * template whose name already exists asked with window.confirm over the
 * sheet. It is two clicks now: the first arms the Save-as-template button
 * with the name it would overwrite, the second writes, and the arm disarms
 * on its own. The hook holds the arm; the form shows it.
 */
import { act, render, renderHook, screen } from "@testing-library/react";

jest.mock("@/lib/api-fetch", () => ({
  // Amended 2026-09-10 (C3, T-0138): the write is runWrite over apiFetch, body as JSON.
  apiFetch: jest.fn(async () => ({ data: {} })),
  messageFromError: (e: unknown, f: string) => (e instanceof Error ? e.message : f),
  toastError: jest.fn(),
}));

import { apiFetch } from "@/lib/api-fetch";
import { useMissionTemplateActions } from "@/hooks/useMissionTemplateActions";
import { MissionComposerActions } from "@/components/missions/MissionCreateForm";

function hookArgs() {
  const composer = {
    newName: "Nightly",
    newInstruction: "Triage the queue",
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
  const templateState = {
    setShowTemplateEditor: jest.fn(),
    editingTemplateId: null,
    setEditingTemplateId: jest.fn(),
    templateName: "",
    setTemplateName: jest.fn(),
    templateDescription: "",
    setTemplateDescription: jest.fn(),
    templateIcon: "Zap",
    setTemplateIcon: jest.fn(),
    templateColor: "cyan",
    setTemplateColor: jest.fn(),
    setTemplateSaving: jest.fn(),
    closeTemplateManager: jest.fn(),
  };
  return {
    composer: composer as never,
    templateState: templateState as never,
    templates: [{ id: "t1", name: "Nightly", isCustom: true }] as never,
    fetchData: jest.fn(async () => {}),
    loadAndApplyTemplate: jest.fn(),
    showToast: jest.fn(),
  };
}

describe("the hook: an existing name arms first, writes second", () => {
  beforeEach(() => (apiFetch as jest.Mock).mockClear());

  it("does not write on the first save, names the template, and writes an update on the second", async () => {
    const args = hookArgs();
    const { result } = renderHook(() => useMissionTemplateActions(args));

    await act(async () => {
      await result.current.handleSaveAsTemplate();
    });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.current.overwriteTemplateName).toBe("Nightly");

    await act(async () => {
      await result.current.handleSaveAsTemplate();
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [, opts] = (apiFetch as jest.Mock).mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(opts.body)).toMatchObject({ action: "update", templateId: "t1" });
    expect(result.current.overwriteTemplateName).toBeNull();
  });

  it("a new name writes on the first save with nothing armed", async () => {
    const args = hookArgs();
    (args.composer as { newName: string }).newName = "Brand new";
    const { result } = renderHook(() => useMissionTemplateActions(args));
    await act(async () => {
      await result.current.handleSaveAsTemplate();
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [, opts] = (apiFetch as jest.Mock).mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(opts.body)).toMatchObject({ action: "create" });
    expect(result.current.overwriteTemplateName).toBeNull();
  });
});

describe("the form: the armed button says what the second click does", () => {
  const formState = { newName: "Nightly", newInstruction: "Triage", newDispatch: "save" } as never;

  it("reads Save as template while nothing is armed", () => {
    render(
      <MissionComposerActions
        editingId={null}
        missions={[]}
        formState={formState}
        onSubmit={() => {}}
        onSaveAsTemplate={() => {}}
        onClose={() => {}}
        dispatching={false}
      />,
    );
    const button = screen.getByRole("button", { name: /save as template/i });
    expect(button).not.toHaveAttribute("data-armed");
  });

  it("names the template it would overwrite, and is marked armed", () => {
    render(
      <MissionComposerActions
        editingId={null}
        missions={[]}
        formState={formState}
        onSubmit={() => {}}
        onSaveAsTemplate={() => {}}
        overwriteTemplateName="Nightly"
        onClose={() => {}}
        dispatching={false}
      />,
    );
    const button = screen.getByRole("button", { name: /overwrite "nightly"\?/i });
    expect(button).toHaveAttribute("data-armed", "true");
    expect(button).not.toBeDisabled();
  });
});

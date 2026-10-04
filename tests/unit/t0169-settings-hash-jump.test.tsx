/** @jest-environment jsdom */

import { render } from "@testing-library/react";

import { CONFIG_SECTIONS } from "@/lib/config/config-schema";

const mockUseSettingsEditor = jest.fn();
jest.mock("@/hooks/useSettingsEditor", () => ({ useSettingsEditor: () => mockUseSettingsEditor() }));
jest.mock("@/components/layout/AppPageShell", () => require("../helpers/mocks").appPageShellMock());
jest.mock("@/components/layout/PageHeader", () => function PageHeaderFake() { return <h1>Settings</h1>; });
jest.mock("@/components/config/SettingsNav", () => () => null);
jest.mock("@/components/config/SettingsSection", () => function SettingsSectionFake(
  { editor }: { editor: { section: { id: string } } },
) { return <section id={editor.section.id} />; });
jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());

import SettingsPage from "@/app/agent/settings/page";

test("Settings waits for file layout before jumping to a bookmarked section", () => {
  window.location.hash = "#env";
  const jump = jest.fn();
  const originalJump = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: jump });

  let fileLayoutReady = false;
  mockUseSettingsEditor.mockImplementation(() => ({
    config: {}, isLoading: false, error: null, refetch: jest.fn(), configError: null,
    subject: null, fileLayoutReady,
    editorFor: (id: string) => ({ section: CONFIG_SECTIONS[id] }),
  }));

  try {
    const view = render(<SettingsPage />);
    expect(document.getElementById("env")).not.toBeNull();
    expect(jump).not.toHaveBeenCalled();

    fileLayoutReady = true;
    view.rerender(<SettingsPage />);
    expect(jump).toHaveBeenCalledTimes(1);
    expect(jump.mock.instances[0]).toBe(document.getElementById("env"));
    expect(jump).toHaveBeenCalledWith({ block: "start" });
    view.unmount();
  } finally {
    window.location.hash = "";
    if (originalJump) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalJump);
    else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    mockUseSettingsEditor.mockReset();
  }
});

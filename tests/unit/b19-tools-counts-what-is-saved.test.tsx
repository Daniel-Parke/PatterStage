/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * T-0113: the Tools screen reported a state that was not stored.
 *
 * Toggling a chip moved the header count and the Enabled tile immediately, and
 * nothing on the screen said there was anything to save. So a reader who
 * toggled two toolsets and walked away was told, by two counters, that their
 * agent had them, and the agent did not. The page already knew: `toolsetsDirty`
 * was computed and used only to guard a profile switch, and was never rendered.
 *
 * What these pin: the counters describe the SAVED list, the screen says when
 * there is unsaved work, and saving is what moves the numbers.
 */

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithQuery } from "../helpers/render-with-query";
import { pageSubtitle } from "../helpers/page-subtitle";

jest.mock("next/navigation", () => ({
  usePathname: () => "/agent/tools",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/components/layout/AppPageShell", () => require("../helpers/mocks").appPageShellMock());
jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

// Amended 2026-09-10 (U11, T-0125). The Enabled tile is gone: the strip
// restated the subtitle, so the subtitle is the one count now, and it is read
// off the DOM below rather than captured from props.
jest.mock("@/hooks/useProfiles", () => ({
  useProfiles: () => ({ refetch: async () => undefined, data: [{ id: "default", name: "Bob", description: "" }], isLoading: false, error: null }),
}));
jest.mock("@/components/ui/ProfilePicker", () => require("../helpers/mocks").profilePickerMock());

const mockApiFetch = jest.fn();
const mockSafeApiCallData = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
  // The Tools page reads through useApiResource, which calls safeApiCall; routed
  // through the same mock so a read is still one of the paths asked for (C6, T-0143).
   
  safeApiCall: require("../helpers/mocks").safeApiCallOver((...a: unknown[]) => mockApiFetch(...a)),
  safeApiCallData: (...a: unknown[]) => mockSafeApiCallData(...a),
}));

import ToolsPage from "@/app/agent/tools/page";
import { setSelectedProfile } from "@/hooks/useSelectedProfile";

/** What the server holds. A PUT replaces it, so the reload after a save sees it. */
let stored: string[] = [];

function answerToolsets(initial: string[]) {
  stored = [...initial];
  mockApiFetch.mockImplementation(async (path: string, init?: { method?: string; body?: string }) => {
    if (path.includes("/toolsets") && init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as { platformToolsets: Record<string, string[]> };
      stored = Object.values(body.platformToolsets)[0] ?? [];
      return { data: { success: true } };
    }
    if (path.includes("/toolsets")) {
      return {
        data: {
          platformToolsets: { cli: stored },
          unifiedEnabled: stored,
          source: "database",
          platformsDiverged: false,
        },
      };
    }
    return { data: { success: true } };
  });
  mockSafeApiCallData.mockResolvedValue({ profiles: [] });
}

function chip(label: string): HTMLButtonElement {
  const found = screen
    .getAllByRole("button")
    .find((b) => (b.textContent ?? "").trim().startsWith(label));
  if (!found) throw new Error(`no chip labelled ${label}`);
  return found as HTMLButtonElement;
}

async function renderLoaded(initial: string[]) {
  answerToolsets(initial);
  renderWithQuery(<ToolsPage />);
  await waitFor(() => expect(screen.getByText("Enabled toolsets")).toBeInTheDocument());
}

/** The enabled count the subtitle prints, read off the DOM. */
const lastEnabledTile = () => {
  const m = /(\d+) of \d+ toolsets enabled/.exec(document.body.textContent ?? "");
  return m ? Number(m[1]) : undefined;
};

beforeEach(() => {
  jest.clearAllMocks();
  // The selection is shared across the agent screens now, so it outlives a
  // render. Put it back to the root agent, as a fresh page load would.
  setSelectedProfile("default");
});

describe("with nothing changed", () => {
  it("counts the toolsets the profile actually has", async () => {
    await renderLoaded(["web", "vision"]);

    expect(pageSubtitle()).toHaveTextContent(/\b2 of \d+ toolsets enabled/i);
    expect(lastEnabledTile()).toBe(2);
  });

  it("GREEN CONTROL: says nothing about unsaved work", async () => {
    await renderLoaded(["web", "vision"]);

    expect(screen.queryByText(/unsaved changes/i)).toBeNull();
  });
});

describe("with a chip toggled and not yet saved", () => {
  it("says there are unsaved changes", async () => {
    await renderLoaded(["web"]);

    fireEvent.click(chip("Vision"));

    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
  });

  it("does not let the header count claim it", async () => {
    await renderLoaded(["web"]);

    fireEvent.click(chip("Vision"));

    // One is stored. The chip shows the choice; the count must not.
    expect(pageSubtitle()).toHaveTextContent(/\b1 of \d+ toolsets enabled/i);
    expect(pageSubtitle()).not.toHaveTextContent(/\b2 of \d+ toolsets enabled/i);
  });

  it("does not let the Enabled tile claim it either", async () => {
    await renderLoaded(["web"]);

    fireEvent.click(chip("Vision"));

    expect(lastEnabledTile()).toBe(1);
  });

  it("counts a toolset turned OFF as still stored until the save", async () => {
    await renderLoaded(["web", "vision"]);

    fireEvent.click(chip("Vision"));

    expect(pageSubtitle()).toHaveTextContent(/\b2 of \d+ toolsets enabled/i);
    expect(lastEnabledTile()).toBe(2);
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
  });

  it("says the same about a hand-edited JSON payload", async () => {
    await renderLoaded(["web"]);
    fireEvent.click(screen.getByRole("button", { name: /Show advanced JSON/i }));
    const box = await screen.findByLabelText("Advanced toolsets JSON");

    fireEvent.change(box, { target: { value: '{"cli":["web","terminal"]}' } });

    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    expect(pageSubtitle()).toHaveTextContent(/\b1 of \d+ toolsets enabled/i);
  });
});

describe("after the save", () => {
  it("moves the counters and drops the marker", async () => {
    await renderLoaded(["web"]);
    fireEvent.click(chip("Vision"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save & push toolsets/i }));
    });

    await waitFor(() => expect(pageSubtitle()).toHaveTextContent(/\b2 of \d+ toolsets enabled/i));
    expect(lastEnabledTile()).toBe(2);
    expect(screen.queryByText(/unsaved changes/i)).toBeNull();
  });
});

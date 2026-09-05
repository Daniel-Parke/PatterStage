/** @jest-environment jsdom */

/**
 * B9 oracle, the Tools page (T-0103, D80, D82-adv, D84).
 *
 *   D80  A granular toolset covered by an enabled hermes-* bundle is a
 *        control that turns itself off: the click registers, Save reports
 *        success, and the reload shows it off again. It should read as
 *        already on, because it IS on, and say what is providing it.
 *        Enabled and disabled chips are also told apart by colour alone.
 *   D82  Advanced-JSON edits are discarded in silence: toggling a chip
 *        overwrites the textarea, and hiding the panel drops the edit from
 *        the payload.
 *   D84  Switching profile discards unsaved toolset changes with no warning.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  usePathname: () => "/agent/tools",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/components/layout/AppPageShell", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("lucide-react", () => {
  const icon = (name: string) =>
    function Icon(props: Record<string, unknown>) {
      return <svg data-icon={name} aria-hidden="true" {...props} />;
    };
  return new Proxy({}, { get: (_t, prop: string) => icon(prop) });
});
jest.mock("@/modules/hermes/components/ToolsInsights", () => ({
  __esModule: true,
  default: () => <div data-testid="tools-insights" />,
}));
jest.mock("@/components/ui/ProfileSelector", () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select aria-label="Profile" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="default">Bob</option>
      <option value="qa">QA Engineer</option>
    </select>
  ),
}));

const mockApiFetch = jest.fn();
const mockSafeApiCallData = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
  safeApiCallData: (...a: unknown[]) => mockSafeApiCallData(...a),
}));

import ToolsPage from "@/app/agent/tools/page";

/** Every path the page called, with its init. */
const calls = () =>
  mockApiFetch.mock.calls.map(([path, init]) => ({
    path: String(path),
    init: init as { method?: string; body?: string } | undefined,
  }));

const puts = () =>
  calls()
    .filter((c) => c.init?.method === "PUT")
    .map((c) => JSON.parse(String(c.init!.body)) as { platformToolsets: Record<string, string[]> });

function answerToolsets(unified: string[]) {
  mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path.includes("/toolsets") && !init?.method) {
      return {
        data: {
          platformToolsets: { cli: unified },
          unifiedEnabled: unified,
          source: "database",
          platformsDiverged: false,
        },
      };
    }
    return { data: { success: true } };
  });
  mockSafeApiCallData.mockResolvedValue({ profiles: [] });
}

/** The chip for one toolset, found by its visible label. */
function chip(label: string): HTMLButtonElement {
  const found = screen
    .getAllByRole("button")
    .find((b) => (b.textContent ?? "").trim().startsWith(label));
  if (!found) throw new Error(`no chip labelled ${label}`);
  return found as HTMLButtonElement;
}

async function renderLoaded(unified: string[]) {
  answerToolsets(unified);
  render(<ToolsPage />);
  await waitFor(() => expect(screen.getByText("Enabled toolsets")).toBeInTheDocument());
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// D80: a control that cannot lie
// ═══════════════════════════════════════════════════════════════

describe("a toolset a bundle already provides", () => {
  it("reads as on, and is not a control", async () => {
    await renderLoaded(["hermes-cli"]);

    const terminal = chip("Terminal");
    expect(terminal.getAttribute("aria-pressed")).toBe("true");
    expect(terminal).toBeDisabled();
  });

  it("says what is providing it", async () => {
    await renderLoaded(["hermes-cli"]);

    expect(screen.getByText(/included in Hermes CLI/i)).toBeInTheDocument();
  });

  it("GREEN CONTROL: with the bundle off it is an ordinary control again", async () => {
    await renderLoaded(["web"]);

    const terminal = chip("Terminal");
    expect(terminal.getAttribute("aria-pressed")).toBe("false");
    expect(terminal).not.toBeDisabled();
  });

  it("a covered toolset is never sent as its own entry", async () => {
    await renderLoaded(["hermes-cli"]);

    // Clicking it must not add it. Before the fix the click registered, the
    // save reported success and the reload turned it back off.
    fireEvent.click(chip("Terminal"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save & push toolsets/i }));
    });

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].platformToolsets.cli).not.toContain("terminal");
  });
});

describe("on and off are not colour alone", () => {
  it("an enabled chip carries a state marker an uncoloured screen can read", async () => {
    await renderLoaded(["web"]);

    const on = chip("Web");
    const off = chip("Vision");
    expect(on.querySelector("[data-icon='Check']")).not.toBeNull();
    expect(off.querySelector("[data-icon='Check']")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// D82: the advanced JSON is not thrown away
// ═══════════════════════════════════════════════════════════════

describe("hand-edited JSON", () => {
  async function openAndEditJson() {
    await renderLoaded(["web"]);
    fireEvent.click(screen.getByRole("button", { name: /Show advanced JSON/i }));
    const box = await screen.findByLabelText("Advanced toolsets JSON");
    fireEvent.change(box, { target: { value: '{"cli":["web","terminal"]}' } });
    return box;
  }

  it("is what Save sends, even after the panel is hidden", async () => {
    await openAndEditJson();
    fireEvent.click(screen.getByRole("button", { name: /Hide advanced JSON/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Save & push toolsets/i }));
    });

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0].platformToolsets).toEqual({ cli: ["web", "terminal"] });
  });

  it("takes the grid out of play while it stands, and says so", async () => {
    await openAndEditJson();

    expect(screen.getByText(/advanced JSON is the source of truth/i)).toBeInTheDocument();
    expect(chip("Vision")).toBeDisabled();
  });

  it("can be discarded, which gives the grid back", async () => {
    await openAndEditJson();

    fireEvent.click(screen.getByRole("button", { name: /Discard JSON edits/i }));

    expect(screen.queryByText(/advanced JSON is the source of truth/i)).toBeNull();
    expect(chip("Vision")).not.toBeDisabled();
  });
});

// ═══════════════════════════════════════════════════════════════
// D84: a profile switch asks
// ═══════════════════════════════════════════════════════════════

describe("switching profile with unsaved changes", () => {
  it("asks instead of discarding", async () => {
    await renderLoaded(["web"]);
    fireEvent.click(chip("Vision"));

    fireEvent.change(screen.getByLabelText("Profile"), { target: { value: "qa" } });

    expect(await screen.findByText(/unsaved toolset changes/i)).toBeInTheDocument();
    // Still on the profile that holds the work.
    expect((screen.getByLabelText("Profile") as HTMLSelectElement).value).toBe("default");
    expect(chip("Vision").getAttribute("aria-pressed")).toBe("true");
  });

  it("Keep editing leaves the work where it is", async () => {
    await renderLoaded(["web"]);
    fireEvent.click(chip("Vision"));
    fireEvent.change(screen.getByLabelText("Profile"), { target: { value: "qa" } });
    await screen.findByText(/unsaved toolset changes/i);

    fireEvent.click(screen.getByRole("button", { name: /Keep editing/i }));

    expect(screen.queryByText(/unsaved toolset changes/i)).toBeNull();
    expect(chip("Vision").getAttribute("aria-pressed")).toBe("true");
  });

  it("Discard changes goes through to the other profile", async () => {
    await renderLoaded(["web"]);
    fireEvent.click(chip("Vision"));
    fireEvent.change(screen.getByLabelText("Profile"), { target: { value: "qa" } });
    await screen.findByText(/unsaved toolset changes/i);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Discard changes/i }));
    });

    await waitFor(() =>
      expect((screen.getByLabelText("Profile") as HTMLSelectElement).value).toBe("qa"),
    );
    expect(screen.queryByText(/unsaved toolset changes/i)).toBeNull();
  });

  it("GREEN CONTROL: with nothing changed, the switch just happens", async () => {
    await renderLoaded(["web"]);

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Profile"), { target: { value: "qa" } });
    });

    expect(screen.queryByText(/unsaved toolset changes/i)).toBeNull();
    expect((screen.getByLabelText("Profile") as HTMLSelectElement).value).toBe("qa");
  });
});

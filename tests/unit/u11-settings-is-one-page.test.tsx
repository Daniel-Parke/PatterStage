/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * U11 (T-0125), decision 7: Settings is one scrollable page.
 *
 * The index rendered 32 links and zero settings: three page cards and 27
 * section cards, 2,814px of chrome, each card leading to a page averaging
 * three and a half fields. Changing two settings in different sections cost
 * four navigations, and "what is the timeout" cost a click and a scroll to
 * find out which card held it.
 *
 * What these pin. Every section is ON the page, in its group, with its own
 * Save and Reset, so the save contract is unchanged - one section, only the
 * keys that differ - and a save in one section never enables another's. A
 * sticky section nav names all 27 and the three pages that are not sections.
 * The search stays, because it was the only fast path, and it narrows the
 * page rather than a grid of doors. The two file sections render in place,
 * and the nested keys that were never editable sit behind a disclosure rather
 * than a page.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { CONFIG_SECTIONS } from "@/lib/config-schema";
import { SETTINGS_GROUPS, SETTINGS_TOOLS, settingsSectionIds } from "@/lib/config-sections";

jest.mock("next/navigation", () => ({
  usePathname: () => "/agent/settings",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());
jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());
jest.mock("@/components/layout/AppPageShell", () => require("../helpers/mocks").appPageShellMock());
jest.mock("@/hooks/useProfiles", () => ({
  useProfiles: () => ({
    data: [{ id: "default", name: "Bob (local default)", description: "" }],
    isLoading: false,
    error: null,
  }),
}));

const mockUseConfig = jest.fn();
jest.mock("@/hooks/useConfig", () => ({ useConfig: () => mockUseConfig() }));

const mockApiFetch = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
}));

import SettingsPage from "@/app/agent/settings/page";

const IDS = settingsSectionIds();

function answer(config: Record<string, unknown>) {
  mockUseConfig.mockReturnValue({
    data: config,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    configError: null,
    subject: "default",
  });
  mockApiFetch.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (path === "/api/config" && init?.method === "PUT") return { data: { success: true } };
    if (path === "/api/agent/files/hermes") return { data: { content: "# HERMES\n" } };
    if (path === "/api/agent/files/env") return { data: { content: "OPENAI_API_KEY=****\n# a comment\n" } };
    if (path.endsWith("/toolsets")) return { data: { platformToolsets: { cli: ["web"] } } };
    return { data: {} };
  });
}

const section = (id: string) => screen.getByTestId(`settings-section-${id}`);
const saveIn = (id: string) => within(section(id)).getByRole("button", { name: /^Save/ });

/** Every PUT /api/config body the page sent, parsed. */
function puts(): Array<{ section: string; values: Record<string, unknown> }> {
  return mockApiFetch.mock.calls
    .filter(([p, init]) => p === "/api/config" && (init as { method?: string } | undefined)?.method === "PUT")
    .map(([, init]) => JSON.parse((init as { body: string }).body));
}

async function renderLoaded(config: Record<string, unknown> = { agent: { max_turns: 40 } }) {
  answer(config);
  render(<SettingsPage />);
  await screen.findByTestId("settings-section-agent");
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
});

describe("every section is on the page", () => {
  it("renders one section per catalogue entry, each headed with its own label", async () => {
    await renderLoaded();
    for (const id of IDS) {
      const s = section(id);
      expect(s.tagName).toBe("SECTION");
      expect(s.id).toBe(id);
      expect(within(s).getByRole("heading", { level: 2 })).toHaveTextContent(CONFIG_SECTIONS[id].label);
    }
  });

  it("in the catalogue's groups, in the catalogue's order", async () => {
    await renderLoaded();
    const order = IDS.map((id) => section(id));
    for (let i = 1; i < order.length; i++) {
      // eslint-disable-next-line no-bitwise
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    for (const group of SETTINGS_GROUPS) {
      expect(screen.getByRole("heading", { name: group.label })).toBeInTheDocument();
    }
  });

  it("carries no link to a section page: a section is an anchor now", async () => {
    await renderLoaded();
    const sectionLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="/agent/settings/"]'))
      .map((a) => a.getAttribute("href")!)
      .filter((h) => h !== "/agent/settings/restore" && h !== "/agent/settings/system");
    expect(sectionLinks).toEqual([]);
  });
});

describe("the section nav", () => {
  it("names every section as an anchor, and the three pages as pages", async () => {
    await renderLoaded();
    const nav = screen.getByRole("navigation", { name: /settings sections/i });
    for (const id of IDS) {
      expect(within(nav).getByRole("link", { name: CONFIG_SECTIONS[id].label })).toHaveAttribute("href", `#${id}`);
    }
    for (const tool of SETTINGS_TOOLS) {
      expect(within(nav).getByRole("link", { name: tool.label })).toHaveAttribute("href", tool.href);
    }
  });

  it("the nav holds exactly the sections plus the three pages, nothing invented", async () => {
    await renderLoaded();
    const nav = screen.getByRole("navigation", { name: /settings sections/i });
    expect(within(nav).getAllByRole("link")).toHaveLength(IDS.length + SETTINGS_TOOLS.length);
  });
});

describe("each section saves itself, and only itself", () => {
  it("Save is disabled everywhere until something changes", async () => {
    await renderLoaded();
    for (const id of ["agent", "display", "discord"]) expect(saveIn(id)).toBeDisabled();
    expect(puts()).toHaveLength(0);
  });

  it("a change in Agent enables Agent's Save and no other section's", async () => {
    await renderLoaded();
    fireEvent.click(within(section("agent")).getByRole("switch", { name: /^Verbose Mode/ }));
    expect(saveIn("agent")).toBeEnabled();
    expect(saveIn("display")).toBeDisabled();
    expect(within(section("agent")).getByText("UNSAVED")).toBeInTheDocument();
    expect(within(section("display")).queryByText("UNSAVED")).toBeNull();
  });

  it("the save carries the section and only the keys that differ", async () => {
    await renderLoaded({ agent: { max_turns: 40, verbose: false } });
    fireEvent.click(within(section("agent")).getByRole("switch", { name: /^Verbose Mode/ }));
    await act(async () => {
      fireEvent.click(saveIn("agent"));
    });
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]).toEqual({ section: "agent", values: { verbose: true } });
    await waitFor(() => expect(saveIn("agent")).toBeDisabled());
  });

  it("Reset puts a section back without touching another section's draft", async () => {
    await renderLoaded({ agent: { max_turns: 40 }, display: { show_cost: false } });
    fireEvent.click(within(section("agent")).getByRole("switch", { name: /^Verbose Mode/ }));
    fireEvent.click(within(section("display")).getByRole("switch", { name: /^Show Cost/i }));
    fireEvent.click(within(section("agent")).getByRole("button", { name: /^Reset/ }));
    expect(saveIn("agent")).toBeDisabled();
    expect(saveIn("display")).toBeEnabled();
  });

  it("Save follows the declared range, with the problem in its title", async () => {
    await renderLoaded({ agent: { max_turns: 40 } });
    const input = within(section("agent")).getByDisplayValue("40");
    fireEvent.change(input, { target: { value: "9999" } });
    expect(saveIn("agent")).toBeDisabled();
    expect(saveIn("agent").getAttribute("title") ?? "").toContain("Max Turns must be between 1 and 500");
    fireEvent.change(input, { target: { value: "300" } });
    expect(saveIn("agent")).toBeEnabled();
  });

  it("after a Clear is saved, the key has left the section's state", async () => {
    await renderLoaded({ agent: { max_turns: 40 } });
    fireEvent.click(within(section("agent")).getByRole("button", { name: "Clear Max Turns" }));
    await act(async () => {
      fireEvent.click(saveIn("agent"));
    });
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]).toEqual({ section: "agent", values: { max_turns: null } });
    expect(within(section("agent")).queryByRole("button", { name: "Clear Max Turns" })).toBeNull();
    await waitFor(() => expect(saveIn("agent")).toBeDisabled());
  });
});

describe("the search narrows the page", () => {
  it("keeps only the sections that match, and says which field matched", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByRole("searchbox", { name: /search settings/i }), {
      target: { value: "reasoning" },
    });
    expect(screen.getByTestId("settings-section-agent")).toBeInTheDocument();
    expect(screen.queryByTestId("settings-section-discord")).toBeNull();
    expect(within(section("agent")).getByText(/reasoning effort/i)).toBeInTheDocument();
    // The nav follows the page: a hidden section is not offered as a jump.
    const nav = screen.getByRole("navigation", { name: /settings sections/i });
    expect(within(nav).queryByRole("link", { name: CONFIG_SECTIONS.discord.label })).toBeNull();
  });

  it("says so when nothing matches, and an empty box brings everything back", async () => {
    await renderLoaded();
    const box = screen.getByRole("searchbox", { name: /search settings/i });
    fireEvent.change(box, { target: { value: "zzz-no-such-field" } });
    expect(screen.getByText(/no setting matches/i)).toBeInTheDocument();
    expect(screen.queryByTestId("settings-section-agent")).toBeNull();
    fireEvent.change(box, { target: { value: "" } });
    expect(screen.getByTestId("settings-section-agent")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^settings-section-/)).toHaveLength(IDS.length);
  });
});

describe("the two file sections render in place", () => {
  it("HERMES.md is an editor with its own Save", async () => {
    await renderLoaded();
    const s = section("hermes_md");
    const box = await within(s).findByRole("textbox", { name: /HERMES\.md/i });
    expect(box).toHaveValue("# HERMES\n");
    fireEvent.change(box, { target: { value: "# HERMES\n\nMore.\n" } });
    await act(async () => {
      fireEvent.click(saveIn("hermes_md"));
    });
    const put = mockApiFetch.mock.calls.find(
      ([p, init]) => p === "/api/agent/files/hermes" && (init as { method?: string } | undefined)?.method === "PUT",
    );
    expect(put).toBeTruthy();
    expect(JSON.parse((put![1] as { body: string }).body)).toEqual({ content: "# HERMES\n\nMore.\n", backup: true });
  });

  it(".env is read-only and masked: a key is named, its value is not printed", async () => {
    await renderLoaded();
    const s = section("env");
    expect(await within(s).findByText("OPENAI_API_KEY")).toBeInTheDocument();
    expect(within(s).queryByRole("button", { name: /^Save/ })).toBeNull();
    expect(within(s).queryByRole("textbox")).toBeNull();
  });
});

describe("what was never editable is behind a disclosure, not a page", () => {
  it("a section's nested keys are named inside a details element", async () => {
    await renderLoaded({ discord: { free_response_channels: { a: 1 } } });
    const s = section("discord");
    const details = s.querySelector("details");
    expect(details).not.toBeNull();
    expect(details!.textContent).toContain("free_response_channels");
  });
});

describe("whose settings these are", () => {
  it("names the subject once, above the sections", async () => {
    await renderLoaded();
    expect(screen.getAllByText(/These settings belong to Bob/)).toHaveLength(1);
  });
});

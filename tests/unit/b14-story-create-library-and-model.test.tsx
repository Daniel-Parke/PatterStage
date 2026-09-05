/** @jest-environment jsdom */

// ═══════════════════════════════════════════════════════════════
// B14 oracle, group create-page: the library round-trip and the writing model
// (D89, D94, and the model selector the plan names). Contract 4.1, 4.2, 4.3.
//
// THE DEFECTS.
//   D89 create/page.tsx:260-269 posts `{action:"themes", subAction:"delete",
//       promptId}`; handlers/library.ts:129 reads `body.themeId` and answers
//       400 "Missing themeId". The client's `catch {}` swallows it and then
//       optimistically filters the theme out of state, so the theme vanishes
//       from the screen and is still in the database on the next load.
//   D94 saveCharacter gates its "Saved!" state and its list refresh on
//       `d.data?.id` (create/page.tsx:216); handleCharacters answers
//       `{data:{character}}` (library.ts:76), so the gate is never true. The
//       character IS written, and nothing on screen says so. saveAsTheme has
//       the identical bug at :247 against `{data:{theme}}`.
//   +   Story Weaver writes with whatever the gateway defaults to. There is no
//       way to choose the model, which is also why its spend has no model
//       dimension (D87's other half).
//
// The double is global fetch, so the assertion for each write is the body that
// actually goes on the wire, and each read is answered in the handlers' own
// envelope shape.
// ═══════════════════════════════════════════════════════════════

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("lucide-react", () => {
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: jest.fn(), back: jest.fn() }),
  useParams: () => ({}),
  usePathname: () => "/recroom/story-weaver/create",
  useSearchParams: () => new URLSearchParams(),
}));

const useModels = jest.fn();
const useModelDefaults = jest.fn();
jest.mock("@/hooks/useModels", () => ({
  useModels: () => useModels(),
  useModelDefaults: () => useModelDefaults(),
}));

import CreateStoryPage from "@/app/recroom/story-weaver/create/page";

// ── doubles ─────────────────────────────────────────────────────

type Body = Record<string, unknown>;

const fetchMock = jest.fn<Promise<unknown>, [string, RequestInit?]>();

const THEME = {
  id: "T-1",
  name: "Salt and starlight",
  premise: "A lighthouse at the end of the world",
  genre: ["Mystery"],
  era: "Modern",
  setting: "Island",
  mood: ["Melancholy"],
  notes: "",
  createdAt: "",
  updatedAt: "",
};

const MODELS = [
  { id: "m-1", name: "Sonnet", provider: "anthropic", modelId: "anthropic/claude-sonnet-4", baseUrl: null, contextLength: null, credentialsId: null, createdAt: "", updatedAt: "" },
  { id: "m-2", name: "Mini", provider: "openai", modelId: "gpt-4o-mini", baseUrl: null, contextLength: null, credentialsId: null, createdAt: "", updatedAt: "" },
];

const SECOND_THEME = { ...THEME, id: "T-2", name: "Rust and rain" };

/** Answers keyed on `action`/`subAction`; overridable per test. */
let refuseThemeDelete = false;
/** Flips once a theme has been created, so the next list carries it. */
let themeCreated = false;

function answer(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function installFetch(): void {
  fetchMock.mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Body;
    if (body.action === "themes") {
      if (body.subAction === "list") {
        // After a create, the list is what tells the page the new theme exists.
        return answer({ data: { themes: themeCreated ? [THEME, SECOND_THEME] : [THEME] } });
      }
      if (body.subAction === "create") {
        themeCreated = true;
        return answer({ data: { theme: SECOND_THEME } });
      }
      if (body.subAction === "delete") {
        return refuseThemeDelete
          ? answer({ error: "Missing themeId" }, 400)
          : answer({ data: { deleted: true } });
      }
    }
    if (body.action === "characters") {
      if (body.subAction === "list") return answer({ data: { characters: [] } });
      if (body.subAction === "create") {
        // The shape handlers/library.ts actually returns.
        return answer({ data: { character: { id: "C-1", name: String(body.name) } } });
      }
    }
    if (body.action === "create") return answer({ data: { id: "S-9" } });
    return answer({ data: {} });
  });
}

function bodies(): Body[] {
  return fetchMock.mock.calls.map((c) => JSON.parse(String(c[1]?.body ?? "{}")) as Body);
}

function bodiesFor(action: string, subAction?: string): Body[] {
  return bodies().filter((b) => b.action === action && (subAction === undefined || b.subAction === subAction));
}

async function mount() {
  const utils = render(<CreateStoryPage />);
  // The saved-theme card only renders once the themes list has landed.
  await screen.findByText(THEME.name);
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  refuseThemeDelete = false;
  themeCreated = false;
  window.localStorage.clear();
  (globalThis as { fetch?: unknown }).fetch = fetchMock;
  installFetch();
  useModels.mockReturnValue({ data: MODELS, error: null, isLoading: false, refetch: jest.fn() });
  useModelDefaults.mockReturnValue({ data: { agent: "m-2" }, error: null, isLoading: false, refetch: jest.fn() });
});

// ═══════════════════════════════════════════════════════════════
// D89 — deleting a theme
// ═══════════════════════════════════════════════════════════════

describe("deleting a saved theme", () => {
  it("posts themeId, which is the field the handler reads", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: `Delete theme ${THEME.name}` }));

    await waitFor(() => expect(bodiesFor("themes", "delete")).toHaveLength(1));
    const sent = bodiesFor("themes", "delete")[0];
    expect(sent.themeId).toBe("T-1");
    expect(sent).not.toHaveProperty("promptId");
  });

  it("a refused delete leaves the theme on screen and says what happened", async () => {
    refuseThemeDelete = true;
    await mount();
    fireEvent.click(screen.getByRole("button", { name: `Delete theme ${THEME.name}` }));

    await waitFor(() => expect(bodiesFor("themes", "delete")).toHaveLength(1));
    // The optimistic removal runs on success only: a theme that is still in the
    // database is still on the screen.
    await waitFor(() => expect(screen.getByText(THEME.name)).toBeInTheDocument());
    expect(await screen.findByText(/Missing themeId|Could not delete/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// D94 — saving to the library
// ═══════════════════════════════════════════════════════════════

describe("Save to Library reads the answer the handler actually sends", () => {
  async function expandFirstCharacter(): Promise<void> {
    await mount();
    fireEvent.click(screen.getByText("Captain Eira Voss"));
    await screen.findByRole("button", { name: /Save to Library/ });
  }

  it("confirms the save on {data:{character}}", async () => {
    await expandFirstCharacter();
    fireEvent.click(screen.getByRole("button", { name: /Save to Library/ }));

    await waitFor(() => expect(bodiesFor("characters", "create")).toHaveLength(1));
    expect(await screen.findByRole("button", { name: /Saved!/ })).toBeInTheDocument();
  });

  it("re-lists the library so the From Library picker is not stale", async () => {
    await expandFirstCharacter();
    const listsBefore = bodiesFor("characters", "list").length;
    fireEvent.click(screen.getByRole("button", { name: /Save to Library/ }));

    await waitFor(() => expect(bodiesFor("characters", "list").length).toBe(listsBefore + 1));
  });

  it("re-lists themes on {data:{theme}} after Save as Theme", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: /Save as Theme/ }));
    fireEvent.change(await screen.findByLabelText("Theme name"), { target: { value: "New theme" } });
    const listsBefore = bodiesFor("themes", "list").length;
    fireEvent.click(screen.getByRole("button", { name: /Save theme/ }));

    await waitFor(() => expect(bodiesFor("themes", "create")).toHaveLength(1));
    await waitFor(() => expect(bodiesFor("themes", "list").length).toBe(listsBefore + 1));
    // Making the request is not the point; reading the answer is. A relist
    // whose result is dropped leaves the operator looking at a saved-themes
    // strip that does not contain what they just saved.
    expect(await screen.findByText(SECOND_THEME.name)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// the writing model
// ═══════════════════════════════════════════════════════════════

describe("the operator chooses which model writes the story", () => {
  it("offers the registry, with the agent default preselected", async () => {
    await mount();
    const select = (await screen.findByLabelText("Writing model")) as HTMLSelectElement;

    expect(within(select).getByRole("option", { name: /Agent default model/ })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: /Sonnet/ })).toBeInTheDocument();
    // The agent default slot names m-2, so that is what is selected before the
    // operator touches anything.
    expect(select.value).toBe("m-2");
  });

  it("puts the chosen model on the wire, where the story config keeps it", async () => {
    await mount();
    const select = (await screen.findByLabelText("Writing model")) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "m-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Begin Writing/ }));

    await waitFor(() => expect(bodiesFor("create")).toHaveLength(1));
    const config = bodiesFor("create")[0].config as Record<string, unknown>;
    expect(config.modelId).toBe("m-1");
  });

  it("sends no model at all when the operator picks the agent default", async () => {
    useModelDefaults.mockReturnValue({ data: { agent: null }, error: null, isLoading: false, refetch: jest.fn() });
    await mount();
    fireEvent.click(screen.getByRole("button", { name: /Begin Writing/ }));

    await waitFor(() => expect(bodiesFor("create")).toHaveLength(1));
    const config = bodiesFor("create")[0].config as Record<string, unknown>;
    expect(config.modelId).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════
// GREEN CONTROL
// ═══════════════════════════════════════════════════════════════

describe("GREEN CONTROL: the rest of the create page is untouched", () => {
  it("still lists saved themes and still posts a premise on create", async () => {
    await mount();
    expect(bodiesFor("themes", "list").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Begin Writing/ }));
    await waitFor(() => expect(bodiesFor("create")).toHaveLength(1));
    const config = bodiesFor("create")[0].config as Record<string, unknown>;
    expect(String(config.premise).length).toBeGreaterThan(10);
  });
});

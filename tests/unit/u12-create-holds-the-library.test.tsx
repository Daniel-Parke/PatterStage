/** @jest-environment jsdom */
/**
 * U12 (T-0126): the saved themes and the character library are panels on
 * Create, which is the only screen that ever used them.
 *
 * Characters and Themes were two pages of CRUD over lists that Create already
 * read (to import from) and wrote (Save to Library, Save as Theme). Bringing
 * the lists here loses nothing they offered - each entry can still be made,
 * edited and deleted, in a dialog - and it makes the import one click where it
 * was two: the library is on the page, so "From Library" and its picker modal
 * are gone.
 *
 * The double is global fetch, as in the B14 suite for this page, so every
 * write is asserted on the body that goes on the wire.
 */
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

type Body = Record<string, unknown>;

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

const CHARACTER = {
  id: "C-1",
  name: "Mara Voss",
  role: "protagonist",
  description: "A keeper who has never seen the sea",
  personality: ["stubborn"],
  backstory: "",
  appearance: "Weathered, forty, salt in her hair",
  speechPatterns: "",
  relationships: "",
  tags: ["noir"],
  createdAt: "",
  updatedAt: "",
};

const fetchMock = jest.fn<Promise<unknown>, [string, RequestInit?]>();
let themes: unknown[];
let characters: unknown[];
let charactersStatus = 200;

function answer(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function bodies(): Body[] {
  return fetchMock.mock.calls.map((c) => JSON.parse(String(c[1]?.body ?? "{}")) as Body);
}

function bodiesFor(action: string, subAction: string): Body[] {
  return bodies().filter((b) => b.action === action && b.subAction === subAction);
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  themes = [THEME];
  characters = [CHARACTER];
  charactersStatus = 200;
  (globalThis as { fetch?: unknown }).fetch = fetchMock;
  fetchMock.mockImplementation(async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Body;
    if (body.action === "themes") {
      if (body.subAction === "list") return answer({ data: { themes } });
      if (body.subAction === "create") return answer({ data: { theme: { ...THEME, id: "T-2", name: body.name } } });
      if (body.subAction === "update") return answer({ data: { theme: { ...THEME, ...body } } });
      if (body.subAction === "delete") return answer({ data: { deleted: true } });
    }
    if (body.action === "characters") {
      if (body.subAction === "list") {
        return charactersStatus === 200
          ? answer({ data: { characters } })
          : answer({ error: "the database is locked" }, charactersStatus);
      }
      if (body.subAction === "create") return answer({ data: { character: { ...CHARACTER, id: "C-2", name: body.name } } });
      if (body.subAction === "update") return answer({ data: { character: { ...CHARACTER, ...body } } });
      if (body.subAction === "delete") return answer({ data: { deleted: true } });
    }
    return answer({ data: {} });
  });
  useModels.mockReturnValue({ data: [], error: null, isLoading: false, refetch: jest.fn() });
  useModelDefaults.mockReturnValue({ data: { agent: "" }, error: null, isLoading: false, refetch: jest.fn() });
});

async function mount() {
  const utils = render(<CreateStoryPage />);
  await screen.findByRole("button", { name: `Use theme ${THEME.name}` });
  return utils;
}

const themesPanel = () => {
  const el = document.getElementById("themes");
  if (!el) throw new Error("no #themes section on the page");
  return el;
};
const charactersPanel = () => {
  const el = document.getElementById("characters");
  if (!el) throw new Error("no #characters section on the page");
  return el;
};

describe("the saved themes", () => {
  it("live in a section of their own, with Use, Edit and Delete on each and New theme above", async () => {
    await mount();
    const panel = themesPanel();
    expect(within(panel).getByRole("heading", { name: "Saved themes" })).toBeInTheDocument();
    expect(within(panel).getByText(THEME.name)).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: `Edit theme ${THEME.name}` })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: `Delete theme ${THEME.name}` })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "New theme" })).toBeInTheDocument();
    expect(screen.queryByText(/click to load/i)).toBeNull();
  });

  it("Use loads the theme into the form", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: `Use theme ${THEME.name}` }));
    expect(screen.getByLabelText("Premise")).toHaveValue(THEME.premise);
  });

  it("Edit opens the editor filled in, and Save posts an update by id", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: `Edit theme ${THEME.name}` }));
    const dialog = screen.getByRole("dialog", { name: "Edit story theme" });
    const name = within(dialog).getByLabelText("Name");
    expect(name).toHaveValue(THEME.name);
    fireEvent.change(name, { target: { value: "Salt, starlight and rain" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save theme" }));
    await waitFor(() => expect(bodiesFor("themes", "update")).toHaveLength(1));
    expect(bodiesFor("themes", "update")[0]).toMatchObject({ themeId: "T-1", name: "Salt, starlight and rain", premise: THEME.premise });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit story theme" })).toBeNull());
  });

  it("New theme opens an empty editor whose Save waits for a name and a premise, then posts a create", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "New theme" }));
    const dialog = screen.getByRole("dialog", { name: "New story theme" });
    const save = within(dialog).getByRole("button", { name: "Save theme" });
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Rust and rain" } });
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Premise"), { target: { value: "A city that forgot how to dry" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(bodiesFor("themes", "create")).toHaveLength(1));
    expect(bodiesFor("themes", "create")[0]).toMatchObject({ name: "Rust and rain", premise: "A city that forgot how to dry" });
  });

  it("Delete asks twice, then posts the delete with themeId", async () => {
    await mount();
    const del = screen.getByRole("button", { name: `Delete theme ${THEME.name}` });
    fireEvent.click(del);
    expect(bodiesFor("themes", "delete")).toHaveLength(0);
    fireEvent.click(del);
    await waitFor(() => expect(bodiesFor("themes", "delete")).toEqual([{ action: "themes", subAction: "delete", themeId: "T-1" }]));
  });
});

describe("the character library", () => {
  it("lives in a section of its own, with Add, Edit and Delete on each and no picker modal", async () => {
    await mount();
    const panel = charactersPanel();
    expect(within(panel).getByRole("heading", { name: "Character library" })).toBeInTheDocument();
    expect(within(panel).getByText(CHARACTER.name)).toBeInTheDocument();
    expect(within(panel).getByText("protagonist")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: `Add ${CHARACTER.name} to the story` })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: `Edit character ${CHARACTER.name}` })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: `Delete character ${CHARACTER.name}` })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "New character" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /From Library/ })).toBeNull();
  });

  it("Add puts the saved character into the cast in one click, and will not add them twice", async () => {
    await mount();
    const add = screen.getByRole("button", { name: `Add ${CHARACTER.name} to the story` });
    fireEvent.click(add);
    const cast = screen.getByTestId("story-cast");
    expect(within(cast).getByText(CHARACTER.name)).toBeInTheDocument();
    expect(add).toBeDisabled();
  });

  it("Edit opens the editor filled in, and Save posts an update by id", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: `Edit character ${CHARACTER.name}` }));
    const dialog = screen.getByRole("dialog", { name: "Edit character" });
    expect(within(dialog).getByLabelText("Name")).toHaveValue(CHARACTER.name);
    expect(within(dialog).getByText("stubborn")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Description"), { target: { value: "A keeper who finally saw the sea" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save character" }));
    await waitFor(() => expect(bodiesFor("characters", "update")).toHaveLength(1));
    expect(bodiesFor("characters", "update")[0]).toMatchObject({
      charId: "C-1",
      name: CHARACTER.name,
      description: "A keeper who finally saw the sea",
      personality: ["stubborn"],
    });
  });

  it("New character opens an empty editor, takes traits one at a time, and posts a create", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "New character" }));
    const dialog = screen.getByRole("dialog", { name: "New character" });
    const save = within(dialog).getByRole("button", { name: "Save character" });
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Tomas Reyl" } });
    const trait = within(dialog).getByLabelText("Personality trait");
    fireEvent.change(trait, { target: { value: "brave" } });
    fireEvent.keyDown(trait, { key: "Enter" });
    expect(within(dialog).getByText("brave")).toBeInTheDocument();
    fireEvent.click(save);
    await waitFor(() => expect(bodiesFor("characters", "create")).toHaveLength(1));
    expect(bodiesFor("characters", "create")[0]).toMatchObject({ name: "Tomas Reyl", personality: ["brave"] });
  });

  it("Delete asks twice, then posts the delete with charId", async () => {
    await mount();
    const del = screen.getByRole("button", { name: `Delete character ${CHARACTER.name}` });
    fireEvent.click(del);
    expect(bodiesFor("characters", "delete")).toHaveLength(0);
    fireEvent.click(del);
    await waitFor(() => expect(bodiesFor("characters", "delete")).toEqual([{ action: "characters", subAction: "delete", charId: "C-1" }]));
  });
});

describe("the read contract, on both panels", () => {
  it("with nothing saved, each panel says so and still offers its editor", async () => {
    themes = [];
    characters = [];
    render(<CreateStoryPage />);
    await screen.findByText(/No saved themes yet/);
    expect(screen.getByText(/No saved characters yet/)).toBeInTheDocument();
    expect(within(themesPanel()).getByRole("button", { name: "New theme" })).toBeInTheDocument();
    expect(within(charactersPanel()).getByRole("button", { name: "New character" })).toBeInTheDocument();
  });

  it("a failed library read is an error with Retry inside the panel, never an empty shelf", async () => {
    charactersStatus = 500;
    render(<CreateStoryPage />);
    await screen.findByRole("button", { name: `Use theme ${THEME.name}` });
    const panel = charactersPanel();
    const alert = await within(panel).findByRole("alert");
    expect(within(alert).getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(within(panel).queryByText(/No saved characters yet/)).toBeNull();

    charactersStatus = 200;
    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }));
    await within(panel).findByText(CHARACTER.name);
  });
});

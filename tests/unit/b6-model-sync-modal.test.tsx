/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B6 oracle, group modal-and-banner, part one: the Export modal (T-0100,
// D12 in verified.json; the task text calls it D13).
//
// Written before the product code moved. Holds contract section 2, "D12 the
// Export modal": every push row except the credential loses its exclude
// button, Confirm always calls onPush or onPull, Confirm is disabled when
// the answer says in sync, the note is shown where the rows would be, and
// the wording is decision 13's: 'Pull from Hermes' / 'Push to Hermes' on the
// row buttons and the dialog heading, the fallback labels renamed, and the
// four Import/Export strings gone.
//
// The doubles: onPush/onPull are jest.fn promises; the diff route is a global
// fetch double answering `{ data: { diffs, modelName, inSync, note } }`, so
// the real apiFetch runs and the URL and body reach the assertions.
//
// Reds here are the implementation's to-do list. The GREEN CONTROLs pin the
// exclusion states the contract keeps (credential excluded -> pushCredential
// false; every pull row excludable).
// ═══════════════════════════════════════════════════════════════

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("lucide-react", () => {
  // Icons leave the accessibility tree, so an icon-only button that names
  // itself with `title` still resolves by its accessible name. A mocked icon
  // that rendered text would become the name and hide the title (skeptic 4).
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

import ModelSyncButtons from "@/components/models/ModelSyncButtons";

// ── the diff route double ──────────────────────────────────────

interface DiffRow {
  id: string;
  label: string;
  detail: string;
}

interface DiffAnswer {
  diffs: DiffRow[];
  modelName: string;
  inSync: boolean;
  note: string | null;
}

const fetchMock = jest.fn<Promise<unknown>, [string, RequestInit?]>();

function answer(body: DiffAnswer): void {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: body }),
  });
}

function refuse(): void {
  fetchMock.mockRejectedValue(new Error("diff route unreachable"));
}

const PUSH_ROWS: DiffRow[] = [
  { id: "modelId", label: "Model ID", detail: "b → a" },
  { id: "provider", label: "Provider", detail: "(none) → anthropic" },
  { id: "baseUrl", label: "Base URL", detail: "(none) → https://api.anthropic.com" },
  { id: "model-env", label: "Credential", detail: "Write ANTHROPIC_API_KEY=sk-a...1234 to the env file" },
];

const PULL_ROWS: DiffRow[] = [
  { id: "modelId", label: "Model ID", detail: "a → b" },
  { id: "provider", label: "Provider", detail: "p → q" },
  { id: "baseUrl", label: "Base URL", detail: "u → v2" },
  { id: "contextLength", label: "Context length", detail: "128000 → 200000" },
];

// ── harness ────────────────────────────────────────────────────

function mount() {
  const onPush = jest.fn(async () => ({ success: true, backupPath: null, details: [] }));
  const onPull = jest.fn(async () => ({ success: true, backupPath: null, details: [] }));
  const utils = render(
    <ModelSyncButtons
      modelId="m-1"
      provider="anthropic"
      modelIdString="anthropic/claude-sonnet-4"
      onPush={onPush}
      onPull={onPull}
    />,
  );
  return { onPush, onPull, ...utils };
}

/**
 * The two row buttons, in DOM order: pull first, push second. Found by
 * position on purpose: the wording test below is the ONE place the titles
 * are pinned, so a title that has not moved yet reds that test alone rather
 * than every test that needs to open the dialog.
 */
function rowButtons(): { pull: HTMLElement; push: HTMLElement } {
  const buttons = screen.getAllByRole("button");
  return { pull: buttons[0], push: buttons[1] };
}

async function open(direction: "push" | "pull"): Promise<HTMLElement> {
  const { pull, push } = rowButtons();
  fireEvent.click(direction === "push" ? push : pull);
  return screen.findByRole("dialog");
}

function excludeButtons(dialog: HTMLElement): HTMLElement[] {
  return within(dialog).queryAllByTitle("Exclude this change");
}

const ROW_LABELS = ["Model ID", "Provider", "Base URL", "Context length", "Credential"];

/**
 * One row, derived structurally rather than by depth: the largest ancestor of
 * this row's label that still carries no OTHER row's label. Counting parents
 * would either pass vacuously or fail falsely the moment the implementation
 * nests differently, and the contract says nothing about the markup.
 */
function rowOf(dialog: HTMLElement, label: string): HTMLElement {
  const labelEl = within(dialog).getByText(label);
  const others = ROW_LABELS.filter((l) => l !== label);
  let node: HTMLElement = labelEl;
  while (node.parentElement && node.parentElement !== dialog) {
    const text = node.parentElement.textContent ?? "";
    if (others.some((other) => text.includes(other))) break;
    node = node.parentElement;
  }
  return node;
}

function confirmButton(dialog: HTMLElement): HTMLElement {
  return within(dialog).getByRole("button", { name: /^Confirm/ });
}

async function confirm(dialog: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(confirmButton(dialog));
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  (globalThis as { fetch: unknown }).fetch = fetchMock;
});

// ── exclusion rules ────────────────────────────────────────────

describe("the push modal offers the X only where the endpoint honours it", () => {
  it("modelId, provider and baseUrl rows have no exclude button; the credential row does", async () => {
    answer({ diffs: PUSH_ROWS, modelName: "Sonnet", inSync: false, note: null });
    mount();
    const dialog = await open("push");

    for (const label of ["Model ID", "Provider", "Base URL"]) {
      expect(within(rowOf(dialog, label)).queryByTitle("Exclude this change")).toBeNull();
    }
    expect(within(rowOf(dialog, "Credential")).getByTitle("Exclude this change")).toBeTruthy();
    expect(excludeButtons(dialog)).toHaveLength(1);
  });

  it("every exclude button the push modal offers still leaves Confirm calling onPush exactly once", async () => {
    // The dead state D12 names: X on Model ID, "Confirm 3/4", no request, no
    // toast, dialog gone. For each X the modal offers, exclude it and confirm;
    // whatever is left visible must reach onPush.
    answer({ diffs: PUSH_ROWS, modelName: "Sonnet", inSync: false, note: null });
    const probe = mount();
    const offered = excludeButtons(await open("push")).length;
    expect(offered).toBeGreaterThan(0);
    probe.unmount();

    for (let i = 0; i < offered; i++) {
      answer({ diffs: PUSH_ROWS, modelName: "Sonnet", inSync: false, note: null });
      const { onPush, onPull, unmount } = mount();
      const dialog = await open("push");
      fireEvent.click(excludeButtons(dialog)[i]);
      const button = confirmButton(dialog);
      expect(button).not.toBeDisabled();
      await confirm(dialog);

      expect(onPush).toHaveBeenCalledTimes(1);
      expect(onPull).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("GREEN CONTROL: excluding the credential pushes with pushCredential false; nothing excluded pushes with true", async () => {
    answer({ diffs: PUSH_ROWS, modelName: "Sonnet", inSync: false, note: null });
    const first = mount();
    let dialog = await open("push");
    fireEvent.click(within(rowOf(dialog, "Credential")).getByTitle("Exclude this change"));
    await confirm(dialog);
    expect(first.onPush).toHaveBeenCalledTimes(1);
    expect(first.onPush).toHaveBeenCalledWith("m-1", { pushCredential: false });
    first.unmount();

    answer({ diffs: PUSH_ROWS, modelName: "Sonnet", inSync: false, note: null });
    const second = mount();
    dialog = await open("push");
    await confirm(dialog);
    expect(second.onPush).toHaveBeenCalledTimes(1);
    expect(second.onPush).toHaveBeenCalledWith("m-1", { pushCredential: true });
  });

  it("GREEN CONTROL: every pull row is excludable and the excluded set reaches onPull", async () => {
    answer({ diffs: PULL_ROWS, modelName: "Sonnet", inSync: false, note: null });
    const { onPull, onPush } = mount();
    const dialog = await open("pull");

    for (const label of ["Model ID", "Provider", "Base URL", "Context length"]) {
      expect(within(rowOf(dialog, label)).getByTitle("Exclude this change")).toBeTruthy();
    }
    fireEvent.click(within(rowOf(dialog, "Context length")).getByTitle("Exclude this change"));
    await confirm(dialog);

    expect(onPull).toHaveBeenCalledTimes(1);
    expect(onPull).toHaveBeenCalledWith("m-1", { excluded: new Set(["contextLength"]) });
    expect(onPush).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL: asks the diff route for the direction it is about to show", async () => {
    answer({ diffs: PUSH_ROWS, modelName: "Sonnet", inSync: false, note: null });
    mount();
    await open("push");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/models/m-1/diff");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ direction: "push" });
  });
});

// ── in sync, and the note ──────────────────────────────────────

describe("an in-sync answer disables Confirm and says so", () => {
  it("push: inSync with no rows shows the note where the rows would be, Confirm disabled, never 'Confirm (3 changes)'", async () => {
    answer({
      diffs: [],
      modelName: "Sonnet",
      inSync: true,
      note: "Sonnet is already in sync with config.yaml",
    });
    mount();
    const dialog = await open("push");

    expect(within(dialog).getByText("Sonnet is already in sync with config.yaml")).toBeTruthy();
    expect(confirmButton(dialog)).toBeDisabled();
    expect(dialog.textContent).not.toContain("Confirm (3 changes)");
  });

  it("push: inSync with only the credential row still disables Confirm (the credential does not count)", async () => {
    answer({
      diffs: [PUSH_ROWS[3]],
      modelName: "Sonnet",
      inSync: true,
      note: "Sonnet is already in sync with config.yaml",
    });
    mount();
    const dialog = await open("push");

    expect(confirmButton(dialog)).toBeDisabled();
  });

  it("pull: no matching section shows the route's note and disables Confirm", async () => {
    answer({
      diffs: [],
      modelName: "Sonnet",
      inSync: false,
      note: "No matching section in config.yaml for anthropic/anthropic/claude-sonnet-4",
    });
    mount();
    const dialog = await open("pull");

    expect(
      within(dialog).getByText("No matching section in config.yaml for anthropic/anthropic/claude-sonnet-4"),
    ).toBeTruthy();
    expect(confirmButton(dialog)).toBeDisabled();
  });

  it("the parse refusal reaches the operator in both directions", async () => {
    const note = "config.yaml did not parse. Repair it before pushing";
    for (const direction of ["push", "pull"] as const) {
      answer({ diffs: [], modelName: "Sonnet", inSync: false, note });
      const { unmount } = mount();
      const dialog = await open(direction);
      expect(within(dialog).getByText(note)).toBeTruthy();
      expect(confirmButton(dialog)).toBeDisabled();
      unmount();
    }
  });
});

// ── wording (decision 13) ──────────────────────────────────────

describe("the ratified wording", () => {
  it("the two row buttons are titled 'Pull from Hermes' and 'Push to Hermes'", () => {
    mount();
    const { pull, push } = rowButtons();
    expect(pull).toHaveAttribute("title", "Pull from Hermes");
    expect(push).toHaveAttribute("title", "Push to Hermes");
  });

  it("the dialog heading reads 'Push to Hermes' for a push", async () => {
    answer({ diffs: PUSH_ROWS, modelName: "Sonnet", inSync: false, note: null });
    mount();
    const dialog = await open("push");
    expect(dialog).toHaveAttribute("aria-labelledby", "model-sync-title");
    expect(document.getElementById("model-sync-title")?.textContent).toBe("Push to Hermes");
  });

  it("the dialog heading reads 'Pull from Hermes' for a pull", async () => {
    answer({ diffs: PULL_ROWS, modelName: "Sonnet", inSync: false, note: null });
    mount();
    await open("pull");
    expect(document.getElementById("model-sync-title")?.textContent).toBe("Pull from Hermes");
  });

  it("the fallback rows (diff route down) are labelled in the same vocabulary", async () => {
    refuse();
    const first = mount();
    let dialog = await open("push");
    expect(within(dialog).getByText("Push model settings to config.yaml")).toBeTruthy();
    first.unmount();

    refuse();
    mount();
    dialog = await open("pull");
    expect(within(dialog).getByText("Pull model settings from config.yaml")).toBeTruthy();
  });

  it("'Export to Hermes', 'Import from Hermes', 'Import: read' and 'Export: write' appear nowhere", async () => {
    const gone = ["Export to Hermes", "Import from Hermes", "Import: read", "Export: write"];

    const closed = mount();
    const titles = screen.getAllByRole("button").map((b) => b.getAttribute("title") ?? "");
    for (const s of gone) {
      expect(document.body.textContent).not.toContain(s);
      for (const t of titles) expect(t).not.toContain(s);
    }
    closed.unmount();

    for (const direction of ["push", "pull"] as const) {
      answer({
        diffs: direction === "push" ? PUSH_ROWS : PULL_ROWS,
        modelName: "Sonnet",
        inSync: false,
        note: null,
      });
      const { unmount } = mount();
      await open(direction);
      for (const s of gone) expect(document.body.textContent).not.toContain(s);
      unmount();
    }
  });
});

// ── the dialog closes after a confirmed call ───────────────────

describe("GREEN CONTROL: a confirmed push closes the dialog once the call returns", () => {
  it("closes after onPush resolves", async () => {
    answer({ diffs: PUSH_ROWS, modelName: "Sonnet", inSync: false, note: null });
    const { onPush } = mount();
    const dialog = await open("push");
    await confirm(dialog);
    expect(onPush).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

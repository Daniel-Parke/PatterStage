/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B6 oracle, group credentials, the browser half (T-0100, D14).
//
// Written before the product code moved. Holds contract section 5, D14, lines
// (11) and (12): CredentialsPanel grows a second door per row, "Rotate key",
// which opens an inline password input, a "Save new key" that stays disabled
// while the input is blank, and a "Cancel"; the key is never printed after
// Save and the hand-wired two-step delete keeps its names. useModelActions
// grows handleRotateCredential, which PATCHes the row, toasts the new hint,
// reloads on success and reports failure without reloading.
//
// The hook is mounted against the closed api-fetch mock of
// b1-model-actions-read-the-answer.test.tsx, deliberately: anything the new
// handler imports from api-fetch beyond apiFetch and toastError is undefined
// here, and that is the constraint the contract states.
//
// Type-tolerance: onRotate and handleRotateCredential do not exist yet, so
// both are reached through one loose cast each (the b5-first-run pattern);
// every runtime assertion is the contract's. Strip the casts once D14 lands.
//
// The server half is tests/unit/b6-credentials-rotate-route.test.ts.
// ═══════════════════════════════════════════════════════════════

import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";

import CredentialsPanel from "@/components/models/CredentialsPanel";
import type { ApiCredential } from "@/components/models/types";

const mockApiFetch = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  API_FETCH_BULK_TIMEOUT_MS: 300_000,
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
  messageFromError: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback),
  safeApiCallData: jest.fn(),
  toastError: (show: (m: string, t?: string) => void, e: unknown, fallback: string) =>
    show(e instanceof Error ? e.message : fallback, "error"),
}));

import { useModelActions } from "@/hooks/useModelActions";

// ── pre-D14 type shims (see header) ─────────────────────────────

type PanelProps = {
  credentials: ApiCredential[];
  onDelete: (credential: ApiCredential) => void;
  busyId: string | null;
  onRotate: (credential: ApiCredential, apiKey: string) => void | Promise<void>;
};
const Panel = CredentialsPanel as unknown as ComponentType<PanelProps>;

type Rotate = (credential: ApiCredential, apiKey: string) => Promise<void>;
type Actions = ReturnType<typeof useModelActions> & { handleRotateCredential?: Rotate };

// ── fixtures ────────────────────────────────────────────────────

const CRED: ApiCredential = {
  id: "c1",
  label: "Anthropic Personal",
  provider: "anthropic",
  keyHint: "sk-a...wxyz",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const ROTATE = "Rotate key for Anthropic Personal";
const NEW_KEY_INPUT = "New API key for Anthropic Personal";
const SAVE = "Save new key for Anthropic Personal";
const CANCEL = "Cancel rotating Anthropic Personal";

function renderPanel(overrides: Partial<PanelProps> = {}) {
  const onRotate = jest.fn();
  const onDelete = jest.fn();
  const utils = render(
    <Panel credentials={[CRED]} onDelete={onDelete} busyId={null} onRotate={onRotate} {...overrides} />,
  );
  return { ...utils, onRotate, onDelete };
}

const inputsHolding = (value: string) =>
  Array.from(document.querySelectorAll("input")).filter((i) => i.value === value);

// ═══════════════════════════════════════════════════════════════
// (11) the panel
// ═══════════════════════════════════════════════════════════════

describe("CredentialsPanel: the rotate door", () => {
  it("offers 'Rotate key' per row, and no key input until it is asked for", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: ROTATE })).toBeInTheDocument();
    expect(screen.queryByLabelText(NEW_KEY_INPUT)).toBeNull();
  });

  it("opens a password input; Save is disabled while it is blank and enabled once a key is typed", () => {
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: ROTATE }));

    const input = screen.getByLabelText(NEW_KEY_INPUT);
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("placeholder", "Paste the replacement key");

    const save = screen.getByRole("button", { name: SAVE });
    expect(save).toBeDisabled();

    fireEvent.change(input, { target: { value: "sk-new" } });
    expect(save).toBeEnabled();
  });

  it("Save calls onRotate once with the credential and the key, hides the input, and never prints the key", async () => {
    const { onRotate } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: ROTATE }));
    fireEvent.change(screen.getByLabelText(NEW_KEY_INPUT), { target: { value: "sk-new" } });
    fireEvent.click(screen.getByRole("button", { name: SAVE }));

    await waitFor(() => expect(screen.queryByLabelText(NEW_KEY_INPUT)).toBeNull());
    expect(onRotate).toHaveBeenCalledTimes(1);
    expect(onRotate).toHaveBeenCalledWith(CRED, "sk-new");
    expect(document.body.textContent).not.toContain("sk-new");
    expect(inputsHolding("sk-new")).toHaveLength(0);
  });

  it("Cancel hides the input and onRotate is never called", () => {
    const { onRotate } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: ROTATE }));
    fireEvent.change(screen.getByLabelText(NEW_KEY_INPUT), { target: { value: "sk-new" } });
    fireEvent.click(screen.getByRole("button", { name: CANCEL }));

    expect(screen.queryByLabelText(NEW_KEY_INPUT)).toBeNull();
    expect(onRotate).not.toHaveBeenCalled();
  });

  it("a busy row disables both doors", () => {
    renderPanel({ busyId: "c1" });

    expect(screen.getByRole("button", { name: ROTATE })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete credential Anthropic Personal" })).toBeDisabled();
  });

  it("GREEN CONTROL: the delete door keeps its two names", () => {
    const { onDelete } = renderPanel();

    const del = screen.getByRole("button", { name: "Delete credential Anthropic Personal" });
    fireEvent.click(del);
    expect(screen.getByRole("button", { name: "Confirm delete credential Anthropic Personal" })).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm delete credential Anthropic Personal" }));
    expect(onDelete).toHaveBeenCalledWith(CRED);
  });
});

// ═══════════════════════════════════════════════════════════════
// (12) the hook
// ═══════════════════════════════════════════════════════════════

const SPACED: ApiCredential = { ...CRED, id: "c 1", label: "L" };

function mount() {
  const showToast = jest.fn();
  const loadAll = jest.fn(async () => undefined);
  const hook = renderHook(() => useModelActions({ loadAll, setDefaults: jest.fn(), showToast }));
  return { showToast, loadAll, hook };
}

function rotateOf(hook: ReturnType<typeof mount>["hook"]): Rotate {
  const fn = (hook.result.current as Actions).handleRotateCredential;
  if (typeof fn !== "function") {
    throw new Error("useModelActions returns no handleRotateCredential (contract D14)");
  }
  return fn;
}

const OK_ANSWER = { data: { credential: { ...SPACED, keyHint: "sk-n...-new" }, envVarUpdated: true } };

beforeEach(() => mockApiFetch.mockReset());

describe("useModelActions.handleRotateCredential", () => {
  it("PATCHes the encoded id with exactly the key", async () => {
    mockApiFetch.mockResolvedValue(OK_ANSWER);
    const { hook } = mount();

    await act(async () => {
      await rotateOf(hook)(SPACED, "sk-new");
    });

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/credentials/c%201",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ apiKey: "sk-new" }) }),
    );
  });

  it("on success toasts 'Rotated L: now <hint>; Hermes .env updated' and reloads", async () => {
    mockApiFetch.mockResolvedValue(OK_ANSWER);
    const { hook, showToast, loadAll } = mount();

    await act(async () => {
      await rotateOf(hook)(SPACED, "sk-new");
    });

    expect(showToast).toHaveBeenCalledTimes(1);
    const [message, type] = showToast.mock.calls[0] as [string, string];
    expect(type).toBe("success");
    expect(message.startsWith("Rotated L: now sk-n...-new")).toBe(true);
    expect(message).toContain("Hermes .env updated");
    // design-lint's hermes-outside-adapter pattern, and the em dash rule.
    expect(message).not.toMatch(/\.hermes\//);
    expect(message).not.toContain(String.fromCharCode(0x2014));
    expect(loadAll).toHaveBeenCalledTimes(1);
  });

  it("says nothing about .env when the route did not touch it", async () => {
    mockApiFetch.mockResolvedValue({ data: { credential: { ...SPACED, keyHint: "sk-n...-new" }, envVarUpdated: false } });
    const { hook, showToast } = mount();

    await act(async () => {
      await rotateOf(hook)(SPACED, "sk-new");
    });

    const [message] = showToast.mock.calls[0] as [string, string];
    expect(message.startsWith("Rotated L: now sk-n...-new")).toBe(true);
    expect(message).not.toContain("Hermes .env updated");
  });

  it("on a rejection toasts an error and does not reload", async () => {
    mockApiFetch.mockRejectedValue(new Error("Failed to rotate credential"));
    const { hook, showToast, loadAll } = mount();

    await act(async () => {
      await rotateOf(hook)(SPACED, "sk-new");
    });

    expect(showToast).toHaveBeenCalledTimes(1);
    const [message, type] = showToast.mock.calls[0] as [string, string];
    expect(type).toBe("error");
    expect(message).toMatch(/Rotate failed|Failed to rotate credential/);
    expect(loadAll).not.toHaveBeenCalled();
    expect(hook.result.current.busyCredentialId).toBeNull();
  });

  it("marks the row busy for the duration and clears it after", async () => {
    let answer!: (value: unknown) => void;
    mockApiFetch.mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    const { hook } = mount();

    let inFlight!: Promise<void>;
    act(() => {
      inFlight = rotateOf(hook)(SPACED, "sk-new");
    });
    expect(hook.result.current.busyCredentialId).toBe("c 1");

    await act(async () => {
      answer(OK_ANSWER);
      await inFlight;
    });
    expect(hook.result.current.busyCredentialId).toBeNull();
  });
});

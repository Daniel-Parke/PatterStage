/**
 * @jest-environment jsdom
 */
// ═══════════════════════════════════════════════════════════════
// PR 6 — ModelEditor modal
// ═══════════════════════════════════════════════════════════════
// Covers:
//   - create flow: posts to /api/credentials then /api/models
//   - reuses an existing credential without re-creating one
//   - edit flow: PUTs to /api/models/[id] without touching /api/credentials

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import ModelEditor, {
  type ModelEditorRecord,
} from "@/components/models/ModelEditor";
import type { CredentialOption } from "@/components/models/CredentialPicker";

interface FetchCall {
  url: string;
  method: string;
  body: unknown;
}

function makeFetchMock(
  calls: FetchCall[],
  responses: Record<string, unknown> = {}
): typeof fetch {
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const bodyText =
      typeof init?.body === "string" ? init.body : init?.body?.toString() ?? "";
    let parsedBody: unknown = null;
    try {
      parsedBody = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      parsedBody = bodyText;
    }
    calls.push({ url, method, body: parsedBody });
    const respKey = `${method} ${url}`;
    const data = responses[respKey] ?? { data: {} };
    return {
      ok: true,
      status: 200,
      json: async () => data,
      text: async () => JSON.stringify(data),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

const ANTHROPIC_KEY: CredentialOption = {
  id: "cred-anthropic",
  label: "anthropic key",
  provider: "anthropic",
  keyHint: "sk-a...wxyz",
};

describe("ModelEditor", () => {
  let calls: FetchCall[];
  const originalFetch = global.fetch;

  beforeEach(() => {
    calls = [];
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("creates a new credential and a new model in create mode", async () => {
    global.fetch = makeFetchMock(calls, {
      "POST /api/credentials": {
        data: { credential: { id: "cred-new" } },
      },
      "POST /api/models": {
        data: { model: { id: "model-new" } },
      },
    });

    const onSaved = jest.fn();
    const onClose = jest.fn();

    render(
      <ModelEditor
        model={null}
        credentials={[]}
        providers={["anthropic", "openrouter", "openai"]}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Claude Sonnet/i), {
      target: { value: "Claude Opus 4" },
    });
    fireEvent.change(screen.getByPlaceholderText(/anthropic\/claude-sonnet-4/i), {
      target: { value: "anthropic/claude-opus-4" },
    });
    fireEvent.change(screen.getByPlaceholderText("sk-..."), {
      target: { value: "sk-test-key" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Model/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    const credCall = calls.find((c) => c.url === "/api/credentials");
    expect(credCall).toBeDefined();
    expect(credCall!.method).toBe("POST");
    expect(credCall!.body).toMatchObject({
      provider: "anthropic",
      apiKey: "sk-test-key",
    });

    const modelCall = calls.find((c) => c.url === "/api/models");
    expect(modelCall).toBeDefined();
    expect(modelCall!.method).toBe("POST");
    expect(modelCall!.body).toMatchObject({
      name: "Claude Opus 4",
      provider: "anthropic",
      modelId: "anthropic/claude-opus-4",
      credentialsId: "cred-new",
    });
  });

  it("reuses an existing credential without POSTing /api/credentials", async () => {
    global.fetch = makeFetchMock(calls, {
      "POST /api/models": { data: { model: { id: "model-new" } } },
    });

    const onSaved = jest.fn();

    render(
      <ModelEditor
        model={null}
        credentials={[ANTHROPIC_KEY]}
        providers={["anthropic", "openrouter", "openai"]}
        onClose={jest.fn()}
        onSaved={onSaved}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Claude Sonnet/i), {
      target: { value: "Claude (existing creds)" },
    });
    fireEvent.change(screen.getByPlaceholderText(/anthropic\/claude-sonnet-4/i), {
      target: { value: "anthropic/claude-sonnet-4" },
    });

    // Pick the existing credential row (Field Kit Select: open, then click the option)
    fireEvent.click(screen.getByLabelText(/Credential/i));
    fireEvent.click(screen.getByText(ANTHROPIC_KEY.label));

    fireEvent.click(screen.getByRole("button", { name: /Create Model/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    expect(calls.find((c) => c.url === "/api/credentials")).toBeUndefined();

    const modelCall = calls.find((c) => c.url === "/api/models");
    expect(modelCall!.body).toMatchObject({
      credentialsId: ANTHROPIC_KEY.id,
      name: "Claude (existing creds)",
    });
  });

  it("edits an existing model without touching credentials when API key is blank", async () => {
    global.fetch = makeFetchMock(calls, {
      "PUT /api/models/model-existing": { data: { model: { id: "model-existing" } } },
    });

    const onSaved = jest.fn();
    const existing: ModelEditorRecord = {
      id: "model-existing",
      name: "Claude Sonnet 4",
      provider: "anthropic",
      modelId: "anthropic/claude-sonnet-4",
      baseUrl: null,
      contextLength: 200000,
      credentialsId: ANTHROPIC_KEY.id,
    };

    render(
      <ModelEditor
        model={existing}
        credentials={[ANTHROPIC_KEY]}
        providers={["anthropic", "openrouter", "openai"]}
        onClose={jest.fn()}
        onSaved={onSaved}
      />
    );

    // Update display name only — leave API key blank
    const nameInput = screen.getByDisplayValue("Claude Sonnet 4");
    fireEvent.change(nameInput, { target: { value: "Claude Sonnet 4 (renamed)" } });

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));

    expect(calls.find((c) => c.url === "/api/credentials")).toBeUndefined();

    const putCall = calls.find((c) => c.method === "PUT");
    expect(putCall).toBeDefined();
    expect(putCall!.url).toBe("/api/models/model-existing");
    expect(putCall!.body).toMatchObject({
      name: "Claude Sonnet 4 (renamed)",
      credentialsId: ANTHROPIC_KEY.id,
    });
  });
});

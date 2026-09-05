/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B6 oracle, group credentials, keyless providers (T-0100, D15).
//
// Written before the product code moved. Holds contract section 5, D15, in
// full: providers.ts names the five providers Hermes can drive without an API
// key (KEYLESS_PROVIDERS, isKeylessProvider) and PROVIDER_ENV_VAR is left
// alone; ModelEditor, told which providers are keyless, stops demanding a key
// for them while still accepting one, and says so in copy the operator can
// read; the page passes the constant; POST /api/credentials refuses nous up
// front instead of creating a row and rolling it back.
//
// DECISION pinned here (recorded in the task): credentialPostSchema.apiKey
// stays non-empty. A keyless provider needs no credential ROW, not an empty
// one, because an empty row would write OLLAMA_API_KEY= into the Hermes .env
// file. POST {provider: ollama, apiKey: ''} is therefore still a 400.
//
// The three editor cases of model-editor-modal.test.tsx are repeated here as
// GREEN CONTROLs, rendered without the new prop: the fixtures there must keep
// passing unchanged. The POST route runs against the credentials-api.test.ts
// mock set, whose next/server stub is what lets a route handler run under
// jsdom beside the editor.
//
// Type-tolerance: KEYLESS_PROVIDERS, isKeylessProvider and the editor's
// keylessProviders prop are read through one loose cast each (the b5-first-run
// pattern). Strip them once D15 lands.
// ═══════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponentProps, ComponentType } from "react";
import type { NextRequest } from "next/server";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("next/server", () => ({
  NextRequest: class NextRequest {
    url: string;
    method: string;
    private _body: string;
    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.method = init?.method ?? "GET";
      this._body = typeof init?.body === "string" ? init.body : JSON.stringify(init?.body ?? {});
    }
    async json() { return JSON.parse(this._body); }
  },
  NextResponse: class NextResponse {
    status = 200;
    private _data: unknown;
    static json(data: unknown, init?: ResponseInit): NextResponse {
      const r = new NextResponse();
      r.status = init?.status ?? 200;
      r._data = data;
      return r;
    }
    async json() { return this._data; }
  },
}));

jest.mock("@/lib/api-logger", () => ({
  logApiError: jest.fn(),
  serverErrorFromCatch: jest.requireActual("@/lib/api-logger").serverErrorFromCatch,
}));
jest.mock("@/lib/audit-log", () => ({ appendAuditLine: jest.fn() }));
jest.mock("@/lib/api-auth", () => ({}));
jest.mock("@/lib/analytics/record-event", () => ({ recordEvent: jest.fn() }));
jest.mock("@/modules/hermes/lib/hermes-env-sync", () => ({
  syncCredentialToHermesEnv: jest.fn(() => ({ backupPath: null })),
  removeCredentialFromHermesEnv: jest.fn(() => ({ backupPath: null })),
}));
jest.mock("@/lib/credentials-repository", () => {
  const listCredentials = jest.fn();
  const getCredential = jest.fn();
  const getCredentialWithKey = jest.fn();
  const createCredential = jest.fn();
  const updateCredential = jest.fn();
  const deleteCredential = jest.fn();
  return {
    listCredentials, getCredential, getCredentialWithKey,
    createCredential, updateCredential, deleteCredential,
    __listCredentials: listCredentials, __getCredential: getCredential,
    __getCredentialWithKey: getCredentialWithKey,
    __createCredential: createCredential, __updateCredential: updateCredential,
    __deleteCredential: deleteCredential,
  };
});

import * as providers from "@/modules/hermes/lib/providers";
import { HERMES_PROVIDERS, PROVIDER_ENV_VAR } from "@/modules/hermes/lib/providers";
import ModelEditor, { type ModelEditorRecord } from "@/components/models/ModelEditor";
import type { CredentialOption } from "@/components/models/CredentialPicker";
import { POST as postCredentials } from "@/app/api/credentials/route";

// eslint-disable-next-line @typescript-eslint/no-require-imports -- the closed mock set is reached the way credentials-api.test.ts reaches it
const repo = require("@/lib/credentials-repository") as Record<string, jest.Mock>;
// eslint-disable-next-line @typescript-eslint/no-require-imports -- same
const env = require("@/modules/hermes/lib/hermes-env-sync") as { syncCredentialToHermesEnv: jest.Mock };

const ROOT = join(__dirname, "..", "..");

// ── pre-D15 type shims (see header) ─────────────────────────────

const KEYLESS = (providers as unknown as { KEYLESS_PROVIDERS?: readonly string[] }).KEYLESS_PROVIDERS;
const isKeyless = (providers as unknown as { isKeylessProvider?: (p: string) => boolean }).isKeylessProvider;

const Editor = ModelEditor as unknown as ComponentType<
  ComponentProps<typeof ModelEditor> & { keylessProviders?: readonly string[] }
>;

// ── fetch double, the model-editor-modal one ────────────────────

interface FetchCall {
  url: string;
  method: string;
  body: unknown;
}

function makeFetchMock(calls: FetchCall[], responses: Record<string, unknown> = {}): typeof fetch {
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const bodyText = typeof init?.body === "string" ? init.body : init?.body?.toString() ?? "";
    let parsedBody: unknown = null;
    try {
      parsedBody = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      parsedBody = bodyText;
    }
    calls.push({ url, method, body: parsedBody });
    const data = responses[`${method} ${url}`] ?? { data: {} };
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

const KEY_REQUIRED = "API key is required when creating a new credential";
const KEYLESS_PLACEHOLDER = "Leave blank, none needed";

/** The Field Kit Select: open the listbox, then click the option by name. */
function chooseProvider(name: string) {
  fireEvent.click(screen.getByLabelText("Provider"));
  fireEvent.click(screen.getByRole("option", { name }));
}

function fillNameAndModelId(name: string, modelId: string) {
  fireEvent.change(screen.getByPlaceholderText(/Claude Sonnet/i), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText(/anthropic\/claude-sonnet-4/i), { target: { value: modelId } });
}

let calls: FetchCall[];
const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  calls = [];
});

afterEach(() => {
  global.fetch = originalFetch;
});

// ═══════════════════════════════════════════════════════════════
// providers.ts
// ═══════════════════════════════════════════════════════════════

describe("KEYLESS_PROVIDERS and isKeylessProvider", () => {
  it("names exactly ollama, lmstudio, vllm, custom and nous, every one a Hermes provider", () => {
    expect(KEYLESS).toBeDefined();
    expect([...KEYLESS!]).toEqual(["ollama", "lmstudio", "vllm", "custom", "nous"]);
    for (const p of KEYLESS!) expect(HERMES_PROVIDERS as readonly string[]).toContain(p);
  });

  it("isKeylessProvider is true for the five and false for key-bearing or unknown names", () => {
    expect(typeof isKeyless).toBe("function");
    for (const p of ["ollama", "lmstudio", "vllm", "custom", "nous"]) expect(isKeyless!(p)).toBe(true);
    expect(isKeyless!("anthropic")).toBe(false);
    expect(isKeyless!("openrouter")).toBe(false);
    expect(isKeyless!("not-a-provider")).toBe(false);
  });

  it("GREEN CONTROL: PROVIDER_ENV_VAR is untouched, nous the only empty entry, ollama still OLLAMA_API_KEY", () => {
    expect(PROVIDER_ENV_VAR.nous).toBe("");
    expect(PROVIDER_ENV_VAR.ollama).toBe("OLLAMA_API_KEY");
    expect(PROVIDER_ENV_VAR.vllm).toBe("VLLM_API_KEY");
    expect(HERMES_PROVIDERS.filter((p) => PROVIDER_ENV_VAR[p] === "")).toEqual(["nous"]);
  });
});

// ═══════════════════════════════════════════════════════════════
// ModelEditor with keylessProviders
// ═══════════════════════════════════════════════════════════════

describe("ModelEditor, told which providers are keyless", () => {
  function renderCreate(keyless: readonly string[] = ["ollama", "vllm"], credentials: CredentialOption[] = []) {
    const onSaved = jest.fn();
    render(
      <Editor
        model={null}
        credentials={credentials}
        providers={["anthropic", "ollama", "vllm"]}
        keylessProviders={keyless}
        onClose={jest.fn()}
        onSaved={onSaved}
      />,
    );
    return { onSaved };
  }

  it("saves an ollama model with a blank key: no alert, no credential row, credentialsId null", async () => {
    global.fetch = makeFetchMock(calls, { "POST /api/models": { data: { model: { id: "model-new" } } } });
    const { onSaved } = renderCreate();

    chooseProvider("ollama");
    fillNameAndModelId("Local Llama", "ollama/llama3");
    fireEvent.click(screen.getByRole("button", { name: /Create Model/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(calls.find((c) => c.url === "/api/credentials")).toBeUndefined();
    const modelCall = calls.find((c) => c.url === "/api/models");
    expect(modelCall?.method).toBe("POST");
    expect(modelCall?.body).toMatchObject({
      name: "Local Llama",
      provider: "ollama",
      modelId: "ollama/llama3",
      credentialsId: null,
    });
  });

  it("GREEN CONTROL: anthropic with a blank key still alerts and calls nothing", async () => {
    global.fetch = makeFetchMock(calls);
    const { onSaved } = renderCreate();

    fillNameAndModelId("Claude", "anthropic/claude-sonnet-4");
    fireEvent.click(screen.getByRole("button", { name: /Create Model/i }));

    expect((await screen.findByRole("alert")).textContent).toBe(KEY_REQUIRED);
    expect(calls).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("accepts a key for vllm: POST /api/credentials first, then /api/models with the returned id", async () => {
    global.fetch = makeFetchMock(calls, {
      "POST /api/credentials": { data: { credential: { id: "cred-vllm" } } },
      "POST /api/models": { data: { model: { id: "model-new" } } },
    });
    const { onSaved } = renderCreate();

    chooseProvider("vllm");
    fillNameAndModelId("vLLM box", "meta-llama/Llama-3-70B");
    fireEvent.change(screen.getByPlaceholderText(KEYLESS_PLACEHOLDER), { target: { value: "sk-vllm-secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Model/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const credIndex = calls.findIndex((c) => c.url === "/api/credentials");
    const modelIndex = calls.findIndex((c) => c.url === "/api/models");
    expect(credIndex).toBeGreaterThanOrEqual(0);
    expect(modelIndex).toBeGreaterThan(credIndex);
    expect(calls[credIndex].method).toBe("POST");
    expect(calls[credIndex].body).toMatchObject({ provider: "vllm", apiKey: "sk-vllm-secret", label: "vllm key" });
    expect(calls[modelIndex].body).toMatchObject({ provider: "vllm", credentialsId: "cred-vllm" });
  });

  it("says a keyless provider needs no key, in the heading, the line, the placeholder and the picker", () => {
    global.fetch = makeFetchMock(calls);
    renderCreate();

    chooseProvider("ollama");

    expect(screen.getByText("Credential (optional)")).toBeInTheDocument();
    expect(
      screen.getByText("ollama needs no API key. Leave this blank, or paste one if your endpoint requires it."),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(KEYLESS_PLACEHOLDER)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("sk-...")).toBeNull();
    expect(
      screen.getByText("No key is needed for this provider. Pick a credential only if your endpoint requires one."),
    ).toBeInTheDocument();

    // The picker keeps its one accessible name: model-editor-modal's
    // getByLabelText(/Credential/i) must still resolve to exactly one control.
    const picker = screen.getByLabelText(/Credential/i);
    fireEvent.click(picker);
    expect(within(screen.getByRole("listbox")).getByRole("option", { name: "No credential (none needed)" })).toBeInTheDocument();
  });

  it("switching back to anthropic restores the placeholder and the requirement", async () => {
    global.fetch = makeFetchMock(calls);
    const { onSaved } = renderCreate();

    chooseProvider("ollama");
    expect(screen.getByPlaceholderText(KEYLESS_PLACEHOLDER)).toBeInTheDocument();

    chooseProvider("anthropic");
    expect(screen.getByPlaceholderText("sk-...")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(KEYLESS_PLACEHOLDER)).toBeNull();
    expect(screen.queryByText(/needs no API key/)).toBeNull();

    fillNameAndModelId("Claude", "anthropic/claude-sonnet-4");
    fireEvent.click(screen.getByRole("button", { name: /Create Model/i }));

    expect((await screen.findByRole("alert")).textContent).toBe(KEY_REQUIRED);
    expect(calls).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("the page hands the editor the constant", () => {
    const src = readFileSync(join(ROOT, "src", "app", "agent", "models", "page.tsx"), "utf-8");

    // Booleans, so a miss reports one line rather than the whole page source.
    const importsConstant = /import \{[^}]*\bKEYLESS_PROVIDERS\b[^}]*\} from "@\/modules\/hermes\/lib\/providers"/.test(src);
    const passesConstant = /keylessProviders=\{KEYLESS_PROVIDERS\}/.test(src);
    expect({ importsConstant, passesConstant }).toEqual({ importsConstant: true, passesConstant: true });
  });
});

// ═══════════════════════════════════════════════════════════════
// The three model-editor-modal cases, without the prop
// ═══════════════════════════════════════════════════════════════

describe("GREEN CONTROL: ModelEditor without keylessProviders behaves as today", () => {
  it("creates a new credential and a new model in create mode", async () => {
    global.fetch = makeFetchMock(calls, {
      "POST /api/credentials": { data: { credential: { id: "cred-new" } } },
      "POST /api/models": { data: { model: { id: "model-new" } } },
    });
    const onSaved = jest.fn();

    render(
      <ModelEditor
        model={null}
        credentials={[]}
        providers={["anthropic", "openrouter", "openai"]}
        onClose={jest.fn()}
        onSaved={onSaved}
      />,
    );

    fillNameAndModelId("Claude Opus 4", "anthropic/claude-opus-4");
    fireEvent.change(screen.getByPlaceholderText("sk-..."), { target: { value: "sk-test-key" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Model/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(calls.find((c) => c.url === "/api/credentials")?.body).toMatchObject({ provider: "anthropic", apiKey: "sk-test-key" });
    expect(calls.find((c) => c.url === "/api/models")?.body).toMatchObject({
      name: "Claude Opus 4",
      provider: "anthropic",
      modelId: "anthropic/claude-opus-4",
      credentialsId: "cred-new",
    });
  });

  it("reuses an existing credential without POSTing /api/credentials", async () => {
    global.fetch = makeFetchMock(calls, { "POST /api/models": { data: { model: { id: "model-new" } } } });
    const onSaved = jest.fn();

    render(
      <ModelEditor
        model={null}
        credentials={[ANTHROPIC_KEY]}
        providers={["anthropic", "openrouter", "openai"]}
        onClose={jest.fn()}
        onSaved={onSaved}
      />,
    );

    fillNameAndModelId("Claude (existing creds)", "anthropic/claude-sonnet-4");
    fireEvent.click(screen.getByLabelText(/Credential/i));
    fireEvent.click(screen.getByText(ANTHROPIC_KEY.label));
    fireEvent.click(screen.getByRole("button", { name: /Create Model/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(calls.find((c) => c.url === "/api/credentials")).toBeUndefined();
    expect(calls.find((c) => c.url === "/api/models")?.body).toMatchObject({
      credentialsId: ANTHROPIC_KEY.id,
      name: "Claude (existing creds)",
    });
  });

  it("edits an existing model without touching credentials when the key is blank", async () => {
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
      />,
    );

    fireEvent.change(screen.getByDisplayValue("Claude Sonnet 4"), { target: { value: "Claude Sonnet 4 (renamed)" } });
    fireEvent.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(calls.find((c) => c.url === "/api/credentials")).toBeUndefined();
    const putCall = calls.find((c) => c.method === "PUT");
    expect(putCall?.url).toBe("/api/models/model-existing");
    expect(putCall?.body).toMatchObject({ name: "Claude Sonnet 4 (renamed)", credentialsId: ANTHROPIC_KEY.id });
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /api/credentials
// ═══════════════════════════════════════════════════════════════

describe("POST /api/credentials and the providers that have no key to store", () => {
  function post(body: unknown) {
    const req = { url: "http://localhost/api/credentials", method: "POST", json: async () => body } as unknown as NextRequest;
    return (postCredentials(req) as unknown as Promise<{ status: number; json: () => Promise<unknown> }>).then(
      async (r) => ({ status: r.status, body: (await r.json()) as { error?: string } }),
    );
  }

  it("nous is refused up front, naming OAuth, and no row is created or rolled back", async () => {
    const res = await post({ label: "x", provider: "nous", apiKey: "y" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nous/);
    expect(res.body.error).toMatch(/OAuth/);
    expect(repo.__createCredential).not.toHaveBeenCalled();
    expect(repo.__deleteCredential).not.toHaveBeenCalled();
    expect(env.syncCredentialToHermesEnv).not.toHaveBeenCalled();
  });

  it("GREEN CONTROL (the decision): an empty key for ollama is still a 400, a keyless provider needs no row", async () => {
    const res = await post({ label: "x", provider: "ollama", apiKey: "" });

    expect(res.status).toBe(400);
    expect(repo.__createCredential).not.toHaveBeenCalled();
  });
});

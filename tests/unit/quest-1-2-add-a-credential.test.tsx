/**
 * @jest-environment jsdom
 */
// ═══════════════════════════════════════════════════════════════
// Quest 1.2 sends a newcomer to a screen where a credential can be added.
//
// Real-agent finding: "Add a credential" lands on /agent/models and there is
// no way to add one. The control was not missing so much as unreachable in
// the state a new install is in. CredentialsPanel opened with
// `if (credentials.length === 0) return null`, so on a fresh install the whole
// section was absent, and the panel had no add control at any count: the only
// path to a credential ran through the Add Model modal, whose picker offers
// "+ Create new credential" beside a key field. A newcomer who had already
// finished quest 1.1 therefore had to invent a SECOND model to attach a key
// to one, which is why a different tester got there and this one did not.
//
// The contract: the Credentials section is on the page whether or not there
// are any, it says what to do when there are none, and it carries a control
// that creates one on its own. The quest's own `screen` is asserted here too,
// so re-pointing the quest moves this test with it rather than leaving the
// control behind.
// ═══════════════════════════════════════════════════════════════

import "@testing-library/jest-dom";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithQuery } from "../helpers/render-with-query";
import { jsonResponse } from "../helpers/fetch-map";

import ModelsPage from "@/app/agent/models/page";
import { QUEST_DEFS } from "@/lib/quests/quest-defs";
import { TASK_TYPES } from "@/lib/models/task-types";

const nullDefaults = () =>
  TASK_TYPES.reduce<Record<string, string | null>>((acc, t) => {
    acc[t] = null;
    return acc;
  }, {});

const FALLBACK_CONFIG = {
  restorePrimaryOnFallback: true,
  fallbackNotification: false,
  apiMaxRetries: 2,
};

const EXISTING = {
  id: "c1",
  label: "Anthropic Personal",
  provider: "anthropic",
  keyHint: "sk-a...wxyz",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

/** Method-aware, because POST and GET on /api/credentials answer differently. */
function setFetch(credentials: unknown[]) {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.startsWith("/api/credentials")) {
      if (method === "POST") {
        return jsonResponse(
          { data: { credential: { ...EXISTING, id: "c-new", label: "Work key", keyHint: "sk-a...6789" } } },
          201,
        ) as unknown as Response;
      }
      return jsonResponse({ data: { credentials } }) as unknown as Response;
    }
    if (url.startsWith("/api/models/defaults")) {
      return jsonResponse({ data: { defaults: nullDefaults() } }) as unknown as Response;
    }
    if (url.startsWith("/api/models/sync/drift")) {
      return jsonResponse({ data: null }) as unknown as Response;
    }
    if (url.startsWith("/api/models/fallbacks/config")) {
      return jsonResponse({ data: { config: FALLBACK_CONFIG } }) as unknown as Response;
    }
    if (url.startsWith("/api/models/fallbacks")) {
      return jsonResponse({ data: { chain: [], config: FALLBACK_CONFIG } }) as unknown as Response;
    }
    if (url.startsWith("/api/models")) {
      return jsonResponse({ data: { models: [] } }) as unknown as Response;
    }
    throw new Error(`Unmatched fetch: ${url}`);
  }) as typeof global.fetch;
}

/** Every recorded POST to /api/credentials, with its parsed body. */
function credentialPosts(): Array<Record<string, unknown>> {
  const calls = (global.fetch as jest.Mock).mock.calls as Array<[RequestInfo | URL, RequestInit?]>;
  return calls
    .filter(([input, init]) => {
      const url = typeof input === "string" ? input : input.toString();
      return url.startsWith("/api/credentials") && (init?.method ?? "GET").toUpperCase() === "POST";
    })
    .map(([, init]) => JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
}

async function renderLoaded(credentials: unknown[] = []) {
  setFetch(credentials);
  const utils = renderWithQuery(<ModelsPage />);
  await waitFor(() => expect(screen.getByText(/No models yet/i)).toBeInTheDocument());
  return utils;
}

/** The custom Select is a button plus a listbox, so choosing is two clicks. */
function chooseOption(ariaLabel: string, optionLabel: string) {
  fireEvent.click(screen.getByRole("button", { name: ariaLabel }));
  fireEvent.click(screen.getByRole("option", { name: new RegExp(optionLabel, "i") }));
}

const ADD = /^Add credential$/;

describe("the quest points at the screen this test drives", () => {
  it("quest 1.2 is 'Add a credential' on the Models page", () => {
    const quest = QUEST_DEFS.find((q) => q.id === "1.2");

    expect(quest?.title).toBe("Add a credential");
    expect(quest?.screen).toBe("/agent/models");
  });
});

describe("a new install can add its first credential", () => {
  it("shows the Credentials section with none stored yet", async () => {
    await renderLoaded([]);

    expect(screen.getByRole("heading", { name: /credentials/i })).toBeInTheDocument();
  });

  it("says what to do when there are none", async () => {
    await renderLoaded([]);

    expect(screen.getByText(/no credentials yet/i)).toBeInTheDocument();
  });

  it("offers a control that adds one", async () => {
    await renderLoaded([]);

    expect(screen.getByRole("button", { name: ADD })).toBeEnabled();
  });

  it("saves the name, provider and key straight to /api/credentials", async () => {
    await renderLoaded([]);

    fireEvent.click(screen.getByRole("button", { name: ADD }));

    fireEvent.change(screen.getByRole("textbox", { name: /credential name/i }), {
      target: { value: "Work key" },
    });
    chooseOption("Provider for the new credential", "anthropic");
    fireEvent.change(screen.getByLabelText(/api key for the new credential/i), {
      target: { value: "sk-ant-0123456789" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Save credential$/ }));

    await waitFor(() => expect(credentialPosts()).toHaveLength(1));
    expect(credentialPosts()[0]).toMatchObject({
      label: "Work key",
      provider: "anthropic",
      apiKey: "sk-ant-0123456789",
    });
  });

  it("will not save an empty key", async () => {
    await renderLoaded([]);

    fireEvent.click(screen.getByRole("button", { name: ADD }));

    expect(screen.getByRole("button", { name: /^Save credential$/ })).toBeDisabled();
    expect(credentialPosts()).toHaveLength(0);
  });

  it("will not save until a provider is chosen", async () => {
    // A key is written to a provider-specific variable, so a form that guessed
    // the provider would file the key in the wrong place and fail at
    // authentication, a long way from the mistake.
    await renderLoaded([]);

    fireEvent.click(screen.getByRole("button", { name: ADD }));
    fireEvent.change(screen.getByLabelText(/api key for the new credential/i), {
      target: { value: "sk-ant-0123456789" },
    });

    expect(screen.getByRole("button", { name: /^Save credential$/ })).toBeDisabled();

    chooseOption("Provider for the new credential", "anthropic");

    expect(screen.getByRole("button", { name: /^Save credential$/ })).toBeEnabled();
  });

  it("names an unnamed credential after its provider", async () => {
    await renderLoaded([]);

    fireEvent.click(screen.getByRole("button", { name: ADD }));
    chooseOption("Provider for the new credential", "anthropic");
    fireEvent.change(screen.getByLabelText(/api key for the new credential/i), {
      target: { value: "sk-ant-0123456789" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Save credential$/ }));

    await waitFor(() => expect(credentialPosts()).toHaveLength(1));
    expect(credentialPosts()[0]).toMatchObject({ label: "anthropic key" });
  });

  it("closes the form again without saving", async () => {
    await renderLoaded([]);

    fireEvent.click(screen.getByRole("button", { name: ADD }));
    fireEvent.click(screen.getByRole("button", { name: /^Cancel adding a credential$/ }));

    expect(screen.queryByRole("button", { name: /^Save credential$/ })).not.toBeInTheDocument();
    expect(credentialPosts()).toHaveLength(0);
  });
});

describe("GREEN CONTROL: the rows an install already has are untouched", () => {
  it("still lists a stored credential with its rotate and delete doors", async () => {
    await renderLoaded([EXISTING]);

    const section = screen.getByRole("heading", { name: /credentials/i }).closest("section");
    expect(section).not.toBeNull();
    const panel = within(section as HTMLElement);

    expect(panel.getByText("Anthropic Personal")).toBeInTheDocument();
    expect(panel.getByText("sk-a...wxyz")).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Rotate key for Anthropic Personal" })).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Delete credential Anthropic Personal" })).toBeInTheDocument();
    // The add door is on the same panel whether or not rows exist.
    expect(panel.getByRole("button", { name: ADD })).toBeInTheDocument();
  });
});

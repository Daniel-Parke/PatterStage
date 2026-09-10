/** @jest-environment jsdom */
/* eslint-disable @typescript-eslint/no-require-imports */

// ═══════════════════════════════════════════════════════════════
// One truth about the model: three screens, three answers (real-agent round).
//
// Driven against a live install whose facts were: the agent's config file
// names MiniMax-M3 on the minimax provider, the models registry's agent slot
// is empty, the gateway is up and serves ["hermes-agent"]. That install works.
// It was told three different things:
//
//   1. Chat  -> "Model not ready for chat". useGatewayHealth ANDed the
//      registry's agent slot with the config file, and the registry slot is
//      irrelevant to chat: an agent turn sends no model at all (the gateway
//      reads its own config file) and a fast turn sends the dropdown id. So a
//      working install was told, in orange, that it could not chat.
//   2. Dashboard -> "MiniMax-M3 · minimax". The OR of the same two facts. This
//      one was right, which is why it is a green control below.
//   3. Models -> "No default set", and on the opposite install (registry set,
//      config file empty) it stamps that model "Active" when the agent has
//      never seen it.
//
// The fix is one rule, resolved once on the server and read by all three:
// what the agent can call is what its config file names, because that is the
// file the gateway reads. A registry slot that has not reached that file is a
// separate, nameable state, not a synonym for "no model".
//
// The third finding is the remedy: the banner offered three routes ("Config →
// Models", "Operations → Agents → Push Bob", `hermes model`), no button, and
// the middle one names a section this product does not have. One action.
// ═══════════════════════════════════════════════════════════════

import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { queryWrapper } from "../helpers/render-with-query";

import { bannerStatesFor } from "@/components/chat/gateway-banner-states";
import type { ApiModel } from "@/components/models/types";
import type { ModelReadiness } from "@/lib/models/model-readiness";

jest.mock("next/link", () => require("../helpers/mocks").nextLinkMock());

jest.mock("lucide-react", () => require("../helpers/mocks").lucideMock());

// The hook polls the gateway every 30s. No timers in this file: the poll is
// not what is under test, the first read is.
jest.mock("@/hooks/useInterval", () => ({ useInterval: () => undefined }));

const safeApiCallData = jest.fn();
// The hook reads through useApiResource since C6 (T-0143), which calls
// safeApiCall; both doubles are served from the same payload map below.
const safeApiCall = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  ...(jest.requireActual("@/lib/api-fetch") as Record<string, unknown>),
  safeApiCallData: (...a: unknown[]) => safeApiCallData(...a),
  safeApiCall: (...a: unknown[]) => safeApiCall(...a),
}));

import GatewayBanner from "@/components/chat/GatewayBanner";
import ModelsAgentDefaultSection from "@/components/models/ModelsAgentDefaultSection";
import { useGatewayHealth } from "@/hooks/useGatewayHealth";

// ── The install the round was driven against ────────────────────
//
// `modelReadiness` is what GET /api/models/defaults answers: the one place the
// rule is applied. The rest of the payloads are copied from the live instance.
const READY: ModelReadiness = {
  state: "ready",
  ready: true,
  label: "MiniMax-M3 · minimax",
  modelName: "MiniMax-M3",
  detail: "",
};

const NOT_SENT: ModelReadiness = {
  state: "not-sent",
  ready: false,
  label: "MiniMax-M3 · not sent to the agent yet",
  modelName: "MiniMax-M3",
  detail:
    "MiniMax-M3 is chosen but has not reached the agent yet. Set the default model again to send it across.",
};

function serve(payloads: Record<string, unknown>) {
  const answer = (url: string) => {
    const key = Object.keys(payloads).find((k) => url.startsWith(k));
    return key ? payloads[key] : null;
  };
  safeApiCallData.mockImplementation(async (url: string) => answer(url));
  safeApiCall.mockImplementation(async (url: string) => {
    const data = answer(url);
    return data ? { ok: true, data: { data } } : { ok: false, error: "unavailable" };
  });
}

/** Every URL either double was asked for. */
function urlsRead(): string[] {
  return [...safeApiCallData.mock.calls, ...safeApiCall.mock.calls].map((c) => String(c[0]));
}

const WORKING_INSTALL = {
  "/api/gateway/health": { online: true, authConfigured: true, baseUrl: "http://127.0.0.1:8642" },
  "/api/gateway/models": { models: ["hermes-agent"] },
  "/api/models/defaults": { defaults: { agent: null }, modelReadiness: READY },
  "/api/models": { models: [] },
};

beforeEach(() => {
  safeApiCallData.mockReset();
  safeApiCall.mockReset();
});

describe("chat does not accuse a working install of having no model", () => {
  it("shows no banner when the agent's config file names a model and the registry slot is empty", async () => {
    serve(WORKING_INSTALL);

    const { result } = renderHook(() => useGatewayHealth(), { wrapper: queryWrapper() });
    await waitFor(() => {
      expect(result.current.online).not.toBeNull();
      expect(result.current.modelReadiness).not.toBeNull();
    });

    expect(result.current.modelReadiness?.ready).toBe(true);
    expect(
      bannerStatesFor({
        gatewayOnline: result.current.online,
        gatewayAuthConfigured: result.current.authConfigured,
        modelReady: result.current.modelReadiness?.ready ?? null,
        hasActiveConversation: false,
        messageCount: 0,
      }),
    ).toEqual([]);
  });

  it("reads the answer once instead of re-deriving it from the config file", async () => {
    // The hook used to fetch /api/config and /api/models/defaults and combine
    // them itself, which is how it came to hold a different opinion from the
    // two screens that read the same two endpoints. The rule is resolved on
    // the server now, so the second read is gone.
    serve(WORKING_INSTALL);

    const { result } = renderHook(() => useGatewayHealth(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.modelReadiness).not.toBeNull());

    const urls = urlsRead();
    expect(urls).toContain("/api/models/defaults");
    expect(urls).not.toContain("/api/config");
  });

  it("GREEN CONTROL: it still says so when there really is no model", async () => {
    serve({
      ...WORKING_INSTALL,
      "/api/models/defaults": { defaults: { agent: null }, modelReadiness: NOT_SENT },
    });

    const { result } = renderHook(() => useGatewayHealth(), { wrapper: queryWrapper() });
    await waitFor(() => {
      expect(result.current.online).not.toBeNull();
      expect(result.current.modelReadiness).not.toBeNull();
    });

    expect(
      bannerStatesFor({
        gatewayOnline: result.current.online,
        gatewayAuthConfigured: result.current.authConfigured,
        modelReady: result.current.modelReadiness?.ready ?? null,
        hasActiveConversation: false,
        messageCount: 0,
      }),
    ).toEqual(["model-missing"]);
  });
});

describe("the models page tells the same story as the rest of the product", () => {
  const noop = async () => undefined;

  function renderSection(agentSlot: string | null, readiness: ModelReadiness | null) {
    const models: ApiModel[] = [
      {
        id: "m_1",
        name: "MiniMax-M3",
        provider: "minimax",
        modelId: "MiniMax-M3",
        apiStyle: null,
        baseUrl: null,
        contextLength: null,
        credentialsId: null,
        defaults: {} as ApiModel["defaults"],
        createdAt: "",
        updatedAt: "",
      },
    ];
    return render(
      <ModelsAgentDefaultSection
        models={models}
        modelOptions={models.map((m) => ({ id: m.id, name: m.name, provider: m.provider, modelId: m.modelId }))}
        defaults={{ agent: agentSlot } as never}
        readiness={readiness}
        busyTaskType={null}
        onBulkAuxiliaryChange={noop}
        onSetDefault={noop}
      />,
    );
  }

  it("does not report 'no model' on the install the dashboard says has one", () => {
    const { container } = renderSection(null, READY);

    // "No default set" is true of the registry slot and false of the product.
    // The section has to say which model the agent is actually using.
    expect(container.textContent).toContain("MiniMax-M3");
    expect(container.textContent).not.toMatch(/No default set/);
  });

  it("does not stamp a model 'Active' that the agent has never seen", () => {
    // The opposite install: the registry slot is set, the agent's config file
    // is not. The registry alone was enough to print Active, which is the same
    // confusion in the other direction.
    const { container } = renderSection("m_1", NOT_SENT);

    expect(screen.queryByText(/Active/)).toBeNull();
    expect(container.textContent).toMatch(/has not reached the agent yet/);
  });

  it("GREEN CONTROL: a model the agent really is using still reads Active", () => {
    renderSection("m_1", READY);
    expect(screen.getByText(/Active/)).toBeInTheDocument();
  });
});

describe("the remedy is one action that works", () => {
  it("offers a single link, to a screen this product has", () => {
    render(<GatewayBanner status="model-missing" modelDetail={NOT_SENT.detail} />);

    const links = Array.from(document.querySelectorAll("a"));
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("/agent/models");
  });

  it("stops sending people to a section that does not exist", () => {
    const { container } = render(<GatewayBanner status="model-missing" />);
    const text = container.textContent ?? "";

    // There is no Operations section in the rail (Home, Work, Results, Agent,
    // Rec Room) and no "Push Bob" screen anywhere.
    expect(text).not.toMatch(/Operations/);
    expect(text).not.toMatch(/Push Bob/);
  });

  it("says what is actually wrong with this install, not a generic three-route list", () => {
    const { container } = render(<GatewayBanner status="model-missing" modelDetail={NOT_SENT.detail} />);

    expect(container.textContent).toContain(NOT_SENT.detail);
  });
});

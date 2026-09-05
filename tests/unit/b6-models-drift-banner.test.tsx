/** @jest-environment jsdom */
// ═══════════════════════════════════════════════════════════════
// B6 oracle, group modal-and-banner, part two: the drift banner gets a
// Pull / Push per line (T-0100, plan item "drift banner per-line Pull /
// Push", contract section 2).
//
// Written before the product code moved. Four contracts, one file:
//
//   (A) `buildDriftLines(drift)` beside `buildDriftDetails`: the same three
//       sentences in the same order, each carrying kind, provider, modelId
//       and a registryId (primary: the DB row matching the Hermes primary or
//       null; db-only: the row id; hermes-only: null). buildDriftDetails stays
//       byte-identical (build-drift-details.test.ts pins it; one control here).
//   (B) GET /api/models/sync/drift answers `{ hasDrift, driftDetails, lines }`
//       with lines[i].text === driftDetails[i], through the REAL sync-manager
//       over mocked repository and config readers.
//   (C) ModelsDriftBanner { drift, agentDefaultId, onPull, onPush, busyLine }:
//       primary -> Pull, and Push only when agentDefaultId is non-null;
//       hermes-only -> Pull; db-only -> Push only when registryId is the agent
//       default. No 'Sync Now'. Nothing when hasDrift is false.
//   (D) useModelActions.handleDriftPull / handleDriftPush against the closed
//       api-fetch double of b1-model-actions-read-the-answer: hermes-only
//       pulls by re-import; primary with a registryId pulls by PUT defaults;
//       push posts the agent default with pushCredential false and never a
//       null modelId. Toasts 'Pulled from Hermes' / 'Pushed to Hermes'.
//
// Type-tolerance: the tests tsconfig type-checks this file before B6 lands,
// so the shapes the contract adds (DriftLine, SyncDrift.lines, the banner's
// new props, the two hook handlers, `agentDefaultId` on the hook's args, the
// registryId on DriftReport entries) are read through local aliases and loose
// casts. Every runtime assertion is exactly what the contract says.
// ═══════════════════════════════════════════════════════════════

import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ComponentType } from "react";

jest.mock("lucide-react", () => {
  // Icons leave the accessibility tree, so an icon-only button that names
  // itself with `title` still resolves by its accessible name. A mocked icon
  // that rendered text would become the name and hide the title (skeptic 4).
  const passthrough = () => () => null;
  return new Proxy({}, { get: () => passthrough() });
});

// next/server, the way models-api.test.ts stands it in: a status and a body.
jest.mock("next/server", () => ({
  NextRequest: class NextRequest {
    url: string;
    method: string;
    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.method = init?.method ?? "GET";
    }
  },
  NextResponse: class NextResponse {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      this.status = status;
      this.body = body;
    }
    async json() {
      return this.body;
    }
    static json(data: unknown, init?: ResponseInit) {
      return new NextResponse(init?.status ?? 200, data);
    }
  },
}));

// The registry and the config readers, as models-pull-context-length mocks
// them: the real sync-manager runs over these.
const mockListModels = jest.fn();
const mockGetModel = jest.fn();
const mockGetModelDefaults = jest.fn();
jest.mock("@/lib/models-repository", () => ({
  listModels: () => mockListModels(),
  getModel: (id: string) => mockGetModel(id),
  getModelDefaults: () => mockGetModelDefaults(),
  getModelWithKey: jest.fn(() => null),
}));
jest.mock("@/lib/credentials-repository", () => ({
  getCredentialWithKey: jest.fn(() => null),
}));

const mockReadHermesConfigModels = jest.fn();
const mockReadHermesYamlConfig = jest.fn();
jest.mock("@/modules/hermes/lib/hermes-config-read", () => ({
  readHermesConfigModels: () => mockReadHermesConfigModels(),
  readHermesYamlConfig: () => mockReadHermesYamlConfig(),
}));

// The closed api-fetch double of b1-model-actions-read-the-answer: any new
// helper the hook imports must be added here, which is the constraint.
const mockApiFetch = jest.fn();
jest.mock("@/lib/api-fetch", () => ({
  API_FETCH_BULK_TIMEOUT_MS: 300_000,
  apiFetch: (...a: unknown[]) => mockApiFetch(...a),
  messageFromError: (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback),
  // Observable, and shaped like the real helper: the same path and init reach
  // the recorder, the envelope is unwrapped, a failure answers null. The hook
  // may re-import through either door and the assertions still see it.
  safeApiCallData: async (path: string, init?: unknown) => {
    try {
      const r = (await mockApiFetch(path, init)) as { data?: unknown } | undefined;
      return r?.data ?? null;
    } catch {
      return null;
    }
  },
  toastError: (show: (m: string, t?: string) => void, e: unknown, fallback: string) =>
    show(e instanceof Error ? e.message : fallback, "error"),
}));

import * as syncManager from "@/modules/hermes/lib/sync-manager";
import { buildDriftDetails, type DriftReport } from "@/modules/hermes/lib/sync-manager";
import { GET } from "@/app/api/models/sync/drift/route";
import ModelsDriftBanner from "@/components/models/ModelsDriftBanner";
import { useModelActions, type UseModelActionsArgs } from "@/hooks/useModelActions";

// ── pre-B6 type shims (see header) ─────────────────────────────

/** The line shape the contract declares in src/components/models/types.ts. */
interface DriftLine {
  kind: "primary" | "hermes-only" | "db-only";
  text: string;
  provider: string;
  modelId: string;
  registryId: string | null;
}

type BuildDriftLines = (drift: DriftReport) => DriftLine[];

/** The new export, read off the namespace so the import compiles before B6. */
const buildDriftLines: BuildDriftLines | undefined = (
  syncManager as typeof syncManager & { buildDriftLines?: BuildDriftLines }
).buildDriftLines;

interface BannerDrift {
  hasDrift: boolean;
  driftDetails: string[];
  lines: DriftLine[];
}

interface BannerProps {
  drift: BannerDrift;
  agentDefaultId: string | null;
  onPull: (line: DriftLine) => void;
  onPush: (line: DriftLine) => void;
  busyLine: string | null;
}

const Banner = ModelsDriftBanner as unknown as ComponentType<BannerProps>;

interface DriftActions {
  handleDriftPull?: (line: DriftLine) => Promise<unknown>;
  handleDriftPush?: (line: DriftLine) => Promise<unknown>;
}

// ── fixtures ───────────────────────────────────────────────────

const DB_ROWS = [
  { id: "reg-1", name: "GPT-4o", provider: "openai", modelId: "gpt-4o", baseUrl: null, contextLength: null },
  { id: "reg-2", name: "Mini", provider: "openai", modelId: "gpt-4o-mini", baseUrl: null, contextLength: null },
];

/** A DriftReport whose entries carry the registryId the contract adds. */
const FULL_DRIFT = {
  primaryDiffers: { dbModel: "openai/gpt-4o-mini", hermesModel: "openai/gpt-4o", registryId: "reg-1" },
  modelsInHermesNotInDb: [{ name: "claude", provider: "anthropic", modelId: "claude" }],
  modelsInDbNotInHermes: [{ name: "Mini", provider: "openai", modelId: "gpt-4o-mini", registryId: "reg-2" }],
} as unknown as DriftReport;

const PRIMARY_LINE: DriftLine = {
  kind: "primary",
  text: 'Primary model drift: DB has "openai/gpt-4o-mini", Hermes has "openai/gpt-4o"',
  provider: "openai",
  modelId: "gpt-4o",
  registryId: "reg-1",
};
const HERMES_ONLY_LINE: DriftLine = {
  kind: "hermes-only",
  text: 'Model "claude" (anthropic) is in Hermes but not in PatterStage',
  provider: "anthropic",
  modelId: "claude",
  registryId: null,
};
const DB_ONLY_LINE: DriftLine = {
  kind: "db-only",
  text: 'Model "gpt-4o-mini" (openai) is in PatterStage but not pushed to Hermes',
  provider: "openai",
  modelId: "gpt-4o-mini",
  registryId: "reg-2",
};

function driftOf(...lines: DriftLine[]): BannerDrift {
  return { hasDrift: lines.length > 0, driftDetails: lines.map((l) => l.text), lines };
}

function renderBanner(drift: BannerDrift, agentDefaultId: string | null) {
  const onPull = jest.fn();
  const onPush = jest.fn();
  const utils = render(
    <Banner drift={drift} agentDefaultId={agentDefaultId} onPull={onPull} onPush={onPush} busyLine={null} />,
  );
  return { onPull, onPush, ...utils };
}

const pullButtons = () => screen.queryAllByRole("button", { name: /^Pull from Hermes/ });
const pushButtons = () => screen.queryAllByRole("button", { name: /^Push to Hermes/ });

beforeEach(() => {
  jest.clearAllMocks();
  mockApiFetch.mockReset();
  mockListModels.mockReturnValue(DB_ROWS);
  mockGetModel.mockImplementation((id: string) => DB_ROWS.find((r) => r.id === id) ?? null);
  mockGetModelDefaults.mockReturnValue({ agent: "reg-2" });
  mockReadHermesConfigModels.mockReturnValue(
    new Map([
      ["openai::gpt-4o", { modelId: "gpt-4o", provider: "openai", baseUrl: null, contextLength: null }],
      ["anthropic::claude", { modelId: "claude", provider: "anthropic", baseUrl: null, contextLength: null }],
    ]),
  );
  mockReadHermesYamlConfig.mockReturnValue({ model: { default: "gpt-4o", provider: "openai" } });
});

// ── (A) buildDriftLines beside buildDriftDetails ───────────────

describe("buildDriftLines says the same three sentences, each with a handle", () => {
  it("is exported from sync-manager", () => {
    expect(typeof buildDriftLines).toBe("function");
  });

  it("yields one line per detail, same text, same order", () => {
    const lines = buildDriftLines!(FULL_DRIFT);
    const details = buildDriftDetails(FULL_DRIFT);
    expect(lines.map((l) => l.text)).toEqual(details);
    expect(lines.map((l) => l.kind)).toEqual(["primary", "hermes-only", "db-only"]);
  });

  it("carries provider, modelId and the registryId the drift report knows", () => {
    const [primary, hermesOnly, dbOnly] = buildDriftLines!(FULL_DRIFT);
    // Only kind and registryId here: where the primary line's provider and
    // modelId come from is the report's business, and this fixture is
    // hand-built. Section (B) asserts them against the real detectConfigDrift.
    expect(primary).toEqual(expect.objectContaining({ kind: "primary", registryId: "reg-1" }));
    expect(hermesOnly).toEqual(
      expect.objectContaining({ provider: "anthropic", modelId: "claude", registryId: null }),
    );
    expect(dbOnly).toEqual(expect.objectContaining({ provider: "openai", modelId: "gpt-4o-mini", registryId: "reg-2" }));
  });

  it("a primary line with no matching DB row has registryId null", () => {
    const drift = {
      primaryDiffers: { dbModel: "none", hermesModel: "openai/gpt-4o" },
      modelsInHermesNotInDb: [],
      modelsInDbNotInHermes: [],
    } as unknown as DriftReport;
    const [primary] = buildDriftLines!(drift);
    expect(primary.kind).toBe("primary");
    expect(primary.registryId).toBeNull();
  });

  it("a model id containing a slash keeps it: the provider is the part before the FIRST slash", () => {
    // Sweep survivor `lines-primary-splits-last-slash`. Real model ids are
    // routinely "anthropic/claude-sonnet-4", so `hermesModel` is
    // "anthropic/anthropic/claude-sonnet-4" and splitting on the last slash
    // hands the banner a provider of "anthropic/anthropic".
    const drift = {
      primaryDiffers: {
        dbModel: "openai/gpt-4o",
        hermesModel: "anthropic/anthropic/claude-sonnet-4",
        registryId: "reg-3",
      },
      modelsInHermesNotInDb: [],
      modelsInDbNotInHermes: [],
    } as unknown as DriftReport;

    const [primary] = buildDriftLines!(drift);

    expect(primary.provider).toBe("anthropic");
    expect(primary.modelId).toBe("anthropic/claude-sonnet-4");
  });

  it("an empty report yields no lines", () => {
    expect(
      buildDriftLines!({ primaryDiffers: null, modelsInHermesNotInDb: [], modelsInDbNotInHermes: [] }),
    ).toEqual([]);
  });

  it("GREEN CONTROL: buildDriftDetails is byte-identical for the same report", () => {
    expect(buildDriftDetails(FULL_DRIFT)).toEqual([
      'Primary model drift: DB has "openai/gpt-4o-mini", Hermes has "openai/gpt-4o"',
      'Model "claude" (anthropic) is in Hermes but not in PatterStage',
      'Model "gpt-4o-mini" (openai) is in PatterStage but not pushed to Hermes',
    ]);
  });
});

// ── (B) the route answers lines ────────────────────────────────

describe("GET /api/models/sync/drift answers lines beside driftDetails", () => {
  async function get(): Promise<{ hasDrift: boolean; driftDetails: string[]; lines?: DriftLine[] }> {
    const res = await GET({} as never);
    const body = (await res.json()) as { data: { hasDrift: boolean; driftDetails: string[]; lines?: DriftLine[] } };
    return body.data;
  }

  it("one line per detail string, same order, same text", async () => {
    const data = await get();
    expect(data.hasDrift).toBe(true);
    expect(data.driftDetails).toHaveLength(3);
    expect(data.lines).toBeDefined();
    expect(data.lines!.map((l) => l.text)).toEqual(data.driftDetails);
  });

  it("detectConfigDrift carries the registry ids the banner acts on", async () => {
    const data = await get();
    const [primary, hermesOnly, dbOnly] = data.lines!;
    // The DB row matching the Hermes primary (gpt-4o), not the agent default.
    expect(primary).toEqual(
      expect.objectContaining({ kind: "primary", registryId: "reg-1", provider: "openai", modelId: "gpt-4o" }),
    );
    expect(hermesOnly).toEqual(expect.objectContaining({ kind: "hermes-only", registryId: null }));
    expect(dbOnly).toEqual(expect.objectContaining({ kind: "db-only", registryId: "reg-2" }));
  });

  it("GREEN CONTROL: driftDetails keeps its strings", async () => {
    const data = await get();
    expect(data.driftDetails).toEqual([
      'Primary model drift: DB has "openai/gpt-4o-mini", Hermes has "openai/gpt-4o"',
      'Model "claude" (anthropic) is in Hermes but not in PatterStage',
      'Model "gpt-4o-mini" (openai) is in PatterStage but not pushed to Hermes',
    ]);
  });

  it("no drift: hasDrift false and lines empty", async () => {
    mockGetModelDefaults.mockReturnValue({ agent: "reg-1" });
    mockListModels.mockReturnValue([DB_ROWS[0]]);
    mockReadHermesConfigModels.mockReturnValue(
      new Map([["openai::gpt-4o", { modelId: "gpt-4o", provider: "openai", baseUrl: null, contextLength: null }]]),
    );
    const data = await get();
    expect(data.hasDrift).toBe(false);
    expect(data.lines).toEqual([]);
  });
});

// ── (C) the banner: a button per line ──────────────────────────

describe("ModelsDriftBanner offers Pull / Push per line", () => {
  it("a primary line offers Pull and Push when there is an agent default", () => {
    renderBanner(driftOf(PRIMARY_LINE), "reg-2");
    expect(pullButtons()).toHaveLength(1);
    expect(pushButtons()).toHaveLength(1);
    expect(screen.getByText(PRIMARY_LINE.text)).toBeTruthy();
  });

  it("a primary line offers only Pull when there is no agent default to push", () => {
    renderBanner(driftOf(PRIMARY_LINE), null);
    expect(pullButtons()).toHaveLength(1);
    expect(pushButtons()).toHaveLength(0);
  });

  it("a hermes-only line offers only Pull", () => {
    renderBanner(driftOf(HERMES_ONLY_LINE), "reg-2");
    expect(pullButtons()).toHaveLength(1);
    expect(pushButtons()).toHaveLength(0);
  });

  it("a db-only line offers Push only when it is the agent default", () => {
    const asDefault = renderBanner(driftOf(DB_ONLY_LINE), "reg-2");
    expect(pushButtons()).toHaveLength(1);
    expect(pullButtons()).toHaveLength(0);
    asDefault.unmount();

    renderBanner(driftOf(DB_ONLY_LINE), "reg-9");
    expect(pushButtons()).toHaveLength(0);
    expect(pullButtons()).toHaveLength(0);
    expect(screen.getByText(DB_ONLY_LINE.text)).toBeTruthy();
    // Found on the proof walk: a line with no safe remedy still has to say why
    // it is offering nothing, or the banner is a complaint with no action.
    expect(screen.getByText("Make it the agent default to push it")).toBeTruthy();
  });

  it("all three lines together: two Pulls, two Pushes, and no 'Sync Now'", () => {
    renderBanner(driftOf(PRIMARY_LINE, HERMES_ONLY_LINE, DB_ONLY_LINE), "reg-2");
    expect(pullButtons()).toHaveLength(2);
    expect(pushButtons()).toHaveLength(2);
    expect(screen.queryByText(/Sync Now/)).toBeNull();
    expect(document.body.textContent).toMatch(/Model config drift/);
  });

  it("clicking a line's buttons hands that line to onPull / onPush", () => {
    const { onPull, onPush } = renderBanner(driftOf(PRIMARY_LINE), "reg-2");
    fireEvent.click(pullButtons()[0]);
    expect(onPull).toHaveBeenCalledTimes(1);
    expect(onPull).toHaveBeenCalledWith(expect.objectContaining({ kind: "primary", registryId: "reg-1" }));
    expect(onPush).not.toHaveBeenCalled();

    fireEvent.click(pushButtons()[0]);
    expect(onPush).toHaveBeenCalledTimes(1);
    expect(onPush).toHaveBeenCalledWith(expect.objectContaining({ kind: "primary" }));
  });

  it("GREEN CONTROL: renders nothing when hasDrift is false", () => {
    const { container } = renderBanner({ hasDrift: false, driftDetails: [], lines: [] }, "reg-2");
    expect(container.firstChild).toBeNull();
  });
});

// ── (D) the hook: what a click does ────────────────────────────

describe("useModelActions handleDriftPull / handleDriftPush", () => {
  function mount(agentDefaultId: string | null) {
    const showToast = jest.fn();
    const loadAll = jest.fn(async () => undefined);
    const args = { loadAll, setDefaults: jest.fn(), showToast, agentDefaultId } as UseModelActionsArgs;
    const hook = renderHook(() => useModelActions(args));
    const actions = hook.result.current as unknown as DriftActions;
    return { showToast, loadAll, hook, actions };
  }

  const calls = () => mockApiFetch.mock.calls as Array<[string, { method?: string; body?: string }?]>;
  const callsTo = (path: string) => calls().filter(([url]) => url === path);

  beforeEach(() => {
    mockApiFetch.mockResolvedValue({ data: { success: true, details: [], modelsImported: 1 } });
  });

  it("exports both handlers", () => {
    const { actions } = mount("reg-2");
    expect(typeof actions.handleDriftPull).toBe("function");
    expect(typeof actions.handleDriftPush).toBe("function");
  });

  it("a hermes-only pull re-imports from config, reloads and toasts 'Pulled from Hermes'", async () => {
    const { actions, loadAll, showToast } = mount("reg-2");
    await act(async () => {
      await actions.handleDriftPull!(HERMES_ONLY_LINE);
    });
    const imports = callsTo("/api/models/import");
    expect(imports).toHaveLength(1);
    expect(imports[0][1]?.method).toBe("POST");
    expect(callsTo("/api/models/defaults")).toHaveLength(0);
    expect(loadAll).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("Pulled from Hermes"), "success");
  });

  it("a primary pull with a registryId makes that row the agent default", async () => {
    const { actions, loadAll } = mount("reg-2");
    await act(async () => {
      await actions.handleDriftPull!(PRIMARY_LINE);
    });
    const puts = callsTo("/api/models/defaults");
    expect(puts).toHaveLength(1);
    expect(puts[0][1]?.method).toBe("PUT");
    expect(JSON.parse(String(puts[0][1]?.body))).toEqual({ taskType: "agent", modelId: "reg-1" });
    expect(callsTo("/api/models/import")).toHaveLength(0);
    expect(loadAll).toHaveBeenCalled();
  });

  it("a primary pull without a registryId falls back to the re-import", async () => {
    const { actions } = mount("reg-2");
    await act(async () => {
      await actions.handleDriftPull!({ ...PRIMARY_LINE, registryId: null });
    });
    expect(callsTo("/api/models/import")).toHaveLength(1);
    expect(callsTo("/api/models/defaults")).toHaveLength(0);
  });

  it("a push writes the agent default to config.yaml without the credential, and toasts 'Pushed to Hermes'", async () => {
    const { actions, loadAll, showToast } = mount("reg-2");
    await act(async () => {
      await actions.handleDriftPush!(PRIMARY_LINE);
    });
    const pushes = callsTo("/api/models/sync/push");
    expect(pushes).toHaveLength(1);
    expect(pushes[0][1]?.method).toBe("POST");
    expect(JSON.parse(String(pushes[0][1]?.body))).toEqual({ modelId: "reg-2", pushCredential: false });
    expect(loadAll).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("Pushed to Hermes"), "success");
  });

  it("a db-only push also pushes the agent default, never the line's own id when they differ", async () => {
    const { actions } = mount("reg-2");
    await act(async () => {
      await actions.handleDriftPush!(DB_ONLY_LINE);
    });
    const pushes = callsTo("/api/models/sync/push");
    expect(pushes).toHaveLength(1);
    expect(JSON.parse(String(pushes[0][1]?.body))).toEqual({ modelId: "reg-2", pushCredential: false });
  });

  it("never POSTs a push with a null modelId", async () => {
    const { actions, showToast } = mount(null);
    await act(async () => {
      await actions.handleDriftPush!(PRIMARY_LINE);
    });
    expect(callsTo("/api/models/sync/push")).toHaveLength(0);
    for (const [, init] of calls()) {
      if (!init?.body) continue;
      expect(JSON.parse(String(init.body))).not.toEqual(expect.objectContaining({ modelId: null }));
    }
    expect(showToast).not.toHaveBeenCalledWith(expect.stringContaining("Pushed to Hermes"), "success");
  });

  it("a refused push is an error toast, not 'Pushed to Hermes'", async () => {
    mockApiFetch.mockRejectedValue(new Error("config.yaml did not parse"));
    const { actions, showToast } = mount("reg-2");
    await act(async () => {
      await actions.handleDriftPush!(PRIMARY_LINE);
    });
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining("config.yaml did not parse"), "error");
    expect(showToast).not.toHaveBeenCalledWith(expect.stringContaining("Pushed to Hermes"), "success");
  });
});
